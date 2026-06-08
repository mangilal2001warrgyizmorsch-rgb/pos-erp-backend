import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import FinancialYear from "../../models/accounting/FinancialYear.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import VoucherType from "../../models/accounting/VoucherType.model.js";
import {
  ACCOUNT_NATURE,
  ACCOUNTING_VOUCHER_TYPES,
  LEDGER_TYPES,
  NORMAL_BALANCE,
} from "../../constants/accounting.constants.js";

const defaultAccountGroups = [
  {
    name: "Assets",
    code: "ASSET",
    legacyCodes: ["ASSETS"],
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Liabilities",
    code: "LIABILITY",
    legacyCodes: ["LIABILITIES"],
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Income",
    code: "INCOME",
    nature: ACCOUNT_NATURE.INCOME,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Expenses",
    code: "EXPENSE",
    legacyCodes: ["EXPENSES"],
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Cash in Hand",
    code: "CASH_IN_HAND",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Bank Accounts",
    code: "BANK_ACCOUNTS",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Sundry Debtors",
    code: "SUNDRY_DEBTORS",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Stock in Hand",
    code: "STOCK_IN_HAND",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Fixed Assets",
    code: "FIXED_ASSETS",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Loans & Advances",
    code: "LOANS_ADVANCES",
    parentCode: "ASSET",
    nature: ACCOUNT_NATURE.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
  {
    name: "Sundry Creditors",
    code: "SUNDRY_CREDITORS",
    parentCode: "LIABILITY",
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Duties & Taxes",
    code: "DUTIES_TAXES",
    parentCode: "LIABILITY",
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Capital Account",
    code: "CAPITAL_ACCOUNT",
    parentCode: "LIABILITY",
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Loans",
    code: "LOANS",
    parentCode: "LIABILITY",
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Current Liabilities",
    code: "CURRENT_LIABILITIES",
    parentCode: "LIABILITY",
    nature: ACCOUNT_NATURE.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Sales Accounts",
    code: "SALES_ACCOUNTS",
    parentCode: "INCOME",
    nature: ACCOUNT_NATURE.INCOME,
    normalBalance: NORMAL_BALANCE.CREDIT,
    affectsGrossProfit: true,
  },
  {
    name: "Indirect Income",
    code: "INDIRECT_INCOME",
    parentCode: "INCOME",
    nature: ACCOUNT_NATURE.INCOME,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Other Income",
    code: "OTHER_INCOME",
    parentCode: "INCOME",
    nature: ACCOUNT_NATURE.INCOME,
    normalBalance: NORMAL_BALANCE.CREDIT,
  },
  {
    name: "Purchase Accounts",
    code: "PURCHASE_ACCOUNTS",
    parentCode: "EXPENSE",
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
    affectsGrossProfit: true,
  },
  {
    name: "Sales Return",
    code: "SALES_RETURN",
    parentCode: "EXPENSE",
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
    affectsGrossProfit: true,
  },
  {
    name: "Purchase Return",
    code: "PURCHASE_RETURN",
    parentCode: "EXPENSE",
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
    affectsGrossProfit: true,
  },
  {
    name: "Direct Expenses",
    code: "DIRECT_EXPENSES",
    parentCode: "EXPENSE",
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
    affectsGrossProfit: true,
  },
  {
    name: "Indirect Expenses",
    code: "INDIRECT_EXPENSES",
    parentCode: "EXPENSE",
    nature: ACCOUNT_NATURE.EXPENSE,
    normalBalance: NORMAL_BALANCE.DEBIT,
  },
];

const defaultLedgerDefinitions = [
  {
    name: "Cash A/c",
    code: "CASH",
    groupCode: "CASH_IN_HAND",
    ledgerType: LEDGER_TYPES.CASH,
  },
  {
    name: "Primary Bank A/c",
    code: "PRIMARY_BANK",
    groupCode: "BANK_ACCOUNTS",
    ledgerType: LEDGER_TYPES.BANK,
  },
  {
    name: "Sales A/c",
    code: "SALES",
    groupCode: "SALES_ACCOUNTS",
    ledgerType: LEDGER_TYPES.SALES,
  },
  {
    name: "Purchase A/c",
    code: "PURCHASE",
    groupCode: "PURCHASE_ACCOUNTS",
    ledgerType: LEDGER_TYPES.PURCHASE,
  },
  {
    name: "Sales Return A/c",
    code: "SALES_RETURN",
    groupCode: "SALES_RETURN",
    ledgerType: LEDGER_TYPES.SALES_RETURN,
  },
  {
    name: "Purchase Return A/c",
    code: "PURCHASE_RETURN",
    groupCode: "PURCHASE_RETURN",
    ledgerType: LEDGER_TYPES.PURCHASE_RETURN,
  },
  {
    name: "Output CGST A/c",
    code: "OUTPUT_CGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Output SGST A/c",
    code: "OUTPUT_SGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Output IGST A/c",
    code: "OUTPUT_IGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Input CGST A/c",
    code: "INPUT_CGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Input SGST A/c",
    code: "INPUT_SGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Input IGST A/c",
    code: "INPUT_IGST",
    groupCode: "DUTIES_TAXES",
    ledgerType: LEDGER_TYPES.TAX,
  },
  {
    name: "Discount Given A/c",
    code: "DISCOUNT_GIVEN",
    groupCode: "INDIRECT_EXPENSES",
    ledgerType: LEDGER_TYPES.DISCOUNT,
  },
  {
    name: "Discount Received A/c",
    code: "DISCOUNT_RECEIVED",
    groupCode: "INDIRECT_INCOME",
    ledgerType: LEDGER_TYPES.DISCOUNT,
  },
  {
    name: "Round Off A/c",
    code: "ROUND_OFF",
    groupCode: "INDIRECT_EXPENSES",
    ledgerType: LEDGER_TYPES.ROUND_OFF,
  },
  {
    name: "Stock in Hand A/c",
    code: "STOCK_IN_HAND",
    groupCode: "STOCK_IN_HAND",
    ledgerType: LEDGER_TYPES.STOCK,
  },
  {
    name: "Cost of Goods Sold A/c",
    code: "COGS",
    groupCode: "DIRECT_EXPENSES",
    ledgerType: LEDGER_TYPES.EXPENSE,
  },
  {
    name: "General Expenses A/c",
    code: "GENERAL_EXPENSES",
    groupCode: "INDIRECT_EXPENSES",
    ledgerType: LEDGER_TYPES.EXPENSE,
  },
];

const defaultVoucherTypes = [
  { name: "Sales", code: ACCOUNTING_VOUCHER_TYPES.SALES, prefix: "SAL-" },
  { name: "Purchase", code: ACCOUNTING_VOUCHER_TYPES.PURCHASE, prefix: "PUR-" },
  { name: "Receipt", code: ACCOUNTING_VOUCHER_TYPES.RECEIPT, prefix: "REC-" },
  { name: "Payment", code: ACCOUNTING_VOUCHER_TYPES.PAYMENT, prefix: "PAY-" },
  { name: "Contra", code: ACCOUNTING_VOUCHER_TYPES.CONTRA, prefix: "CON-" },
  { name: "Journal", code: ACCOUNTING_VOUCHER_TYPES.JOURNAL, prefix: "JRN-" },
  { name: "Credit Note", code: ACCOUNTING_VOUCHER_TYPES.CREDIT_NOTE, prefix: "CN-" },
  { name: "Debit Note", code: ACCOUNTING_VOUCHER_TYPES.DEBIT_NOTE, prefix: "DN-" },
  { name: "Expense", code: ACCOUNTING_VOUCHER_TYPES.EXPENSE, prefix: "EXP-" },
  { name: "Stock Journal", code: ACCOUNTING_VOUCHER_TYPES.STOCK_JOURNAL, prefix: "STJ-" },
];

const getCurrentIndianFinancialYear = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  return {
    name: `${year}-${year + 1}`,
    startDate: new Date(Date.UTC(year, 3, 1)),
    endDate: new Date(Date.UTC(year + 1, 2, 31, 23, 59, 59, 999)),
  };
};

