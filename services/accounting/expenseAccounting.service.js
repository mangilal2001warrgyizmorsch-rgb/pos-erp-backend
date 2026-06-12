import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Expense from "../../models/Expense.js";
import { LEDGER_TYPES, NORMAL_BALANCE } from "../../constants/accounting.constants.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";
import { postVoucher } from "./voucher.service.js";

const EXPENSE_REFERENCE_MODULE = "expense";
const INCOME_REFERENCE_MODULE = "income";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const money = (value) => roundMoney(Math.max(0, Number(value || 0)));

const queryWithSession = (query, session = null) => {
  if (session) query.session(session);
  return query;
};

const createDocument = async (Model, payload, session = null) => {
  if (!session) return Model.create(payload);
  const [doc] = await Model.create([payload], { session });
  return doc;
};

const normalizeCodePart = (value) =>
  String(value || "GENERAL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36) || "GENERAL";

const addEntry = (entries, ledger, debit, credit, narration) => {
  const normalizedDebit = money(debit);
  const normalizedCredit = money(credit);
  if (normalizedDebit <= 0 && normalizedCredit <= 0) return;
  if (!ledger) {
    throw new Error("Accounting ledger is not configured for one or more voucher entries.");
  }

  entries.push({
    ledgerId: ledger._id,
    debit: normalizedDebit,
    credit: normalizedCredit,
    narration,
  });
};

/**
 * Resolve the correct account group code based on entryType and nature
 */
const getGroupCode = (entryType, nature) => {
  if (entryType === "income") {
    return nature === "direct" ? "DIRECT_INCOME" : "INDIRECT_INCOME";
  }
  return nature === "direct" ? "DIRECT_EXPENSES" : "INDIRECT_EXPENSES";
};

/**
 * Get the correct ledger type based on entryType
 */
const getLedgerType = (entryType) => {
  return entryType === "income" ? LEDGER_TYPES.INCOME : LEDGER_TYPES.EXPENSE;
};

/**
 * Get the correct normal balance based on entryType
 */
const getNormalBalance = (entryType) => {
  return entryType === "income" ? NORMAL_BALANCE.CREDIT : NORMAL_BALANCE.DEBIT;
};

/**
 * Get or create an income/expense ledger under the correct group
 */
export const getOrCreateIncomeExpenseLedger = async (
  categoryName,
  entryType = "expense",
  nature = "indirect",
  session = null,
  createdBy = null,
) => {
  const name = String(categoryName || "General").trim() || "General";
  const prefix = entryType === "income" ? "INC" : "EXP";
  const code = `${prefix}-${normalizeCodePart(name)}`;

  let ledger = await queryWithSession(Ledger.findOne({ code, isActive: true }), session);
  if (ledger) return ledger;

  const groupCode = getGroupCode(entryType, nature);
  const group = await queryWithSession(AccountGroup.findOne({ code: groupCode, isActive: true }), session);
  if (!group) throw new Error(`${groupCode} account group is not configured.`);

  try {
    return await createDocument(Ledger, {
      name: `${name} A/c`,
      code,
      groupId: group._id,
      ledgerType: getLedgerType(entryType),
      openingBalance: 0,
      openingBalanceType: getNormalBalance(entryType),
      currentBalance: 0,
      currentBalanceType: getNormalBalance(entryType),
      partyType: "none",
      isSystemDefault: false,
      isActive: true,
      createdBy,
    }, session);
  } catch (error) {
    if (error?.code === 11000) {
      ledger = await queryWithSession(Ledger.findOne({ code, isActive: true }), session);
      if (ledger) return ledger;
    }
    throw error;
  }
};

// Keep backward compat alias
export const getOrCreateExpenseLedger = async (categoryName, session = null, createdBy = null) => {
  return getOrCreateIncomeExpenseLedger(categoryName, "expense", "indirect", session, createdBy);
};

const markExpenseAccounting = async (expenseId, fields, session = null) => {
  await Expense.findByIdAndUpdate(expenseId, {
    ...fields,
    accountingPostedAt: fields.accountingStatus === "posted" ? new Date() : undefined,
  }, { session });
};

const getExistingVoucher = async (expense, session = null) => {
  if (expense.accountingVoucherId) {
    const voucher = await queryWithSession(Voucher.findById(expense.accountingVoucherId), session);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  const refModule = expense.entryType === "income" ? INCOME_REFERENCE_MODULE : EXPENSE_REFERENCE_MODULE;
  return queryWithSession(
    Voucher.findOne({
      referenceModule: refModule,
      referenceId: expense._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
};

/**
 * Get GST ledgers for the entry
 */
const getGSTLedgers = async (entryType, gstType, session = null) => {
  const prefix = entryType === "expense" ? "INPUT" : "OUTPUT";

  if (gstType === "igst") {
    const igst = await queryWithSession(
      Ledger.findOne({ code: `${prefix}_IGST`, isActive: true }),
      session,
    );
    if (!igst) throw new Error(`${prefix} IGST ledger is not configured.`);
    return { type: "igst", igst };
  }

  const cgst = await queryWithSession(
    Ledger.findOne({ code: `${prefix}_CGST`, isActive: true }),
    session,
  );
  const sgst = await queryWithSession(
    Ledger.findOne({ code: `${prefix}_SGST`, isActive: true }),
    session,
  );
  if (!cgst || !sgst) throw new Error(`${prefix} CGST/SGST ledgers are not configured.`);
  return { type: "cgst_sgst", cgst, sgst };
};

/**
 * Main posting function for both income and expense entries with GST support
 */
export const postIncomeExpenseAccountingVoucher = async (expenseInput, { createdBy } = {}, options = {}) => {
  const session = options.session || null;
  const expense = typeof expenseInput?.save === "function"
    ? expenseInput
    : await queryWithSession(Expense.findById(expenseInput), session);

  if (!expense) {
    throw new Error("Entry not found for accounting posting.");
  }

  const existingVoucher = await getExistingVoucher(expense, session);
  if (existingVoucher) {
    await markExpenseAccounting(expense._id, {
      accountingVoucherId: existingVoucher._id,
      accountingPosted: existingVoucher.status === "POSTED",
      accountingStatus: existingVoucher.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    }, session);
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    await markExpenseAccounting(expense._id, {
      accountingPosted: false,
      accountingStatus: "not_posted",
      accountingError: "Accounting auto posting is disabled.",
    }, session);
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const entryType = expense.entryType || "expense";
  const nature = expense.nature || "indirect";
  const isIncome = entryType === "income";
  const gstApplicable = expense.gstApplicable || false;

  // Resolve amounts
  const taxableAmount = money(gstApplicable ? (expense.taxableAmount || expense.amount) : expense.amount);
  const gstAmount = money(gstApplicable ? expense.gstAmount : 0);
  const totalAmount = money(gstApplicable ? (expense.totalAmount || taxableAmount + gstAmount) : taxableAmount);

  if (totalAmount <= 0) {
    throw new Error("Amount must be greater than zero for accounting posting.");
  }

  // Resolve the income/expense ledger
  const incomeExpenseLedger = expense.ledgerId
    ? await queryWithSession(Ledger.findById(expense.ledgerId), session)
    : await getOrCreateIncomeExpenseLedger(
        expense.ledgerName || expense.categoryName || expense.category || expense.title,
        entryType,
        nature,
        session,
        createdBy,
      );

  if (!incomeExpenseLedger) {
    throw new Error("Income/Expense ledger not found.");
  }

  // Resolve payment/receipt account ledger
  const paymentLedger = await getOrCreateCashBankLedger(
    expense.paymentMethod === "cash" ? null : (expense.paymentAccountId || expense.cashBankAccountId),
    settings,
    session,
    createdBy,
  );

  const entries = [];
  const refNo = expense.reference || String(expense._id).slice(-8).toUpperCase();
  const narration = `${isIncome ? "Income" : "Expense"} entry ${refNo}`;
  const refModule = isIncome ? INCOME_REFERENCE_MODULE : EXPENSE_REFERENCE_MODULE;
  const voucherTypeCode = isIncome ? "INCOME" : "EXPENSE";

  if (isIncome) {
    // Income: Cash/Bank Dr, Income Ledger Cr (+ Output GST Cr if applicable)
    addEntry(entries, paymentLedger, totalAmount, 0, `Receipt for income ${refNo}`);
    addEntry(entries, incomeExpenseLedger, 0, taxableAmount, `Income recorded: ${expense.ledgerName || expense.title}`);

    if (gstApplicable && gstAmount > 0) {
      const gstLedgers = await getGSTLedgers("income", expense.gstType || "cgst_sgst", session);
      if (gstLedgers.type === "igst") {
        addEntry(entries, gstLedgers.igst, 0, gstAmount, `Output IGST on income ${refNo}`);
      } else {
        const halfGst = roundMoney(gstAmount / 2);
        addEntry(entries, gstLedgers.cgst, 0, halfGst, `Output CGST on income ${refNo}`);
        addEntry(entries, gstLedgers.sgst, 0, roundMoney(gstAmount - halfGst), `Output SGST on income ${refNo}`);
      }
    }
  } else {
    // Expense: Expense Ledger Dr (+ Input GST Dr if applicable), Cash/Bank Cr
    addEntry(entries, incomeExpenseLedger, taxableAmount, 0, `Expense recorded: ${expense.ledgerName || expense.title}`);

    if (gstApplicable && gstAmount > 0) {
      const gstLedgers = await getGSTLedgers("expense", expense.gstType || "cgst_sgst", session);
      if (gstLedgers.type === "igst") {
        addEntry(entries, gstLedgers.igst, gstAmount, 0, `Input IGST on expense ${refNo}`);
      } else {
        const halfGst = roundMoney(gstAmount / 2);
        addEntry(entries, gstLedgers.cgst, halfGst, 0, `Input CGST on expense ${refNo}`);
        addEntry(entries, gstLedgers.sgst, roundMoney(gstAmount - halfGst), 0, `Input SGST on expense ${refNo}`);
      }
    }

    addEntry(entries, paymentLedger, 0, totalAmount, `Payment made for expense ${refNo}`);
  }

  const posted = await postVoucher({
    voucherTypeCode,
    date: expense.date || new Date(),
    referenceModule: refModule,
    referenceId: expense._id,
    referenceNo: expense.reference || undefined,
    narration,
    entries,
    createdBy,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  await markExpenseAccounting(expense._id, {
    accountingVoucherId: voucher._id,
    accountingPosted: true,
    accountingStatus: "posted",
    accountingError: undefined,
  }, session);

  return posted;
};

// Backward compatible alias
export const postExpenseAccountingVoucher = postIncomeExpenseAccountingVoucher;

export const markExpenseAccountingFailure = async (expenseId, error, session = null) => {
  await markExpenseAccounting(expenseId, {
    accountingPosted: false,
    accountingStatus: "failed",
    accountingError: String(error?.message || error || "Accounting posting failed").slice(0, 500),
  }, session);
};

export const EXPENSE_ACCOUNTING_REFERENCE_MODULE = EXPENSE_REFERENCE_MODULE;
export const INCOME_ACCOUNTING_REFERENCE_MODULE = INCOME_REFERENCE_MODULE;
