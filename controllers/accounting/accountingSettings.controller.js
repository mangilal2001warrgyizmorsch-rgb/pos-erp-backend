import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherType from "../../models/accounting/VoucherType.model.js";
import FinancialYear from "../../models/accounting/FinancialYear.model.js";
import {
  getAccountingStatus,
  getChartOfAccounts,
  initializeAccounting,
} from "../../services/accounting/accounting.service.js";

export const getStatus = async (req, res) => {
  try {
    const status = await getAccountingStatus();
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const initializeAccountingFoundation = async (req, res) => {
  try {
    const result = await initializeAccounting(req.user?._id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getChartOfAccountsController = async (req, res) => {
  try {
    const chartOfAccounts = await getChartOfAccounts();
    res.status(200).json({
      success: true,
      count: chartOfAccounts.length,
      data: chartOfAccounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAccountingDashboard = async (req, res) => {
  try {
    const [
      settings,
      activeFinancialYear,
      accountGroups,
      ledgers,
      voucherTypes,
      postedVouchers,
      draftVouchers,
      cancelledVouchers,
      reversedVouchers,
      recentVouchers,
    ] = await Promise.all([
      AccountingSettings.findOne().lean(),
      FinancialYear.findOne({ isActive: true, isClosed: false }).lean(),
      AccountGroup.countDocuments(),
      Ledger.countDocuments(),
      VoucherType.countDocuments(),
      Voucher.countDocuments({ status: "POSTED", reversalVoucherId: { $exists: false } }),
      Voucher.countDocuments({ status: "DRAFT" }),
      Voucher.countDocuments({ status: "CANCELLED" }),
      Voucher.countDocuments({
        $or: [
          { status: "REVERSED" },
          { status: "POSTED", reversalVoucherId: { $exists: true } },
        ],
      }),
      Voucher.find()
        .populate("voucherTypeId", "name code")
        .sort({ date: -1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        status: {
          accountingEnabled: Boolean(settings?.accountingEnabled),
          gstAccountingEnabled: Boolean(settings?.gstAccountingEnabled),
          inventoryAccountingEnabled: Boolean(settings?.inventoryAccountingEnabled),
          autoVoucherPosting: settings?.autoVoucherPosting ?? true,
          activeFinancialYear,
        },
        counts: {
          accountGroups,
          ledgers,
          voucherTypes,
          postedVouchers,
          draftVouchers,
          cancelledVouchers,
          reversedVouchers,
        },
        recentVouchers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAccountingSettings = async (req, res) => {
  try {
    const settings = await AccountingSettings.findOne()
      .populate("defaultCashLedgerId", "name code")
      .populate("defaultBankLedgerId", "name code")
      .populate("defaultSalesLedgerId", "name code")
      .populate("defaultPurchaseLedgerId", "name code")
      .populate("defaultSalesReturnLedgerId", "name code")
      .populate("defaultPurchaseReturnLedgerId", "name code")
      .populate("defaultRoundOffLedgerId", "name code")
      .populate("defaultDiscountGivenLedgerId", "name code")
      .populate("defaultDiscountReceivedLedgerId", "name code")
      .populate("defaultStockLedgerId", "name code")
      .populate("defaultCOGSLedgerId", "name code");

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAccountingSettings = async (req, res) => {
  try {
    const settings = await AccountingSettings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
