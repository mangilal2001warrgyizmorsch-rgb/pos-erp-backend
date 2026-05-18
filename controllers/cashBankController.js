import mongoose from 'mongoose';
import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js';
import {
  createCashBankTransaction,
  reverseTransactionService,
  getCashBankSummaryInternal,
  ensureDefaultAccounts
} from '../services/cashBankTransactionService.js';

// @desc    Get all cash & bank transactions with advanced filters
// @route   GET /api/cash-bank/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    const { type, direction, accountId, startDate, endDate, partyId, paymentMode, search } = req.query;
    let query = {};

    if (accountId && accountId !== 'All') {
      if (accountId === 'cash') {
        query.accountType = 'cash';
      } else if (mongoose.Types.ObjectId.isValid(accountId)) {
        query.accountId = accountId;
      }
    }
    if (type && type !== 'All') query.type = type;
    if (direction && direction !== 'All') {
      query.direction = direction.toLowerCase() === 'inflow' ? 'in' : 'out';
    }
    if (paymentMode && paymentMode !== 'All') query.paymentMode = paymentMode;
    if (partyId && partyId !== 'All') query.partyId = partyId;

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (search) {
      query.$or = [
        { transactionNo: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await CashBankTransaction.find(query)
      .sort({ createdAt: -1 })
      .populate('accountId', 'accountName accountNumber bankName');

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed transaction by ID
// @route   GET /api/cash-bank/transactions/:id
// @access  Private
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await CashBankTransaction.findById(req.params.id)
      .populate('accountId')
      .populate('createdBy', 'name email');
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get central cash and bank summary and cards data
// @route   GET /api/cash-bank/summary
// @access  Private
export const getSummary = async (req, res) => {
  try {
    const summary = await getCashBankSummaryInternal();
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all bank and cash accounts
// @route   GET /api/cash-bank/accounts
// @access  Private
export const getAccounts = async (req, res) => {
  try {
    await ensureDefaultAccounts();
    const accounts = await BankAccount.find();
    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create cash in / cash out manual adjustments
// @route   POST /api/cash-bank/cash-entry
// @access  Private
export const createCashEntry = async (req, res) => {
  try {
    const { entryType, amount, date, reason, notes, accountId } = req.body;
    
    if (!entryType || !amount) {
      return res.status(400).json({ success: false, message: 'Entry type and amount are required' });
    }

    const transaction = await createCashBankTransaction({
      date: date ? new Date(date) : new Date(),
      type: entryType === 'in' ? 'cash_in' : 'cash_out',
      direction: entryType,
      amount,
      paymentMode: 'Cash',
      accountType: 'cash',
      accountId,
      description: notes || reason || `Manual cash ${entryType}`,
      referenceModule: 'cash_entry',
      createdBy: req.user._id,
      metadata: { reason }
    });

    res.status(201).json({ success: true, data: transaction, message: 'Cash entry saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Transfer cash between cash-to-bank, bank-to-cash, or bank-to-bank accounts
// @route   POST /api/cash-bank/bank-transfer
// @access  Private
export const createBankTransfer = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const { fromAccountId, toAccountId, amount, date, notes } = req.body;

    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ success: false, message: 'Source, destination, and amount are required' });
    }

    const transferId = new mongoose.Types.ObjectId();

    // 1. Resolve source and destination accounts
    let fromAccount = await BankAccount.findById(fromAccountId).session(session);
    let toAccount = await BankAccount.findById(toAccountId).session(session);

    if (!fromAccount || !toAccount) {
      throw new Error('Source or Destination account not found');
    }

    // 2. Outflow from source account
    const sourceTx = await createCashBankTransaction({
      date: date ? new Date(date) : new Date(),
      type: 'bank_transfer_out',
      direction: 'out',
      amount,
      paymentMode: fromAccount.accountType === 'cash' ? 'Cash' : 'Bank',
      accountType: fromAccount.accountType,
      accountId: fromAccountId,
      description: notes || `Transfer to ${toAccount.accountName}`,
      referenceModule: 'bank_transfer',
      referenceId: transferId,
      referenceNo: 'TRF-' + Math.floor(Math.random() * 100000),
      createdBy: req.user._id,
      metadata: { transferId, toAccountId }
    }, session);

    // 3. Inflow to destination account
    const destTx = await createCashBankTransaction({
      date: date ? new Date(date) : new Date(),
      type: 'bank_transfer_in',
      direction: 'in',
      amount,
      paymentMode: toAccount.accountType === 'cash' ? 'Cash' : 'Bank',
      accountType: toAccount.accountType,
      accountId: toAccountId,
      description: notes || `Transfer from ${fromAccount.accountName}`,
      referenceModule: 'bank_transfer',
      referenceId: transferId,
      referenceNo: sourceTx.referenceNo,
      createdBy: req.user._id,
      metadata: { transferId, fromAccountId }
    }, session);

    if (session) {
      await session.commitTransaction();
    }

    res.status(201).json({
      success: true,
      data: { sourceTx, destTx },
      message: 'Bank transfer processed successfully'
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

// @desc    Reverse an active financial transaction
// @route   POST /api/cash-bank/transactions/:id/reverse
// @access  Private
export const reverseTransactionController = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const { reversalReason } = req.body;
    if (!reversalReason) {
      return res.status(400).json({ success: false, message: 'Reversal reason is required' });
    }

    const reversed = await reverseTransactionService(req.params.id, req.user._id, reversalReason, session);

    if (session) {
      await session.commitTransaction();
    }

    res.status(200).json({
      success: true,
      data: reversed,
      message: 'Transaction reversed successfully'
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

// @desc    Create a new Cash/Bank Account
// @route   POST /api/cash-bank/accounts
// @access  Private
export const createAccount = async (req, res) => {
  try {
    const { accountName, accountType, bankName, accountNumber, ifscCode, openingBalance } = req.body;

    if (!accountName || !accountType) {
      return res.status(400).json({ success: false, message: 'Account name and type are required' });
    }

    const newAccount = new BankAccount({
      accountName,
      accountType,
      bankName,
      accountNumber,
      ifscCode,
      openingBalance: Number(openingBalance) || 0,
      currentBalance: Number(openingBalance) || 0,
      createdBy: req.user._id
    });

    await newAccount.save();

    // Create a transaction log for opening balance if greater than 0
    if (Number(openingBalance) > 0) {
      await createCashBankTransaction({
        type: 'opening_cash',
        direction: 'in',
        amount: Number(openingBalance),
        paymentMode: accountType === 'cash' ? 'Cash' : 'Bank',
        accountType,
        accountId: newAccount._id,
        description: `Opening balance for ${accountName}`,
        createdBy: req.user._id
      });
    }

    res.status(201).json({ success: true, data: newAccount, message: 'Account created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update an account profile
// @route   PUT /api/cash-bank/accounts/:id
// @access  Private
export const updateAccount = async (req, res) => {
  try {
    const account = await BankAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const { accountName, bankName, accountNumber, ifscCode, status, isDefault } = req.body;

    if (accountName) account.accountName = accountName;
    if (bankName) account.bankName = bankName;
    if (accountNumber) account.accountNumber = accountNumber;
    if (ifscCode) account.ifscCode = ifscCode;
    if (status) account.status = status;
    
    if (isDefault !== undefined) {
      if (isDefault === true) {
        await BankAccount.updateMany({ accountType: account.accountType }, { isDefault: false });
      }
      account.isDefault = isDefault;
    }

    await account.save();
    res.status(200).json({ success: true, data: account, message: 'Account updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