const createSummary = () => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  records: [],
});

const addSummaryRecord = (summary, action, record) => {
  summary[action] += 1;
  summary.records.push({
    action,
    id: record._id,
    name: record.name,
    code: record.code,
  });
};

const valuesEqual = (currentValue, nextValue) => {
  if (currentValue === undefined && nextValue === undefined) return true;
  if (currentValue === null && nextValue === undefined) return true;
  if (currentValue?._id) return String(currentValue._id) === String(nextValue);
  if (currentValue && typeof currentValue.equals === "function") return currentValue.equals(nextValue);
  return String(currentValue ?? "") === String(nextValue ?? "");
};

const setIfDifferent = (updates, document, field, nextValue) => {
  if (nextValue === undefined) return;
  if (!valuesEqual(document[field], nextValue)) {
    updates[field] = nextValue;
  }
};

export const initializeDefaultAccountGroups = async (createdBy) => {
  const summary = createSummary();
  const groupsByCode = {};

  for (const group of defaultAccountGroups) {
    const parentGroupId = group.parentCode ? groupsByCode[group.parentCode]?._id : undefined;
    const codesToFind = [group.code, ...(group.legacyCodes || [])];
    let existing = await AccountGroup.findOne({ code: { $in: codesToFind } });

    if (!existing) {
      const created = await AccountGroup.create({
        name: group.name,
        code: group.code,
        parentGroupId,
        nature: group.nature,
        normalBalance: group.normalBalance,
        affectsGrossProfit: group.affectsGrossProfit || false,
        isSystemDefault: true,
        isActive: true,
        createdBy,
      });
      groupsByCode[group.code] = created;
      addSummaryRecord(summary, "created", created);
      continue;
    }

    const updates = {};
    if (!existing.name) updates.name = group.name;
    setIfDifferent(updates, existing, "code", group.code);
    setIfDifferent(updates, existing, "parentGroupId", parentGroupId);
    setIfDifferent(updates, existing, "nature", group.nature);
    setIfDifferent(updates, existing, "normalBalance", group.normalBalance);
    setIfDifferent(updates, existing, "affectsGrossProfit", group.affectsGrossProfit || false);
    setIfDifferent(updates, existing, "isSystemDefault", true);
    setIfDifferent(updates, existing, "isActive", true);
    if (!existing.createdBy && createdBy) updates.createdBy = createdBy;

    if (Object.keys(updates).length > 0) {
      existing = await AccountGroup.findByIdAndUpdate(existing._id, updates, {
        new: true,
        runValidators: true,
      });
      addSummaryRecord(summary, "updated", existing);
    } else {
      addSummaryRecord(summary, "unchanged", existing);
    }

    groupsByCode[group.code] = existing;
  }

  return { summary, groupsByCode };
};

