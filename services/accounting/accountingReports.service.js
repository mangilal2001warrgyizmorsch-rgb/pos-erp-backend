import mongoose from "mongoose";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import FinancialYear from "../../models/accounting/FinancialYear.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const objectId = (value) => (mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value);

const signedOpening = (ledger) => (
  ledger.openingBalanceType === "CREDIT"
    ? -Number(ledger.openingBalance || 0)
    : Number(ledger.openingBalance || 0)
);

const splitSignedBalance = (value) => {
  const rounded = roundMoney(value);
  return {
    debit: rounded > 0 ? rounded : 0,
    credit: rounded < 0 ? Math.abs(rounded) : 0,
    balance: Math.abs(rounded),
    balanceType: rounded < 0 ? "CREDIT" : "DEBIT",
    signed: rounded,
  };
};

const getFinancialYearRange = async (filters = {}) => {
  let financialYear = null;
  if (filters.financialYearId) {
    financialYear = await FinancialYear.findById(filters.financialYearId).lean();
  }

  const startDate = filters.startDate
    ? new Date(filters.startDate)
    : financialYear?.startDate
      ? new Date(financialYear.startDate)
      : null;

  const endSource = filters.asOnDate || filters.endDate || financialYear?.endDate;
  const endDate = endSource ? new Date(endSource) : new Date();
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate, financialYear };
};

const getPostedVouchers = async ({ startDate = null, endDate = null, beforeDate = null, financialYearId = null } = {}) => {
  const filter = { status: "POSTED" };

  if (financialYearId) {
    filter.financialYearId = objectId(financialYearId);
  }

  if (beforeDate) {
    filter.date = { $lt: beforeDate };
  } else if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }

  return Voucher.find(filter)
    .populate("voucherTypeId", "name code")
    .sort({ date: 1, createdAt: 1 })
    .lean();
};

const getMovementMap = async (voucherIds, ledgerIds = null) => {
  if (!voucherIds.length) return new Map();

  const match = { voucherId: { $in: voucherIds } };
  if (ledgerIds?.length) {
    match.ledgerId = { $in: ledgerIds.map(objectId) };
  }

  const rows = await VoucherEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$ledgerId",
        debit: { $sum: "$debit" },
        credit: { $sum: "$credit" },
      },
    },
  ]);

  return new Map(rows.map((row) => [
    String(row._id),
    { debit: roundMoney(row.debit), credit: roundMoney(row.credit) },
  ]));
};

const getLedgerRows = async (filters = {}) => {
  const { startDate, endDate, financialYear } = await getFinancialYearRange(filters);
  const ledgerFilter = { isActive: true };
  if (filters.groupId) ledgerFilter.groupId = objectId(filters.groupId);
  if (filters.ledgerId) ledgerFilter._id = objectId(filters.ledgerId);
  if (filters.ledgerType) ledgerFilter.ledgerType = String(filters.ledgerType).toUpperCase();

  const ledgers = await Ledger.find(ledgerFilter)
    .populate("groupId", "name code nature normalBalance parentGroupId")
    .sort({ name: 1 })
    .lean();

  const ledgerIds = ledgers.map((ledger) => ledger._id);
  const openingVouchers = startDate
    ? await getPostedVouchers({ beforeDate: startDate, financialYearId: filters.financialYearId })
    : [];
  const periodVouchers = await getPostedVouchers({
    startDate,
    endDate,
    financialYearId: filters.financialYearId,
  });
  const openingMovement = await getMovementMap(openingVouchers.map((voucher) => voucher._id), ledgerIds);
  const periodMovement = await getMovementMap(periodVouchers.map((voucher) => voucher._id), ledgerIds);

  const rows = ledgers.map((ledger) => {
    const opening = openingMovement.get(String(ledger._id)) || { debit: 0, credit: 0 };
    const period = periodMovement.get(String(ledger._id)) || { debit: 0, credit: 0 };
    const openingSigned = roundMoney(signedOpening(ledger) + opening.debit - opening.credit);
    const closingSigned = roundMoney(openingSigned + period.debit - period.credit);
    const openingBalance = splitSignedBalance(openingSigned);
    const closingBalance = splitSignedBalance(closingSigned);

    return {
      ledgerId: ledger._id,
      ledgerName: ledger.name,
      code: ledger.code,
      ledgerType: ledger.ledgerType,
      groupId: ledger.groupId?._id,
      groupName: ledger.groupId?.name || "Ungrouped",
      groupCode: ledger.groupId?.code,
      nature: ledger.groupId?.nature,
      normalBalance: ledger.groupId?.normalBalance,
      openingDebit: openingBalance.debit,
      openingCredit: openingBalance.credit,
      openingBalance: openingBalance.balance,
      openingBalanceType: openingBalance.balanceType,
      periodDebit: roundMoney(period.debit),
      periodCredit: roundMoney(period.credit),
      closingDebit: closingBalance.debit,
      closingCredit: closingBalance.credit,
      closingBalance: closingBalance.balance,
      closingBalanceType: closingBalance.balanceType,
      closingSigned,
    };
  });

  return {
    rows,
    period: {
      startDate,
      endDate,
      financialYear,
    },
  };
};

