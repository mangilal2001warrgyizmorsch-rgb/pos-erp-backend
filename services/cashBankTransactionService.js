import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { emitSocketEvent } from '../utils/socket.js';

/**
 * Ensure default Cash In Hand account exists
 */
export const ensureDefaultAccounts = async (session = null) => {
  let cashAccount = await BankAccount.findOne({ accountType: 'cash', isDefault: true }).session(session);
  if (!cashAccount) {
    const created = await BankAccount.create([{
      accountName: 'Cash In Hand',
      accountType: 'cash',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: true,
      status: 'active'
    }], { session });
    cashAccount = created[0];
    console.log('[Seeding] Seeded default Cash In Hand account successfully');
  }
  return cashAccount;
};

/**
 * Helper to compute summaries internally for socket broadcasts
 */
export const getCashBankSummaryInternal = async () => {
  await ensureDefaultAccounts();
  const accounts = await BankAccount.find({ status: 'active' });
  const cashAccount = accounts.find(a => a.accountType === 'cash') || { currentBalance: 0 };
  const banks = accounts.filter(a => a.accountType === 'bank');
  
  const totalCashInHand = cashAccount.currentBalance || 0;
  const totalBankBalance = banks.reduce((sum, b) => sum + b.currentBalance, 0);

  // Today inflow / outflow
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const inflowTodayAgg = await CashBankTransaction.aggregate([
    { $match: { direction: 'in', status: 'completed', date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const outflowTodayAgg = await CashBankTransaction.aggregate([
    { $match: { direction: 'out', status: 'completed', date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const todayInflow = inflowTodayAgg[0]?.total || 0;
  const todayOutflow = outflowTodayAgg[0]?.total || 0;

  return {
    cashBalance: totalCashInHand,
    totalBankBalance,
    todayInflow,
    todayOutflow,
    netBalance: totalCashInHand + totalBankBalance,
    banks
  };
};

/**
 * Create a Cash/Bank Transaction Log and update account balance
 */
export const createCashBankTransaction = async ({
  date = new Date(),
  type,
  direction,
  amount,
  paymentMode,
  accountType,
  accountId,
  partyId,
  partyType,
  referenceModule,
  referenceId,
  referenceNo,
  description,
  createdBy,
  metadata
}, session = null) => {
  if (Number(amount) <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  // 1. Resolve Account
  let account;
  if (accountType === 'cash') {
    const defaultCash = await ensureDefaultAccounts(session);
    accountId = accountId || defaultCash._id;
  }

  if (accountId) {
    account = await BankAccount.findById(accountId).session(session);
    if (!account) {
      throw new Error('Cash/Bank account not found');
    }
  }

  // 2. Fetch Party details if applicable
  let partyName = '';
  if (partyId && partyType) {
    if (partyType === 'Customer') {
      const customer = await Customer.findById(partyId).session(session);
      partyName = customer ? customer.name : '';
    } else if (partyType === 'Supplier') {
      const supplier = await Supplier.findById(partyId).session(session);
      partyName = supplier ? supplier.name : '';
    }
  }

  // 3. Update Balances
  const balanceBefore = account ? account.currentBalance : 0;
  let balanceAfter = balanceBefore;

  if (account) {
    if (direction === 'in') {
      account.currentBalance += Number(amount);
    } else if (direction === 'out') {
      account.currentBalance -= Number(amount);
    }
    await account.save({ session, validateBeforeSave: false });
    balanceAfter = account.currentBalance;
  }

  // 4. Generate Sequence
  const transactionNo = await generateSequenceNumber('CBT', session);

  // 5. Create Transaction Record
  const transaction = new CashBankTransaction({
    transactionNo,
    date,
    type,
    direction,
    amount: Number(amount),
    paymentMode,
    accountType,
    accountId: accountId || null,
    accountName: account ? account.accountName : (accountType === 'cash' ? 'Cash In Hand' : ''),
    partyId: partyId || null,
    partyName,
    partyType,
    referenceModule,
    referenceId,
    referenceNo,
    description,
    balanceBefore,
    balanceAfter,
    status: 'completed',
    createdBy,
    metadata
  });

  await transaction.save({ session });

  // 6. Emit real-time Socket.IO update (deferred to nextTick to avoid blocking db saves)
  process.nextTick(async () => {
    try {
      const summary = await getCashBankSummaryInternal();
      emitSocketEvent('cashBank:transactionCreated', transaction);
      emitSocketEvent('cashBank:balanceUpdated', summary);
    } catch (err) {
      console.error('[Socket Service Error] Failed to broadcast transaction updates:', err);
    }
  });

  return transaction;
};

/**
 * Reverse a completed transaction (reversal logic)
 */
export const reverseTransactionService = async (transactionId, reversedBy, reversalReason, session = null) => {
  const original = await CashBankTransaction.findById(transactionId).session(session);
  if (!original) {
    throw new Error('Transaction not found');
  }

  if (original.status === 'reversed') {
    throw new Error('Transaction is already reversed');
  }

  // 1. Mark original transaction as reversed
  original.status = 'reversed';
  original.reversedBy = reversedBy;
  original.reversedAt = new Date();
  original.reversalReason = reversalReason;
  await original.save({ session });

  // 2. Adjust Account Balances (opposite of original direction)
  let account = null;
  if (original.accountId) {
    account = await BankAccount.findById(original.accountId).session(session);
  }

  const balanceBefore = account ? account.currentBalance : 0;
  let balanceAfter = balanceBefore;

  if (account) {
    if (original.direction === 'in') {
      account.currentBalance -= original.amount;
    } else {
      account.currentBalance += original.amount;
    }
    await account.save({ session, validateBeforeSave: false });
    balanceAfter = account.currentBalance;
  }

  // 3. Create opposite transaction entry
  const reversalNo = await generateSequenceNumber('CBT', session);
  const reversal = new CashBankTransaction({
    transactionNo: reversalNo,
    date: new Date(),
    type: 'reversal',
    direction: original.direction === 'in' ? 'out' : 'in',
    amount: original.amount,
    paymentMode: original.paymentMode,
    accountType: original.accountType,
    accountId: original.accountId,
    accountName: original.accountName,
    partyId: original.partyId,
    partyName: original.partyName,
    partyType: original.partyType,
    referenceModule: original.referenceModule,
    referenceId: original.referenceId,
    referenceNo: original.referenceNo,
    description: `Reversal of ${original.transactionNo}. Reason: ${reversalReason}`,
    balanceBefore,
    balanceAfter,
    status: 'completed',
    createdBy: reversedBy,
    metadata: { reversedTransactionId: original._id }
  });

  await reversal.save({ session });

  // 4. Emit Socket Updates
  process.nextTick(async () => {
    try {
      const summary = await getCashBankSummaryInternal();
      emitSocketEvent('cashBank:transactionReversed', { original, reversal });
      emitSocketEvent('cashBank:balanceUpdated', summary);
    } catch (err) {
      console.error('[Socket Service Error] Failed to broadcast reversal updates:', err);
    }
  });

  return { original, reversal };
};