export const initializeDefaultLedgers = async (groupsByCode, createdBy) => {
  const summary = createSummary();

  for (const ledger of defaultLedgerDefinitions) {
    const group = groupsByCode[ledger.groupCode] || await AccountGroup.findOne({ code: ledger.groupCode });
    if (!group) {
      throw new Error(`Account group ${ledger.groupCode} is required for ledger ${ledger.code}`);
    }

    let existing = await Ledger.findOne({ code: ledger.code });

    if (!existing) {
      const created = await Ledger.create({
        name: ledger.name,
        code: ledger.code,
        groupId: group._id,
        ledgerType: ledger.ledgerType,
        openingBalance: 0,
        openingBalanceType: group.normalBalance,
        currentBalance: 0,
        currentBalanceType: group.normalBalance,
        partyType: "none",
        isSystemDefault: true,
        isActive: true,
        createdBy,
      });
      addSummaryRecord(summary, "created", created);
      continue;
    }

    const updates = {};
    if (!existing.name) updates.name = ledger.name;
    setIfDifferent(updates, existing, "groupId", group._id);
    setIfDifferent(updates, existing, "ledgerType", ledger.ledgerType);
    setIfDifferent(updates, existing, "isSystemDefault", true);
    setIfDifferent(updates, existing, "isActive", true);
    if (!existing.openingBalanceType) updates.openingBalanceType = group.normalBalance;
    if (!existing.currentBalanceType) updates.currentBalanceType = group.normalBalance;
    if (!existing.partyType) updates.partyType = "none";
    if (!existing.createdBy && createdBy) updates.createdBy = createdBy;

    if (Object.keys(updates).length > 0) {
      existing = await Ledger.findByIdAndUpdate(existing._id, updates, {
        new: true,
        runValidators: true,
      });
      addSummaryRecord(summary, "updated", existing);
    } else {
      addSummaryRecord(summary, "unchanged", existing);
    }
  }

  return summary;
};

export const initializeDefaultVoucherTypes = async () => {
  const summary = createSummary();

  for (const voucherType of defaultVoucherTypes) {
    let existing = await VoucherType.findOne({ code: voucherType.code });

    if (!existing) {
      const created = await VoucherType.create({
        ...voucherType,
        suffix: "",
        currentNumber: 0,
        numberingMethod: "automatic",
        isSystemDefault: true,
        isActive: true,
      });
      addSummaryRecord(summary, "created", created);
      continue;
    }

    const updates = {};
    if (!existing.name) updates.name = voucherType.name;
    if (!existing.prefix) updates.prefix = voucherType.prefix;
    if (existing.suffix === undefined) updates.suffix = "";
    if (existing.currentNumber === undefined || existing.currentNumber === null) updates.currentNumber = 0;
    if (!existing.numberingMethod) updates.numberingMethod = "automatic";
    setIfDifferent(updates, existing, "isSystemDefault", true);
    setIfDifferent(updates, existing, "isActive", true);

    if (Object.keys(updates).length > 0) {
      existing = await VoucherType.findByIdAndUpdate(existing._id, updates, {
        new: true,
        runValidators: true,
      });
      addSummaryRecord(summary, "updated", existing);
    } else {
      addSummaryRecord(summary, "unchanged", existing);
    }
  }

  return summary;
};

