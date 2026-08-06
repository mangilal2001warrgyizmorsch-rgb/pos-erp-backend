import BankStatementImport from "../../models/accounting/BankStatementImport.model.js";
import BankTransactionMapping from "../../models/accounting/BankTransactionMapping.model.js";
import BankImportSettings from "../../models/accounting/BankImportSettings.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import { parseBankStatementPDF, cleanNarration } from "../../utils/pdfParser.js";
import { postVoucher } from "../../services/accounting/voucher.service.js";

/**
 * Helper to generate a unique statement number
 */
const generateStatementNo = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `STMT-${dateStr}-${randomStr}`;
};

/**
 * Check if a transaction is a duplicate
 */
const checkIsDuplicate = async (bankLedgerId, date, debit, credit, narration) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const amount = debit > 0 ? debit : credit;
  const isDebit = debit > 0;

  // Search in posted vouchers for matching entries
  // The entry must belong to the selected bank ledger, and have matched amount
  const matchedEntries = await VoucherEntry.find({
    ledgerId: bankLedgerId,
    debit: isDebit ? 0 : amount,  // In bank ledger, withdrawals are CREDITS (outgoing cash)
    credit: isDebit ? amount : 0, // In bank ledger, deposits are DEBITS (incoming cash)
  });

  if (matchedEntries.length === 0) return false;

  const voucherIds = matchedEntries.map(e => e.voucherId);
  const matchingVouchers = await Voucher.find({
    _id: { $in: voucherIds },
    status: "POSTED",
    date: { $gte: startOfDay, $lte: endOfDay },
    narration: new RegExp(escapeRegex(narration.trim()), "i")
  });

  return matchingVouchers.length > 0;
};

const escapeRegex = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
};

/**
 * @desc    Upload & Parse PDF Bank Statement (Preview only)
 * @route   POST /api/accounting/bank-statement/import
 */
