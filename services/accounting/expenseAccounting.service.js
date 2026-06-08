import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Expense from "../../models/Expense.js";
import { LEDGER_TYPES, NORMAL_BALANCE } from "../../constants/accounting.constants.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";
import { postVoucher } from "./voucher.service.js";

const EXPENSE_REFERENCE_MODULE = "expense";

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
    throw new Error("Accounting ledger is not configured for one or more expense voucher entries.");
  }

  entries.push({
    ledgerId: ledger._id,
    debit: normalizedDebit,
    credit: normalizedCredit,
    narration,
  });
};

const getExpenseGroup = async (session = null) => {
  const group = await queryWithSession(AccountGroup.findOne({ code: "INDIRECT_EXPENSES", isActive: true }), session);
  if (!group) throw new Error("Indirect Expenses account group is not configured.");
  return group;
};

export const getOrCreateExpenseLedger = async (categoryName, session = null, createdBy = null) => {
  const name = String(categoryName || "General Expenses").trim() || "General Expenses";
  const code = `EXP-${normalizeCodePart(name)}`;

  let ledger = await queryWithSession(Ledger.findOne({ code, isActive: true }), session);
  if (ledger) return ledger;

  const group = await getExpenseGroup(session);
  try {
    return await createDocument(Ledger, {
      name: `${name} A/c`,
      code,
      groupId: group._id,
      ledgerType: LEDGER_TYPES.EXPENSE,
      openingBalance: 0,
      openingBalanceType: NORMAL_BALANCE.DEBIT,
      currentBalance: 0,
      currentBalanceType: NORMAL_BALANCE.DEBIT,
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

  return queryWithSession(
    Voucher.findOne({
      referenceModule: EXPENSE_REFERENCE_MODULE,
      referenceId: expense._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
};

export const postExpenseAccountingVoucher = async (expenseInput, { createdBy } = {}, options = {}) => {
  const session = options.session || null;
  const expense = typeof expenseInput?.save === "function"
    ? expenseInput
    : await queryWithSession(Expense.findById(expenseInput), session);

  if (!expense) {
    throw new Error("Expense not found for accounting posting.");
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

  const amount = money(expense.amount);
  if (amount <= 0) {
    throw new Error("Expense amount must be greater than zero for accounting posting.");
  }

  const expenseLedger = await getOrCreateExpenseLedger(
    expense.categoryName || expense.category || expense.title,
    session,
    createdBy,
  );
  const paymentLedger = await getOrCreateCashBankLedger(
    expense.paymentMethod === "cash" ? null : expense.cashBankAccountId,
    settings,
    session,
    createdBy,
  );

  const entries = [];
  const expenseNo = expense.reference || String(expense._id).slice(-8).toUpperCase();
  const narration = `Expense entry ${expenseNo}`;

  addEntry(entries, expenseLedger, amount, 0, `Expense recorded: ${expense.categoryName || expense.category || expense.title}`);
  addEntry(entries, paymentLedger, 0, amount, `Payment made for expense ${expenseNo}`);

  const posted = await postVoucher({
    voucherTypeCode: "EXPENSE",
    date: expense.date || new Date(),
    referenceModule: EXPENSE_REFERENCE_MODULE,
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

export const markExpenseAccountingFailure = async (expenseId, error, session = null) => {
  await markExpenseAccounting(expenseId, {
    accountingPosted: false,
    accountingStatus: "failed",
    accountingError: String(error?.message || error || "Accounting posting failed").slice(0, 500),
  }, session);
};

export const EXPENSE_ACCOUNTING_REFERENCE_MODULE = EXPENSE_REFERENCE_MODULE;
