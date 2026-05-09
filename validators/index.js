import { body, validationResult } from 'express-validator';

// Handle validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// Auth validators
export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

export const loginValidator = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// Product validators
export const productValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Valid purchase price is required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Valid selling price is required'),
  body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
  validate,
];

// Customer validators
export const customerValidator = [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validate,
];

// Category validators
export const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  validate,
];

// Sale validators
export const saleValidator = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').notEmpty().withMessage('Product ID is required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required for each item'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Valid subtotal is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount is required'),
  body('paymentMethod').isIn(['cash', 'card', 'upi']).withMessage('Valid payment method is required'),
  validate,
];
