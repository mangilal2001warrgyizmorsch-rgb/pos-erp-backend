import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js';

// @desc    Get all cash & bank transactions
// @route   GET /api/cash-bank/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    const { accountId, type, startDate, endDate, limit = 50 } = req.query;
    let query = {};

    if (accountId) query.accountId = accountId;
    if (type) query.type = type;
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const transactions = await CashBankTransaction.find(query)
      .sort('-date')
      .limit(Number(limit))
      .populate('accountId', 'accountName');

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get summary of cash and bank balances
// @route   GET /api/cash-bank/summary
// @access  Private
export const getSummary = async (req, res) => {
  try {
    const banks = await BankAccount.find();
    const totalBankBalance = banks.reduce((sum, b) => sum + b.currentBalance, 0);
    
    // For cash, we sum all 'cash' type transactions or assume a base cash account
    // Since we don't have a CashAccount model, we sum the direction in/out for 'cash' accountType
    const cashIn = await CashBankTransaction.aggregate([
      { $match: { accountType: 'cash', direction: 'in' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const cashOut = await CashBankTransaction.aggregate([
      { $match: { accountType: 'cash', direction: 'out' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const cashBalance = (cashIn[0]?.total || 0) - (cashOut[0]?.total || 0);

    res.status(200).json({
      success: true,
      data: {
        cashBalance,
        totalBankBalance,
        banks
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
