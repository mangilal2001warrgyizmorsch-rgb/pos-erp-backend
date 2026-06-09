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
import { createAuditLog } from "../../services/auditLog.service.js";
import {
  getDefaultAccountingMissingCounts,
  initializeAccountingSettings,
} from "../../services/accounting/seedAccounting.service.js";

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
      missingDefaults,
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
      getDefaultAccountingMissingCounts(),
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
          initialized: Boolean(settings) && accountGroups > 0 && ledgers > 0 && voucherTypes > 0 && Boolean(activeFinancialYear),
          ...missingDefaults,
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
    let baseSettings = await AccountingSettings.findOne();
    if (!baseSettings) {
      baseSettings = await initializeAccountingSettings();
    }

    const settings = await AccountingSettings.findById(baseSettings._id)
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

const populateAccountingSettings = (query) => query
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

export const updateAccountingSettings = async (req, res) => {
  try {
    const allowedFields = [
      "accountingEnabled",
      "gstAccountingEnabled",
      "inventoryAccountingEnabled",
      "autoVoucherPosting",
      "allowManualJournalEntry",
      "allowBackdatedVouchers",
      "lockBooksTillDate",
      "defaultCashLedgerId",
      "defaultBankLedgerId",
      "defaultSalesLedgerId",
      "defaultPurchaseLedgerId",
      "defaultSalesReturnLedgerId",
      "defaultPurchaseReturnLedgerId",
      "defaultRoundOffLedgerId",
      "defaultDiscountGivenLedgerId",
      "defaultDiscountReceivedLedgerId",
      "defaultStockLedgerId",
      "defaultCOGSLedgerId",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field] === "" ? null : req.body[field];
      }
    });

    let existing = await AccountingSettings.findOne().sort({ createdAt: 1 });
    const oldData = existing ? existing.toObject() : null;
    if (!existing) {
      existing = await AccountingSettings.create(updates);
    } else {
      await AccountingSettings.updateMany({}, updates, { runValidators: true });
      existing = await AccountingSettings.findByIdAndUpdate(existing._id, updates, {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
    }

    const settings = await populateAccountingSettings(
      AccountingSettings.findById(existing._id),
    );

    await createAuditLog({
      req,
      action: "ACCOUNTING_SETTINGS_UPDATED",
      module: "accounting_settings",
      referenceId: existing._id,
      oldData,
      newData: settings,
      description: "Accounting settings updated",
    });

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const requiredLedgerFields = [
  ["defaultCashLedgerId", "Default Cash Ledger"],
  ["defaultBankLedgerId", "Default Bank Ledger"],
  ["defaultSalesLedgerId", "Default Sales Ledger"],
  ["defaultPurchaseLedgerId", "Default Purchase Ledger"],
  ["defaultRoundOffLedgerId", "Default Round Off Ledger"],
  ["defaultDiscountGivenLedgerId", "Default Discount Given Ledger"],
  ["defaultDiscountReceivedLedgerId", "Default Discount Received Ledger"],
];

export const validateAccountingSettingsController = async (req, res) => {
  try {
    let settings = await AccountingSettings.findOne();
    if (!settings) settings = await initializeAccountingSettings();

    const missingLedgers = [];
    const warnings = [];
    for (const [field, label] of requiredLedgerFields) {
      if (!settings[field]) {
        missingLedgers.push({ field, label, reason: "Not configured" });
        continue;
      }
      const ledger = await Ledger.findOne({ _id: settings[field], isActive: true }).lean();
      if (!ledger) missingLedgers.push({ field, label, reason: "Ledger not found or inactive" });
    }

    if (settings.gstAccountingEnabled) {
      const gstLedgers = await Ledger.find({
        code: { $in: ["OUTPUT_CGST", "OUTPUT_SGST", "OUTPUT_IGST", "INPUT_CGST", "INPUT_SGST", "INPUT_IGST"] },
        isActive: true,
      }).select("code").lean();
      const configuredCodes = new Set(gstLedgers.map((ledger) => ledger.code));
      ["OUTPUT_CGST", "OUTPUT_SGST", "OUTPUT_IGST", "INPUT_CGST", "INPUT_SGST", "INPUT_IGST"].forEach((code) => {
        if (!configuredCodes.has(code)) missingLedgers.push({ field: code, label: code, reason: "GST ledger missing" });
      });
    }

    if (settings.inventoryAccountingEnabled) {
      if (!settings.defaultStockLedgerId) missingLedgers.push({ field: "defaultStockLedgerId", label: "Default Stock Ledger", reason: "Required when inventory accounting is enabled" });
      if (!settings.defaultCOGSLedgerId) missingLedgers.push({ field: "defaultCOGSLedgerId", label: "Default COGS Ledger", reason: "Required when inventory accounting is enabled" });
    }

    if (!settings.accountingEnabled) warnings.push("Accounting is disabled. Business transactions will not post vouchers.");
    if (!settings.autoVoucherPosting) warnings.push("Auto voucher posting is disabled. Use repost tools for business transactions.");

    res.status(200).json({
      success: true,
      data: {
        valid: missingLedgers.length === 0,
        missingLedgers,
        warnings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const enableAccountingController = async (req, res) => {
  try {
    const settings = await AccountingSettings.findOneAndUpdate({}, {
      accountingEnabled: true,
      autoVoucherPosting: true,
    }, {
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
