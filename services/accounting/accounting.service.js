import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import FinancialYear from "../../models/accounting/FinancialYear.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherType from "../../models/accounting/VoucherType.model.js";
import {
  getDefaultAccountingMissingCounts,
  initializeAccountingFoundation,
} from "./seedAccounting.service.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const validateDebitCredit = (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("At least one voucher entry is required");
  }

  let totalDebit = 0;
  let totalCredit = 0;

  entries.forEach((entry) => {
    const debit = roundMoney(entry.debit);
    const credit = roundMoney(entry.credit);

    if (debit < 0 || credit < 0) {
      throw new Error("Debit and credit values cannot be negative");
    }

    if (debit > 0 && credit > 0) {
      throw new Error("Voucher entry cannot contain both debit and credit");
    }

    if (debit === 0 && credit === 0) {
      throw new Error("Voucher entry must contain either debit or credit");
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  if (totalDebit !== totalCredit) {
    throw new Error("Total debit must equal total credit");
  }

  return {
    totalDebit,
    totalCredit,
    isBalanced: true,
  };
};

export const initializeAccounting = async (createdBy) => {
  return initializeAccountingFoundation(createdBy);
};

export const getAccountingStatus = async () => {
  const [
    settings,
    groupCount,
    ledgerCount,
    voucherTypeCount,
    voucherCount,
    activeFinancialYear,
    missingDefaults,
  ] = await Promise.all([
    AccountingSettings.findOne().lean(),
    AccountGroup.countDocuments(),
    Ledger.countDocuments(),
    VoucherType.countDocuments(),
    Voucher.countDocuments(),
    FinancialYear.findOne({ isActive: true, isClosed: false }).lean(),
    getDefaultAccountingMissingCounts(),
  ]);

  const settingsConfigured = Boolean(settings);
  const foundationReady = groupCount > 0
    && ledgerCount > 0
    && voucherTypeCount > 0
    && Boolean(activeFinancialYear)
    && settingsConfigured;

  return {
    accountingEnabled: Boolean(settings?.accountingEnabled),
    groupsCount: groupCount,
    ledgersCount: ledgerCount,
    voucherTypesCount: voucherTypeCount,
    activeFinancialYear,
    settingsConfigured,
    foundationReady,
    initialized: foundationReady,
    ...missingDefaults,
    gstAccountingEnabled: Boolean(settings?.gstAccountingEnabled),
    inventoryAccountingEnabled: Boolean(settings?.inventoryAccountingEnabled),
    autoVoucherPosting: settings?.autoVoucherPosting ?? true,
    counts: {
      accountGroups: groupCount,
      ledgers: ledgerCount,
      voucherTypes: voucherTypeCount,
      vouchers: voucherCount,
    },
    settings,
  };
};

const logicalGroupOrder = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "CASH_IN_HAND",
  "BANK_ACCOUNTS",
  "SUNDRY_DEBTORS",
  "STOCK_IN_HAND",
  "FIXED_ASSETS",
  "LOANS_ADVANCES",
  "SUNDRY_CREDITORS",
  "DUTIES_TAXES",
  "CAPITAL_ACCOUNT",
  "LOANS",
  "CURRENT_LIABILITIES",
  "SALES_ACCOUNTS",
  "INDIRECT_INCOME",
  "OTHER_INCOME",
  "PURCHASE_ACCOUNTS",
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "DIRECT_EXPENSES",
  "INDIRECT_EXPENSES",
];

const getGroupOrder = (group) => {
  const index = logicalGroupOrder.indexOf(group.code);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const formatLedgerForChart = (ledger) => ({
  ledgerId: ledger._id,
  ledgerName: ledger.name,
  name: ledger.name,
  code: ledger.code,
  ledgerType: ledger.ledgerType,
  openingBalance: ledger.openingBalance,
  openingBalanceType: ledger.openingBalanceType,
  currentBalance: ledger.currentBalance,
  currentBalanceType: ledger.currentBalanceType,
  isSystemDefault: ledger.isSystemDefault,
  isActive: ledger.isActive,
});

const formatGroupForChart = (group) => ({
  groupId: group._id,
  groupName: group.name,
  name: group.name,
  code: group.code,
  nature: group.nature,
  normalBalance: group.normalBalance,
  affectsGrossProfit: group.affectsGrossProfit,
  isSystemDefault: group.isSystemDefault,
  isActive: group.isActive,
  childGroups: [],
  ledgers: [],
});

export const getChartOfAccounts = async () => {
  const [groups, ledgers] = await Promise.all([
    AccountGroup.find({ isActive: true }).lean(),
    Ledger.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  const groupMap = new Map();
  groups
    .sort((a, b) => getGroupOrder(a) - getGroupOrder(b) || a.name.localeCompare(b.name))
    .forEach((group) => {
      groupMap.set(String(group._id), formatGroupForChart(group));
    });

  ledgers
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((ledger) => {
      const group = groupMap.get(String(ledger.groupId));
      if (group) {
        group.ledgers.push(formatLedgerForChart(ledger));
      }
    });

  const parentGroups = [];
  groups
    .sort((a, b) => getGroupOrder(a) - getGroupOrder(b) || a.name.localeCompare(b.name))
    .forEach((group) => {
      const formattedGroup = groupMap.get(String(group._id));
      const parentGroupId = group.parentGroupId ? String(group.parentGroupId) : null;

      if (parentGroupId && groupMap.has(parentGroupId)) {
        groupMap.get(parentGroupId).childGroups.push(formattedGroup);
      } else {
        parentGroups.push(formattedGroup);
      }
    });

  const sortTree = (items) => {
    items.sort((a, b) => {
      const orderA = logicalGroupOrder.indexOf(a.code);
      const orderB = logicalGroupOrder.indexOf(b.code);
      const safeA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
      const safeB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
      return safeA - safeB || a.groupName.localeCompare(b.groupName);
    });

    items.forEach((item) => {
      item.ledgers.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
      sortTree(item.childGroups);
    });
  };

  sortTree(parentGroups);
  return parentGroups;
};
