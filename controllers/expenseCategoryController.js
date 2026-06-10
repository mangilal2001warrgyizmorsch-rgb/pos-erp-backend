import ExpenseCategory from '../models/ExpenseCategory.js';

export const getExpenseCategories = async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const createExpenseCategory = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateExpenseCategory = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Expense category not found' });
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteExpenseCategory = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!category) {
      return res.status(404).json({ success: false, message: 'Expense category not found' });
    }
    res.status(200).json({ success: true, message: 'Expense category deleted successfully' });
  } catch (error) {
    next(error);
  }
};
