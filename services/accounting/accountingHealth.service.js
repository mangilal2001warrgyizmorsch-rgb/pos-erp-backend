import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import Sale from "../../models/Sale.js";
import Purchase from "../../models/Purchase.js";
import PaymentIn from "../../models/PaymentIn.js";
import PaymentOut from "../../models/PaymentOut.js";
import Expense from "../../models/Expense.js";
import CashBankTransaction from "../../models/CashBankTransaction.js";
import SalesReturn from "../../models/SalesReturn.js";
import PurchaseReturn from "../../models/PurchaseReturn.js";
import BankAccount from "../../models/BankAccount.js";
import Customer from "../../models/Customer.js";
import Supplier from "../../models/Supplier.js";
import PartyLedger from "../../models/PartyLedger.js";
import { getGSTSummary } from "./gstReports.service.js";
import { ensureCustomerAccountingLedger, ensureSupplierAccountingLedger } from "./partyAccountingLedger.service.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";
import { postVoucher } from "./voucher.service.js";

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const signedBalance = (amount, type) => (type === "CREDIT" ? -money(amount) : money(amount));
const balanceFromSigned = (value) => ({
  amount: Math.abs(money(value)),
  type: value < 0 ? "CREDIT" : "DEBIT",
});
const absDiff = (a, b) => Math.abs(money(a) - money(b));
const isMismatch = (a, b) => absDiff(a, b) > 0.01;
const idString = (value) => (value ? String(value) : "");
const shortId = (id) => String(id || "").slice(-8).toUpperCase();
const startOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};
const voucherDateMatch = (filters = {}) => {
  const startDate = startOfDay(filters.startDate);
  const endDate = endOfDay(filters.endDate);
  const match = { "voucher.date": { $lte: endDate } };
  if (startDate) match["voucher.date"].$gte = startDate;
  return match;
};

const issue = ({
  type,
  severity = "warning",
  module = "accounting",
  referenceId,
  referenceNo,
  voucherId,
  message,
  suggestedFix,
  suggestedApi,
  actionType,
  safeToAutoFix = false,
  details,
}) => ({
  id: `${type}-${referenceId || voucherId || referenceNo || Math.random().toString(36).slice(2)}`,
  type,
  severity,
  module,
  referenceId,
  referenceNo,
  voucherId,
  message,
  suggestedFix,
  suggestedApi,
  actionType,
  safeToAutoFix,
  details,
});

const getReferenceVoucher = async (referenceModule, referenceId) => Voucher.findOne({
  referenceModule,
  referenceId,
  status: { $nin: ["CANCELLED", "REVERSED"] },
}).select("_id voucherNo status").lean();

const getOpeningBalanceEquityLedger = async () => {
  const ledger = await Ledger.findOne({ code: "OPENING_BALANCE_EQUITY", isActive: true });
  if (!ledger) {
    throw new Error("Opening Balance Equity A/c ledger is not configured. Run Initialize Accounting first.");
  }
  return ledger;
};

const addOpeningEntries = (entries, sourceLedger, equityLedger, signedAmount, narration, extra = {}) => {
  const amount = Math.abs(money(signedAmount));
  if (amount <= 0) return;
  if (signedAmount >= 0) {
    entries.push({ ledgerId: sourceLedger._id, debit: amount, credit: 0, narration, ...extra });
    entries.push({ ledgerId: equityLedger._id, debit: 0, credit: amount, narration });
  } else {
    entries.push({ ledgerId: equityLedger._id, debit: amount, credit: 0, narration });
    entries.push({ ledgerId: sourceLedger._id, debit: 0, credit: amount, narration, ...extra });
  }
};

export const postOpeningBalanceVouchers = async ({ userId = null } = {}) => {
  const equityLedger = await getOpeningBalanceEquityLedger();
  const settings = await AccountingSettings.findOne();
  const results = [];

  const cashBankResult = await postCashBankOpeningBalanceVouchers({ userId, equityLedger, settings });
  results.push(...cashBankResult.results);

  const customers = await Customer.find({ isActive: true, openingBalance: { $ne: 0 } });
  for (const customer of customers) {
    const existing = await getReferenceVoucher("party_opening_balance", customer._id);
    if (existing) {
      results.push({ module: "customer", referenceId: customer._id, referenceNo: customer.name, action: "skipped", voucher: existing, message: "Opening balance voucher already exists." });
      continue;
    }

    const ledger = await ensureCustomerAccountingLedger(customer._id, null, userId, { required: true });
    const direction = String(customer.openingBalanceType || "Receivable").toLowerCase() === "payable" ? -1 : 1;
    const signedAmount = money(customer.openingBalance) * direction;
    const entries = [];
    addOpeningEntries(entries, ledger, equityLedger, signedAmount, `Opening balance for ${customer.name}`, {
      partyId: customer._id,
      partyType: "customer",
    });
    if (entries.length) {
      const posted = await postVoucher({
        voucherTypeCode: "JOURNAL",
        date: customer.openingBalanceDate || customer.createdAt || new Date(),
        referenceModule: "party_opening_balance",
        referenceId: customer._id,
        referenceNo: customer.name,
        narration: `Opening balance for customer ${customer.name}`,
        entries,
        createdBy: userId,
      }, userId);
      results.push({ module: "customer", referenceId: customer._id, referenceNo: customer.name, action: "posted", voucher: posted.voucher || posted });
    }
  }

  const suppliers = await Supplier.find({ isActive: true, openingBalance: { $ne: 0 } });
  for (const supplier of suppliers) {
    const existing = await getReferenceVoucher("party_opening_balance", supplier._id);
    if (existing) {
      results.push({ module: "supplier", referenceId: supplier._id, referenceNo: supplier.name, action: "skipped", voucher: existing, message: "Opening balance voucher already exists." });
      continue;
    }

    const ledger = await ensureSupplierAccountingLedger(supplier._id, null, userId, { required: true });
    const direction = String(supplier.openingBalanceType || "Payable").toLowerCase() === "receivable" ? 1 : -1;
    const signedAmount = money(supplier.openingBalance) * direction;
    const entries = [];
    addOpeningEntries(entries, ledger, equityLedger, signedAmount, `Opening balance for ${supplier.name}`, {
      partyId: supplier._id,
      partyType: "supplier",
    });
    if (entries.length) {
      const posted = await postVoucher({
        voucherTypeCode: "JOURNAL",
        date: supplier.openingBalanceDate || supplier.createdAt || new Date(),
        referenceModule: "party_opening_balance",
        referenceId: supplier._id,
        referenceNo: supplier.name,
        narration: `Opening balance for supplier ${supplier.name}`,
        entries,
        createdBy: userId,
      }, userId);
      results.push({ module: "supplier", referenceId: supplier._id, referenceNo: supplier.name, action: "posted", voucher: posted.voucher || posted });
    }
  }

  return {
    postedAt: new Date(),
    posted: results.filter((row) => row.action === "posted").length,
    skipped: results.filter((row) => row.action === "skipped").length,
    results,
  };
};