export const importStatement = async (req, res) => {
  try {
    let { bankLedgerId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a bank statement PDF file" });
    }

    // Load configurations
    let settings = await BankImportSettings.findOne();
    if (!settings) {
      settings = await BankImportSettings.create({
        autoPostEnabled: false,
        confidenceThreshold: 90,
        bankMappings: []
      });
    }

    // Parse PDF
    const { transactions: parsedTransactions, detectedBank } = await parseBankStatementPDF(req.file.buffer);

    // Resolve Bank Ledger ID
    let resolvedBankLedgerId = bankLedgerId;
    if (detectedBank && !resolvedBankLedgerId) {
      const mapping = settings.bankMappings.find(m => m.keyword === detectedBank.toUpperCase());
      if (mapping) {
        resolvedBankLedgerId = mapping.bankLedgerId;
      }
    }

    if (!resolvedBankLedgerId) {
      resolvedBankLedgerId = settings.defaultBankLedgerId;
    }

    if (!resolvedBankLedgerId) {
      return res.status(400).json({
        success: false,
        message: "No bank ledger selected, and no default bank ledger configured. Please configure a default bank ledger in settings or select one manually.",
        detectedBank
      });
    }

    // Check bank ledger exists
    const bankLedger = await Ledger.findById(resolvedBankLedgerId);
    if (!bankLedger) {
      return res.status(400).json({ success: false, message: "Resolved bank ledger not found" });
    }

    // Load active mapping rules
    const mappingRules = await BankTransactionMapping.find();

    // Populate duplicate detection flag and auto mappings for each parsed row
    const transactionsWithDuplicateCheck = [];
    let duplicateCount = 0;
    let autoMappedCount = 0;

    for (const txn of parsedTransactions) {
      const isDuplicate = await checkIsDuplicate(
        resolvedBankLedgerId,
        txn.date,
        txn.debit,
        txn.credit,
        txn.narration
      );
      if (isDuplicate) duplicateCount++;

      let mappedLedgerId = undefined;
      let confidence = 0;

      if (!isDuplicate) {
        const cleanedTxnNarration = cleanNarration(txn.narration);
        let bestMatch = null;
        let bestMatchIsStrong = false;

        if (cleanedTxnNarration) {
          for (const rule of mappingRules) {
            const isStrong = cleanedTxnNarration.includes(rule.pattern);
            const isLoose = rule.pattern.includes(cleanedTxnNarration);

            if (isStrong || isLoose) {
              const isBetter = !bestMatch || 
                               (isStrong && !bestMatchIsStrong) ||
                               (isStrong === bestMatchIsStrong && rule.pattern.length > bestMatch.pattern.length);

              if (isBetter) {
                bestMatch = rule;
                bestMatchIsStrong = isStrong;
              }
            }
          }
        }

        if (bestMatch) {
          const matchConfidence = bestMatchIsStrong ? (bestMatch.confidence || 100) : 50;
          confidence = matchConfidence;
          if (matchConfidence >= (settings.confidenceThreshold || 90)) {
            mappedLedgerId = bestMatch.ledgerId;
            autoMappedCount++;
          }
        }
      }

      transactionsWithDuplicateCheck.push({
        ...txn,
        isDuplicate,
        mappedLedgerId,
        confidence,
        status: isDuplicate ? "skipped" : "pending"
      });
    }

    const statementNo = generateStatementNo();

    res.status(200).json({
      success: true,
      data: {
        statementNo,
        fileName: req.file.originalname,
        bankLedgerId: resolvedBankLedgerId,
        bankName: bankLedger.name,
        transactions: transactionsWithDuplicateCheck,
        detectedBank,
        autoPostEnabled: settings.autoPostEnabled,
        confidenceThreshold: settings.confidenceThreshold,
        defaultExpenseLedgerId: settings.defaultExpenseLedgerId,
        summary: {
          totalCount: parsedTransactions.length,
          duplicateCount,
          autoMappedCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Save imported statement details (Create mapping draft)
 * @route   POST /api/accounting/bank-statement/save
 */
export const saveStatementAndMap = async (req, res) => {
  try {
    const { bankLedgerId, fileName, statementNo, bank, transactions } = req.body;
    
    if (!bankLedgerId || !fileName || !statementNo || !transactions) {
      return res.status(400).json({ success: false, message: "Missing required statement payload data" });
    }

    // Verify uniqueness of statementNo
    const existing = await BankStatementImport.findOne({ statementNo });
    if (existing) {
      return res.status(400).json({ success: false, message: "This statement has already been saved" });
    }

    const newImport = await BankStatementImport.create({
      statementNo,
      bank: bank || "Generic",
      bankLedgerId,
      fileName,
      transactions: transactions.map(t => ({
        date: t.date,
        narration: t.narration,
        debit: t.debit || 0,
        credit: t.credit || 0,
        balance: t.balance || 0,
        mappedLedgerId: t.mappedLedgerId || undefined,
        status: t.isDuplicate ? "skipped" : "pending"
      })),
      status: "pending"
    });

    res.status(201).json({ success: true, data: newImport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Post mapped transaction entries to vouchers
 * @route   POST /api/accounting/bank-statement/:id/post-entries
 */
export const postMappedEntries = async (req, res) => {
  try {
    const { id } = req.params;
    const { mappings } = req.body; // Map: transaction_id -> ledger_id

    const stmt = await BankStatementImport.findById(id);
    if (!stmt) {
      return res.status(404).json({ success: false, message: "Statement import record not found" });
    }

    const userId = req.user?._id;
    let postedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Iterate through all transactions in the saved statement
    for (const txn of stmt.transactions) {
      if (txn.status === "posted" || txn.status === "skipped") {
        continue; // Already processed
      }

      // Check if a ledger mapping is provided for this transaction
      const mappedLedgerId = mappings?.[String(txn._id)] || txn.mappedLedgerId;

      if (!mappedLedgerId) {
        continue; // No mapping, keep as pending
      }

      try {
        const isIncoming = txn.credit > 0;
        const amount = isIncoming ? txn.credit : txn.debit;

        // In standard double-entry:
        // Receipt (Incoming money): Debit Bank A/c, Credit Mapped Ledger (e.g. Sales, Debtors)
        // Payment (Outgoing money): Debit Mapped Ledger (e.g. Expense, Creditors), Credit Bank A/c
        const entries = isIncoming
          ? [
              { ledgerId: stmt.bankLedgerId, debit: amount, credit: 0, narration: txn.narration },
              { ledgerId: mappedLedgerId, debit: 0, credit: amount, narration: txn.narration }
            ]
          : [
              { ledgerId: mappedLedgerId, debit: amount, credit: 0, narration: txn.narration },
              { ledgerId: stmt.bankLedgerId, debit: 0, credit: amount, narration: txn.narration }
            ];

        const voucherPayload = {
          voucherTypeCode: isIncoming ? "RECEIPT" : "PAYMENT",
          date: txn.date,
          narration: txn.narration,
          referenceModule: "bank_statement_import",
          referenceId: txn._id,
          referenceNo: stmt.statementNo,
          entries
        };

        // Post standard voucher
        const result = await postVoucher(voucherPayload, userId);

        // Update transaction model entry
        txn.status = "posted";
        txn.mappedLedgerId = mappedLedgerId;
        txn.voucherId = result._id;
        postedCount++;

        // Self-learning step: save/update mapping rule permanently
        const cleanPattern = cleanNarration(txn.narration);
        if (cleanPattern) {
          const matchedLedger = await Ledger.findById(mappedLedgerId).populate("groupId", "name");
          if (matchedLedger) {
            await BankTransactionMapping.findOneAndUpdate(
              { pattern: cleanPattern },
              {
                pattern: cleanPattern,
                ledgerId: mappedLedgerId,
                ledgerName: matchedLedger.name,
                groupType: matchedLedger.groupId?.name || "Other",
                confidence: 100,
                createdBy: userId
              },
              { upsert: true, new: true }
            );
          }
        }
      } catch (err) {
        errorCount++;
        errors.push({ narration: txn.narration, error: err.message });
      }
    }

    // Update overall statement status
    const allProcessed = stmt.transactions.every(t => t.status === "posted" || t.status === "skipped");
    const anyPosted = stmt.transactions.some(t => t.status === "posted");
    
    if (allProcessed) {
      stmt.status = "completed";
    } else if (anyPosted) {
      stmt.status = "partially_posted";
    }

    await stmt.save();

    res.status(200).json({
      success: true,
      data: {
        postedCount,
        errorCount,
        errors,
        status: stmt.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all statement import history records
 * @route   GET /api/accounting/bank-statement/history
 */
export const getImportHistory = async (req, res) => {
  try {
    const history = await BankStatementImport.find()
      .populate("bankLedgerId", "name code")
      .sort({ importDate: -1 });

    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single statement details
 * @route   GET /api/accounting/bank-statement/:id
 */
export const getImportDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const stmt = await BankStatementImport.findById(id)
      .populate("bankLedgerId", "name code")
      .populate("transactions.mappedLedgerId", "name code");

    if (!stmt) {
      return res.status(404).json({ success: false, message: "Statement record not found" });
    }

    res.status(200).json({ success: true, data: stmt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
