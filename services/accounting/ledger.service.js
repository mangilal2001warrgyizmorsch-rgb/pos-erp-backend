import Ledger from "../../models/accounting/Ledger.model.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const balanceToSignedDebit = (amount, type) => {
  const numericAmount = Number(amount || 0);
  return type === "CREDIT" ? -numericAmount : numericAmount;
};

const signedDebitToBalance = (value) => ({
  currentBalance: Math.abs(roundMoney(value)),
  currentBalanceType: value < 0 ? "CREDIT" : "DEBIT",
});

export const createLedger = async (ledgerData) => {
  const openingBalance = roundMoney(ledgerData.openingBalance);
  const openingBalanceType = ledgerData.openingBalanceType || ledgerData.currentBalanceType || "DEBIT";

  return Ledger.create({
    ...ledgerData,
    openingBalance,
    openingBalanceType,
    currentBalance: ledgerData.currentBalance ?? openingBalance,
    currentBalanceType: ledgerData.currentBalanceType || openingBalanceType,
  });
};

export const getLedgerById = async (ledgerId) => {
  return Ledger.findById(ledgerId).populate("groupId", "name code nature normalBalance");
};

export const getLedgerByCode = async (code) => {
  return Ledger.findOne({ code: String(code).toUpperCase() }).populate(
    "groupId",
    "name code nature normalBalance",
  );
};

export const updateLedgerBalance = async (ledgerId, debit = 0, credit = 0, session = null) => {
  const query = Ledger.findById(ledgerId).populate("groupId", "name code nature normalBalance");
  if (session) query.session(session);
  const ledger = await query;
  if (!ledger) {
    throw new Error("Ledger not found");
  }

  const signedCurrentBalance = balanceToSignedDebit(
    ledger.currentBalance,
    ledger.currentBalanceType,
  );
  const signedNewBalance = signedCurrentBalance + roundMoney(debit) - roundMoney(credit);
  const { currentBalance, currentBalanceType } = signedDebitToBalance(signedNewBalance);

  ledger.currentBalance = currentBalance;
  ledger.currentBalanceType = currentBalanceType;
  await ledger.save({ session });

  return ledger;
};

export const getLedgerBalanceVerification = async (ledgerId) => {
  const ledger = await Ledger.findById(ledgerId).populate("groupId", "name code nature normalBalance");
  if (!ledger) {
    throw new Error("Ledger not found");
  }

  return ledger;
};

export const getLedgersByGroup = async (groupId) => {
  return Ledger.find({ groupId, isActive: true }).sort({ name: 1 });
};

export const getSystemLedger = async (ledgerType) => {
  const query = { isSystemDefault: true, isActive: true };
  if (ledgerType) {
    query.ledgerType = String(ledgerType).toUpperCase();
  }

  return Ledger.findOne(query).populate("groupId", "name code nature normalBalance");
};
