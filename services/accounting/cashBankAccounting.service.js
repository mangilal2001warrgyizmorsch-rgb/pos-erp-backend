import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import BankAccount from "../../models/BankAccount.js";
import CashBankTransaction from "../../models/CashBankTransaction.js";
import { LEDGER_TYPES, NORMAL_BALANCE } from "../../constants/accounting.constants.js";
import { postVoucher } from "./voucher.service.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const money = (value) => roundMoney(Math.max(0, Number(value || 0)));
const shortId = (id) => String(id || "").slice(-8).toUpperCase();

const queryWithSession = (query, session = null) => {
  if (session) query.session(session);
  return query;
};

const createDocument = async (Model, payload, session = null) => {
  if (!session) return Model.create(payload);
  const [doc] = await Model.create([payload], { session });
  return doc;
};

const normalizeSearchRegex = (value) => {
  const escaped = String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
};

const ledgerByIdOrCode = async (ledgerId, code, ledgerType, session = null) => {
  const queries = [];
  if (ledgerId) queries.push({ _id: ledgerId });
  if (code) queries.push({ code: String(code).toUpperCase() });
  if (ledgerType) queries.push({ ledgerType });

  for (const query of queries) {
    const ledger = await queryWithSession(Ledger.findOne({ ...query, isActive: true }), session);
    if (ledger) return ledger;
  }
  return null;
};

const requireLedger = async (label, ledgerId, code, ledgerType, session = null) => {
  const ledger = await ledgerByIdOrCode(ledgerId, code, ledgerType, session);
  if (!ledger) throw new Error(`${label} ledger is not configured.`);
  return ledger;
};

const getGroup = async (code, session = null) => {
  const group = await queryWithSession(AccountGroup.findOne({ code, isActive: true }), session);
  if (!group) throw new Error(`Account group ${code} is not configured.`);
  return group;
};

const getOrCreateCashAdjustmentLedger = async (createdBy, session = null) => {
  let ledger = await queryWithSession(Ledger.findOne({ code: "CASH_ADJUSTMENT" }), session);
  if (ledger) return ledger;

  const group = await getGroup("INDIRECT_INCOME", session);
  try {
    return await createDocument(Ledger, {
      name: "Cash Adjustment A/c",
      code: "CASH_ADJUSTMENT",
      groupId: group._id,
      ledgerType: LEDGER_TYPES.OTHER,
      openingBalance: 0,
      openingBalanceType: group.normalBalance,
      currentBalance: 0,
      currentBalanceType: group.normalBalance,
      partyType: "none",
      isActive: true,
      createdBy,
    }, session);
  } catch (error) {
    if (error?.code === 11000) {
      ledger = await queryWithSession(Ledger.findOne({ code: "CASH_ADJUSTMENT" }), session);
      if (ledger) return ledger;
    }
    throw error;
  }
};

const getOrCreateOpeningBalanceLedger = async (createdBy, session = null) => {
  let ledger = await queryWithSession(Ledger.findOne({ code: "OPENING_BALANCE_EQUITY" }), session);
  if (ledger) return ledger;

  const group = await getGroup("CAPITAL_ACCOUNT", session);
  try {
    return await createDocument(Ledger, {
      name: "Opening Balance Equity A/c",
      code: "OPENING_BALANCE_EQUITY",
      groupId: group._id,
      ledgerType: LEDGER_TYPES.OTHER,
      openingBalance: 0,
      openingBalanceType: NORMAL_BALANCE.CREDIT,
      currentBalance: 0,
      currentBalanceType: NORMAL_BALANCE.CREDIT,
      partyType: "none",
      isActive: true,
      createdBy,
    }, session);
  } catch (error) {
    if (error?.code === 11000) {
      ledger = await queryWithSession(Ledger.findOne({ code: "OPENING_BALANCE_EQUITY" }), session);
      if (ledger) return ledger;
    }
    throw error;
  }
};