export const postCashBankOpeningBalanceVouchers = async ({
  accountId = null,
  userId = null,
  equityLedger = null,
  settings = null,
} = {}) => {
  const openingEquityLedger = equityLedger || await getOpeningBalanceEquityLedger();
  const accountingSettings = settings || await AccountingSettings.findOne();
  const query = { status: "active", openingBalance: { $ne: 0 } };
  if (accountId) query._id = accountId;

  const accounts = await BankAccount.find(query);
  const results = [];

  for (const account of accounts) {
    const existing = await getReferenceVoucher("cash_bank_opening_balance", account._id);
    if (existing) {
      if (!account.accountingOpeningPosted) {
        account.accountingOpeningPosted = true;
        await account.save({ validateBeforeSave: false });
      }
      results.push({
        module: "cash_bank",
        referenceId: account._id,
        referenceNo: account.accountName,
        action: "skipped",
        voucher: existing,
        message: "Opening balance voucher already exists.",
      });
      continue;
    }

    const ledger = await getOrCreateCashBankLedger(account, accountingSettings, null, userId);
    const entries = [];
    addOpeningEntries(
      entries,
      ledger,
      openingEquityLedger,
      money(account.openingBalance),
      `Opening balance for ${account.accountName}`,
    );

    if (!entries.length) {
      results.push({
        module: "cash_bank",
        referenceId: account._id,
        referenceNo: account.accountName,
        action: "skipped",
        message: "Opening balance is zero.",
      });
      continue;
    }

    const posted = await postVoucher({
      voucherTypeCode: "JOURNAL",
      date: account.createdAt || new Date(),
      referenceModule: "cash_bank_opening_balance",
      referenceId: account._id,
      referenceNo: account.accountName,
      narration: `Opening balance for ${account.accountName}`,
      entries,
      createdBy: userId,
    }, userId);

    account.accountingOpeningPosted = true;
    await account.save({ validateBeforeSave: false });
    results.push({
      module: "cash_bank",
      referenceId: account._id,
      referenceNo: account.accountName,
      action: "posted",
      voucher: posted.voucher || posted,
    });
  }

  return {
    postedAt: new Date(),
    posted: results.filter((row) => row.action === "posted").length,
    skipped: results.filter((row) => row.action === "skipped").length,
    results,
  };
};

const cashBankReferenceModule = (transaction) => {
  if (transaction.referenceModule === "bank_transfer" && transaction.referenceId) return "bank_transfer";
  if (transaction.type === "cash_in") return "manual_cash_in";
  if (transaction.type === "cash_out") return "manual_cash_out";
  if (transaction.type === "opening_cash") return "opening_cash_bank";
  return "cash_bank_adjustment";
};

const sourceModules = [
  {
    module: "sale",
    referenceModule: "sale_invoice",
    model: Sale,
    filter: { status: { $nin: ["cancelled", "draft"] } },
    no: (doc) => doc.invoiceNumber,
    date: (doc) => doc.createdAt,
    amount: (doc) => doc.totalAmount,
    repostApi: (id) => `/api/accounting/repost/sale/${id}`,
  },
  {
    module: "purchase",
    referenceModule: "purchase",
    model: Purchase,
    filter: { status: { $nin: ["cancelled", "draft"] } },
    no: (doc) => doc.purchaseNumber,
    date: (doc) => doc.purchaseDate || doc.createdAt,
    amount: (doc) => doc.totalAmount,
    repostApi: (id) => `/api/accounting/repost/purchase/${id}`,
  },
  {
    module: "payment_in",
    referenceModule: "payment_in",
    model: PaymentIn,
    filter: { status: { $ne: "cancelled" } },
    no: (doc) => doc.receiptNo,
    date: (doc) => doc.date,
    amount: (doc) => doc.amountReceived,
    repostApi: (id) => `/api/accounting/repost/missing`,
  },
  {
    module: "payment_out",
    referenceModule: "payment_out",
    model: PaymentOut,
    filter: { status: { $ne: "cancelled" } },
    no: (doc) => doc.receiptNo,
    date: (doc) => doc.date,
    amount: (doc) => doc.amountPaid,
    repostApi: (id) => `/api/accounting/repost/missing`,
  },
  {
    module: "expense",
    referenceModule: "expense",
    model: Expense,
    filter: {},
    no: (doc) => doc.reference || doc.title,
    date: (doc) => doc.date,
    amount: (doc) => doc.amount,
    repostApi: (id) => `/api/accounting/repost/expense/${id}`,
  },
  {
    module: "sale_return",
    referenceModule: "sale_return",
    model: SalesReturn,
    filter: { status: { $ne: "cancelled" } },
    no: (doc) => doc.creditNoteNo || doc.returnNumber,
    date: (doc) => doc.returnDate,
    amount: (doc) => doc.grandTotal,
    repostApi: (id) => `/api/accounting/repost/sale-return/${id}`,
  },
  {
    module: "purchase_return",
    referenceModule: "purchase_return",
    model: PurchaseReturn,
    filter: { status: { $ne: "cancelled" } },
    no: (doc) => doc.debitNoteNo || doc.returnNumber,
    date: (doc) => doc.returnDate,
    amount: (doc) => doc.grandTotal,
    repostApi: (id) => `/api/accounting/repost/purchase-return/${id}`,
  },
  {
    module: "cash_bank_transaction",
    referenceModule: null,
    model: CashBankTransaction,
    filter: {
      status: "completed",
      type: { $in: ["cash_in", "cash_out", "opening_cash", "adjustment", "bank_transfer"] },
    },
    no: (doc) => doc.transactionNo,
    date: (doc) => doc.date,
    amount: (doc) => doc.amount,
    repostApi: (id) => `/api/accounting/repost/cash-bank-transaction/${id}`,
  },
];

