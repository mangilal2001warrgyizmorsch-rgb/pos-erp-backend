import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import AccountGroup from '../models/accounting/AccountGroup.model.js';
import Ledger from '../models/accounting/Ledger.model.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';
import { postIncomeExpenseAccountingVoucher, markExpenseAccountingFailure, getOrCreateIncomeExpenseLedger } from '../services/accounting/expenseAccounting.service.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';
import { createAuditLog } from '../services/auditLog.service.js';

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

/**
 * Calculate GST amounts from base amount and rate
 */
const calculateGSTAmounts = (amount, gstRate, gstApplicable) => {
  const baseAmount = Number(amount) || 0;
  if (!gstApplicable || !gstRate || gstRate <= 0) {
    return {
      taxableAmount: baseAmount,
      gstAmount: 0,
      totalAmount: baseAmount,
    };
  }
  const taxableAmount = roundMoney(baseAmount);
  const gstAmount = roundMoney(taxableAmount * (gstRate / 100));
  const totalAmount = roundMoney(taxableAmount + gstAmount);
  return { taxableAmount, gstAmount, totalAmount };
};

// @desc    Create expense or income entry
// @route   POST /api/expenses
export const createExpense = async (req, res, next) => {
  try {
    const { amount, paymentMethod, cashBankAccountId, title, entryType, nature } = req.body;
    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const pMethod = paymentMethod || 'cash';
    const accountId = (req.body.cashBankAccountId && String(req.body.cashBankAccountId).trim() !== '')
      ? req.body.cashBankAccountId
      : (req.body.paymentAccountId && String(req.body.paymentAccountId).trim() !== '')
        ? req.body.paymentAccountId
        : undefined;

    if (pMethod !== 'cash' && !accountId) {
      return res.status(400).json({ success: false, message: 'Please select a bank account for non-cash payment' });
    }

    // Calculate GST amounts
    const gstApplicable = req.body.gstApplicable || false;
    const gstRate = gstApplicable ? (Number(req.body.gstRate) || 0) : 0;
    const gstAmounts = calculateGSTAmounts(amount, gstRate, gstApplicable);

    const expenseData = {
      ...req.body,
      entryType: entryType || 'expense',
      nature: nature || 'indirect',
      amount: Number(amount),
      categoryName: req.body.ledgerName || req.body.category || req.body.title,
      category: req.body.ledgerName || req.body.category || '',
      cashBankAccountId: accountId,
      paymentAccountId: accountId,
      gstApplicable,
      gstRate,
      taxableAmount: gstAmounts.taxableAmount,
      gstAmount: gstAmounts.gstAmount,
      totalAmount: gstAmounts.totalAmount,
      status: 'active',
      createdBy: req.user._id,
    };

    const isIncome = expenseData.entryType === 'income';
    const direction = isIncome ? 'in' : 'out';
    const txType = isIncome ? 'income' : 'expense';

    // Use a DB transaction when accounting auto-posting is enabled to ensure atomicity
    const session = await mongoose.startSession();
    try {
      let createdExpense;
      try {
        await session.withTransaction(async () => {
          const [doc] = await Expense.create([expenseData], { session });
          createdExpense = doc;

          // Create central cash bank transaction log and update balance
          const accountType = createdExpense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: createdExpense.date || new Date(),
            type: txType,
            direction,
            amount: createdExpense.totalAmount || createdExpense.amount,
            paymentMode: createdExpense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: createdExpense.cashBankAccountId || undefined,
            description: createdExpense.description || `${isIncome ? 'Income' : 'Expense'}: ${createdExpense.title}`,
            referenceModule: txType,
            referenceId: createdExpense._id,
            referenceNo: createdExpense.reference || undefined,
            createdBy: req.user._id
          }, session);

          // Attempt accounting posting
          await postIncomeExpenseAccountingVoucher(createdExpense, { createdBy: req.user._id }, { session });
        });
      } catch (err) {
        const message = String(err?.message || "");
        const isTxnUnsupported = message.includes("Transaction numbers are only allowed on a replica set member or mongos")
          || message.includes("This MongoDB deployment does not support retryable writes");

        if (isTxnUnsupported) {
          // Fallback to non-transactional flow for standalone MongoDB
          console.warn('Transactions not supported, falling back to non-transactional create.');
          createdExpense = await Expense.create(expenseData);

          const accountType = createdExpense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: createdExpense.date || new Date(),
            type: txType,
            direction,
            amount: createdExpense.totalAmount || createdExpense.amount,
            paymentMode: createdExpense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: createdExpense.cashBankAccountId || undefined,
            description: createdExpense.description || `${isIncome ? 'Income' : 'Expense'}: ${createdExpense.title}`,
            referenceModule: txType,
            referenceId: createdExpense._id,
            referenceNo: createdExpense.reference || undefined,
            createdBy: req.user._id
          });

          try {
            await postIncomeExpenseAccountingVoucher(createdExpense, { createdBy: req.user._id });
          } catch (acctErr) {
            console.error('Accounting posting failed (standalone fallback):', acctErr);
            await markExpenseAccountingFailure(createdExpense._id, acctErr);
          }
        } else {
          throw err;
        }
      }

      // Audit log
      await createAuditLog({
        userId: req.user._id,
        action: isIncome ? 'INCOME_CREATED' : 'EXPENSE_CREATED',
        module: 'expense',
        referenceId: createdExpense._id,
        description: `${isIncome ? 'Income' : 'Expense'} created: ${createdExpense.title} - ₹${createdExpense.totalAmount || createdExpense.amount}`,
      });

      res.status(201).json({ success: true, data: createdExpense });
    } catch (err) {
      try {
        if (err?.expenseId) {
          await markExpenseAccountingFailure(err.expenseId, err);
        }
      } catch (inner) {
        console.error('Failed to mark accounting failure:', inner);
      }
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all expenses/income entries
// @route   GET /api/expenses
export const getExpenses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, startDate, endDate, entryType, nature, status, search, ledgerId } = req.query;

    const query = {};

    // Filter by entry type
    if (entryType && entryType !== 'all') query.entryType = entryType;

    // Filter by nature
    if (nature && nature !== 'all') query.nature = nature;

    // Filter by status - default to active only
    if (status && status !== 'all') {
      query.status = status;
    } else {
      query.status = { $ne: 'cancelled' };
    }

    if (category) query.category = category;
    if (ledgerId) query.ledgerId = ledgerId;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { ledgerName: searchRegex },
        { categoryName: searchRegex },
        { reference: searchRegex },
      ];
    }

    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense summary report
