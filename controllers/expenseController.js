import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';
import { postExpenseAccountingVoucher, markExpenseAccountingFailure } from '../services/accounting/expenseAccounting.service.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';

// @desc    Create expense
// @route   POST /api/expenses
export const createExpense = async (req, res, next) => {
  try {
    const { amount, paymentMethod, cashBankAccountId, title } = req.body;
    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (paymentMethod && paymentMethod !== 'cash' && !cashBankAccountId) {
      return res.status(400).json({ success: false, message: 'Please select a bank account for non-cash expense' });
    }

    const cashBankAccountIdClean = (req.body.cashBankAccountId && String(req.body.cashBankAccountId).trim() !== '')
      ? req.body.cashBankAccountId
      : undefined;

    const expenseData = {
      ...req.body,
      categoryName: req.body.category, // since it's a string
      cashBankAccountId: cashBankAccountIdClean,
      createdBy: req.user._id,
    };

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
            type: 'expense',
            direction: 'out',
            amount: createdExpense.amount,
            paymentMode: createdExpense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: createdExpense.cashBankAccountId || undefined,
            description: createdExpense.description || `Expense: ${createdExpense.title}`,
            referenceModule: 'expense',
            referenceId: createdExpense._id,
            referenceNo: createdExpense.reference || undefined,
            createdBy: req.user._id
          }, session);

          // Attempt accounting posting (will be skipped if accounting disabled)
          await postExpenseAccountingVoucher(createdExpense, { createdBy: req.user._id }, { session });
        });
      } catch (err) {
        const message = String(err?.message || "");
        const isTxnUnsupported = message.includes("Transaction numbers are only allowed on a replica set member or mongos")
          || message.includes("This MongoDB deployment does not support retryable writes");

        if (isTxnUnsupported) {
          // Fallback to non-transactional flow for standalone MongoDB
          console.warn('Transactions not supported by MongoDB deployment, falling back to non-transactional expense create.');
          createdExpense = await Expense.create(expenseData);

          const accountType = createdExpense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: createdExpense.date || new Date(),
            type: 'expense',
            direction: 'out',
            amount: createdExpense.amount,
            paymentMode: createdExpense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: createdExpense.cashBankAccountId || undefined,
            description: createdExpense.description || `Expense: ${createdExpense.title}`,
            referenceModule: 'expense',
            referenceId: createdExpense._id,
            referenceNo: createdExpense.reference || undefined,
            createdBy: req.user._id
          });

          // Try accounting posting without session
          try {
            await postExpenseAccountingVoucher(createdExpense, { createdBy: req.user._id });
          } catch (acctErr) {
            console.error('Expense accounting posting failed (standalone fallback):', acctErr);
            await markExpenseAccountingFailure(createdExpense._id, acctErr);
          }
        } else {
          throw err;
        }
      }

      res.status(201).json({ success: true, data: createdExpense });
    } catch (err) {
      // If posting failed inside transaction, try to mark failure (best-effort outside txn)
      try {
        if (err?.expenseId) {
          await markExpenseAccountingFailure(err.expenseId, err);
        }
      } catch (inner) {
        console.error('Failed to mark expense accounting failure:', inner);
      }
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all expenses
// @route   GET /api/expenses
export const getExpenses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, startDate, endDate } = req.query;

    const query = {};

    if (category) query.category = category;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
    const { startDate, endDate, groupBy = 'category' } = req.query;
    const match = {};

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const groupId = groupBy === 'date' || groupBy === 'month'
      ? { $dateToString: { format: dateFormat, date: '$date' } }
      : '$category';

    const report = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          totalAmount: { $sum: '$amount' },
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
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        report,
        summary: summary || { totalAmount: 0, count: 0 },
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
        message: 'Expense not found',
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