const sum = (rows, key) => roundMoney(rows.reduce((total, row) => total + Number(row[key] || 0), 0));

const hasActivity = (row) => (
  row.openingDebit
  || row.openingCredit
  || row.periodDebit
  || row.periodCredit
  || row.closingDebit
  || row.closingCredit
);

const groupLedgerRows = (rows, amountForRow) => {
  const groups = new Map();
  rows.forEach((row) => {
    const amount = roundMoney(amountForRow(row));
    if (Math.abs(amount) <= 0.009) return;
    const groupName = row.groupName || "Ungrouped";
    if (!groups.has(groupName)) {
      groups.set(groupName, { groupId: row.groupId, groupName, ledgers: [], total: 0 });
    }
    const group = groups.get(groupName);
    group.ledgers.push({
      ledgerId: row.ledgerId,
      ledgerName: row.ledgerName,
      code: row.code,
      amount,
      balanceType: amount < 0 ? "CREDIT" : "DEBIT",
    });
    group.total = roundMoney(group.total + amount);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    total: roundMoney(Math.abs(group.total)),
  }));
};

const excludedProfitLossLedgerTypes = new Set(["TAX", "CASH", "BANK", "CUSTOMER", "SUPPLIER", "STOCK"]);

const profitLossDebugRows = (rows, includedRows, side) => {
  const includedIds = new Set(includedRows.map((row) => String(row.ledgerId)));
  return rows.map((row) => {
    let reason = "Excluded because ledger group nature is not income or expense.";
    if (excludedProfitLossLedgerTypes.has(row.ledgerType)) {
      reason = `Excluded because ${row.ledgerType} ledgers are not part of Profit & Loss.`;
    } else if (includedIds.has(String(row.ledgerId))) {
      reason = `Included as ${side}.`;
    } else if (row.nature === "INCOME" || row.nature === "EXPENSE") {
      reason = "Excluded because net period movement is zero or contra-classified.";
    }
    return {
      ledgerId: row.ledgerId,
      ledgerName: row.ledgerName,
      code: row.code,
      ledgerType: row.ledgerType,
      groupName: row.groupName,
      nature: row.nature,
      periodDebit: row.periodDebit,
      periodCredit: row.periodCredit,
      netAmount: roundMoney(row.periodCredit - row.periodDebit),
      included: includedIds.has(String(row.ledgerId)),
      side: includedIds.has(String(row.ledgerId)) ? side : null,
      reason,
    };
  });
};

export const getTrialBalance = async (filters = {}) => {
  const { rows, period } = await getLedgerRows(filters);
  const visibleRows = rows.filter((row) => filters.hideZero === "true" ? hasActivity(row) : true);
  const totals = {
    openingDebit: sum(visibleRows, "openingDebit"),
    openingCredit: sum(visibleRows, "openingCredit"),
    periodDebit: sum(visibleRows, "periodDebit"),
    periodCredit: sum(visibleRows, "periodCredit"),
    closingDebit: sum(visibleRows, "closingDebit"),
    closingCredit: sum(visibleRows, "closingCredit"),
  };
  totals.difference = roundMoney(totals.closingDebit - totals.closingCredit);

  return {
    reportName: "Trial Balance",
    period: { startDate: period.startDate, endDate: period.endDate, financialYear: period.financialYear },
    rows: visibleRows,
    totals,
    isBalanced: Math.abs(totals.difference) <= 0.009,
  };
};

