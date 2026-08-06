import BankTransactionMapping from "../../models/accounting/BankTransactionMapping.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import { cleanNarration } from "../../utils/pdfParser.js";

/**
 * @desc    Get all bank transaction mapping rules
 * @route   GET /api/accounting/bank-statement/mappings
 */
export const getMappings = async (req, res) => {
  try {
    const rules = await BankTransactionMapping.find()
      .populate("ledgerId", "name code groupId")
      .sort({ pattern: 1 });

    res.status(200).json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create a new mapping rule manually
 * @route   POST /api/accounting/bank-statement/mappings
 */
export const createMapping = async (req, res) => {
  try {
    const { pattern, ledgerId, confidence } = req.body;

    if (!pattern || !ledgerId) {
      return res.status(400).json({ success: false, message: "Please provide both pattern and ledger" });
    }

    const ledger = await Ledger.findById(ledgerId).populate("groupId", "name");
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger account not found" });
    }

    const cleanPattern = cleanNarration(pattern);

    if (!cleanPattern) {
      return res.status(400).json({ success: false, message: "The pattern contains only ignored noise/routing words. Please enter a descriptive pattern." });
    }

    // Check if duplicate rule pattern exists
    const existing = await BankTransactionMapping.findOne({ pattern: cleanPattern });
    if (existing) {
      return res.status(400).json({ success: false, message: `Mapping rule for pattern "${cleanPattern}" already exists` });
    }

    const rule = await BankTransactionMapping.create({
      pattern: cleanPattern,
      ledgerId,
      ledgerName: ledger.name,
      groupType: ledger.groupId?.name || "Other",
      confidence: confidence || 100,
      createdBy: req.user?._id
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update an existing mapping rule
 * @route   PUT /api/accounting/bank-statement/mappings/:id
 */
export const updateMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const { pattern, ledgerId, confidence } = req.body;

    const rule = await BankTransactionMapping.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Mapping rule not found" });
    }

    if (ledgerId) {
      const ledger = await Ledger.findById(ledgerId).populate("groupId", "name");
      if (!ledger) {
        return res.status(404).json({ success: false, message: "Ledger account not found" });
      }
      rule.ledgerId = ledgerId;
      rule.ledgerName = ledger.name;
      rule.groupType = ledger.groupId?.name || "Other";
    }

    if (pattern) {
      const cleanPattern = cleanNarration(pattern);
      if (!cleanPattern) {
        return res.status(400).json({ success: false, message: "The pattern contains only ignored noise/routing words. Please enter a descriptive pattern." });
      }
      const existing = await BankTransactionMapping.findOne({ pattern: cleanPattern, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `Mapping rule for pattern "${cleanPattern}" already exists` });
      }
      rule.pattern = cleanPattern;
    }

    if (confidence !== undefined) {
      rule.confidence = confidence;
    }

    await rule.save();

    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a mapping rule
 * @route   DELETE /api/accounting/bank-statement/mappings/:id
 */
export const deleteMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await BankTransactionMapping.findByIdAndDelete(id);

    if (!rule) {
      return res.status(404).json({ success: false, message: "Mapping rule not found" });
    }

    res.status(200).json({ success: true, message: "Mapping rule deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
