import express from "express";
import {
  createAccountGroup,
  deleteAccountGroup,
  getAccountGroupById,
  getAccountGroups,
  updateAccountGroup,
} from "../controllers/accounting/accountGroup.controller.js";
import {
  getChartOfAccountsController,
  getAccountingDashboard,
  getAccountingSettings,
  getStatus,
  initializeAccountingFoundation,
  updateAccountingSettings,
  validateAccountingSettingsController,
} from "../controllers/accounting/accountingSettings.controller.js";
import {
  fixLedgerReconciliationController,
  getAccountingAuditLogsController,
  getAccountingHealthCheckController,
  getCashBankReconciliationController,
  getCashBankReconciliationDetailsController,
  getGSTReconciliationController,
  getLedgerReconciliationController,
  getPartyReconciliationController,
  linkCashBankLedgersController,
  linkPartyLedgersController,
  postCashBankOpeningBalanceController,
  postCashBankOpeningBalancesController,
  postOpeningBalancesController,
  repostMissingAccountingBatchController,
  repostMissingAccountingController,
} from "../controllers/accounting/accountingHealth.controller.js";
import {
  getAccountingReportDashboardController,
  getBalanceSheetReportController,
  getBankBookReportController,
  getCashBookReportController,
  getGroupSummaryReportController,
  getLedgerSummaryReportController,
  getPayablesReportController,
  getProfitLossReportController,
  getReceivablesReportController,
  getTrialBalanceReportController,
} from "../controllers/accounting/accountingReports.controller.js";
import {
  getGSTDebugReportController,
  getGSTExceptionReportController,
  getGSTLedgerReportController,
  getGSTPartyWiseReportController,
  getGSTPayableSummaryController,
  getGSTSummaryController,
  getGSTR1StyleReportController,
  getGSTR3BStyleSummaryController,
  getHSNSummaryController,
  getInputGSTReportController,
  getOutputGSTReportController,
} from "../controllers/accounting/gstReports.controller.js";
import {
  createLedgerController,
  deleteLedger,
  getBasicTrialBalance,
  getLedgerBalance,
  getLedger,
  getLedgerStatement,
  getLedgerByCodeController,
  getDefaultLedgers,
  getLedgers,
  getLedgersByGroupController,
  getSystemLedgerController,
  restoreDefaultLedgersController,
  updateLedger,
} from "../controllers/accounting/ledger.controller.js";
import {
  cancelVoucherController,
  createJournalDraftController,
  createVoucher,
  createTestVoucherController,
  deleteVoucher,
  directPostVoucherController,
  getDayBook,
  getVoucher,
  getVouchers,
  postJournalController,
  postVoucherController,
  repostBankTransferAccountingController,
  repostCashBankTransactionAccountingController,
  repostExpenseAccountingController,
  repostPurchaseAccountingController,
  repostPurchaseReturnAccountingController,
  repostSaleAccountingController,
  repostSaleReturnAccountingController,
  reverseVoucherController,
} from "../controllers/accounting/voucher.controller.js";
import {
  createVoucherType,
  deleteVoucherType,
  getVoucherType,
  getVoucherTypes,
  updateVoucherType,
} from "../controllers/accounting/voucherType.controller.js";
import {
  importStatement,
  saveStatementAndMap,
  postMappedEntries,
  getImportHistory,
  getImportDetails
} from "../controllers/accounting/bankStatementImport.controller.js";
import {
  getMappings,
  createMapping,
  updateMapping,
  deleteMapping
} from "../controllers/accounting/bankTransactionMapping.controller.js";
import {
  getSettings,
  updateSettings
} from "../controllers/accounting/bankImportSettings.controller.js";
import { authorize, protect } from "../middleware/auth.js";
import multer from "multer";

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});


const router = express.Router();

router.use(protect);