export const recalculateLedgerBalancesFromVouchers = async ({ apply = false, userId = null } = {}) => {
  const ledgers = await Ledger.find({ isActive: true }).populate("groupId", "name code").lean();
  const ledgerIds = ledgers.map((ledger) => ledger._id);
  const totals = await VoucherEntry.aggregate([
    { $match: { ledgerId: { $in: ledgerIds } } },
    {
      $lookup: {
        from: "vouchers",
        localField: "voucherId",
        foreignField: "_id",
        as: "voucher",
      },
    },
    { $unwind: "$voucher" },
    { $match: { "voucher.status": "POSTED" } },
    {
      $group: {
        _id: "$ledgerId",
        debit: { $sum: "$debit" },
        credit: { $sum: "$credit" },
      },
    },
  ]);
  const totalsByLedger = new Map(totals.map((row) => [idString(row._id), row]));

  const mismatches = [];
  for (const ledger of ledgers) {
    const total = totalsByLedger.get(idString(ledger._id)) || { debit: 0, credit: 0 };
    const expectedSigned = signedBalance(ledger.openingBalance, ledger.openingBalanceType)
      + money(total.debit)
      - money(total.credit);
    const expected = balanceFromSigned(expectedSigned);
    const storedSigned = signedBalance(ledger.currentBalance, ledger.currentBalanceType);
    const difference = money(expectedSigned - storedSigned);
    if (Math.abs(difference) > 0.01) {
      const row = {
        ledgerId: ledger._id,
        ledgerName: ledger.name,
        code: ledger.code,
        groupName: ledger.groupId?.name,
        storedBalance: money(ledger.currentBalance),
        storedBalanceType: ledger.currentBalanceType,
        expectedBalance: expected.amount,
        expectedBalanceType: expected.type,
        difference,
        status: "mismatch",
      };
      mismatches.push(row);
      if (apply) {
        await Ledger.findByIdAndUpdate(ledger._id, {
          currentBalance: expected.amount,
          currentBalanceType: expected.type,
        });
      }
    }
  }

  return {
    fixed: Boolean(apply),
    checkedAt: new Date(),
    mismatches,
    count: mismatches.length,
    userId,
  };
};

export const checkUnbalancedVouchers = async () => {
  const vouchers = await Voucher.find({ status: { $in: ["POSTED", "DRAFT"] } }).lean();
  const totals = await VoucherEntry.aggregate([
    { $group: { _id: "$voucherId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" }, lines: { $sum: 1 } } },
  ]);
  const totalsByVoucher = new Map(totals.map((row) => [idString(row._id), row]));

  return vouchers
    .map((voucher) => {
      const total = totalsByVoucher.get(idString(voucher._id)) || { debit: 0, credit: 0, lines: 0 };
      if (total.lines < 2 || isMismatch(total.debit, total.credit) || isMismatch(voucher.totalDebit, voucher.totalCredit)) {
        return issue({
          type: "UNBALANCED_VOUCHER",
          severity: "critical",
          module: voucher.referenceModule || "voucher",
          voucherId: voucher._id,
          referenceId: voucher.referenceId,
          referenceNo: voucher.referenceNo || voucher.voucherNo,
          message: `Voucher ${voucher.voucherNo} is not balanced.`,
          suggestedFix: "Review voucher entries, then cancel/repost the source transaction if required.",
          details: { voucherDebit: voucher.totalDebit, voucherCredit: voucher.totalCredit, entryDebit: total.debit, entryCredit: total.credit, lines: total.lines },
        });
      }
      return null;
    })
    .filter(Boolean);
};

