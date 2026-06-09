import AuditLog from "../../models/AuditLog.js";
import {
  getCashBankReconciliation,
  getCashBankReconciliationDetails,
  getGSTReconciliation,
  getPartyReconciliation,
  linkCashBankAccountLedgers,
  linkPartyAccountingLedgers,
  postCashBankOpeningBalanceVouchers,
  postOpeningBalanceVouchers,
  recalculateLedgerBalancesFromVouchers,
  runAccountingHealthCheck,
} from "../../services/accounting/accountingHealth.service.js";
import {
  repostMissingAccounting,
  repostMissingAccountingBatch,
} from "../../services/accounting/accountingRepost.service.js";
import { createAuditLog } from "../../services/auditLog.service.js";

const errorResponse = (res, error, status = 400) => res.status(status).json({
  success: false,
  code: error.code,
  message: error.message,
  details: error.details,
});

export const getAccountingHealthCheckController = async (req, res) => {
  try {
    const health = await runAccountingHealthCheck();
    res.status(200).json({ success: true, data: health });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const repostMissingAccountingController = async (req, res) => {
  try {
    const result = await repostMissingAccounting({
      module: req.body.module,
      referenceId: req.body.referenceId,
      userId: req.user?._id,
    });
    await createAuditLog({
      req,
      action: "ACCOUNTING_REPOSTED",
      module: req.body.module,
      referenceId: req.body.referenceId,
      description: result.skipped ? "Accounting repost skipped because voucher exists" : "Accounting repost completed",
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const repostMissingAccountingBatchController = async (req, res) => {
  try {
    const results = await repostMissingAccountingBatch({
      items: req.body.items || [],
      userId: req.user?._id,
    });
    await createAuditLog({
      req,
      action: "ACCOUNTING_REPOSTED",
      module: "accounting_batch",
      description: "Batch missing accounting repost completed",
      newData: results,
    });
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const getLedgerReconciliationController = async (req, res) => {
  try {
    const result = await recalculateLedgerBalancesFromVouchers({ apply: false });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const fixLedgerReconciliationController = async (req, res) => {
  try {
    const before = await recalculateLedgerBalancesFromVouchers({ apply: false });
    const after = await recalculateLedgerBalancesFromVouchers({ apply: true, userId: req.user?._id });
    await createAuditLog({
      req,
      action: "LEDGER_RECONCILIATION_FIXED",
      module: "accounting_reconciliation",
      description: `Ledger reconciliation fixed ${before.count} mismatch(es)`,
      oldData: before.mismatches,
      newData: after.mismatches,
    });
    res.status(200).json({ success: true, data: { before, after } });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const getCashBankReconciliationController = async (req, res) => {
  try {
    const result = await getCashBankReconciliation();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const linkCashBankLedgersController = async (req, res) => {
  try {
    const result = await linkCashBankAccountLedgers({ userId: req.user?._id });
    await createAuditLog({
      req,
      action: "CASH_BANK_RECONCILIATION_FIXED",
      module: "accounting_reconciliation",
      description: "Cash/bank accounts linked to accounting ledgers",
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const linkPartyLedgersController = async (req, res) => {
  try {
    const result = await linkPartyAccountingLedgers({ userId: req.user?._id });
    await createAuditLog({
      req,
      action: "PARTY_LEDGER_RECONCILIATION_FIXED",
      module: "accounting_reconciliation",
      description: "Party accounts linked to accounting ledgers",
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const postOpeningBalancesController = async (req, res) => {
  try {
    const result = await postOpeningBalanceVouchers({ userId: req.user?._id });
    await createAuditLog({
      req,
      action: "OPENING_BALANCES_POSTED",
      module: "accounting_opening_balances",
      description: `Posted ${result.posted} opening balance voucher(s)`,
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const postCashBankOpeningBalancesController = async (req, res) => {
  try {
    const result = await postCashBankOpeningBalanceVouchers({ userId: req.user?._id });
    await createAuditLog({
      req,
      action: "CASH_BANK_OPENING_BALANCES_POSTED",
      module: "accounting_opening_balances",
      description: `Posted ${result.posted} cash/bank opening balance voucher(s)`,
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const postCashBankOpeningBalanceController = async (req, res) => {
  try {
    const result = await postCashBankOpeningBalanceVouchers({
      accountId: req.params.accountId,
      userId: req.user?._id,
    });
    await createAuditLog({
      req,
      action: "CASH_BANK_OPENING_BALANCE_POSTED",
      module: "accounting_opening_balances",
      referenceId: req.params.accountId,
      description: `Posted ${result.posted} cash/bank opening balance voucher(s) for one account`,
      newData: result,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const getCashBankReconciliationDetailsController = async (req, res) => {
  try {
    const result = await getCashBankReconciliationDetails();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const getPartyReconciliationController = async (req, res) => {
  try {
    const result = await getPartyReconciliation();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const getGSTReconciliationController = async (req, res) => {
  try {
    const result = await getGSTReconciliation(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};

export const getAccountingAuditLogsController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      module,
      user,
      startDate,
      endDate,
      search,
    } = req.query;
    const query = {};
    if (action) query.action = action;
    if (module) query.module = module;
    if (user) query.userName = { $regex: String(user), $options: "i" };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search) {
      const regex = new RegExp(String(search), "i");
      query.$or = [{ description: regex }, { referenceNo: regex }, { action: regex }, { module: regex }];
    }
    query.$and = [
      {
        $or: [
          { module: /accounting/i },
          { action: /ACCOUNTING|VOUCHER|LEDGER|JOURNAL|RECONCILIATION/i },
        ],
      },
    ];

    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedPage = Number(page) || 1;
    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate("user", "name role email")
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
    ]);
    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    errorResponse(res, error, 500);
  }
};
