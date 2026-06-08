import {
  getAccountGroupSummary,
  getAccountingReportDashboard,
  getBalanceSheet,
  getBankBook,
  getCashBook,
  getLedgerSummary,
  getPayables,
  getProfitAndLoss,
  getReceivables,
  getTrialBalance,
} from "../../services/accounting/accountingReports.service.js";

const sendReport = (handler) => async (req, res) => {
  try {
    const data = await handler(req.query || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAccountingReportDashboardController = sendReport(getAccountingReportDashboard);
export const getTrialBalanceReportController = sendReport(getTrialBalance);
export const getProfitLossReportController = sendReport(getProfitAndLoss);
export const getBalanceSheetReportController = sendReport(getBalanceSheet);
export const getCashBookReportController = sendReport(getCashBook);
export const getBankBookReportController = sendReport(getBankBook);
export const getReceivablesReportController = sendReport(getReceivables);
export const getPayablesReportController = sendReport(getPayables);
export const getLedgerSummaryReportController = sendReport(getLedgerSummary);
export const getGroupSummaryReportController = sendReport(getAccountGroupSummary);