export const checkDuplicateVouchers = async () => {
  const modules = ["sale_invoice", "sale", "purchase", "payment_in", "payment_out", "expense", "manual_cash_in", "manual_cash_out", "cash_bank_adjustment", "opening_cash_bank", "bank_transfer", "sale_return", "purchase_return"];
  const duplicates = await Voucher.aggregate([
    { $match: { referenceModule: { $in: modules }, referenceId: { $ne: null }, status: { $nin: ["CANCELLED", "REVERSED"] } } },
    {
      $group: {
        _id: { referenceModule: "$referenceModule", referenceId: "$referenceId", voucherTypeCode: "$voucherTypeCode" },
        count: { $sum: 1 },
        vouchers: { $push: { _id: "$_id", voucherNo: "$voucherNo", status: "$status" } },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  return duplicates.map((row) => issue({
    type: "DUPLICATE_VOUCHER",
    severity: "critical",
    module: row._id.referenceModule,
    referenceId: row._id.referenceId,
    referenceNo: row.vouchers.map((voucher) => voucher.voucherNo).join(", "),
    message: `Duplicate ${row._id.voucherTypeCode} vouchers found for one reference.`,
    suggestedFix: "Cancel the duplicate voucher and reconcile ledger balances.",
    details: row,
  }));
};

export const checkLedgerBalanceMismatch = async () => {
  const result = await recalculateLedgerBalancesFromVouchers({ apply: false });
  return result.mismatches.map((row) => issue({
    type: "LEDGER_BALANCE_MISMATCH",
    severity: "critical",
    module: "ledger",
    referenceId: row.ledgerId,
    referenceNo: row.code,
    message: `${row.ledgerName} stored balance does not match posted vouchers.`,
    suggestedFix: "Run ledger reconciliation fix after reviewing mismatches.",
    suggestedApi: "/api/accounting/reconciliation/ledgers/fix",
    actionType: "RECALCULATE_LEDGER_BALANCE",
    safeToAutoFix: true,
    details: row,
  }));
};

export const checkMissingAccountingPostings = async () => {
  const settings = await AccountingSettings.findOne().lean();
  if (settings && settings.accountingEnabled === false) return [];

  const missing = [];
  for (const config of sourceModules) {
    const docs = await config.model.find({
      ...config.filter,
      $or: [
        { accountingPosted: false },
        { accountingVoucherId: { $exists: false } },
        { accountingVoucherId: null },
        { accountingStatus: { $ne: "posted" } },
      ],
    }).limit(250).lean();

    for (const doc of docs) {
      const referenceModule = config.referenceModule || cashBankReferenceModule(doc);
      const existing = referenceModule
        ? await getReferenceVoucher(referenceModule, referenceModule === "bank_transfer" ? doc.referenceId : doc._id)
        : null;
      if (existing) continue;
      missing.push(issue({
        type: "MISSING_POSTING",
        severity: "warning",
        module: config.module,
        referenceId: doc._id,
        referenceNo: config.no(doc),
        message: `${config.module.replaceAll("_", " ")} has no posted accounting voucher.`,
        suggestedFix: "Repost accounting for this document.",
        suggestedApi: config.repostApi(doc._id),
        actionType: "REPOST_ACCOUNTING",
        safeToAutoFix: true,
        details: {
          documentDate: config.date(doc),
          amount: money(config.amount(doc)),
          reason: doc.accountingError || "accountingPosted false or voucher missing",
        },
      }));
    }
  }
  return missing;
};

export const checkCashBankMismatch = async () => {
  const accounts = await getCashBankReconciliation();
  return accounts.accounts
    .filter((account) => account.status !== "ok")
    .map((account) => issue({
      type: "CASH_BANK_MISMATCH",
      severity: "warning",
      module: "cash_bank",
      referenceId: account.accountId,
      referenceNo: account.accountName,
      message: `${account.accountName} cash/bank balance differs from accounting ledger or transactions.`,
      suggestedFix: account.mappedLedger ? "Review cash/bank account mapping and transaction history." : "Link the cash/bank account to an accounting ledger.",
      suggestedApi: account.mappedLedger ? undefined : "/api/accounting/reconciliation/cash-bank/link-ledgers",
      actionType: account.mappedLedger ? "REVIEW_ONLY" : "LINK_CASH_BANK_LEDGER",
      safeToAutoFix: !account.mappedLedger,
      details: account,
    }));
};

export const checkPartyLedgerMismatch = async () => {
  const reconciliation = await getPartyReconciliation();
  return [...reconciliation.customers, ...reconciliation.suppliers]
    .filter((row) => row.status !== "ok")
    .map((row) => issue({
      type: "PARTY_LEDGER_MISMATCH",
      severity: "warning",
      module: row.partyType,
      referenceId: row.partyId,
      referenceNo: row.partyName,
      message: `${row.partyName} party balance differs between business, party ledger, and accounting ledger.`,
      suggestedFix: row.suggestedFix,
      suggestedApi: row.suggestedApi,
      actionType: row.suggestedApi ? "LINK_PARTY_LEDGER" : "REVIEW_ONLY",
      safeToAutoFix: Boolean(row.suggestedApi),
      details: row,
    }));
};

export const checkGSTMismatch = async (filters = {}) => {
  const reconciliation = await getGSTReconciliation(filters);
  return reconciliation.mismatches.map((row) => issue({
    type: "GST_MISMATCH",
    severity: "warning",
    module: "gst",
    referenceNo: row.ledgerCode,
    message: `${row.ledgerCode} report amount ${Math.abs(row.expected).toFixed(2)} differs from accounting ledger ${row.actual === null ? "missing" : Math.abs(row.actual).toFixed(2)}.`,
    suggestedFix: row.status === "missing_ledger"
      ? "Restore or initialize the missing GST ledger, then repost affected GST documents."
      : "Open the GST debug report for this tax head and compare source documents with posted GST voucher entries.",
    suggestedApi: `/api/accounting/gst/debug?ledgerCode=${encodeURIComponent(row.ledgerCode)}`,
    actionType: "FIX_GST_FIELD_MAPPING",
    safeToAutoFix: false,
    details: row,
  }));
};

export const checkOrphanVoucherEntries = async () => {
  const entries = await VoucherEntry.find().populate("voucherId", "_id voucherNo").limit(5000).lean();
  return entries
    .filter((entry) => !entry.voucherId)
    .map((entry) => issue({
      type: "ORPHAN_VOUCHER_ENTRY",
      severity: "critical",
      module: "voucher_entry",
      referenceId: entry._id,
      message: "Voucher entry has no parent voucher.",
      suggestedFix: "Investigate and remove orphan entry only after backup.",
      details: entry,
    }));
};

export const checkInvalidLedgerReferences = async () => {
  const entries = await VoucherEntry.find().populate("ledgerId", "_id name code isActive").limit(5000).lean();
  return entries
    .filter((entry) => !entry.ledgerId || entry.ledgerId.isActive === false)
    .map((entry) => issue({
      type: "INVALID_LEDGER_REFERENCE",
      severity: "critical",
      module: "voucher_entry",
      referenceId: entry._id,
      voucherId: entry.voucherId,
      message: "Voucher entry points to a missing or inactive ledger.",
      suggestedFix: "Restore or remap the ledger, then reconcile ledger balances.",
      details: entry,
    }));
};

export const checkCancelledVoucherImpact = async () => {
  const cancelled = await Voucher.find({ status: "CANCELLED", cancelledAt: { $exists: false } }).lean();
  return cancelled.map((voucher) => issue({
    type: "CANCELLED_VOUCHER_AUDIT",
    severity: "info",
    module: voucher.referenceModule || "voucher",
    voucherId: voucher._id,
    referenceNo: voucher.voucherNo,
    message: `Cancelled voucher ${voucher.voucherNo} is missing cancellation metadata.`,
    suggestedFix: "Review cancellation audit trail.",
    details: voucher,
  }));
};

export const getCashBankReconciliation = async () => {
  const details = await getCashBankReconciliationDetails();
  return {
    checkedAt: details.checkedAt,
    accounts: details.accounts.map((account) => ({
      accountId: account.accountId,
      accountName: account.accountName,
      accountType: account.accountType,
      cashBankBalance: account.currentBalance,
      ledgerBalance: account.ledgerBalance,
      transactionBalance: account.transactionBalance,
      difference: account.difference,
      transactionDifference: account.transactionDifference,
      status: account.status,
      suggestedFix: account.suggestedFix,
    })),
  };
};

const normalizeAccountName = (value) => String(value || "").trim().toLowerCase();

const findDefaultCashLedger = async () => {
  const settings = await AccountingSettings.findOne()
    .populate("defaultCashLedgerId", "name code currentBalance currentBalanceType openingBalance openingBalanceType ledgerType isActive")
    .lean();
  if (settings?.defaultCashLedgerId?.isActive !== false && settings?.defaultCashLedgerId) {
    return settings.defaultCashLedgerId;
  }

  return Ledger.findOne({
    isActive: true,
    $or: [
      { code: "CASH" },
      { code: "CASH_IN_HAND" },
      { name: /^cash in hand/i },
      { ledgerType: "CASH" },
    ],
  });
};

const findExistingBankLedger = async (account) => {
  if (account.accountingLedgerId) {
    const linked = await Ledger.findOne({ _id: account.accountingLedgerId, isActive: true });
    if (linked) return linked;
  }

  const shortCode = `BANK-${shortId(account._id)}`;
  const nameValues = [account.bankName, account.accountName].filter(Boolean);
  const nameQueries = nameValues.map((value) => ({
    name: new RegExp(`\\b${String(value).trim().replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i"),
  }));

  const searchFilters = [
    { code: shortCode },
    account.accountNumber ? { "bankDetails.accountNumber": account.accountNumber } : null,
    account.ifscCode ? { "bankDetails.ifscCode": account.ifscCode } : null,
    ...nameQueries,
  ].filter(Boolean);

  return Ledger.findOne({
    isActive: true,
    ledgerType: "BANK",
    $or: searchFilters,
  });
};

const createBankLedgerForAccount = async (account, userId = null) => {
  const bankGroup = await AccountGroup.findOne({ code: "BANK_ACCOUNTS", isActive: true });
  if (!bankGroup) {
    throw new Error("Bank Accounts group is not configured.");
  }

  const code = normalizeAccountName(account.accountName) === "sbi" ? "BANK-SBI" : `BANK-${shortId(account._id)}`;
  try {
    return await Ledger.create({
      name: normalizeAccountName(account.accountName) === "sbi" ? "SBI Bank A/c" : `${account.accountName} A/c`,
      code,
      groupId: bankGroup._id,
      ledgerType: "BANK",
      openingBalance: 0,
      openingBalanceType: "DEBIT",
      currentBalance: 0,
      currentBalanceType: "DEBIT",
      partyType: "none",
      bankDetails: {
        bankName: account.bankName || account.accountName,
        accountNumber: account.accountNumber,
        ifscCode: account.ifscCode,
      },
      isActive: true,
      createdBy: userId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Ledger.findOne({ code, isActive: true });
      if (existing) return existing;
    }
    throw error;
  }
};

export const linkCashBankAccountLedgers = async ({ userId = null } = {}) => {
  const accounts = await BankAccount.find({ status: "active" });
  const results = [];

  for (const account of accounts) {
    const normalized = normalizeAccountName(account.accountName);
    let ledger = null;
    let action = "unchanged";

    if (account.accountType === "cash" || normalized === "cash in hand") {
      ledger = await findDefaultCashLedger();
      if (!ledger) {
        results.push({
          accountId: account._id,
          accountName: account.accountName,
          accountType: account.accountType,
          action: "failed",
          message: "Default Cash A/c ledger was not found. Configure default cash ledger first.",
        });
        continue;
      }
    } else {
      ledger = await findExistingBankLedger(account);
      if (!ledger) {
        ledger = await createBankLedgerForAccount(account, userId);
        action = "created_ledger";
      }
    }

    if (ledger && idString(account.accountingLedgerId) !== idString(ledger._id)) {
      account.accountingLedgerId = ledger._id;
      account.accountingLinked = true;
      await account.save({ validateBeforeSave: false });
      action = action === "created_ledger" ? "created_and_linked" : "linked";
    }

    results.push({
      accountId: account._id,
      accountName: account.accountName,
      accountType: account.accountType,
      ledgerId: ledger?._id,
      ledgerName: ledger?.name,
      ledgerCode: ledger?.code,
      action,
      message: action === "unchanged" ? "Account already linked to the correct ledger." : "Account linked to accounting ledger.",
    });
  }

  return { linkedAt: new Date(), results };
};

const isOpeningCashBankTransaction = (tx) => (
  tx.type === "opening_cash"
  || tx.referenceModule === "opening_cash_bank"
  || tx.referenceModule === "cash_bank_opening_balance"
);

const getCashBankComparableBalance = (account, transactions) => {
  const openingBalance = money(account.openingBalance);
  const storedCurrentBalance = money(account.currentBalance);
  const openingTxMovement = money(transactions
    .filter(isOpeningCashBankTransaction)
    .reduce((sum, tx) => sum + (tx.direction === "in" ? money(tx.amount) : -money(tx.amount)), 0));
  const operatingMovement = money(transactions
    .filter((tx) => !isOpeningCashBankTransaction(tx))
    .reduce((sum, tx) => sum + (tx.direction === "in" ? money(tx.amount) : -money(tx.amount)), 0));
  const rawTransactionNet = money(openingTxMovement + operatingMovement);
  const hasOpeningTransaction = Math.abs(openingTxMovement) > 0.01;
  const transactionBalance = openingBalance > 0
    ? money(openingBalance + operatingMovement)
    : money(rawTransactionNet);
  const openingTreatment = hasOpeningTransaction && openingBalance > 0
    ? "legacy_opening_transaction_excluded_from_transaction_balance"
    : hasOpeningTransaction
      ? "opening_transaction_used_as_opening_balance"
      : "account_opening_balance_field_used";

  return {
    openingBalance,
    storedCurrentBalance,
    openingTxMovement,
    operatingMovement,
    transactionNet: rawTransactionNet,
    transactionBalance,
    calculatedCurrentBalance: transactionBalance,
    hasOpeningTransaction,
    openingTreatment,
  };
};

export const getCashBankReconciliationDetails = async () => {
  const accounts = await BankAccount.find({ status: "active" })
    .populate("accountingLedgerId", "name code currentBalance currentBalanceType openingBalance openingBalanceType ledgerType groupId")
    .lean();
  const rows = [];

  for (const account of accounts) {
    const txRows = await CashBankTransaction.find({ accountId: account._id, status: "completed" }).lean();
    const openingVoucher = await getReferenceVoucher("cash_bank_opening_balance", account._id);
    const comparable = getCashBankComparableBalance(account, txRows);
    const ledgerBalance = account.accountingLedgerId
      ? signedBalance(account.accountingLedgerId.currentBalance, account.accountingLedgerId.currentBalanceType)
      : null;
    const ledgerOpeningBalance = account.accountingLedgerId
      ? signedBalance(account.accountingLedgerId.openingBalance, account.accountingLedgerId.openingBalanceType)
      : null;
    const currentBalance = comparable.storedCurrentBalance;
    const difference = ledgerBalance === null ? currentBalance : money(comparable.calculatedCurrentBalance - ledgerBalance);
    const storedBalanceDifference = money(currentBalance - comparable.calculatedCurrentBalance);
    const transactionDifference = ledgerBalance === null ? null : money(comparable.transactionBalance - ledgerBalance);
    const ledgerMasterOpeningDifference = ledgerOpeningBalance === null ? null : money(comparable.openingBalance - ledgerOpeningBalance);
    const openingBalanceDifference = openingVoucher ? null : ledgerMasterOpeningDifference;
    const status = !account.accountingLedgerId
      ? "missing_ledger"
      : (isMismatch(comparable.calculatedCurrentBalance, ledgerBalance) || isMismatch(currentBalance, comparable.calculatedCurrentBalance) ? "mismatch" : "ok");

    let suggestedFix = "No action required.";
    if (!account.accountingLedgerId) {
      suggestedFix = "Run Link Cash/Bank Ledgers to map this account to an accounting ledger.";
    } else if (Math.abs(storedBalanceDifference) > 0.01) {
      suggestedFix = "Cash/bank stored current balance differs from opening plus non-opening transaction movement. Review cash/bank transaction history before recalculating ledgers.";
    } else if (!openingVoucher && openingBalanceDifference && Math.abs(openingBalanceDifference) > 0.01 && Math.abs(difference) <= Math.abs(openingBalanceDifference) + 0.01) {
      suggestedFix = "Remaining difference appears related to opening balance. Post cash/bank opening balances, then run Recalculate Ledger Balances.";
    } else if (openingVoucher && ledgerMasterOpeningDifference && Math.abs(ledgerMasterOpeningDifference) > 0.01 && status === "ok") {
      suggestedFix = "No action required. Opening balance is represented by an opening voucher, so the ledger master opening can remain zero.";
    } else if (status === "mismatch") {
      suggestedFix = "Run Recalculate Ledger Balances, then review missing cash/bank vouchers if the difference remains.";
    }

    rows.push({
      accountId: account._id,
      accountName: account.accountName,
      accountType: account.accountType,
      currentBalance,
      openingBalance: comparable.openingBalance,
      openingTxMovement: comparable.openingTxMovement,
      operatingMovement: comparable.operatingMovement,
      transactionNet: comparable.transactionNet,
      transactionBalance: comparable.transactionBalance,
      calculatedCurrentBalance: comparable.calculatedCurrentBalance,
      storedBalanceDifference,
      openingTreatment: comparable.openingTreatment,
      hasOpeningTransaction: comparable.hasOpeningTransaction,
      mappedLedger: account.accountingLedgerId ? {
        ledgerId: account.accountingLedgerId._id,
        name: account.accountingLedgerId.name,
        code: account.accountingLedgerId.code,
        ledgerType: account.accountingLedgerId.ledgerType,
        openingBalance: money(account.accountingLedgerId.openingBalance),
        openingBalanceType: account.accountingLedgerId.openingBalanceType,
      } : null,
      ledgerBalance,
      ledgerBalanceType: account.accountingLedgerId?.currentBalanceType || null,
      difference,
      transactionDifference,
      openingBalanceDifference,
      ledgerMasterOpeningDifference,
      openingVoucher: openingVoucher ? {
        voucherId: openingVoucher._id,
        voucherNo: openingVoucher.voucherNo,
        status: openingVoucher.status,
      } : null,
      openingPosted: Boolean(openingVoucher || account.accountingOpeningPosted),
      status,
      suggestedFix,
    });
  }

  const rowsByLedger = rows.reduce((acc, row) => {
    const ledgerId = idString(row.mappedLedger?.ledgerId);
    if (!ledgerId) return acc;
    if (!acc.has(ledgerId)) acc.set(ledgerId, []);
    acc.get(ledgerId).push(row);
    return acc;
  }, new Map());

  for (const groupRows of rowsByLedger.values()) {
    const ledgerType = groupRows[0]?.mappedLedger?.ledgerType;
    if (ledgerType !== "CASH" || groupRows.length <= 1) continue;

    const sharedStoredBalance = money(groupRows.reduce((sum, row) => sum + row.currentBalance, 0));
    const sharedCalculatedBalance = money(groupRows.reduce((sum, row) => sum + row.calculatedCurrentBalance, 0));
    const sharedLedgerBalance = groupRows[0].ledgerBalance;
    const sharedDifference = sharedLedgerBalance === null ? sharedCalculatedBalance : money(sharedCalculatedBalance - sharedLedgerBalance);
    const sharedStoredDifference = money(sharedStoredBalance - sharedCalculatedBalance);
    const sharedStatus = sharedLedgerBalance === null
      ? "missing_ledger"
      : (isMismatch(sharedCalculatedBalance, sharedLedgerBalance) || isMismatch(sharedStoredBalance, sharedCalculatedBalance) ? "mismatch" : "ok");

    for (const row of groupRows) {
      row.sharedLedger = true;
      row.sharedLedgerAccountCount = groupRows.length;
      row.sharedLedgerStoredBalance = sharedStoredBalance;
      row.sharedLedgerCalculatedBalance = sharedCalculatedBalance;
      row.sharedLedgerDifference = sharedDifference;
      row.sharedLedgerStoredDifference = sharedStoredDifference;
      row.difference = sharedDifference;
      row.transactionDifference = sharedDifference;
      row.status = sharedStatus;
      row.suggestedFix = sharedStatus === "ok"
        ? "Cash ledger is shared; reconciliation is OK when cash accounts are compared in aggregate."
        : "Cash ledger is shared by multiple cash accounts. Review aggregate cash movements, post missing opening balances, then run Recalculate Ledger Balances.";
    }
  }

  return { checkedAt: new Date(), accounts: rows };
};

const latestPartyLedgerSummary = async (partyId, partyType) => {
  const [row, count] = await Promise.all([
    PartyLedger.findOne({ partyId, partyType }).sort({ date: -1, createdAt: -1 }).lean(),
    PartyLedger.countDocuments({ partyId, partyType }),
  ]);
  if (!row) return { balance: null, entryCount: 0, lastEntry: null };
  return {
    balance: money(row.balanceAfter),
    entryCount: count,
    lastEntry: {
      entryId: row._id,
      type: row.type,
      receiptNo: row.receiptNo,
      debitAmount: money(row.debitAmount),
      creditAmount: money(row.creditAmount),
      balanceAfter: money(row.balanceAfter),
      date: row.date,
    },
  };
};

export const getPartyReconciliation = async () => {
  const [customers, suppliers] = await Promise.all([
    Customer.find({ isActive: true }).lean(),
    Supplier.find({ isActive: true }).lean(),
  ]);
  const customerRows = [];
  for (const customer of customers) {
    const ledger = customer.accountingLedgerId
      ? await Ledger.findOne({ _id: customer.accountingLedgerId, isActive: true }).lean()
      : await Ledger.findOne({ partyId: customer._id, partyType: "customer", isActive: true }).lean();
    const businessBalance = -money(customer.walletBalance ?? 0);
    const partyLedger = await latestPartyLedgerSummary(customer._id, "Customer");
    const partyLedgerBalance = partyLedger.balance;
    const accountingBalance = ledger ? signedBalance(ledger.currentBalance, ledger.currentBalanceType) : null;
    const customerMismatch = accountingBalance !== null && isMismatch(businessBalance, accountingBalance);
    const partyLedgerMismatch = accountingBalance !== null && partyLedgerBalance !== null && isMismatch(partyLedgerBalance, accountingBalance);
    const missingPartyLedgerHistory = partyLedgerBalance === null
      && (Math.abs(businessBalance) > 0.01 || (accountingBalance !== null && Math.abs(accountingBalance) > 0.01));
    customerRows.push({
      partyId: customer._id,
      partyType: "customer",
      partyName: customer.name,
      businessBalance,
      partyLedgerBalance,
      partyLedgerEntryCount: partyLedger.entryCount,
      lastPartyLedgerEntry: partyLedger.lastEntry,
      accountingBalance,
      difference: accountingBalance === null ? businessBalance : money(businessBalance - accountingBalance),
      status: !ledger
        ? "missing_accounting_ledger"
        : missingPartyLedgerHistory
          ? "missing_party_ledger_history"
          : (customerMismatch || partyLedgerMismatch ? "mismatch" : "ok"),
      suggestedFix: !ledger
        ? "Create missing customer accounting ledgers using the reconciliation fix action."
        : missingPartyLedgerHistory
          ? "No party ledger history exists yet. Rebuild or seed party ledger entries before treating this party as fully reconciled."
          : customerMismatch || partyLedgerMismatch
            ? "Review customer ledger entries, then repost missing sale/payment accounting if needed."
            : "No action required.",
      suggestedApi: !ledger ? "/api/accounting/reconciliation/parties/link-ledgers" : undefined,
    });
  }
  const supplierRows = [];
  for (const supplier of suppliers) {
    const ledger = supplier.accountingLedgerId
      ? await Ledger.findOne({ _id: supplier.accountingLedgerId, isActive: true }).lean()
      : await Ledger.findOne({ partyId: supplier._id, partyType: "supplier", isActive: true }).lean();
    const businessBalance = -money(supplier.outstandingBalance ?? 0);
    const partyLedger = await latestPartyLedgerSummary(supplier._id, "Supplier");
    const rawPartyLedgerBalance = partyLedger.balance;
    const partyLedgerBalance = rawPartyLedgerBalance === null ? null : -money(rawPartyLedgerBalance);
    const accountingBalance = ledger ? signedBalance(ledger.currentBalance, ledger.currentBalanceType) : null;
    const supplierMismatch = accountingBalance !== null && isMismatch(businessBalance, accountingBalance);
    const partyLedgerMismatch = accountingBalance !== null && partyLedgerBalance !== null && isMismatch(partyLedgerBalance, accountingBalance);
    const missingPartyLedgerHistory = partyLedgerBalance === null
      && (Math.abs(businessBalance) > 0.01 || (accountingBalance !== null && Math.abs(accountingBalance) > 0.01));
    supplierRows.push({
      partyId: supplier._id,
      partyType: "supplier",
      partyName: supplier.name,
      businessBalance,
      partyLedgerBalance,
      partyLedgerEntryCount: partyLedger.entryCount,
      lastPartyLedgerEntry: partyLedger.lastEntry,
      accountingBalance,
      difference: accountingBalance === null ? businessBalance : money(businessBalance - accountingBalance),
      status: !ledger
        ? "missing_accounting_ledger"
        : missingPartyLedgerHistory
          ? "missing_party_ledger_history"
          : (supplierMismatch || partyLedgerMismatch ? "mismatch" : "ok"),
      suggestedFix: !ledger
        ? "Create missing supplier accounting ledgers using the reconciliation fix action."
        : missingPartyLedgerHistory
          ? "No party ledger history exists yet. Rebuild or seed party ledger entries before treating this party as fully reconciled."
          : supplierMismatch || partyLedgerMismatch
            ? "Review supplier ledger entries, then repost missing purchase/payment accounting if needed."
            : "No action required.",
      suggestedApi: !ledger ? "/api/accounting/reconciliation/parties/link-ledgers" : undefined,
    });
  }
  return { checkedAt: new Date(), customers: customerRows, suppliers: supplierRows };
};

const gstLedgerBalance = async (code, filters = {}) => {
  const ledger = await Ledger.findOne({ code }).lean();
  if (!ledger) return null;
  const totals = await VoucherEntry.aggregate([
    { $match: { ledgerId: ledger._id } },
    { $lookup: { from: "vouchers", localField: "voucherId", foreignField: "_id", as: "voucher" } },
    { $unwind: "$voucher" },
    { $match: { "voucher.status": "POSTED" } },
    { $match: voucherDateMatch(filters) },
    { $group: { _id: "$ledgerId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);
  const total = totals[0] || { debit: 0, credit: 0 };
  return {
    ledgerId: ledger._id,
    ledgerName: ledger.name,
    code,
    debit: money(total.debit),
    credit: money(total.credit),
    signed: money(total.debit - total.credit),
    balanceType: money(total.debit - total.credit) < 0 ? "CREDIT" : "DEBIT",
  };
};

export const linkPartyAccountingLedgers = async ({ userId = null } = {}) => {
  const customers = await Customer.find({ isActive: true }).lean();
  const suppliers = await Supplier.find({ isActive: true }).lean();
  const results = [];

  for (const customer of customers) {
    try {
      const ledger = await ensureCustomerAccountingLedger(customer._id, null, userId, { required: false });
      results.push({
        partyId: customer._id,
        partyType: "customer",
        partyName: customer.name,
        ledgerId: ledger?._id,
        ledgerCode: ledger?.code,
        ledgerName: ledger?.name,
        action: ledger ? "linked" : "skipped",
        message: ledger ? "Customer accounting ledger ensured." : "Customer ledger could not be created because accounting foundation is missing.",
      });
    } catch (error) {
      results.push({
        partyId: customer._id,
        partyType: "customer",
        partyName: customer.name,
        action: "failed",
        message: String(error?.message || error),
      });
    }
  }

  for (const supplier of suppliers) {
    try {
      const ledger = await ensureSupplierAccountingLedger(supplier._id, null, userId, { required: false });
      results.push({
        partyId: supplier._id,
        partyType: "supplier",
        partyName: supplier.name,
        ledgerId: ledger?._id,
        ledgerCode: ledger?.code,
        ledgerName: ledger?.name,
        action: ledger ? "linked" : "skipped",
        message: ledger ? "Supplier accounting ledger ensured." : "Supplier ledger could not be created because accounting foundation is missing.",
      });
    } catch (error) {
      results.push({
        partyId: supplier._id,
        partyType: "supplier",
        partyName: supplier.name,
        action: "failed",
        message: String(error?.message || error),
      });
    }
  }

  return {
    linkedAt: new Date(),
    results,
  };
};

export const getGSTReconciliation = async (filters = {}) => {
  const summary = await getGSTSummary(filters);
  const period = {
    startDate: startOfDay(filters.startDate),
    endDate: endOfDay(filters.endDate),
  };
  const expected = {
    OUTPUT_CGST: -money(summary.outputGST.cgst),
    OUTPUT_SGST: -money(summary.outputGST.sgst),
    OUTPUT_IGST: -money(summary.outputGST.igst),
    INPUT_CGST: money(summary.inputGST.cgst),
    INPUT_SGST: money(summary.inputGST.sgst),
    INPUT_IGST: money(summary.inputGST.igst),
  };
  const rows = [];
  for (const code of Object.keys(expected)) {
    const ledger = await gstLedgerBalance(code, filters);
    const actual = ledger?.signed ?? null;
    rows.push({
      ledgerCode: code,
      expected: expected[code],
      actual,
      difference: actual === null ? expected[code] : money(expected[code] - actual),
      expectedType: expected[code] < 0 ? "CREDIT" : "DEBIT",
      actualType: actual === null ? null : actual < 0 ? "CREDIT" : "DEBIT",
      status: actual === null ? "missing_ledger" : (isMismatch(expected[code], actual) ? "mismatch" : "ok"),
      ledger,
    });
  }
  return {
    checkedAt: new Date(),
    period,
    outputGST: summary.outputGST,
    inputGST: summary.inputGST,
    rows,
    mismatches: rows.filter((row) => row.status !== "ok"),
  };
};

export const runAccountingHealthCheck = async () => {
  const checkGroups = await Promise.all([
    checkUnbalancedVouchers(),
    checkDuplicateVouchers(),
    checkLedgerBalanceMismatch(),
    checkMissingAccountingPostings(),
    checkCashBankMismatch(),
    checkPartyLedgerMismatch(),
    checkGSTMismatch(),
    checkOrphanVoucherEntries(),
    checkInvalidLedgerReferences(),
    checkCancelledVoucherImpact(),
  ]);
  const issues = checkGroups.flat();
  const summary = issues.reduce((acc, row) => {
    acc.totalIssues += 1;
    acc[`${row.severity}Issues`] = (acc[`${row.severity}Issues`] || 0) + 1;
    if (row.type === "MISSING_POSTING") acc.missingPostings += 1;
    if (row.type === "LEDGER_BALANCE_MISMATCH") acc.ledgerMismatches += 1;
    if (row.type === "DUPLICATE_VOUCHER") acc.duplicateVouchers += 1;
    return acc;
  }, {
    totalIssues: 0,
    criticalIssues: 0,
    warningIssues: 0,
    infoIssues: 0,
    missingPostings: 0,
    ledgerMismatches: 0,
    duplicateVouchers: 0,
  });

  return {
    status: summary.criticalIssues > 0 ? "critical" : summary.warningIssues > 0 ? "warning" : "healthy",
    checkedAt: new Date(),
    summary,
    issues,
  };
};
