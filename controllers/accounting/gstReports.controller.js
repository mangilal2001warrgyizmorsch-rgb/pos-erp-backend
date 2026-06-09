import {
  getGSTDebugReport,
  getGSTExceptionReport,
  getGSTLedgerReport,
  getGSTPartyWiseReport,
  getGSTPayableSummary,
  getGSTSummary,
  getGSTR1StyleReport,
  getGSTR3BStyleSummary,
  getHSNSummary,
  getInputGSTReport,
  getOutputGSTReport,
} from "../../services/accounting/gstReports.service.js";

const sendReport = (handler) => async (req, res) => {
  try {
    const data = await handler(req.query || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGSTSummaryController = sendReport(getGSTSummary);
export const getOutputGSTReportController = sendReport(getOutputGSTReport);
export const getInputGSTReportController = sendReport(getInputGSTReport);
export const getGSTPayableSummaryController = sendReport(getGSTPayableSummary);
export const getHSNSummaryController = sendReport(getHSNSummary);
export const getGSTR1StyleReportController = sendReport(getGSTR1StyleReport);
export const getGSTR3BStyleSummaryController = sendReport(getGSTR3BStyleSummary);
export const getGSTLedgerReportController = sendReport(getGSTLedgerReport);
export const getGSTPartyWiseReportController = sendReport(getGSTPartyWiseReport);
export const getGSTExceptionReportController = sendReport(getGSTExceptionReport);
export const getGSTDebugReportController = sendReport(getGSTDebugReport);
