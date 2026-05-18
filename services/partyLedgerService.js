import PartyLedger from '../models/PartyLedger.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import { emitSocketEvent } from '../utils/socket.js';

export const partyLedgerService = {
  /**
   * Create a double-entry Party Ledger record and update the party's primary balance
   */
  createEntry: async ({
    partyId,
    partyType,
    type,
    debitAmount = 0,
    creditAmount = 0,
    referenceId,
    receiptNo,
    notes,
    date = new Date()
  }, session = null) => {
    // 1. Fetch last ledger record to calculate running balance
    const lastLedger = await PartyLedger.findOne({ partyId })
      .sort({ date: -1, createdAt: -1 })
      .session(session);

    const lastBalance = lastLedger ? lastLedger.balanceAfter : 0;
    let balanceAfter = lastBalance;

    if (partyType === 'Customer') {
      // Customer (Receivables normal balance): debit increases outstanding, credit decreases outstanding
      balanceAfter = lastBalance + Number(debitAmount) - Number(creditAmount);
    } else if (partyType === 'Supplier') {
      // Supplier (Payables normal balance): credit increases liability, debit decreases liability
      balanceAfter = lastBalance + Number(creditAmount) - Number(debitAmount);
    }

    // 2. Create the Ledger entry
    const entry = new PartyLedger({
      partyId,
      partyType,
      type,
      debitAmount,
      creditAmount,
      balanceAfter,
      referenceId,
      receiptNo,
      date,
      notes
    });

    await entry.save({ session });

    // 3. Update primary balance on the Party record
    if (partyType === 'Customer') {
      // For Customer, we decrease walletBalance for debits (sales) and increase for credits (payments)
      // outstanding = debit - credit. walletBalance = credit - debit.
      const walletDelta = Number(creditAmount) - Number(debitAmount);
      await Customer.findByIdAndUpdate(
        partyId,
        { $inc: { walletBalance: walletDelta } },
        { session }
      );
    } else if (partyType === 'Supplier') {
      // For Supplier, outstandingBalance = credit (purchases) - debit (payments)
      const outstandingDelta = Number(creditAmount) - Number(debitAmount);
      await Supplier.findByIdAndUpdate(
        partyId,
        { $inc: { outstandingBalance: outstandingDelta } },
        { session }
      );
    }

    // 4. Broadcast live Socket.IO update (deferred to prevent blocking transactional saves)
    process.nextTick(() => {
      try {
        emitSocketEvent('partyLedger:updated', { partyId, partyType, balanceAfter });
      } catch (err) {
        console.error('[Socket Service Error] Failed to emit party ledger update:', err);
      }
    });

    return entry;
  }
};