export const getProfitAndLoss = async (filters = {}) => {
  const { rows, period } = await getLedgerRows(filters);
  const plEligibleRows = rows.filter((row) => !excludedProfitLossLedgerTypes.has(row.ledgerType));
  const incomeRows = plEligibleRows.filter((row) => row.nature === "INCOME" || row.ledgerType === "PURCHASE_RETURN");
  const expenseRows = plEligibleRows.filter((row) => row.nature === "EXPENSE" && row.ledgerType !== "PURCHASE_RETURN");
  const income = groupLedgerRows(incomeRows, (row) => row.periodCredit - row.periodDebit);
  const expenses = groupLedgerRows(expenseRows, (row) => row.periodDebit - row.periodCredit);
  const totalIncome = roundMoney(income.reduce((total, group) => total + group.total, 0));
  const totalExpenses = roundMoney(expenses.reduce((total, group) => total + group.total, 0));
  const result = roundMoney(totalIncome - totalExpenses);

  const report = {
    reportName: "Profit & Loss",
    period: { startDate: period.startDate, endDate: period.endDate, financialYear: period.financialYear },
    income,
    expenses,
    totals: {
      totalIncome,
      totalExpenses,
      grossProfit: result > 0 ? result : 0,
      netProfit: result > 0 ? result : 0,
      netLoss: result < 0 ? Math.abs(result) : 0,
    },
  };

  if (String(filters.debug) === "true") {
    report.debug = {
      includedIncomeLedgers: profitLossDebugRows(rows, incomeRows, "income").filter((row) => row.included),
      includedExpenseLedgers: profitLossDebugRows(rows, expenseRows, "expense").filter((row) => row.included),
      allLedgers: [
        ...profitLossDebugRows(rows, incomeRows, "income").filter((row) => row.included),
        ...profitLossDebugRows(rows, expenseRows, "expense").filter((row) => row.included),
        ...rows
          .filter((row) => !incomeRows.some((incomeRow) => String(incomeRow.ledgerId) === String(row.ledgerId))
            && !expenseRows.some((expenseRow) => String(expenseRow.ledgerId) === String(row.ledgerId)))
          .map((row) => profitLossDebugRows([row], [], null)[0]),
      ],
    };
  }

  return report;
};

export const getBalanceSheet = async (filters = {}) => {
  const asOnDate = filters.asOnDate || filters.endDate || new Date().toISOString().slice(0, 10);
  const ledgerResult = await getLedgerRows({ ...filters, startDate: undefined, endDate: asOnDate, asOnDate });
  const balanceSheetRows = ledgerResult.rows.filter((row) => row.nature === "ASSET" || row.nature === "LIABILITY");
  const assetRows = balanceSheetRows.filter((row) => row.closingSigned > 0);
  const liabilityRows = balanceSheetRows.filter((row) => row.closingSigned < 0);
  const assets = groupLedgerRows(assetRows, (row) => row.closingSigned);
  const liabilities = groupLedgerRows(liabilityRows, (row) => -row.closingSigned);

  const pl = await getProfitAndLoss({
    ...filters,
    startDate: ledgerResult.period.financialYear?.startDate,
    endDate: asOnDate,
  });
  if (pl.totals.netProfit > 0) {
    liabilities.push({
      groupName: "Current Period Profit",
      ledgers: [{ ledgerName: "Net Profit", amount: pl.totals.netProfit, balanceType: "CREDIT" }],
      total: pl.totals.netProfit,
    });
  }
  if (pl.totals.netLoss > 0) {
    assets.push({
      groupName: "Current Period Loss",
      ledgers: [{ ledgerName: "Net Loss", amount: pl.totals.netLoss, balanceType: "DEBIT" }],
      total: pl.totals.netLoss,
    });
  }

  const totalAssets = roundMoney(assets.reduce((total, group) => total + group.total, 0));
  const totalLiabilities = roundMoney(liabilities.reduce((total, group) => total + group.total, 0));
  const difference = roundMoney(totalAssets - totalLiabilities);

  const report = {
    reportName: "Balance Sheet",
    asOnDate: ledgerResult.period.endDate,
    assets,
    liabilities,
    totals: { totalAssets, totalLiabilities, difference },
    isBalanced: Math.abs(difference) <= 0.009,
  };

  if (String(filters.debug) === "true") {
    const assetIds = new Set(assetRows.map((row) => String(row.ledgerId)));
    const liabilityIds = new Set(liabilityRows.map((row) => String(row.ledgerId)));
    report.debug = {
      ledgers: ledgerResult.rows.map((row) => ({
        ledgerId: row.ledgerId,
        ledgerName: row.ledgerName,
        code: row.code,
        ledgerType: row.ledgerType,
        groupName: row.groupName,
        nature: row.nature,
        closingBalance: row.closingBalance,
        closingBalanceType: row.closingBalanceType,
        includedUnder: assetIds.has(String(row.ledgerId)) ? "assets" : liabilityIds.has(String(row.ledgerId)) ? "liabilities" : null,
        reason: assetIds.has(String(row.ledgerId))
          ? "Included because group nature is ASSET."
          : liabilityIds.has(String(row.ledgerId))
            ? "Included because group nature is LIABILITY."
            : "Excluded because Profit & Loss handles income/expense ledgers.",
      })),
    };
  }

  return report;
};

