import PaymentIn from '../models/PaymentIn.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import PartyLedger from '../models/PartyLedger.js';
import Customer from '../models/Customer.js';
import BankAccount from '../models/BankAccount.js';
import Sale from '../models/Sale.js';
import Counter from '../models/Counter.js';
import mongoose from 'mongoose';
import { createCashBankTransaction } from '../services/cashBankTransactionService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { postPaymentInAccountingVoucher } from '../services/accounting/paymentAccounting.service.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';
import { emitSocketEvent } from '../utils/socket.js';

// @desc    Create a new payment in
// @route   POST /api/payment-in
// @access  Private
export const createPaymentIn = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

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

    const sanitizeObjectId = (value) => value ? value : undefined;
    const cashBankAccountIdClean = sanitizeObjectId(cashBankAccountId);
    const linkedInvoiceIdClean = sanitizeObjectId(linkedInvoiceId);

    const customer = await Customer.findById(partyId).session(session);
    if (!customer) throw new Error('Customer not found');

    // 1. Generate Receipt Number
    const counter = await Counter.findOneAndUpdate(
      { _id: 'paymentIn' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const receiptNo = `PAYIN-${String(counter.seq).padStart(6, '0')}`;

    // 2. Create PaymentIn Record
    const paymentIn = new PaymentIn({
      receiptNo,
      partyId,
      partyName: customer.name,
      amountReceived,
      paymentMode,
      cashBankAccountId: cashBankAccountIdClean,
      linkedInvoiceId: linkedInvoiceIdClean,
      referenceNo,
      description,
      attachments,
      date: date || Date.now(),
      createdBy: req.user._id
    });
    await paymentIn.save({ session });

    // 3. Create central Cash/Bank Transaction Log and update account balance
    await createCashBankTransaction({
      date: date || new Date(),
      type: 'payment_in',
      direction: 'in',
      amount: amountReceived,
      paymentMode,
      accountType: cashBankAccountIdClean ? 'bank' : 'cash',
      accountId: cashBankAccountIdClean || undefined,
      partyId,
      partyType: 'Customer',
      referenceModule: 'payment_in',
      referenceId: paymentIn._id,
      referenceNo: receiptNo,
      description: description || `Payment In: ${receiptNo}`,
      createdBy: req.user._id
    }, session);

    // 4. Update Customer Balance and Statements using unified partyLedgerService
    await partyLedgerService.createEntry({
      partyId,
      partyType: 'Customer',
      type: 'payment_in',
      creditAmount: amountReceived,
      referenceId: paymentIn._id,
      receiptNo,
      notes: description,
      date: date || Date.now()
    }, session);

    // 5. Update Linked Invoice if any
    if (linkedInvoiceIdClean) {
      const sale = await Sale.findById(linkedInvoiceIdClean).session(session);
      if (sale) {
        const newAmountPaid = (sale.amountPaid || 0) + Number(amountReceived);
        let paymentStatus = 'partial';
        if (newAmountPaid >= sale.totalAmount) {
          paymentStatus = 'paid';
        }
        await Sale.findByIdAndUpdate(
          linkedInvoiceId,
          { 
            $set: { 
              amountPaid: newAmountPaid,
              paymentStatus: paymentStatus
            } 
          },
          { session }
        );
      }
    }

    await postPaymentInAccountingVoucher(paymentIn, {
      session,
      createdBy: req.user._id,
      source: 'payment_in',
    });

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast Socket updates
    try {
      emitSocketEvent('paymentIn:created', {
        _id: paymentIn._id,
        receiptNo,
        amountReceived,
        customerName: customer.name
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit paymentIn socket event:', e);
    }

    res.status(201).json({ success: true, data: paymentIn });
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

    const payments = await PaymentIn.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('partyId', 'name phone')
      .populate('accountingVoucherId', 'voucherNo status date');
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
    const payment = await PaymentIn.findById(req.params.id)
      .populate('partyId', 'name phone address')
      .populate('linkedInvoiceId')
      .populate('accountingVoucherId', 'voucherNo status date');
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
    const previousAccountingVoucherId = payment.accountingVoucherId;

    // Reverse the logic
    // Reverse the balance adjustment
    let account;
    if (payment.cashBankAccountId) {
      account = await BankAccount.findById(payment.cashBankAccountId);
    } else {
      account = await BankAccount.findOne({ accountType: 'cash', isDefault: true });
    }
    if (account) {
      account.currentBalance -= payment.amountReceived;
      await account.save({ validateBeforeSave: false });
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

    await CashBankTransaction.deleteMany({ referenceId: payment._id });
    await PartyLedger.deleteOne({ referenceId: payment._id });
    if (previousAccountingVoucherId) {
      await cancelVoucher(previousAccountingVoucherId, `Payment In ${payment.receiptNo} deleted`, req.user._id);
    }
    await PaymentIn.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payment in
// @route   PUT /api/payment-in/:id
// @access  Private
export const updatePaymentIn = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const payment = await PaymentIn.findById(req.params.id).session(session);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const previousAccountingVoucherId = payment.accountingVoucherId;

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

    const sanitizeObjectId = (value) => value ? value : undefined;
    const cashBankAccountIdClean = sanitizeObjectId(cashBankAccountId);
    const linkedInvoiceIdClean = sanitizeObjectId(linkedInvoiceId);

    // 1. Revert Old Effects
    // Revert account balance
    let oldAccount;
    if (payment.cashBankAccountId) {
      oldAccount = await BankAccount.findById(payment.cashBankAccountId).session(session);
    } else {
      oldAccount = await BankAccount.findOne({ accountType: 'cash', isDefault: true }).session(session);
    }
    if (oldAccount) {
      oldAccount.currentBalance -= payment.amountReceived;
      await oldAccount.save({ session, validateBeforeSave: false });
    }

    // Revert Customer wallet balance
    const oldCustomer = await Customer.findById(payment.partyId).session(session);
    if (oldCustomer) {
      oldCustomer.walletBalance -= payment.amountReceived;
      await oldCustomer.save({ session });
    }

    // Revert linked invoice
    if (payment.linkedInvoiceId) {
      const oldSale = await Sale.findById(payment.linkedInvoiceId).session(session);
      if (oldSale) {
        oldSale.amountPaid -= payment.amountReceived;
        if (oldSale.amountPaid <= 0) {
          oldSale.paymentStatus = 'pending';
        } else if (oldSale.amountPaid < oldSale.totalAmount) {
          oldSale.paymentStatus = 'partial';
        } else {
          oldSale.paymentStatus = 'paid';
        }
        await oldSale.save({ session });
      }
    }

    // Delete previous Ledger entry and CashBank transaction so we can recreate them
    await CashBankTransaction.deleteMany({ referenceId: payment._id }).session(session);
    await PartyLedger.deleteOne({ referenceId: payment._id }).session(session);

    // 2. Apply New Effects
    const newPartyId = partyId || payment.partyId;
    const newCustomer = await Customer.findById(newPartyId).session(session);
    if (!newCustomer) throw new Error('Customer not found');

    payment.partyId = newPartyId;
    payment.partyName = newCustomer.name;
    payment.amountReceived = amountReceived;
    payment.paymentMode = paymentMode;
    payment.cashBankAccountId = cashBankAccountIdClean;
    payment.linkedInvoiceId = linkedInvoiceIdClean;
    payment.referenceNo = referenceNo;
    payment.description = description;
    payment.attachments = attachments;
    payment.date = date || Date.now();

    await payment.save({ session });

    // Apply new Customer wallet balance
    newCustomer.walletBalance += amountReceived;
    await newCustomer.save({ session });

    // Apply new CashBank transaction
    await createCashBankTransaction({
      date: date || new Date(),
      type: 'payment_in',
      direction: 'in',
      amount: amountReceived,
      paymentMode,
      accountType: cashBankAccountIdClean ? 'bank' : 'cash',
      accountId: cashBankAccountIdClean || undefined,
      partyId: newPartyId,
      partyType: 'Customer',
      referenceModule: 'payment_in',
      referenceId: payment._id,
      referenceNo: payment.receiptNo,
      description: description || `Payment In Updated: ${payment.receiptNo}`,
      createdBy: req.user._id
    }, session);

    // Apply new PartyLedger entry
    await partyLedgerService.createEntry({
      partyId: newPartyId,
      partyType: 'Customer',
      type: 'payment_in',
      creditAmount: amountReceived,
      referenceId: payment._id,
      receiptNo: payment.receiptNo,
      notes: description,
      date: date || Date.now()
    }, session);

    // Update new Linked Invoice
    if (linkedInvoiceIdClean) {
      const newSale = await Sale.findById(linkedInvoiceIdClean).session(session);
      if (newSale) {
        const newAmountPaid = (newSale.amountPaid || 0) + Number(amountReceived);
        let paymentStatus = 'partial';
        if (newAmountPaid >= newSale.totalAmount) {
          paymentStatus = 'paid';
        }
        await Sale.findByIdAndUpdate(
          linkedInvoiceIdClean,
          { 
            $set: { 
              amountPaid: newAmountPaid,
              paymentStatus: paymentStatus
            } 
          },
          { session }
        );
      }
    }

    if (previousAccountingVoucherId) {
      await cancelVoucher(previousAccountingVoucherId, `Payment In ${payment.receiptNo} updated`, req.user._id, { session });
      payment.accountingVoucherId = undefined;
      payment.accountingPosted = false;
      payment.accountingStatus = 'not_posted';
      payment.accountingError = '';
      await payment.save({ session, validateBeforeSave: false });
    }

    await postPaymentInAccountingVoucher(payment, {
      session,
      createdBy: req.user._id,
      source: 'payment_in_update',
    });

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast Socket updates
    try {
      emitSocketEvent('paymentIn:updated', {
        _id: payment._id,
        receiptNo: payment.receiptNo,
        amountReceived,
        customerName: newCustomer.name
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit paymentIn socket event:', e);
    }

    res.status(200).json({ success: true, data: payment });
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
