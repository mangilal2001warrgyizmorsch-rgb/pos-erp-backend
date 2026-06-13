import PaymentOut from '../models/PaymentOut.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import PartyLedger from '../models/PartyLedger.js';
import Supplier from '../models/Supplier.js';
import BankAccount from '../models/BankAccount.js';
import Purchase from '../models/Purchase.js';
import Counter from '../models/Counter.js';
import mongoose from 'mongoose';
import { createCashBankTransaction } from '../services/cashBankTransactionService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { postPaymentOutAccountingVoucher } from '../services/accounting/paymentAccounting.service.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';
import { emitSocketEvent } from '../utils/socket.js';

const makeValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const sanitizeObjectId = (value) => value ? value : undefined;

const isCashPaymentMode = (paymentMode) => String(paymentMode || '').toLowerCase() === 'cash';

const getPurchaseTotal = (purchase) => Number(purchase?.totalAmount ?? purchase?.grandTotal ?? 0);

const getPaymentStatus = (paidAmount, totalAmount) => {
  const paid = Number(paidAmount || 0);
  const total = Number(totalAmount || 0);
  if (paid <= 0) return 'pending';
  return paid + 0.009 >= total ? 'paid' : 'partial';
};

const validatePaymentOutRequest = async ({
  partyId,
  amountPaid,
  paymentMode,
  cashBankAccountId,
  linkedPurchaseId,
  existingPayment = null,
  session = null,
}) => {
  if (!partyId) throw makeValidationError('Payment-Out requires a supplier.');
  if (!paymentMode) throw makeValidationError('Payment-Out requires a payment mode.');

  const amount = Number(amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeValidationError('Payment amount must be greater than zero.');
  }

  if (!isCashPaymentMode(paymentMode)) {
    if (!cashBankAccountId) {
      throw makeValidationError('Bank/UPI/Card payments require a cash/bank account.');
    }

    const bankAccount = await BankAccount.findOne({
      _id: cashBankAccountId,
      accountType: 'bank',
      status: 'active',
    }).session(session);
    if (!bankAccount) {
      throw makeValidationError('Selected bank account is invalid or inactive.');
    }
  }

  if (linkedPurchaseId) {
    const purchase = await Purchase.findById(linkedPurchaseId).session(session);
    if (!purchase) throw makeValidationError('Linked purchase bill not found.');
    if (purchase.supplier && String(purchase.supplier) !== String(partyId)) {
      throw makeValidationError('Linked purchase bill does not belong to the selected supplier.');
    }

    const previousAmountOnSamePurchase = existingPayment
      && existingPayment.linkedPurchaseId
      && String(existingPayment.linkedPurchaseId) === String(linkedPurchaseId)
      ? Number(existingPayment.amountPaid || 0)
      : 0;
    const alreadyPaidExcludingThisPayment = Math.max(0, Number(purchase.amountPaid || 0) - previousAmountOnSamePurchase);
    const remaining = getPurchaseTotal(purchase) - alreadyPaidExcludingThisPayment;
    if (amount - remaining > 0.009) {
      throw makeValidationError(`Payment amount exceeds linked purchase outstanding amount. Remaining: ${Math.max(0, remaining).toFixed(2)}.`);
    }
  }

  return amount;
};

