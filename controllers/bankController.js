import BankAccount from '../models/BankAccount.js';
import Transaction from '../models/Transaction.js';

// @desc    Create a new bank account
// @route   POST /api/bank
// @access  Private
export const createBankAccount = async (req, res) => {
  try {
    const { accountName, accountNumber, ifscCode, openingBalance } = req.body;
    
    const accountExists = await BankAccount.findOne({ accountNumber });
    if (accountExists) {
      return res.status(400).json({ success: false, message: 'Bank account already exists' });
    }

    const bankAccount = await BankAccount.create({
      accountName,
      accountNumber,
      ifscCode,
      openingBalance: Number(openingBalance),
      currentBalance: Number(openingBalance)
    });

    res.status(201).json({ success: true, data: bankAccount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all bank accounts
// @route   GET /api/bank
// @access  Private
export const getBankAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.find();
    res.status(200).json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new cash or bank transaction
// @route   POST /api/bank/transaction
// @access  Private
export const createTransaction = async (req, res) => {
  try {
    const { ledgerType, accountId, transactionType, amount, date, remarks } = req.body;

    const transaction = await Transaction.create({
      ledgerType,
      accountId: accountId || undefined,
      accountModel: accountId ? 'BankAccount' : undefined,
      transactionType,
      amount: Number(amount),
      date: date || Date.now(),
      remarks
    });

    // Update balances if necessary
    if (ledgerType === 'Bank' && accountId) {
      const bank = await BankAccount.findById(accountId);
      if (bank) {
        if (transactionType === 'Credit') {
          bank.currentBalance += Number(amount);
        } else {
          bank.currentBalance -= Number(amount);
        }
        await bank.save();
      }
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all transactions
// @route   GET /api/bank/transaction
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find().populate('accountId', 'accountName accountNumber').sort('-date');
    res.status(200).json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