export const initializeFinancialYear = async () => {
  const activeFinancialYear = await FinancialYear.findOne({ isActive: true, isClosed: false });
  if (activeFinancialYear) {
    await FinancialYear.updateMany(
      { _id: { $ne: activeFinancialYear._id }, isActive: true, isClosed: false },
      { isActive: false },
    );
    return activeFinancialYear;
  }

  const financialYearData = getCurrentIndianFinancialYear();
  await FinancialYear.updateMany(
    { isActive: true, isClosed: false },
    { isActive: false },
  );

  return FinancialYear.findOneAndUpdate(
    { name: financialYearData.name },
    {
      ...financialYearData,
      isActive: true,
      isClosed: false,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const initializeAccountingSettings = async () => {
  const ledgersByCode = Object.fromEntries(
    await Promise.all(
      [
        "CASH",
        "PRIMARY_BANK",
        "SALES",
        "PURCHASE",
        "SALES_RETURN",
        "PURCHASE_RETURN",
        "ROUND_OFF",
        "DISCOUNT_GIVEN",
        "DISCOUNT_RECEIVED",
        "STOCK_IN_HAND",
        "COGS",
      ].map(async (code) => [code, await Ledger.findOne({ code })]),
    ),
  );

  const defaultLedgerFields = {
    defaultCashLedgerId: ledgersByCode.CASH?._id,
    defaultBankLedgerId: ledgersByCode.PRIMARY_BANK?._id,
    defaultSalesLedgerId: ledgersByCode.SALES?._id,
    defaultPurchaseLedgerId: ledgersByCode.PURCHASE?._id,
    defaultSalesReturnLedgerId: ledgersByCode.SALES_RETURN?._id,
    defaultPurchaseReturnLedgerId: ledgersByCode.PURCHASE_RETURN?._id,
    defaultRoundOffLedgerId: ledgersByCode.ROUND_OFF?._id,
    defaultDiscountGivenLedgerId: ledgersByCode.DISCOUNT_GIVEN?._id,
    defaultDiscountReceivedLedgerId: ledgersByCode.DISCOUNT_RECEIVED?._id,
    defaultStockLedgerId: ledgersByCode.STOCK_IN_HAND?._id,
    defaultCOGSLedgerId: ledgersByCode.COGS?._id,
  };

  let settings = await AccountingSettings.findOne();
  if (!settings) {
    settings = await AccountingSettings.create({
      accountingEnabled: true,
      gstAccountingEnabled: false,
      inventoryAccountingEnabled: false,
      autoVoucherPosting: true,
      allowManualJournalEntry: false,
      allowBackdatedVouchers: true,
      ...defaultLedgerFields,
    });
    return settings;
  }

  const updates = {};
  if (settings.accountingEnabled !== true) {
    updates.accountingEnabled = true;
  }
  Object.entries(defaultLedgerFields).forEach(([field, ledgerId]) => {
    if (!settings[field] && ledgerId) {
      updates[field] = ledgerId;
    }
  });

  if (Object.keys(updates).length === 0) {
    return settings;
  }

  return AccountingSettings.findByIdAndUpdate(settings._id, updates, {
    new: true,
    runValidators: true,
  });
};

export const initializeAccountingFoundation = async (createdBy) => {
  const { summary: groupsCreated, groupsByCode } = await initializeDefaultAccountGroups(createdBy);
  const ledgersCreated = await initializeDefaultLedgers(groupsByCode, createdBy);
  const voucherTypesCreated = await initializeDefaultVoucherTypes();
  const financialYear = await initializeFinancialYear();
  const settings = await initializeAccountingSettings();

  return {
    success: true,
    message: "Accounting foundation initialized successfully",
    data: {
      groupsCreated,
      ledgersCreated,
      voucherTypesCreated,
      financialYear,
      settings,
    },
  };
};

export const seedAccountingFoundation = initializeAccountingFoundation;