// @desc    Create a new payment out
// @route   POST /api/payment-out
// @access  Private
export const createPaymentOut = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

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

    const cashBankAccountIdClean = isCashPaymentMode(paymentMode)
      ? undefined
      : sanitizeObjectId(cashBankAccountId);
    const linkedPurchaseIdClean = sanitizeObjectId(linkedPurchaseId);
    const paymentAmount = await validatePaymentOutRequest({
      partyId,
      amountPaid,
      paymentMode,
      cashBankAccountId: cashBankAccountIdClean,
      linkedPurchaseId: linkedPurchaseIdClean,
      session,
    });

    const supplier = await Supplier.findById(partyId).session(session);
    if (!supplier) throw makeValidationError('Supplier not found');

    // 1. Generate Receipt Number
    const counter = await Counter.findOneAndUpdate(
      { _id: 'paymentOut' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const receiptNo = `PAYOUT-${String(counter.seq).padStart(6, '0')}`;

    // 2. Create PaymentOut Record
    const paymentOut = new PaymentOut({
      receiptNo,
      partyId,
      partyName: supplier.name,
      amountPaid: paymentAmount,
      paymentMode,
      cashBankAccountId: cashBankAccountIdClean,
      linkedPurchaseId: linkedPurchaseIdClean,
      referenceNo,
      description,
      attachments,
      date: date || Date.now(),
      createdBy: req.user._id
    });
    await paymentOut.save({ session });

    // 3. Create central Cash/Bank Transaction Log and update account balance
    await createCashBankTransaction({
      date: date || new Date(),
      type: 'payment_out',
      direction: 'out',
      amount: paymentAmount,
      paymentMode,
      accountType: isCashPaymentMode(paymentMode) ? 'cash' : 'bank',
      accountId: cashBankAccountIdClean || undefined,
      partyId,
      partyType: 'Supplier',
      referenceModule: 'payment_out',
      referenceId: paymentOut._id,
      referenceNo: receiptNo,
      description: description || `Payment Out: ${receiptNo}`,
      createdBy: req.user._id
    }, session);

    // 4. Update Supplier Balance and Statements using unified partyLedgerService
    await partyLedgerService.createEntry({
      partyId,
      partyType: 'Supplier',
      type: 'payment_out',
      debitAmount: paymentAmount,
      referenceId: paymentOut._id,
      receiptNo,
      notes: description,
      date: date || Date.now()
    }, session);

    // 5. Update Linked Purchase if any
    if (linkedPurchaseIdClean) {
      const purchase = await Purchase.findById(linkedPurchaseIdClean).session(session);
      if (purchase) {
        const newAmountPaid = (purchase.amountPaid || 0) + paymentAmount;
        const paymentStatus = getPaymentStatus(newAmountPaid, getPurchaseTotal(purchase));
        await Purchase.findByIdAndUpdate(
          linkedPurchaseIdClean,
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

    await postPaymentOutAccountingVoucher(paymentOut, {
      session,
      createdBy: req.user._id,
      source: 'payment_out',
    });

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast Socket updates
    try {
      emitSocketEvent('paymentOut:created', {
        _id: paymentOut._id,
        receiptNo,
        amountPaid: paymentAmount,
        supplierName: supplier.name
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit paymentOut socket event:', e);
    }

    res.status(201).json({ success: true, data: paymentOut });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
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

    const payments = await PaymentOut.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('partyId', 'name phone')
      .populate('accountingVoucherId', 'voucherNo status date');
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
    const payment = await PaymentOut.findById(req.params.id)
      .populate('partyId', 'name phone address')
      .populate('linkedPurchaseId')
      .populate('accountingVoucherId', 'voucherNo status date');
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
      account.currentBalance += Number(payment.amountPaid || 0);
      await account.save({ validateBeforeSave: false });
    }

    const supplier = await Supplier.findById(payment.partyId);
    if (supplier) {
      await Supplier.findByIdAndUpdate(payment.partyId, { $inc: { outstandingBalance: Number(payment.amountPaid || 0) } });
    }


    if (payment.linkedPurchaseId) {
      const purchase = await Purchase.findById(payment.linkedPurchaseId);
      if (purchase) {
        purchase.amountPaid = Math.max(0, Number(purchase.amountPaid || 0) - Number(payment.amountPaid || 0));
        purchase.paymentStatus = getPaymentStatus(purchase.amountPaid, getPurchaseTotal(purchase));

        await purchase.save();
      }
    }

    await CashBankTransaction.deleteMany({ referenceId: payment._id });
    await PartyLedger.deleteOne({ referenceId: payment._id });
    if (previousAccountingVoucherId) {
      await cancelVoucher(previousAccountingVoucherId, `Payment Out ${payment.receiptNo} deleted`, req.user._id);
    }
    await PaymentOut.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payment out
// @route   PUT /api/payment-out/:id
// @access  Private
export const updatePaymentOut = async (req, res) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const payment = await PaymentOut.findById(req.params.id).session(session);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const previousAccountingVoucherId = payment.accountingVoucherId;

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

    const newPartyId = partyId || payment.partyId;
    const newPaymentMode = paymentMode || payment.paymentMode;
    const cashBankAccountIdClean = isCashPaymentMode(newPaymentMode)
      ? undefined
      : cashBankAccountId !== undefined
        ? sanitizeObjectId(cashBankAccountId)
        : payment.cashBankAccountId;
    const linkedPurchaseIdClean = linkedPurchaseId !== undefined
      ? sanitizeObjectId(linkedPurchaseId)
      : payment.linkedPurchaseId;
    const paymentAmount = await validatePaymentOutRequest({
      partyId: newPartyId,
      amountPaid: amountPaid !== undefined ? amountPaid : payment.amountPaid,
      paymentMode: newPaymentMode,
      cashBankAccountId: cashBankAccountIdClean,
      linkedPurchaseId: linkedPurchaseIdClean,
      existingPayment: payment,
      session,
    });

    // 1. Revert Old Effects
    // Revert account balance
    let oldAccount;
    if (payment.cashBankAccountId) {
      oldAccount = await BankAccount.findById(payment.cashBankAccountId).session(session);
    } else {
      oldAccount = await BankAccount.findOne({ accountType: 'cash', isDefault: true }).session(session);
    }
    if (oldAccount) {
      oldAccount.currentBalance += Number(payment.amountPaid || 0);
      await oldAccount.save({ session, validateBeforeSave: false });
    }

    // Revert Supplier outstanding balance
    const oldSupplier = await Supplier.findById(payment.partyId).session(session);
    if (oldSupplier) {
      oldSupplier.outstandingBalance += Number(payment.amountPaid || 0);
      await oldSupplier.save({ session });
    }

    // Revert linked purchase
    if (payment.linkedPurchaseId) {
      const oldPurchase = await Purchase.findById(payment.linkedPurchaseId).session(session);
      if (oldPurchase) {
        oldPurchase.amountPaid = Math.max(0, Number(oldPurchase.amountPaid || 0) - Number(payment.amountPaid || 0));
        oldPurchase.paymentStatus = getPaymentStatus(oldPurchase.amountPaid, getPurchaseTotal(oldPurchase));
        await oldPurchase.save({ session });
      }
    }

    // Delete previous Ledger entry and CashBank transaction so we can recreate them
    await CashBankTransaction.deleteMany({ referenceId: payment._id }).session(session);
    await PartyLedger.deleteOne({ referenceId: payment._id }).session(session);

    // 2. Apply New Effects
    const newSupplier = await Supplier.findById(newPartyId).session(session);
    if (!newSupplier) throw makeValidationError('Supplier not found');

    payment.partyId = newPartyId;
    payment.partyName = newSupplier.name;
    payment.amountPaid = paymentAmount;
    payment.paymentMode = newPaymentMode;
    payment.cashBankAccountId = cashBankAccountIdClean;
    payment.linkedPurchaseId = linkedPurchaseIdClean;
    payment.referenceNo = referenceNo;
    payment.description = description;
    payment.attachments = attachments;
    payment.date = date || Date.now();

    await payment.save({ session });

    // Apply new CashBank transaction
    await createCashBankTransaction({
      date: date || new Date(),
      type: 'payment_out',
      direction: 'out',
      amount: paymentAmount,
      paymentMode: newPaymentMode,
      accountType: isCashPaymentMode(newPaymentMode) ? 'cash' : 'bank',
      accountId: cashBankAccountIdClean || undefined,
      partyId: newPartyId,
      partyType: 'Supplier',
      referenceModule: 'payment_out',
      referenceId: payment._id,
      referenceNo: payment.receiptNo,
      description: description || `Payment Out Updated: ${payment.receiptNo}`,
      createdBy: req.user._id
    }, session);

    // Apply new PartyLedger entry
    await partyLedgerService.createEntry({
      partyId: newPartyId,
      partyType: 'Supplier',
      type: 'payment_out',
      debitAmount: paymentAmount,
      referenceId: payment._id,
      receiptNo: payment.receiptNo,
      notes: description,
      date: date || Date.now()
    }, session);

    // Update new Linked Purchase
    if (linkedPurchaseIdClean) {
      const newPurchase = await Purchase.findById(linkedPurchaseIdClean).session(session);
      if (newPurchase) {
        const newAmountPaid = (newPurchase.amountPaid || 0) + paymentAmount;
        const paymentStatus = getPaymentStatus(newAmountPaid, getPurchaseTotal(newPurchase));
        await Purchase.findByIdAndUpdate(
          linkedPurchaseIdClean,
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
      await cancelVoucher(previousAccountingVoucherId, `Payment Out ${payment.receiptNo} updated`, req.user._id, { session });
      payment.accountingVoucherId = undefined;
      payment.accountingPosted = false;
      payment.accountingStatus = 'not_posted';
      payment.accountingError = '';
      await payment.save({ session, validateBeforeSave: false });
    }

    await postPaymentOutAccountingVoucher(payment, {
      session,
      createdBy: req.user._id,
      source: 'payment_out_update',
    });

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast Socket updates
    try {
      emitSocketEvent('paymentOut:updated', {
        _id: payment._id,
        receiptNo: payment.receiptNo,
        amountPaid: paymentAmount,
        supplierName: newSupplier.name
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit paymentOut socket event:', e);
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};