const getBook = async (filters = {}, ledgerType, names) => {
  const { startDate, endDate, financialYear } = await getFinancialYearRange(filters);
  const ledgerFilter = { isActive: true, ledgerType };
  if (filters.ledgerId) ledgerFilter._id = objectId(filters.ledgerId);
  const ledgers = await Ledger.find(ledgerFilter).sort({ name: 1 }).lean();
  const ledgerIds = ledgers.map((ledger) => ledger._id);
  const ledgerById = new Map(ledgers.map((ledger) => [String(ledger._id), ledger]));
  const openingVouchers = startDate ? await getPostedVouchers({ beforeDate: startDate, financialYearId: filters.financialYearId }) : [];
  const openingMovement = await getMovementMap(openingVouchers.map((voucher) => voucher._id), ledgerIds);
  let runningSigned = roundMoney(ledgers.reduce((total, ledger) => {
    const movement = openingMovement.get(String(ledger._id)) || { debit: 0, credit: 0 };
    return total + signedOpening(ledger) + movement.debit - movement.credit;
  }, 0));

  const vouchers = await getPostedVouchers({ startDate, endDate, financialYearId: filters.financialYearId });
  const voucherById = new Map(vouchers.map((voucher) => [String(voucher._id), voucher]));
  const entries = await VoucherEntry.find({
    ledgerId: { $in: ledgerIds },
    voucherId: { $in: vouchers.map((voucher) => voucher._id) },
  }).lean();

  const rows = entries
    .map((entry) => ({ entry, voucher: voucherById.get(String(entry.voucherId)) }))
    .filter(({ voucher }) => Boolean(voucher))
    .sort((a, b) => new Date(a.voucher.date) - new Date(b.voucher.date) || String(a.entry._id).localeCompare(String(b.entry._id)))
    .map(({ entry, voucher }) => {
      const debit = roundMoney(entry.debit);
      const credit = roundMoney(entry.credit);
      runningSigned = roundMoney(runningSigned + debit - credit);
      const balance = splitSignedBalance(runningSigned);
      const ledger = ledgerById.get(String(entry.ledgerId));
      return {
        date: voucher.date,
        voucherId: voucher._id,
        voucherTypeCode: voucher.voucherTypeCode,
        voucherNo: voucher.voucherNo,
        ledgerId: entry.ledgerId,
        ledgerName: ledger?.name || entry.ledgerName,
        particulars: entry.narration || voucher.narration || "-",
        referenceNo: voucher.referenceNo,
        debit,
        credit,
        receipt: debit,
        payment: credit,
        deposit: debit,
        withdrawal: credit,
        balance: balance.balance,
        balanceType: balance.balanceType,
      };
    });

  const totalDebit = sum(rows, "debit");
  const totalCredit = sum(rows, "credit");
  const closing = splitSignedBalance(runningSigned);

  return {
    reportName: names.reportName,
    period: { startDate, endDate, financialYear },
    ledgers: ledgers.map((ledger) => ({ ledgerId: ledger._id, ledgerName: ledger.name, code: ledger.code })),
    openingBalance: splitSignedBalance(roundMoney(runningSigned - totalDebit + totalCredit)).balance,
    openingBalanceType: splitSignedBalance(roundMoney(runningSigned - totalDebit + totalCredit)).balanceType,
    entries: rows,
    totals: {
      [names.debitTotal]: totalDebit,
      [names.creditTotal]: totalCredit,
      closingBalance: closing.balance,
      closingBalanceType: closing.balanceType,
    },
  };
};

export const getCashBook = (filters = {}) => getBook(filters, "CASH", {
  reportName: "Cash Book",
  debitTotal: "totalReceipts",
  creditTotal: "totalPayments",
});

export const getBankBook = (filters = {}) => getBook(filters, "BANK", {
  reportName: "Bank Book",
  debitTotal: "totalDeposits",
  creditTotal: "totalWithdrawals",
});

