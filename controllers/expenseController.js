import Expense from '../models/Expense.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';

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

    const expenseData = {
      ...req.body,
      categoryName: req.body.category, // since it's a string
      createdBy: req.user._id,
    };
    
    const expense = await Expense.create(expenseData);

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
    });

    res.status(201).json({
      success: true,
      data: expense,
    });
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
    const cashBankAccountId = req.body.cashBankAccountId !== undefined ? req.body.cashBankAccountId : oldExpense.cashBankAccountId;

    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (paymentMethod && paymentMethod !== 'cash' && !cashBankAccountId) {
      return res.status(400).json({ success: false, message: 'Please select a bank account for non-cash expense' });
    }

    // Reverse old cash/bank transaction
    await reverseReferenceTransaction('expense', oldExpense._id, req.user._id, 'Expense updated');

    const expense = await Expense.findByIdAndUpdate(req.params.id, {
      ...req.body,
      categoryName: req.body.category || oldExpense.categoryName,
    }, {
      new: true,
      runValidators: true,
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
    });

    res.status(200).json({
      success: true,
      data: expense,
    });
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

    await Expense.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
