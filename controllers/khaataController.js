import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PartyLedger from '../models/PartyLedger.js';
import ReminderLog from '../models/ReminderLog.js';
import mongoose from 'mongoose';

// @desc    Get all parties (customers & suppliers) with their accounting khaata balances
// @route   GET /api/khaata/balances
// @access  Private
export const getKhaataBalances = async (req, res, next) => {
  try {
    const [customers, suppliers] = await Promise.all([
      Customer.find({}).populate('accountingLedgerId', 'currentBalance currentBalanceType'),
      Supplier.find({}).populate('accountingLedgerId', 'currentBalance currentBalanceType')
    ]);

    const formatParty = (party, partyType) => {
      let balance = 0;
      if (party.accountingLedgerId) {
        balance = party.accountingLedgerId.currentBalanceType === 'DEBIT' 
          ? party.accountingLedgerId.currentBalance 
          : -party.accountingLedgerId.currentBalance;
      }
      return {
        _id: party._id,
        name: party.name,
        phone: party.phone,
        partyType,
        currentBalance: balance, // Positive = Receivable (Debit), Negative = Payable (Credit)
        creditDays: party.creditDays || 0,
        lastReminderSentAt: party.lastReminderSentAt || null,
        isAutoReminderEnabled: party.isAutoReminderEnabled || false
      };
    };

    const parties = [
      ...customers.map(c => formatParty(c, 'customer')),
      ...suppliers.map(s => formatParty(s, 'supplier'))
    ];

    // Sort by largest absolute balance first, so active accounts are at top
    parties.sort((a, b) => Math.abs(b.currentBalance) - Math.abs(a.currentBalance));
    
    res.status(200).json({ success: true, count: parties.length, data: parties });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ledger transactions for a specific customer
// @route   GET /api/khaata/:customerId/transactions
// @access  Private
export const getKhaataTransactions = async (req, res, next) => {
  try {
    const transactions = await PartyLedger.find({ 
      partyId: req.params.customerId,
      partyType: 'Customer'
    })
    .sort({ date: -1, createdAt: -1 });

    res.status(200).json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
};

import PaymentIn from '../models/PaymentIn.js';
import PaymentOut from '../models/PaymentOut.js';
import { postPaymentInAccountingVoucher, postPaymentOutAccountingVoucher } from '../services/accounting/paymentAccounting.service.js';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';

// @desc    Add manual transaction (Payment Receivable or Payment Payable)
// @route   POST /api/khaata/:partyId/transaction
// @access  Private
export const addKhaataTransaction = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, type, notes, date, partyType, paymentMode = 'Cash' } = req.body;
    
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const isCustomer = partyType === 'customer';
    const PartyModel = isCustomer ? Customer : Supplier;
    const party = await PartyModel.findById(req.params.partyId).session(session);
    
    if (!party) {
      throw new Error('Party not found');
    }

    let transactionLog;
    const now = date || Date.now();

    if (type === 'payment_in' && isCustomer) {
      // Receive Payment from Customer
      const receiptNo = await generateSequenceNumber('PAYIN', session);
      const paymentIn = new PaymentIn({
        receiptNo,
        partyId: party._id,
        partyName: party.name,
        amountReceived: amount,
        paymentMode,
        description: notes || 'Received via Digital Khaata',
        date: now,
        createdBy: req.user?._id
      });
      await paymentIn.save({ session });
      
      // Post to accounting
      await postPaymentInAccountingVoucher(paymentIn, { session, createdBy: req.user?._id, source: 'khaata' });
      
      transactionLog = await PartyLedger.create([{
        partyId: party._id,
        partyType: 'Customer',
        type: 'payment_in',
        creditAmount: amount,
        date: now,
        notes: notes || `Payment In: ${receiptNo}`,
        receiptNo,
        status: 'paid'
      }], { session });

    } else if (type === 'payment_out' && !isCustomer) {
      // Make Payment to Supplier
      const receiptNo = await generateSequenceNumber('PAYOUT', session);
      const paymentOut = new PaymentOut({
        receiptNo,
        partyId: party._id,
        partyName: party.name,
        amountPaid: amount,
        paymentMode,
        description: notes || 'Paid via Digital Khaata',
        date: now,
        createdBy: req.user?._id
      });
      await paymentOut.save({ session });
      
      // Post to accounting
      await postPaymentOutAccountingVoucher(paymentOut, { session, createdBy: req.user?._id, source: 'khaata' });
      
      transactionLog = await PartyLedger.create([{
        partyId: party._id,
        partyType: 'Supplier',
        type: 'payment_out',
        debitAmount: amount,
        date: now,
        notes: notes || `Payment Out: ${receiptNo}`,
        receiptNo,
        status: 'paid'
      }], { session });
    } else {
      throw new Error('Invalid transaction type for party');
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: transactionLog ? transactionLog[0] : null });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// @desc    Log and initiate WhatsApp reminder
// @route   POST /api/khaata/:partyId/remind
// @access  Private
export const logAndSendReminder = async (req, res, next) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const partyId = req.params.partyId;
    let isCustomer = true;
    let party = await Customer.findById(partyId);
    
    if (!party) {
      party = await Supplier.findById(partyId);
      isCustomer = false;
    }

    if (!party) {
      return res.status(404).json({ success: false, message: 'Party not found' });
    }

    if (isCustomer) {
      await ReminderLog.create({
        customerId: party._id,
        message,
        status: 'sent'
      });
    }

    // Update customer last reminded time
    party.lastReminderSentAt = Date.now();
    await party.save();

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reminder history for a customer
// @route   GET /api/khaata/:partyId/reminders
// @access  Private
export const getReminderLogs = async (req, res, next) => {
  try {
    const logs = await ReminderLog.find({ customerId: req.params.partyId })
      .sort({ sentAt: -1 });

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
};
