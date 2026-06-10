import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import PartyLedger from '../models/PartyLedger.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PaymentIn from '../models/PaymentIn.js';
import PaymentOut from '../models/PaymentOut.js';
import SalesReturn from '../models/SalesReturn.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import { partyLedgerService } from '../services/partyLedgerService.js';

export const reconcileLegacyLedgers = async () => {
  console.log('[Reconciliation Engine] Starting legacy ledger synchronization check...');
  try {
    // 1. Reconcile Sales Invoices
    const sales = await Sale.find({ customer: { $ne: null } });
    let salesReconciled = 0;

    for (const sale of sales) {
      const exists = await PartyLedger.exists({ referenceId: sale._id, type: 'sale' });
      if (!exists) {
        // Create the missing double-entry ledger row
        await partyLedgerService.createEntry({
          partyId: sale.customer,
          partyType: 'Customer',
          type: 'sale',
          debitAmount: Number(sale.totalAmount || 0),
          creditAmount: Number(sale.amountPaid || 0),
          referenceId: sale._id,
          receiptNo: sale.invoiceNumber,
          notes: `Historical Sale Invoice ${sale.invoiceNumber} (Auto-synchronized). Total: ₹${sale.totalAmount}, Paid: ₹${sale.amountPaid}`,
          date: sale.createdAt || new Date()
        });
        salesReconciled++;
      }
    }

    if (salesReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${salesReconciled} legacy customer sale statement records.`);
    }

    // 2. Reconcile Purchase Bills
    const purchases = await Purchase.find({ supplier: { $ne: null } });
    let purchasesReconciled = 0;

    for (const purchase of purchases) {
      const exists = await PartyLedger.exists({ referenceId: purchase._id, type: 'purchase' });
      if (!exists) {
        // Create the missing double-entry ledger row
        await partyLedgerService.createEntry({
          partyId: purchase.supplier,
          partyType: 'Supplier',
          type: 'purchase',
          creditAmount: Number(purchase.totalAmount || 0),
          debitAmount: Number(purchase.amountPaid || 0),
          referenceId: purchase._id,
          receiptNo: purchase.purchaseNumber,
          notes: `Historical Purchase Bill ${purchase.purchaseNumber} (Auto-synchronized). Total: ₹${purchase.totalAmount}, Paid: ₹${purchase.amountPaid}`,
          date: purchase.createdAt || new Date()
        });
        purchasesReconciled++;
      }
    }

    if (purchasesReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${purchasesReconciled} legacy supplier purchase statement records.`);
    }

    // 3. Reconcile Payments In
    const paymentsIn = await PaymentIn.find({ partyId: { $ne: null } });
    let paymentsInReconciled = 0;

    for (const payment of paymentsIn) {
      const exists = await PartyLedger.exists({ referenceId: payment._id, type: 'payment_in' });
      if (!exists) {
        await partyLedgerService.createEntry({
          partyId: payment.partyId,
          partyType: 'Customer',
          type: 'payment_in',
          creditAmount: Number(payment.amountReceived || 0),
          debitAmount: 0,
          referenceId: payment._id,
          receiptNo: payment.receiptNo,
          notes: payment.description || `Payment In: ${payment.receiptNo} (Auto-synchronized)`,
          date: payment.date || payment.createdAt || new Date()
        });
        paymentsInReconciled++;
      }
    }

    if (paymentsInReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${paymentsInReconciled} legacy customer payment-in statement records.`);
    }

    // 4. Reconcile Payments Out
    const paymentsOut = await PaymentOut.find({ partyId: { $ne: null } });
    let paymentsOutReconciled = 0;

    for (const payment of paymentsOut) {
      const exists = await PartyLedger.exists({ referenceId: payment._id, type: 'payment_out' });
      if (!exists) {
        await partyLedgerService.createEntry({
          partyId: payment.partyId,
          partyType: 'Supplier',
          type: 'payment_out',
          debitAmount: Number(payment.amountPaid || 0),
          creditAmount: 0,
          referenceId: payment._id,
          receiptNo: payment.receiptNo,
          notes: payment.description || `Payment Out: ${payment.receiptNo} (Auto-synchronized)`,
          date: payment.date || payment.createdAt || new Date()
        });
        paymentsOutReconciled++;
      }
    }

    if (paymentsOutReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${paymentsOutReconciled} legacy supplier payment-out statement records.`);
    }

    // 5. Reconcile Sales Returns
    const saleReturns = await SalesReturn.find({ customer: { $ne: null } });
    let saleReturnsReconciled = 0;

    for (const ret of saleReturns) {
      const exists = await PartyLedger.exists({ referenceId: ret._id, type: 'return' });
      if (!exists) {
        let ledgerDebit = 0;
        let ledgerCredit = Number(ret.grandTotal || 0);

        if (ret.refundType === 'refund_now') {
          ledgerDebit = Number(ret.grandTotal || 0); // Offsets immediately on cash refund
        }

        await partyLedgerService.createEntry({
          partyId: ret.customer,
          partyType: 'Customer',
          type: 'return',
          debitAmount: ledgerDebit,
          creditAmount: ledgerCredit,
          referenceId: ret._id,
          receiptNo: ret.creditNoteNo,
          notes: `Credit Note ${ret.creditNoteNo} for Sale Return of Invoice ${ret.invoiceNumber} (Auto-synchronized). Refund type: ${ret.refundType}`,
          date: ret.returnDate || ret.createdAt || new Date()
        });
        saleReturnsReconciled++;
      }
    }

    if (saleReturnsReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${saleReturnsReconciled} legacy customer sale return statement records.`);
    }

    // 6. Reconcile Purchase Returns
    const purchaseReturns = await PurchaseReturn.find({ supplier: { $ne: null } });
    let purchaseReturnsReconciled = 0;

    for (const ret of purchaseReturns) {
      const exists = await PartyLedger.exists({ referenceId: ret._id, type: 'return' });
      if (!exists) {
        let ledgerDebit = Number(ret.grandTotal || 0);
        let ledgerCredit = 0;

        if (ret.refundType === 'refund_received') {
          ledgerCredit = Number(ret.grandTotal || 0); // Offsets immediately on cash refund
        }

        await partyLedgerService.createEntry({
          partyId: ret.supplier,
          partyType: 'Supplier',
          type: 'return',
          debitAmount: ledgerDebit,
          creditAmount: ledgerCredit,
          referenceId: ret._id,
          receiptNo: ret.debitNoteNo,
          notes: `Debit Note ${ret.debitNoteNo} for Purchase Return of Bill ${ret.purchaseNumber} (Auto-synchronized). Refund type: ${ret.refundType}`,
          date: ret.returnDate || ret.createdAt || new Date()
        });
        purchaseReturnsReconciled++;
      }
    }

    if (purchaseReturnsReconciled > 0) {
      console.log(`[Reconciliation Engine] Retroactively synchronized ${purchaseReturnsReconciled} legacy supplier purchase return statement records.`);
    }

    console.log('[Reconciliation Engine] Legacy ledger reconciliation check complete! All registries synchronized.');
  } catch (error) {
    console.error('[Reconciliation Engine Failed] Error during sync run:', error);
  }
};