// @route   GET /api/expenses/reports/summary
export const getExpenseSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'category', entryType } = req.query;
    const match = { status: { $ne: 'cancelled' } };

    if (entryType && entryType !== 'all') match.entryType = entryType;

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    let groupId;
    if (groupBy === 'date' || groupBy === 'month') {
      groupId = { $dateToString: { format: dateFormat, date: '$date' } };
    } else if (groupBy === 'entryType') {
      groupId = { entryType: '$entryType', nature: '$nature' };
    } else {
      groupId = '$category';
    }

    const report = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          totalAmount: { $sum: '$totalAmount' },
          taxableAmount: { $sum: '$taxableAmount' },
          gstAmount: { $sum: '$gstAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const [summary] = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          taxableAmount: { $sum: '$taxableAmount' },
          gstAmount: { $sum: '$gstAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        report,
        summary: summary || { totalAmount: 0, taxableAmount: 0, gstAmount: 0, count: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
export const getExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('createdBy', 'name');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update expense/income
// @route   PUT /api/expenses/:id
export const updateExpense = async (req, res, next) => {
  try {
    const oldExpense = await Expense.findById(req.params.id);
    if (!oldExpense) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    const title = req.body.title !== undefined ? req.body.title : oldExpense.title;
    const amount = req.body.amount !== undefined ? req.body.amount : oldExpense.amount;
    const paymentMethod = req.body.paymentMethod !== undefined ? req.body.paymentMethod : oldExpense.paymentMethod;
    const accountId = (req.body.cashBankAccountId !== undefined && String(req.body.cashBankAccountId).trim() !== '')
      ? req.body.cashBankAccountId
      : (req.body.paymentAccountId !== undefined && String(req.body.paymentAccountId).trim() !== '')
        ? req.body.paymentAccountId
        : oldExpense.cashBankAccountId;

    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (paymentMethod && paymentMethod !== 'cash' && !accountId) {
      return res.status(400).json({ success: false, message: 'Please select a bank account for non-cash payment' });
    }

    // Calculate GST amounts
    const gstApplicable = req.body.gstApplicable !== undefined ? req.body.gstApplicable : oldExpense.gstApplicable;
    const gstRate = gstApplicable ? (Number(req.body.gstRate ?? oldExpense.gstRate) || 0) : 0;
    const gstAmounts = calculateGSTAmounts(amount, gstRate, gstApplicable);

    const entryType = req.body.entryType || oldExpense.entryType || 'expense';
    const isIncome = entryType === 'income';
    const direction = isIncome ? 'in' : 'out';
    const txType = isIncome ? 'income' : 'expense';
    const oldTxType = (oldExpense.entryType || 'expense') === 'income' ? 'income' : 'expense';

    const session = await mongoose.startSession();
    try {
      let expense;
      try {
        await session.withTransaction(async () => {
          // Reverse old transaction
          await reverseReferenceTransaction(oldTxType, oldExpense._id, req.user._id, 'Entry updated', session);
          if (oldExpense.accountingVoucherId) {
            await cancelVoucher(oldExpense.accountingVoucherId, `Entry ${oldExpense.title} updated`, req.user._id, { session });
          }

          const updatePayload = {
            ...req.body,
            entryType,
            nature: req.body.nature || oldExpense.nature || 'indirect',
            categoryName: req.body.ledgerName || req.body.category || oldExpense.categoryName,
            cashBankAccountId: String(accountId || '').trim() === '' ? undefined : accountId,
            paymentAccountId: String(accountId || '').trim() === '' ? undefined : accountId,
            gstApplicable,
            gstRate,
            taxableAmount: gstAmounts.taxableAmount,
            gstAmount: gstAmounts.gstAmount,
            totalAmount: gstAmounts.totalAmount,
            accountingVoucherId: undefined,
            accountingPosted: false,
            accountingStatus: 'not_posted',
            accountingError: '',
          };

          expense = await Expense.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true,
            session,
          });

          // Create cash bank transaction with new values
          const accountType = expense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: expense.date || new Date(),
            type: txType,
            direction,
            amount: expense.totalAmount || expense.amount,
            paymentMode: expense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: expense.cashBankAccountId || undefined,
            description: expense.description || `${isIncome ? 'Income' : 'Expense'}: ${expense.title}`,
            referenceModule: txType,
            referenceId: expense._id,
            referenceNo: expense.reference || undefined,
            createdBy: req.user._id
          }, session);

          // Attempt accounting posting for updated entry
          await postIncomeExpenseAccountingVoucher(expense, { createdBy: req.user._id }, { session });
        });
      } catch (err) {
        const message = String(err?.message || "");
        const isTxnUnsupported = message.includes("Transaction numbers are only allowed on a replica set member or mongos")
          || message.includes("This MongoDB deployment does not support retryable writes");

        if (isTxnUnsupported) {
          console.warn('Transactions not supported, falling back to non-transactional update.');

          await reverseReferenceTransaction(oldTxType, oldExpense._id, req.user._id, 'Entry updated');
          if (oldExpense.accountingVoucherId) {
            await cancelVoucher(oldExpense.accountingVoucherId, `Entry ${oldExpense.title} updated`, req.user._id);
          }

          const updatePayload = {
            ...req.body,
            entryType,
            nature: req.body.nature || oldExpense.nature || 'indirect',
            categoryName: req.body.ledgerName || req.body.category || oldExpense.categoryName,
            cashBankAccountId: String(accountId || '').trim() === '' ? undefined : accountId,
            paymentAccountId: String(accountId || '').trim() === '' ? undefined : accountId,
            gstApplicable,
            gstRate,
            taxableAmount: gstAmounts.taxableAmount,
            gstAmount: gstAmounts.gstAmount,
            totalAmount: gstAmounts.totalAmount,
            accountingVoucherId: undefined,
            accountingPosted: false,
            accountingStatus: 'not_posted',
            accountingError: '',
          };

          expense = await Expense.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });

          const accountType = expense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: expense.date || new Date(),
            type: txType,
            direction,
            amount: expense.totalAmount || expense.amount,
            paymentMode: expense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: expense.cashBankAccountId || undefined,
            description: expense.description || `${isIncome ? 'Income' : 'Expense'}: ${expense.title}`,
            referenceModule: txType,
            referenceId: expense._id,
            referenceNo: expense.reference || undefined,
            createdBy: req.user._id
          });

          try {
            await postIncomeExpenseAccountingVoucher(expense, { createdBy: req.user._id });
          } catch (acctErr) {
            console.error('Accounting posting failed (standalone fallback update):', acctErr);
            await markExpenseAccountingFailure(expense._id, acctErr);
          }
        } else {
          throw err;
        }
      }

      // Audit log
      await createAuditLog({
        userId: req.user._id,
        action: isIncome ? 'INCOME_UPDATED' : 'EXPENSE_UPDATED',
        module: 'expense',
        referenceId: expense._id,
        description: `${isIncome ? 'Income' : 'Expense'} updated: ${expense.title}`,
      });

      res.status(200).json({ success: true, data: expense });
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Cancel expense
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    const isIncome = (expense.entryType || 'expense') === 'income';
    const txType = isIncome ? 'income' : 'expense';

    // Reverse the cash/bank transaction
    await reverseReferenceTransaction(txType, expense._id, req.user._id, 'Entry deleted');
    if (expense.accountingVoucherId) {
      await cancelVoucher(expense.accountingVoucherId, `${isIncome ? 'Income' : 'Expense'} ${expense.title} deleted`, req.user._id);
    }

    // Soft delete: mark as cancelled
    expense.status = 'cancelled';
    expense.accountingPosted = false;
    expense.accountingStatus = 'not_posted';
    await expense.save();

    // Audit log
    await createAuditLog({
      userId: req.user._id,
      action: isIncome ? 'INCOME_DELETED' : 'EXPENSE_DELETED',
      module: 'expense',
      referenceId: expense._id,
      description: `${isIncome ? 'Income' : 'Expense'} cancelled: ${expense.title} - ₹${expense.totalAmount || expense.amount}`,
    });

    res.status(200).json({
      success: true,
      message: 'Entry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ledgers by group code for dropdown
// @route   GET /api/expenses/ledgers
export const getExpenseLedgers = async (req, res, next) => {
  try {
    const { group } = req.query;
    if (!group) {
      return res.status(400).json({ success: false, message: 'Group code is required' });
    }

    const accountGroup = await AccountGroup.findOne({ code: group, isActive: true });
    if (!accountGroup) {
      return res.status(404).json({ success: false, message: 'Account group not found' });
    }

    const ledgers = await Ledger.find({ groupId: accountGroup._id, isActive: true })
      .select('name code ledgerType')
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    next(error);
  }
};

// @desc    Quick create a ledger under correct group
// @route   POST /api/expenses/ledgers/quick-create
export const quickCreateLedger = async (req, res, next) => {
  try {
    const { name, groupCode, entryType, nature } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Ledger name is required' });
    }

    const resolvedEntryType = entryType || 'expense';
    const resolvedNature = nature || 'indirect';

    const ledger = await getOrCreateIncomeExpenseLedger(
      name,
      resolvedEntryType,
      resolvedNature,
      null,
      req.user._id,
    );

    res.status(201).json({ success: true, data: ledger });
  } catch (error) {
    next(error);
  }
};
