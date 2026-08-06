import BankImportSettings from "../../models/accounting/BankImportSettings.model.js";

/**
 * @desc    Get default bank import settings (returns default if not set)
 * @route   GET /api/accounting/bank-statement/settings
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await BankImportSettings.findOne()
      .populate("defaultBankLedgerId", "name code")
      .populate("defaultExpenseLedgerId", "name code")
      .populate("bankMappings.bankLedgerId", "name code");

    if (!settings) {
      // Create empty settings default record on the fly
      settings = await BankImportSettings.create({
        autoPostEnabled: false,
        confidenceThreshold: 90,
        bankMappings: []
      });
    }

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update bank import settings config
 * @route   PUT /api/accounting/bank-statement/settings
 */
export const updateSettings = async (req, res) => {
  try {
    const { defaultBankLedgerId, defaultExpenseLedgerId, autoPostEnabled, confidenceThreshold, bankMappings } = req.body;

    let settings = await BankImportSettings.findOne();
    if (!settings) {
      settings = new BankImportSettings();
    }

    settings.defaultBankLedgerId = defaultBankLedgerId || undefined;
    settings.defaultExpenseLedgerId = defaultExpenseLedgerId || undefined;
    if (autoPostEnabled !== undefined) settings.autoPostEnabled = autoPostEnabled;
    if (confidenceThreshold !== undefined) settings.confidenceThreshold = Number(confidenceThreshold) || 90;
    if (bankMappings) settings.bankMappings = bankMappings;

    await settings.save();

    const populated = await BankImportSettings.findById(settings._id)
      .populate("defaultBankLedgerId", "name code")
      .populate("defaultExpenseLedgerId", "name code")
      .populate("bankMappings.bankLedgerId", "name code");

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