export const getOrCreateCashBankLedger = async (accountInput, settings, session = null, createdBy = null) => {
  if (!settings) {
    settings = await queryWithSession(AccountingSettings.findOne(), session);
  }

  const account = typeof accountInput?.save === "function"
    ? accountInput
    : accountInput
      ? await queryWithSession(BankAccount.findById(accountInput), session)
      : null;

  if (!account || account.accountType === "cash") {
    return requireLedger("Cash", settings?.defaultCashLedgerId, "CASH", LEDGER_TYPES.CASH, session);
  }

  if (account.accountingLedgerId) {
    const existing = await ledgerByIdOrCode(account.accountingLedgerId, null, LEDGER_TYPES.BANK, session);
    if (existing) return existing;
  }

  const group = await getGroup("BANK_ACCOUNTS", session);
  const code = `BANK-${shortId(account._id)}`;
  let ledger = await queryWithSession(Ledger.findOne({ code, isActive: true }), session);

  if (!ledger && account.accountNumber) {
    ledger = await queryWithSession(Ledger.findOne({ "bankDetails.accountNumber": account.accountNumber, ledgerType: LEDGER_TYPES.BANK, isActive: true }), session);
  }

  if (!ledger && account.ifscCode) {
    ledger = await queryWithSession(Ledger.findOne({ "bankDetails.ifscCode": account.ifscCode, ledgerType: LEDGER_TYPES.BANK, isActive: true }), session);
  }

  if (!ledger && (account.bankName || account.accountName)) {
    const searchValue = account.bankName || account.accountName;
    const nameSearch = normalizeSearchRegex(searchValue);
    ledger = await queryWithSession(Ledger.findOne({
      ledgerType: LEDGER_TYPES.BANK,
      isActive: true,
      $or: [
        { name: nameSearch },
        { "bankDetails.bankName": nameSearch },
      ],
    }), session);
  }

  if (!ledger) {
    try {
      ledger = await createDocument(Ledger, {
        name: `${account.accountName} A/c`,
        code,
        groupId: group._id,
        ledgerType: LEDGER_TYPES.BANK,
        openingBalance: 0,
        openingBalanceType: NORMAL_BALANCE.DEBIT,
        currentBalance: 0,
        currentBalanceType: NORMAL_BALANCE.DEBIT,
        partyType: "none",
        bankDetails: {
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          ifscCode: account.ifscCode,
        },
        isSystemDefault: false,
        isActive: true,
        createdBy,
      }, session);
    } catch (error) {
      if (error?.code === 11000) {
        ledger = await queryWithSession(Ledger.findOne({ code }), session);
        if (ledger) {
          if (!ledger.isActive) {
            ledger.isActive = true;
            ledger.bankDetails = {
              ...ledger.bankDetails,
              bankName: account.bankName || ledger.bankDetails?.bankName,
              accountNumber: account.accountNumber || ledger.bankDetails?.accountNumber,
              ifscCode: account.ifscCode || ledger.bankDetails?.ifscCode,
            };
            await ledger.save({ session, validateBeforeSave: false });
          }
        }
      }
      if (!ledger) throw error;
    }
  }

  account.accountingLedgerId = ledger._id;
  account.accountingLinked = true;
  await account.save({ session, validateBeforeSave: false });
  return ledger;
};

const updateTransactionAccountingStatus = async (transactionId, fields = {}, session = null) => {
  const updateData = {
    accountingVoucherId: fields.accountingVoucherId,
    accountingPosted: fields.accountingStatus === "posted",
    accountingStatus: fields.accountingStatus,
    accountingError: fields.accountingError,
    accountingPostedAt: fields.accountingStatus === "posted" ? new Date() : undefined,
  };

  const sanitizedUpdate = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(sanitizedUpdate).length === 0) return null;
  return CashBankTransaction.findByIdAndUpdate(transactionId, sanitizedUpdate, { session, new: true });
};

const getManualReferenceModule = (transaction) => {
  if (transaction.type === "cash_in") return "manual_cash_in";
  if (transaction.type === "cash_out") return "manual_cash_out";
  if (transaction.type === "opening_cash") return "opening_cash_bank";
  return "cash_bank_adjustment";
};