const getPartyReport = async (filters = {}, ledgerType, names) => {
  const asOnDate = filters.asOnDate || filters.endDate || new Date().toISOString().slice(0, 10);
  const { rows } = await getLedgerRows({
    ...filters,
    startDate: undefined,
    endDate: asOnDate,
    asOnDate,
    ledgerType,
  });
  const visibleRows = rows
    .filter((row) => filters.includeZero === "true" || row.closingBalance > 0)
    .map((row) => ({
      ledgerId: row.ledgerId,
      ledgerName: row.ledgerName,
      openingBalance: row.openingBalance,
      openingBalanceType: row.openingBalanceType,
      debit: row.periodDebit,
      credit: row.periodCredit,
      closingBalance: row.closingBalance,
      balanceType: row.closingBalanceType,
      [names.primaryField]: row.closingBalanceType === names.primaryType ? row.closingBalance : 0,
      advance: row.closingBalanceType !== names.primaryType ? row.closingBalance : 0,
    }));

  return {
    reportName: names.reportName,
    asOnDate,
    rows: visibleRows,
    totals: {
      [names.primaryTotal]: sum(visibleRows, names.primaryField),
      totalAdvance: sum(visibleRows, "advance"),
    },
  };
};

export const getReceivables = (filters = {}) => getPartyReport(filters, "CUSTOMER", {
  reportName: "Receivables",
  primaryType: "DEBIT",
  primaryField: "receivable",
  primaryTotal: "totalReceivable",
});

export const getPayables = (filters = {}) => getPartyReport(filters, "SUPPLIER", {
  reportName: "Payables",
  primaryType: "CREDIT",
  primaryField: "payable",
  primaryTotal: "totalPayable",
});

export const getLedgerSummary = async (filters = {}) => {
  const { rows, period } = await getLedgerRows(filters);
  return {
    reportName: "Ledger Summary",
    period: { startDate: period.startDate, endDate: period.endDate, financialYear: period.financialYear },
    rows: rows.filter((row) => filters.hideZero === "true" ? hasActivity(row) : true),
  };
};

export const getAccountGroupSummary = async (filters = {}) => {
  const { rows, period } = await getLedgerRows(filters);
  const groups = await AccountGroup.find(filters.nature ? { nature: String(filters.nature).toUpperCase() } : {})
    .select("name code nature normalBalance parentGroupId")
    .lean();
  const groupById = new Map(groups.map((group) => [String(group._id), group]));
  const summary = new Map();

  const ensure = (group) => {
    const id = String(group?._id || "ungrouped");
    if (!summary.has(id)) {
      summary.set(id, {
        groupId: group?._id,
        groupName: group?.name || "Ungrouped",
        groupCode: group?.code,
        nature: group?.nature,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        closingBalance: 0,
      });
    }
    return summary.get(id);
  };

  rows.forEach((row) => {
    let group = row.groupId ? groupById.get(String(row.groupId)) : null;
    while (group) {
      const target = ensure(group);
      target.openingDebit = roundMoney(target.openingDebit + row.openingDebit);
      target.openingCredit = roundMoney(target.openingCredit + row.openingCredit);
      target.periodDebit = roundMoney(target.periodDebit + row.periodDebit);
      target.periodCredit = roundMoney(target.periodCredit + row.periodCredit);
      target.closingDebit = roundMoney(target.closingDebit + row.closingDebit);
      target.closingCredit = roundMoney(target.closingCredit + row.closingCredit);
      target.closingBalance = roundMoney(target.closingBalance + row.closingBalance);
      group = group.parentGroupId ? groupById.get(String(group.parentGroupId)) : null;
    }
  });

  return {
    reportName: "Account Group Summary",
    period: { startDate: period.startDate, endDate: period.endDate, financialYear: period.financialYear },
    rows: Array.from(summary.values()).sort((a, b) => String(a.groupName).localeCompare(String(b.groupName))),
  };
};

export const getAccountingReportDashboard = async (filters = {}) => {
  const [trialBalance, profitLoss, balanceSheet, cashBook, bankBook, receivables, payables, recentVouchers] = await Promise.all([
    getTrialBalance({ ...filters, hideZero: "true" }),
    getProfitAndLoss(filters),
    getBalanceSheet({ ...filters, asOnDate: filters.asOnDate || filters.endDate }),
    getCashBook(filters),
    getBankBook(filters),
    getReceivables(filters),
    getPayables(filters),
    Voucher.find({ status: "POSTED" }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
  ]);

  return {
    reportName: "Accounting Report Dashboard",
    period: trialBalance.period,
    totalIncome: profitLoss.totals.totalIncome,
    totalExpenses: profitLoss.totals.totalExpenses,
    netProfit: profitLoss.totals.netProfit,
    netLoss: profitLoss.totals.netLoss,
    cashBalance: cashBook.totals.closingBalance,
    bankBalance: bankBook.totals.closingBalance,
    receivables: receivables.totals.totalReceivable,
    payables: payables.totals.totalPayable,
    totalAssets: balanceSheet.totals.totalAssets,
    totalLiabilities: balanceSheet.totals.totalLiabilities,
    trialBalanceDifference: trialBalance.totals.difference,
    recentVouchers,
  };
};
