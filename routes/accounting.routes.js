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
} from "../controllers/accounting/accountingSettings.controller.js";
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
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/status", getStatus);
router.get("/dashboard", getAccountingDashboard);
router.post("/initialize", initializeAccountingFoundation);
router.get("/chart-of-accounts", getChartOfAccountsController);
router.get("/day-book", getDayBook);
router.post("/journal/draft", authorize("admin"), createJournalDraftController);
router.post("/journal/post", authorize("admin"), postJournalController);
router.post("/test-voucher", authorize("admin"), createTestVoucherController);
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

export default router;