const getExistingVoucherForTransaction = async (transaction, session = null) => {
  if (!transaction) return null;
  if (transaction.accountingVoucherId) {
    const voucher = await queryWithSession(Voucher.findById(transaction.accountingVoucherId), session);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  return queryWithSession(
    Voucher.findOne({
      referenceModule: getManualReferenceModule(transaction),
      referenceId: transaction._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
};

export const postCashBankTransactionVoucher = async (transactionInput, { createdBy } = {}, options = {}) => {
  const session = options.session || null;
  const transaction = typeof transactionInput?.toObject === "function"
    ? transactionInput
    : await queryWithSession(CashBankTransaction.findById(transactionInput), session);
  if (!transaction) throw new Error("Transaction not found for accounting posting.");

  const allowedManualTypes = ["cash_in", "cash_out", "opening_cash", "adjustment"];
  if (!allowedManualTypes.includes(transaction.type)) {
    return { skipped: true, reason: "Transaction type is posted by its source module." };
  }

  const existing = await getExistingVoucherForTransaction(transaction, session);
  if (existing) {
    await updateTransactionAccountingStatus(transaction._id, {
      accountingVoucherId: existing._id,
      accountingStatus: existing.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    }, session);
    return { skipped: true, voucher: existing };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    await updateTransactionAccountingStatus(transaction._id, {
      accountingStatus: "not_posted",
      accountingError: "Accounting auto posting is disabled.",
    }, session);
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const amount = money(transaction.amount);
  if (amount <= 0) throw new Error("Transaction amount must be greater than zero for accounting posting.");

  const cashBankLedger = await getOrCreateCashBankLedger(transaction.accountId, settings, session, createdBy);
  const adjustmentLedger = transaction.type === "opening_cash"
    ? await getOrCreateOpeningBalanceLedger(createdBy, session)
    : await getOrCreateCashAdjustmentLedger(createdBy, session);

  const entries = [];
  const narration = transaction.description || `Cash/Bank ${transaction.type}`;

  if (transaction.direction === "in") {
    entries.push({ ledgerId: cashBankLedger._id, debit: amount, credit: 0, narration: `Manual cash in: ${narration}` });
    entries.push({ ledgerId: adjustmentLedger._id, debit: 0, credit: amount, narration: "Cash in adjustment" });
  } else {
    entries.push({ ledgerId: adjustmentLedger._id, debit: amount, credit: 0, narration: `Cash out adjustment: ${narration}` });
    entries.push({ ledgerId: cashBankLedger._id, debit: 0, credit: amount, narration: "Manual cash out" });
  }

  const referenceModule = getManualReferenceModule(transaction);
  const posted = await postVoucher({
    voucherTypeCode: "JOURNAL",
    date: transaction.date || new Date(),
    referenceModule,
    referenceId: transaction._id,
    referenceNo: transaction.referenceNo || transaction.transactionNo,
    narration,
    entries,
    createdBy,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  await updateTransactionAccountingStatus(transaction._id, {
    accountingVoucherId: voucher._id,
    accountingStatus: "posted",
    accountingError: undefined,
  }, session);

  return posted;
};

export const postBankTransferVoucher = async (transferId, sourceTx, destTx, { createdBy } = {}, options = {}) => {
  const session = options.session || null;
  if (!transferId || !sourceTx || !destTx) throw new Error("Transfer details are required");

  const existing = await queryWithSession(
    Voucher.findOne({
      referenceModule: "bank_transfer",
      referenceId: transferId,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
  if (existing) {
    for (const tx of [sourceTx, destTx]) {
      if (tx?._id) {
        await updateTransactionAccountingStatus(tx._id, {
          accountingVoucherId: existing._id,
          accountingStatus: existing.status === "POSTED" ? "posted" : "failed",
          accountingError: undefined,
        }, session);
      }
    }
    return { skipped: true, voucher: existing };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    for (const tx of [sourceTx, destTx]) {
      if (tx?._id) {
        await updateTransactionAccountingStatus(tx._id, {
          accountingStatus: "not_posted",
          accountingError: "Accounting auto posting is disabled.",
        }, session);
      }
    }
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const sourceLedger = await getOrCreateCashBankLedger(sourceTx.accountId, settings, session, createdBy);
  const destinationLedger = await getOrCreateCashBankLedger(destTx.accountId, settings, session, createdBy);
  const amount = money(sourceTx.amount || destTx.amount);
  if (amount <= 0) throw new Error("Transfer amount must be greater than zero");

  const narration = `Bank Transfer ${sourceTx.referenceNo || transferId}`;
  const entries = [
    {
      ledgerId: destinationLedger._id,
      debit: amount,
      credit: 0,
      narration: `Transfer received from ${sourceTx.accountName || "source account"}`,
    },
    {
      ledgerId: sourceLedger._id,
      debit: 0,
      credit: amount,
      narration: `Transfer made to ${destTx.accountName || "destination account"}`,
    },
  ];

  const posted = await postVoucher({
    voucherTypeCode: "CONTRA",
    date: destTx.date || sourceTx.date || new Date(),
    referenceModule: "bank_transfer",
    referenceId: transferId,
    referenceNo: destTx.referenceNo || sourceTx.referenceNo,
    narration,
    entries,
    createdBy,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  for (const tx of [sourceTx, destTx]) {
    if (tx?._id) {
      await updateTransactionAccountingStatus(tx._id, {
        accountingVoucherId: voucher._id,
        accountingStatus: "posted",
        accountingError: undefined,
      }, session);
    }
  }

  return posted;
};
