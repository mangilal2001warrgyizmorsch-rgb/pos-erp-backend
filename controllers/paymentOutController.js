import PaymentOut from '../models/PaymentOut.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import PartyLedger from '../models/PartyLedger.js';
import Supplier from '../models/Supplier.js';
import BankAccount from '../models/BankAccount.js';
import Purchase from '../models/Purchase.js';
import Counter from '../models/Counter.js';
import mongoose from 'mongoose';

// @desc    Create a new payment out
// @route   POST /api/payment-out
// @access  Private
export const createPaymentOut = async (req, res) => {
  try {
    const {
      partyId,
      amountPaid,
      paymentMode,
      cashBankAccountId,
      linkedPurchaseId,
      referenceNo,
      description,
      attachments,
      date
    } = req.body;

    const supplier = await Supplier.findById(partyId);
    if (!supplier) throw new Error('Supplier not found');

    // 1. Generate Receipt Number
    const counter = await Counter.findOneAndUpdate(
      { _id: 'paymentOut' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const receiptNo = `PAYOUT-${String(counter.seq).padStart(6, '0')}`;

    // 2. Create PaymentOut Record
    const paymentOut = await PaymentOut.create({
      receiptNo,
      partyId,
      partyName: supplier.name,
      amountPaid,
      paymentMode,
      cashBankAccountId,
      linkedPurchaseId,
      referenceNo,
      description,
      attachments,
      date: date || Date.now(),
      createdBy: req.user._id
    });

    // 3. Update Cash/Bank Balance
    let accountType = 'cash';
    if (cashBankAccountId) {
      accountType = 'bank';
      await BankAccount.findByIdAndUpdate(cashBankAccountId, { $inc: { currentBalance: -Number(amountPaid) } });
    }

    // 4. Create CashBankTransaction
    await CashBankTransaction.create({
      transactionNo: `TR-OUT-${receiptNo}`,
      type: 'payment_out',
      direction: 'out',
      amount: amountPaid,
      paymentMode,
      accountType,
      accountId: cashBankAccountId || undefined,
      partyId,
      partyType: 'Supplier',
      referenceModule: 'PaymentOut',
      referenceId: paymentOut._id,
      receiptNo,
      date: date || Date.now(),
      notes: description
    });

    // 5. Update Supplier Balance
    await Supplier.findByIdAndUpdate(partyId, { $inc: { outstandingBalance: -Number(amountPaid) } });


    // 6. Update Linked Purchase if any
    if (linkedPurchaseId) {
      const purchase = await Purchase.findById(linkedPurchaseId);
      if (purchase) {
        const newAmountPaid = (purchase.amountPaid || 0) + Number(amountPaid);
        let paymentStatus = 'partial';
        if (newAmountPaid >= purchase.totalAmount) {
          paymentStatus = 'paid';
        }
        await Purchase.findByIdAndUpdate(linkedPurchaseId, { 
          $set: { 
            amountPaid: newAmountPaid,
            paymentStatus: paymentStatus
          } 
        });

      }
    }


    // 7. Update PartyLedger
    const lastLedger = await PartyLedger.findOne({ partyId }).sort({ createdAt: -1 });
    const balanceAfter = (lastLedger ? lastLedger.balanceAfter : 0) - Number(amountPaid);

    await PartyLedger.create({
      partyId,
      partyType: 'Supplier',
      type: 'payment_out',
      debitAmount: amountPaid,
      balanceAfter,
      referenceId: paymentOut._id,
      receiptNo,
      date: date || Date.now(),
      notes: description
    });

    res.status(201).json({ success: true, data: paymentOut });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get all payment outs
// @route   GET /api/payment-out
// @access  Private
export const getPaymentOuts = async (req, res) => {
  try {
    const { startDate, endDate, partyId, paymentMode } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (partyId) query.partyId = partyId;
    if (paymentMode) query.paymentMode = paymentMode;

    const payments = await PaymentOut.find(query).sort('-date').populate('partyId', 'name phone');
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get payment out by ID
// @route   GET /api/payment-out/:id
// @access  Private
export const getPaymentOutById = async (req, res) => {
  try {
    const payment = await PaymentOut.findById(req.params.id).populate('partyId', 'name phone address').populate('linkedPurchaseId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete payment out
// @route   DELETE /api/payment-out/:id
// @access  Private
export const deletePaymentOut = async (req, res) => {
  try {
    const payment = await PaymentOut.findById(req.params.id);
    if (!payment) throw new Error('Payment record not found');

    // Reverse the logic
    if (payment.cashBankAccountId) {
      const bank = await BankAccount.findById(payment.cashBankAccountId);
      if (bank) {
        bank.currentBalance += payment.amountPaid;
        await bank.save();
      }
    }

    const supplier = await Supplier.findById(payment.partyId);
    if (supplier) {
      await Supplier.findByIdAndUpdate(payment.partyId, { $inc: { outstandingBalance: payment.amountPaid } });
    }


    if (payment.linkedPurchaseId) {
      const purchase = await Purchase.findById(payment.linkedPurchaseId);
      if (purchase) {
        purchase.amountPaid -= payment.amountPaid;
        if (purchase.amountPaid <= 0) {
          purchase.paymentStatus = 'pending';
        } else if (purchase.amountPaid < purchase.totalAmount) {
          purchase.paymentStatus = 'partial';
        }

        await purchase.save();
      }
    }

    await CashBankTransaction.deleteOne({ referenceId: payment._id });
    await PartyLedger.deleteOne({ referenceId: payment._id });
    await PaymentOut.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