// @desc    Update expense
// @route   PUT /api/expenses/:id
export const updateExpense = async (req, res, next) => {
  try {
    const oldExpense = await Expense.findById(req.params.id);
    if (!oldExpense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    const title = req.body.title !== undefined ? req.body.title : oldExpense.title;
    const amount = req.body.amount !== undefined ? req.body.amount : oldExpense.amount;
    const paymentMethod = req.body.paymentMethod !== undefined ? req.body.paymentMethod : oldExpense.paymentMethod;
    const cashBankAccountId = (req.body.cashBankAccountId !== undefined && String(req.body.cashBankAccountId).trim() !== '')
      ? req.body.cashBankAccountId
      : oldExpense.cashBankAccountId;

    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (paymentMethod && paymentMethod !== 'cash' && !cashBankAccountId) {
      return res.status(400).json({ success: false, message: 'Please select a bank account for non-cash expense' });
    }

    const session = await mongoose.startSession();
    try {
      let expense;
      try {
        await session.withTransaction(async () => {
          await reverseReferenceTransaction('expense', oldExpense._id, req.user._id, 'Expense updated', session);
          if (oldExpense.accountingVoucherId) {
            await cancelVoucher(oldExpense.accountingVoucherId, `Expense ${oldExpense.title} updated`, req.user._id, { session });
          }

          const updatePayload = {
            ...req.body,
            categoryName: req.body.category || oldExpense.categoryName,
            accountingVoucherId: undefined,
            accountingPosted: false,
            accountingStatus: 'not_posted',
            accountingError: '',
          };
          if (req.body.cashBankAccountId !== undefined) {
            updatePayload.cashBankAccountId = String(req.body.cashBankAccountId).trim() === '' ? undefined : req.body.cashBankAccountId;
          }

          expense = await Expense.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true,
            session,
          });

          // Create central cash bank transaction log and update balance
          const accountType = expense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: expense.date || new Date(),
            type: 'expense',
            direction: 'out',
            amount: expense.amount,
            paymentMode: expense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: expense.cashBankAccountId || undefined,
            description: expense.description || `Expense: ${expense.title}`,
            referenceModule: 'expense',
            referenceId: expense._id,
            referenceNo: expense.reference || undefined,
            createdBy: req.user._id
          }, session);

          // Attempt accounting posting for updated expense
          await postExpenseAccountingVoucher(expense, { createdBy: req.user._id }, { session });
        });
      } catch (err) {
        const message = String(err?.message || "");
        const isTxnUnsupported = message.includes("Transaction numbers are only allowed on a replica set member or mongos")
          || message.includes("This MongoDB deployment does not support retryable writes");

        if (isTxnUnsupported) {
          console.warn('Transactions not supported by MongoDB deployment, falling back to non-transactional expense update.');

          await reverseReferenceTransaction('expense', oldExpense._id, req.user._id, 'Expense updated');
          if (oldExpense.accountingVoucherId) {
            await cancelVoucher(oldExpense.accountingVoucherId, `Expense ${oldExpense.title} updated`, req.user._id);
          }

          const updatePayload = {
            ...req.body,
            categoryName: req.body.category || oldExpense.categoryName,
            accountingVoucherId: undefined,
            accountingPosted: false,
            accountingStatus: 'not_posted',
            accountingError: '',
          };
          if (req.body.cashBankAccountId !== undefined) {
            updatePayload.cashBankAccountId = String(req.body.cashBankAccountId).trim() === '' ? undefined : req.body.cashBankAccountId;
          }

          expense = await Expense.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });

          const accountType = expense.paymentMethod === 'cash' ? 'cash' : 'bank';
          await createCashBankTransaction({
            date: expense.date || new Date(),
            type: 'expense',
            direction: 'out',
            amount: expense.amount,
            paymentMode: expense.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            accountType,
            accountId: expense.cashBankAccountId || undefined,
            description: expense.description || `Expense: ${expense.title}`,
            referenceModule: 'expense',
            referenceId: expense._id,
            referenceNo: expense.reference || undefined,
            createdBy: req.user._id
          });

          try {
            await postExpenseAccountingVoucher(expense, { createdBy: req.user._id });
          } catch (acctErr) {
            console.error('Expense accounting posting failed (standalone fallback update):', acctErr);
            await markExpenseAccountingFailure(expense._id, acctErr);
          }
        } else {
          throw err;
        }
      }

      res.status(200).json({ success: true, data: expense });
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    // Reverse the cash/bank transaction
    await reverseReferenceTransaction('expense', expense._id, req.user._id, 'Expense deleted');
    if (expense.accountingVoucherId) {
      await cancelVoucher(expense.accountingVoucherId, `Expense ${expense.title} deleted`, req.user._id);
    }

    await Expense.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
