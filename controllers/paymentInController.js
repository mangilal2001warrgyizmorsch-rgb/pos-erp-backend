import PaymentIn from '../models/PaymentIn.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import PartyLedger from '../models/PartyLedger.js';
import Customer from '../models/Customer.js';
import BankAccount from '../models/BankAccount.js';
import Sale from '../models/Sale.js';
import Counter from '../models/Counter.js';
import mongoose from 'mongoose';

// @desc    Create a new payment in
// @route   POST /api/payment-in
// @access  Private
export const createPaymentIn = async (req, res) => {
  try {
    const {
      partyId,
      amountReceived,
      paymentMode,
      cashBankAccountId,
      linkedInvoiceId,
      referenceNo,
      description,
      attachments,
      date
    } = req.body;

    const customer = await Customer.findById(partyId);
    if (!customer) throw new Error('Customer not found');

    // 1. Generate Receipt Number
    const counter = await Counter.findOneAndUpdate(
      { _id: 'paymentIn' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const receiptNo = `PAYIN-${String(counter.seq).padStart(6, '0')}`;

    // 2. Create PaymentIn Record
    const paymentIn = await PaymentIn.create({
      receiptNo,
      partyId,
      partyName: customer.name,
      amountReceived,
      paymentMode,
      cashBankAccountId,
      linkedInvoiceId,
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
      await BankAccount.findByIdAndUpdate(cashBankAccountId, { $inc: { currentBalance: Number(amountReceived) } });
    }

    // 4. Create CashBankTransaction
    await CashBankTransaction.create({
      transactionNo: `TR-IN-${receiptNo}`,
      type: 'payment_in',
      direction: 'in',
      amount: amountReceived,
      paymentMode,
      accountType,
      accountId: cashBankAccountId || undefined,
      partyId,
      partyType: 'Customer',
      referenceModule: 'PaymentIn',
      referenceId: paymentIn._id,
      receiptNo,
      date: date || Date.now(),
      notes: description
    });

    // 5. Update Customer Balance
    await Customer.findByIdAndUpdate(partyId, { $inc: { walletBalance: Number(amountReceived) } });


    // 6. Update Linked Invoice if any
    if (linkedInvoiceId) {
      const sale = await Sale.findById(linkedInvoiceId);
      if (sale) {
        const newAmountPaid = (sale.amountPaid || 0) + Number(amountReceived);
        let paymentStatus = 'partial';
        if (newAmountPaid >= sale.totalAmount) {
          paymentStatus = 'paid';
        }
        await Sale.findByIdAndUpdate(linkedInvoiceId, { 
          $set: { 
            amountPaid: newAmountPaid,
            paymentStatus: paymentStatus
          } 
        });

      }
    }


    // 7. Update PartyLedger
    const lastLedger = await PartyLedger.findOne({ partyId }).sort({ createdAt: -1 });
    const balanceAfter = (lastLedger ? lastLedger.balanceAfter : 0) - Number(amountReceived);

    await PartyLedger.create({
      partyId,
      partyType: 'Customer',
      type: 'payment_in',
      creditAmount: amountReceived,
      balanceAfter,
      referenceId: paymentIn._id,
      receiptNo,
      date: date || Date.now(),
      notes: description
    });

    res.status(201).json({ success: true, data: paymentIn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get all payment ins
// @route   GET /api/payment-in
// @access  Private
export const getPaymentIns = async (req, res) => {
  try {
    const { startDate, endDate, partyId, paymentMode } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (partyId) query.partyId = partyId;
    if (paymentMode) query.paymentMode = paymentMode;

    const payments = await PaymentIn.find(query).sort('-date').populate('partyId', 'name phone');
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get payment in by ID
// @route   GET /api/payment-in/:id
// @access  Private
export const getPaymentInById = async (req, res) => {
  try {
    const payment = await PaymentIn.findById(req.params.id).populate('partyId', 'name phone address').populate('linkedInvoiceId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete payment in
// @route   DELETE /api/payment-in/:id
// @access  Private
export const deletePaymentIn = async (req, res) => {
  try {
    const payment = await PaymentIn.findById(req.params.id);
    if (!payment) throw new Error('Payment record not found');

    // Reverse the logic
    if (payment.cashBankAccountId) {
      const bank = await BankAccount.findById(payment.cashBankAccountId);
      if (bank) {
        bank.currentBalance -= payment.amountReceived;
        await bank.save();
      }
    }

    const customer = await Customer.findById(payment.partyId);
    if (customer) {
      customer.walletBalance -= payment.amountReceived;
      await customer.save();
    }

    if (payment.linkedInvoiceId) {
      const sale = await Sale.findById(payment.linkedInvoiceId);
      if (sale) {
        sale.amountPaid -= payment.amountReceived;
        if (sale.amountPaid <= 0) {
          sale.paymentStatus = 'pending';
        } else if (sale.amountPaid < sale.totalAmount) {
          sale.paymentStatus = 'partial';
        }

        await sale.save();
      }
    }

    await CashBankTransaction.deleteOne({ referenceId: payment._id });
    await PartyLedger.deleteOne({ referenceId: payment._id });
    await PaymentIn.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