router.get("/status", getStatus);
router.get("/dashboard", getAccountingDashboard);
router.post("/initialize", authorize("admin", "accountant"), initializeAccountingFoundation);
router.get("/chart-of-accounts", getChartOfAccountsController);
router.get("/day-book", getDayBook);
router.get("/health-check", getAccountingHealthCheckController);
router.get("/audit-logs", getAccountingAuditLogsController);
router.post("/journal/draft", authorize("admin", "accountant"), createJournalDraftController);
router.post("/journal/post", authorize("admin", "accountant"), postJournalController);
router.post("/test-voucher", authorize("admin", "accountant"), createTestVoucherController);
router.post("/repost/missing", authorize("admin", "accountant"), repostMissingAccountingController);
router.post("/repost/missing/batch", authorize("admin", "accountant"), repostMissingAccountingBatchController);
router.post("/repost/sale/:saleId", authorize("admin", "accountant"), repostSaleAccountingController);
router.post("/repost/purchase/:purchaseId", authorize("admin", "accountant"), repostPurchaseAccountingController);
router.post("/repost/sale-return/:returnId", authorize("admin", "accountant"), repostSaleReturnAccountingController);
router.post("/repost/purchase-return/:returnId", authorize("admin", "accountant"), repostPurchaseReturnAccountingController);
router.post("/repost/expense/:expenseId", authorize("admin", "accountant"), repostExpenseAccountingController);
router.post("/repost/cash-bank-transaction/:transactionId", authorize("admin", "accountant"), repostCashBankTransactionAccountingController);
router.post("/repost/bank-transfer/:transferId", authorize("admin", "accountant"), repostBankTransferAccountingController);
router.get("/trial-balance/basic", getBasicTrialBalance);
router.get("/reports/dashboard", getAccountingReportDashboardController);
router.get("/reports/trial-balance", getTrialBalanceReportController);
router.get("/reports/profit-loss", getProfitLossReportController);
router.get("/reports/balance-sheet", getBalanceSheetReportController);
router.get("/reports/cash-book", getCashBookReportController);
router.get("/reports/bank-book", getBankBookReportController);
router.get("/reports/receivables", getReceivablesReportController);
router.get("/reports/payables", getPayablesReportController);
router.get("/reports/ledger-summary", getLedgerSummaryReportController);
router.get("/reports/group-summary", getGroupSummaryReportController);
router.get("/gst/summary", getGSTSummaryController);
router.get("/gst/output", getOutputGSTReportController);
router.get("/gst/input", getInputGSTReportController);
router.get("/gst/payable-summary", getGSTPayableSummaryController);
router.get("/gst/hsn-summary", getHSNSummaryController);
router.get("/gst/gstr1", getGSTR1StyleReportController);
router.get("/gst/gstr3b-summary", getGSTR3BStyleSummaryController);
router.get("/gst/ledger", getGSTLedgerReportController);
router.get("/gst/party-wise", getGSTPartyWiseReportController);
router.get("/gst/exceptions", getGSTExceptionReportController);
router.get("/gst/debug", getGSTDebugReportController);
router.get("/reconciliation/ledgers", getLedgerReconciliationController);
router.post("/reconciliation/ledgers/fix", authorize("admin", "accountant"), fixLedgerReconciliationController);
router.get("/reconciliation/cash-bank", getCashBankReconciliationController);
router.get("/reconciliation/cash-bank/details", getCashBankReconciliationDetailsController);
router.post("/reconciliation/cash-bank/link-ledgers", authorize("admin", "accountant"), linkCashBankLedgersController);
router.post("/reconciliation/parties/link-ledgers", authorize("admin", "accountant"), linkPartyLedgersController);
router.post("/opening-balances/post-all", authorize("admin", "accountant"), postOpeningBalancesController);
router.post("/opening-balances/cash-bank/post-all", authorize("admin", "accountant"), postCashBankOpeningBalancesController);
router.post("/opening-balances/cash-bank/:accountId/post", authorize("admin", "accountant"), postCashBankOpeningBalanceController);
router.get("/reconciliation/parties", getPartyReconciliationController);
router.get("/reconciliation/gst", getGSTReconciliationController);

router
  .route("/groups")
  .get(getAccountGroups)
  .post(authorize("admin", "accountant"), createAccountGroup);

router
  .route("/groups/:id")
  .get(getAccountGroupById)
  .put(authorize("admin", "accountant"), updateAccountGroup)
  .delete(authorize("admin", "accountant"), deleteAccountGroup);

router.get("/ledgers/code/:code", getLedgerByCodeController);
router.get("/ledgers/group/:groupId", getLedgersByGroupController);
router.get("/ledgers/system/:ledgerType", getSystemLedgerController);
router.get("/ledgers/defaults", getDefaultLedgers);
router.post("/ledgers/restore-defaults", authorize("admin", "accountant"), restoreDefaultLedgersController);
router.get("/ledgers/:id/balance", getLedgerBalance);
router.get("/ledgers/:id/statement", getLedgerStatement);

router
  .route("/ledgers")
  .get(getLedgers)
  .post(authorize("admin", "accountant"), createLedgerController);

router
  .route("/ledgers/:id")
  .get(getLedger)
  .put(authorize("admin", "accountant"), updateLedger)
  .delete(authorize("admin", "accountant"), deleteLedger);

router
  .route("/voucher-types")
  .get(getVoucherTypes)
  .post(authorize("admin", "accountant"), createVoucherType);

router
  .route("/voucher-types/:id")
  .get(getVoucherType)
  .put(authorize("admin", "accountant"), updateVoucherType)
  .delete(authorize("admin", "accountant"), deleteVoucherType);

router.get("/vouchers", getVouchers);
router.post("/vouchers/draft", authorize("admin", "accountant"), createVoucher);
router.post("/vouchers/post", authorize("admin", "accountant"), directPostVoucherController);
router.post("/vouchers", authorize("admin", "accountant"), createVoucher);

router.post("/vouchers/:id/post", authorize("admin", "accountant"), postVoucherController);
router.post("/vouchers/:id/cancel", authorize("admin", "accountant"), cancelVoucherController);
router.post("/vouchers/:id/reverse", authorize("admin", "accountant"), reverseVoucherController);

router
  .route("/vouchers/:id")
  .get(getVoucher)
  .delete(authorize("admin", "accountant"), deleteVoucher);

router
  .route("/settings")
  .get(getAccountingSettings)
  .put(authorize("admin", "accountant"), updateAccountingSettings);

router.get("/settings/validate", validateAccountingSettingsController);

// Bank Statement Import Routes
router.post("/bank-statement/import", authorize("admin", "accountant"), memoryUpload.single("file"), importStatement);
router.post("/bank-statement/save", authorize("admin", "accountant"), saveStatementAndMap);
router.post("/bank-statement/:id/post-entries", authorize("admin", "accountant"), postMappedEntries);
router.get("/bank-statement/history", getImportHistory);
router.get("/bank-statement/settings", getSettings);

// Bank Transaction Mapping Routes
router.get("/bank-statement/mappings", getMappings);
router.post("/bank-statement/mappings", authorize("admin", "accountant"), createMapping);
router.put("/bank-statement/mappings/:id", authorize("admin", "accountant"), updateMapping);
router.delete("/bank-statement/mappings/:id", authorize("admin", "accountant"), deleteMapping);

// Dynamic routes
router.get("/bank-statement/:id", getImportDetails);

export default router;
