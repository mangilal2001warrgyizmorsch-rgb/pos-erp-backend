import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import Sale from "../../models/Sale.js";
import { postSaleAccountingVoucher } from "../../services/accounting/salesAccounting.service.js";
import Purchase from "../../models/Purchase.js";
import { postPurchaseAccountingVoucher } from "../../services/accounting/purchaseAccounting.service.js";
import SalesReturn from "../../models/SalesReturn.js";
import PurchaseReturn from "../../models/PurchaseReturn.js";
import Expense from "../../models/Expense.js";
import CashBankTransaction from "../../models/CashBankTransaction.js";
import { postExpenseAccountingVoucher } from "../../services/accounting/expenseAccounting.service.js";
import {
  postPurchaseReturnAccountingVoucher,
  postSaleReturnAccountingVoucher,
} from "../../services/accounting/returnAccounting.service.js";
import {
  postBankTransferVoucher,
  postCashBankTransactionVoucher,
} from "../../services/accounting/cashBankAccounting.service.js";
import {
  cancelVoucher,
  createDraftVoucher,
  createAndPostTestVoucher,
  getVoucherById,
  postVoucher,
  reverseVoucher,
} from "../../services/accounting/voucher.service.js";

export const createVoucher = async (req, res) => {
  try {
    const voucher = await createDraftVoucher({
      ...req.body,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVouchers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = String(req.query.status).toUpperCase();
    }
    if (req.query.voucherTypeCode) {
      filter.voucherTypeCode = String(req.query.voucherTypeCode).toUpperCase();
    }
    if (req.query.referenceModule) {
      filter.referenceModule = String(req.query.referenceModule);
    }
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.date.$lte = new Date(req.query.endDate);
      }
    }
    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { voucherNo: new RegExp(search, "i") },
        { referenceNo: new RegExp(search, "i") },
        { narration: new RegExp(search, "i") },
      ];
    }

    const vouchers = await Voucher.find(filter)
      .populate("voucherTypeId", "name code")
      .populate("financialYearId", "name startDate endDate")
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({ success: true, count: vouchers.length, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getVoucher = async (req, res) => {
  try {
    const voucher = await getVoucherById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    return res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const postVoucherController = async (req, res) => {
  try {
    const voucher = await postVoucher(req.params.id, req.user?._id);
    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const directPostVoucherController = async (req, res) => {
  try {
    const voucher = await postVoucher({
      ...req.body,
      createdBy: req.user?._id,
    }, req.user?._id);
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const cancelVoucherController = async (req, res) => {
  try {
    const voucher = await cancelVoucher(
      req.params.id,
      req.body?.reason || req.body?.cancellationReason,
      req.user?._id,
    );
    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const reverseVoucherController = async (req, res) => {
  try {
    const voucher = await reverseVoucher(req.params.id, req.body?.reason, req.user?._id);
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createTestVoucherController = async (req, res) => {
  try {
    // Phase 3 manual journal test endpoint. Future phases can replace this with a full journal UI/API.
    const voucher = await createAndPostTestVoucher(req.body, req.user?._id);
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const buildJournalPayload = (body = {}, userId = null) => ({
  voucherTypeCode: "JOURNAL",
  date: body.date || Date.now(),
  narration: body.narration || "Manual journal voucher",
  referenceNo: body.referenceNo,
  entries: body.entries || [],
  createdBy: userId,
});

export const createJournalDraftController = async (req, res) => {
  try {
    const voucher = await createDraftVoucher(buildJournalPayload(req.body, req.user?._id));
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const postJournalController = async (req, res) => {
  try {
    const voucher = await postVoucher(buildJournalPayload(req.body, req.user?._id), req.user?._id);
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const repostSaleAccountingController = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const result = await postSaleAccountingVoucher(sale, { createdBy: req.user?._id });
    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Sale accounting voucher already exists or posting is disabled."
        : "Sale accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostPurchaseAccountingController = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    let existingVoucher = purchase.accountingVoucherId
      ? await Voucher.findById(purchase.accountingVoucherId)
      : null;
    if (!existingVoucher || ["CANCELLED", "REVERSED"].includes(existingVoucher.status)) {
      existingVoucher = await Voucher.findOne({
        referenceModule: "purchase",
        referenceId: purchase._id,
        status: { $nin: ["CANCELLED", "REVERSED"] },
      });
    }

    if (existingVoucher && !["CANCELLED", "REVERSED"].includes(existingVoucher.status)) {
      await cancelVoucher(
        existingVoucher._id,
        `Purchase ${purchase.purchaseNumber || purchase.invoiceNumber || purchase._id} reposted`,
        req.user?._id,
      );
      purchase.accountingVoucherId = undefined;
      purchase.accountingPosted = false;
      purchase.accountingStatus = "not_posted";
      purchase.accountingError = undefined;
      await purchase.save();
    }

    const result = await postPurchaseAccountingVoucher(purchase, {
      createdBy: req.user?._id,
      source: "purchase_bill",
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Purchase accounting voucher already exists or posting is disabled."
        : "Purchase accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostSaleReturnAccountingController = async (req, res) => {
  try {
    const saleReturn = await SalesReturn.findById(req.params.returnId);
    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    const result = await postSaleReturnAccountingVoucher(saleReturn, {
      createdBy: req.user?._id,
      source: "sale_return",
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Sale return accounting voucher already exists or posting is disabled."
        : "Sale return accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostPurchaseReturnAccountingController = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.returnId);
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    const result = await postPurchaseReturnAccountingVoucher(purchaseReturn, {
      createdBy: req.user?._id,
      source: "purchase_return",
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Purchase return accounting voucher already exists or posting is disabled."
        : "Purchase return accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostExpenseAccountingController = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    const result = await postExpenseAccountingVoucher(expense, { createdBy: req.user?._id });
    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Expense accounting voucher already exists or posting is disabled."
        : "Expense accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostCashBankTransactionAccountingController = async (req, res) => {
  try {
    const transaction = await CashBankTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Cash/bank transaction not found" });
    }

    let result;
    if (transaction.referenceModule === "bank_transfer" && transaction.referenceId) {
      const transferTransactions = await CashBankTransaction.find({
        referenceModule: "bank_transfer",
        referenceId: transaction.referenceId,
        status: "completed",
      });
      const sourceTx = transferTransactions.find((tx) => tx.direction === "out");
      const destTx = transferTransactions.find((tx) => tx.direction === "in");
      result = await postBankTransferVoucher(transaction.referenceId, sourceTx, destTx, { createdBy: req.user?._id });
    } else {
      result = await postCashBankTransactionVoucher(transaction, { createdBy: req.user?._id });
    }

    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Cash/bank accounting voucher already exists or posting is disabled."
        : "Cash/bank accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const repostBankTransferAccountingController = async (req, res) => {
  try {
    const transferTransactions = await CashBankTransaction.find({
      referenceModule: "bank_transfer",
      referenceId: req.params.transferId,
      status: "completed",
    });
    const sourceTx = transferTransactions.find((tx) => tx.direction === "out");
    const destTx = transferTransactions.find((tx) => tx.direction === "in");
    if (!sourceTx || !destTx) {
      return res.status(404).json({ success: false, message: "Bank transfer transactions not found" });
    }

    const result = await postBankTransferVoucher(req.params.transferId, sourceTx, destTx, { createdBy: req.user?._id });
    return res.status(200).json({
      success: true,
      data: result,
      message: result?.skipped
        ? "Bank transfer accounting voucher already exists or posting is disabled."
        : "Bank transfer accounting voucher posted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getDayBook = async (req, res) => {
  try {
    const voucherFilter = {
      status: req.query.status ? String(req.query.status).toUpperCase() : "POSTED",
    };

    if (!req.query.status) {
      voucherFilter.reversalVoucherId = { $exists: false };
    }

    if (req.query.voucherTypeCode) {
      voucherFilter.voucherTypeCode = String(req.query.voucherTypeCode).toUpperCase();
    }
    if (req.query.startDate || req.query.endDate) {
      voucherFilter.date = {};
      if (req.query.startDate) voucherFilter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) voucherFilter.date.$lte = new Date(req.query.endDate);
    }
    if (req.query.search) {
      const search = String(req.query.search).trim();
      voucherFilter.$or = [
        { voucherNo: new RegExp(search, "i") },
        { referenceNo: new RegExp(search, "i") },
        { narration: new RegExp(search, "i") },
      ];
    }

    const vouchers = await Voucher.find(voucherFilter)
      .populate("voucherTypeId", "name code")
      .sort({ date: 1, createdAt: 1 })
      .lean();
    const voucherIds = vouchers.map((voucher) => voucher._id);
    const voucherById = new Map(vouchers.map((voucher) => [String(voucher._id), voucher]));

    const entryFilter = { voucherId: { $in: voucherIds } };
    if (req.query.ledgerId) {
      entryFilter.ledgerId = req.query.ledgerId;
    }

    const entries = await VoucherEntry.find(entryFilter)
      .populate("ledgerId", "name code")
      .sort({ createdAt: 1 })
      .lean();

    let totalDebit = 0;
    let totalCredit = 0;
    const dayBookEntries = entries
      .map((entry) => {
        const voucher = voucherById.get(String(entry.voucherId));
        if (!voucher) return null;
        const debit = Number(entry.debit || 0);
        const credit = Number(entry.credit || 0);
        totalDebit += debit;
        totalCredit += credit;

        return {
          date: voucher.date,
          voucherId: voucher._id,
          voucherNo: voucher.voucherNo,
          voucherTypeName: voucher.voucherTypeId?.name || voucher.voucherTypeCode,
          voucherTypeCode: voucher.voucherTypeCode,
          ledgerId: entry.ledgerId?._id,
          ledgerName: entry.ledgerId?.name || entry.ledgerName,
          referenceNo: voucher.referenceNo,
          narration: entry.narration || voucher.narration,
          debit,
          credit,
          status: voucher.status,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: {
        entries: dayBookEntries,
        totals: {
          totalDebit: Math.round((totalDebit + Number.EPSILON) * 100) / 100,
          totalCredit: Math.round((totalCredit + Number.EPSILON) * 100) / 100,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    if (voucher.status === "POSTED") {
      return res.status(400).json({
        success: false,
        message: "Posted vouchers cannot be deleted. Cancel or reverse them instead.",
      });
    }

    await VoucherEntry.deleteMany({ voucherId: voucher._id });
    await Voucher.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Voucher deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
