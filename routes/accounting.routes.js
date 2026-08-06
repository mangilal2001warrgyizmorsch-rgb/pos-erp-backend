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
router.post("/initialize", initializeAccountingFoundation);
router.get("/chart-of-accounts", getChartOfAccountsController);
router.get("/day-book", getDayBook);
router.get("/health-check", getAccountingHealthCheckController);
router.get("/audit-logs", getAccountingAuditLogsController);
router.post("/journal/draft", authorize("admin"), createJournalDraftController);
router.post("/journal/post", authorize("admin"), postJournalController);
router.post("/test-voucher", authorize("admin"), createTestVoucherController);
router.post("/repost/missing", authorize("admin"), repostMissingAccountingController);
router.post("/repost/missing/batch", authorize("admin"), repostMissingAccountingBatchController);
router.post("/repost/sale/:saleId", authorize("admin"), repostSaleAccountingController);
router.post("/repost/purchase/:purchaseId", authorize("admin"), repostPurchaseAccountingController);
router.post("/repost/sale-return/:returnId", authorize("admin"), repostSaleReturnAccountingController);
router.post("/repost/purchase-return/:returnId", authorize("admin"), repostPurchaseReturnAccountingController);
router.post("/repost/expense/:expenseId", authorize("admin"), repostExpenseAccountingController);
router.post("/repost/cash-bank-transaction/:transactionId", authorize("admin"), repostCashBankTransactionAccountingController);
router.post("/repost/bank-transfer/:transferId", authorize("admin"), repostBankTransferAccountingController);
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
router.post("/reconciliation/ledgers/fix", authorize("admin"), fixLedgerReconciliationController);
router.get("/reconciliation/cash-bank", getCashBankReconciliationController);
router.get("/reconciliation/cash-bank/details", getCashBankReconciliationDetailsController);
router.post("/reconciliation/cash-bank/link-ledgers", authorize("admin"), linkCashBankLedgersController);
router.post("/reconciliation/parties/link-ledgers", authorize("admin"), linkPartyLedgersController);
router.post("/opening-balances/post-all", authorize("admin"), postOpeningBalancesController);
router.post("/opening-balances/cash-bank/post-all", authorize("admin"), postCashBankOpeningBalancesController);
router.post("/opening-balances/cash-bank/:accountId/post", authorize("admin"), postCashBankOpeningBalanceController);
router.get("/reconciliation/parties", getPartyReconciliationController);
router.get("/reconciliation/gst", getGSTReconciliationController);

router
  .route("/groups")
  .get(getAccountGroups)
  .post(createAccountGroup);

router
  .route("/groups/:id")
  .get(getAccountGroupById)
  .put(updateAccountGroup)
  .delete(deleteAccountGroup);

router.get("/ledgers/code/:code", getLedgerByCodeController);
router.get("/ledgers/group/:groupId", getLedgersByGroupController);
router.get("/ledgers/system/:ledgerType", getSystemLedgerController);
router.get("/ledgers/defaults", getDefaultLedgers);
router.post("/ledgers/restore-defaults", authorize("admin"), restoreDefaultLedgersController);
router.get("/ledgers/:id/balance", getLedgerBalance);
router.get("/ledgers/:id/statement", getLedgerStatement);

router
  .route("/ledgers")
  .get(getLedgers)
  .post(createLedgerController);

router
  .route("/ledgers/:id")
  .get(getLedger)
  .put(updateLedger)
  .delete(deleteLedger);

router
  .route("/voucher-types")
  .get(getVoucherTypes)
  .post(createVoucherType);

router
  .route("/voucher-types/:id")
  .get(getVoucherType)
  .put(updateVoucherType)
  .delete(deleteVoucherType);

router.get("/vouchers", getVouchers);
router.post("/vouchers/draft", createVoucher);
router.post("/vouchers/post", directPostVoucherController);
router.post("/vouchers", createVoucher);

router.post("/vouchers/:id/post", postVoucherController);
router.post("/vouchers/:id/cancel", cancelVoucherController);
router.post("/vouchers/:id/reverse", reverseVoucherController);

router
  .route("/vouchers/:id")
  .get(getVoucher)
  .delete(deleteVoucher);

router
  .route("/settings")
  .get(getAccountingSettings)
  .put(updateAccountingSettings);

router.get("/settings/validate", validateAccountingSettingsController);

// Bank Statement Import Routes
router.post("/bank-statement/import", memoryUpload.single("file"), importStatement);
router.post("/bank-statement/save", saveStatementAndMap);
router.post("/bank-statement/:id/post-entries", postMappedEntries);
router.get("/bank-statement/history", getImportHistory);
router.get("/bank-statement/settings", getSettings);

// Bank Transaction Mapping Routes
router.get("/bank-statement/mappings", getMappings);
router.post("/bank-statement/mappings", createMapping);
router.put("/bank-statement/mappings/:id", updateMapping);
router.delete("/bank-statement/mappings/:id", deleteMapping);

// Dynamic routes
router.get("/bank-statement/:id", getImportDetails);

export default router;
