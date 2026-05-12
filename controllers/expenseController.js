import Expense from '../models/Expense.js';

// @desc    Create expense
// @route   POST /api/expenses
export const createExpense = async (req, res, next) => {
  try {
    const expenseData = {
      ...req.body,
      categoryName: req.body.category, // since it's a string
      createdBy: req.user._id,
    };
    
    const expense = await Expense.create(expenseData);
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
      .sort('-date')
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
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

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

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
