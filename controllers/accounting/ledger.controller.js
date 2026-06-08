import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import {
  createLedger,
  getLedgerByCode,
  getLedgerById,
  getLedgersByGroup,
  getSystemLedger,
} from "../../services/accounting/ledger.service.js";

export const createLedgerController = async (req, res) => {
  try {
    const ledger = await createLedger({
      ...req.body,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: ledger });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getLedgers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.groupId) {
      filter.groupId = req.query.groupId;
    }
    if (req.query.ledgerType) {
      filter.ledgerType = String(req.query.ledgerType).toUpperCase();
    }
    if (req.query.partyType) {
      filter.partyType = String(req.query.partyType).toLowerCase();
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const ledgers = await Ledger.find(filter)
      .populate("groupId", "name code nature normalBalance")
      .sort({ name: 1 });

    res.status(200).json({ success: true, count: ledgers.length, data: ledgers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDefaultLedgers = async (req, res) => {
  try {
    const ledgers = await Ledger.find({ isSystemDefault: true })
      .populate("groupId", "name code nature normalBalance")
      .sort({ name: 1 });

    res.status(200).json({ success: true, count: ledgers.length, data: ledgers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const balanceToSignedDebit = (amount, type) => {
  const numericAmount = Number(amount || 0);
  return type === "CREDIT" ? -numericAmount : numericAmount;
};

const signedDebitToBalance = (value) => ({
  balance: Math.abs(roundMoney(value)),
  balanceType: value < 0 ? "CREDIT" : "DEBIT",
});

const buildVoucherFilter = (query = {}) => {
  const filter = { status: "POSTED", reversalVoucherId: { $exists: false } };

  if (query.voucherTypeCode) {
    filter.voucherTypeCode = String(query.voucherTypeCode).toUpperCase();
  }

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }

  if (query.search) {
    const search = String(query.search).trim();
    filter.$or = [
      { voucherNo: new RegExp(search, "i") },
      { referenceNo: new RegExp(search, "i") },
      { narration: new RegExp(search, "i") },
    ];
  }

  return filter;
};

export const getLedgerBalance = async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id).populate(
      "groupId",
      "name code nature normalBalance",
    );

    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    const postedVoucherIds = await Voucher.find({ status: "POSTED" }).distinct("_id");
    const [totals] = await VoucherEntry.aggregate([
      {
        $match: {
          ledgerId: ledger._id,
          voucherId: { $in: postedVoucherIds },
        },
      },
      {
        $group: {
          _id: "$ledgerId",
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]);

    const totalDebit = roundMoney(totals?.totalDebit || 0);
    const totalCredit = roundMoney(totals?.totalCredit || 0);
    const signedOpeningBalance = balanceToSignedDebit(
      ledger.openingBalance,
      ledger.openingBalanceType,
    );
    const calculatedSignedBalance = signedOpeningBalance + totalDebit - totalCredit;
    const calculatedBalance = signedDebitToBalance(calculatedSignedBalance);

    return res.status(200).json({
      success: true,
      data: {
        ledgerId: ledger._id,
        ledgerName: ledger.name,
        code: ledger.code,
        group: ledger.groupId,
        openingBalance: ledger.openingBalance,
        openingBalanceType: ledger.openingBalanceType,
        currentBalance: ledger.currentBalance,
        currentBalanceType: ledger.currentBalanceType,
        totalDebit,
        totalCredit,
        calculatedBalanceFromEntries: calculatedBalance.balance,
        calculatedBalanceTypeFromEntries: calculatedBalance.balanceType,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLedgerStatement = async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id).populate(
      "groupId",
      "name code nature normalBalance",
    );

    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    const vouchers = await Voucher.find(buildVoucherFilter(req.query))
      .populate("voucherTypeId", "name code")
      .sort({ date: 1, createdAt: 1 })
      .lean();
    const voucherIds = vouchers.map((voucher) => voucher._id);
    const voucherById = new Map(vouchers.map((voucher) => [String(voucher._id), voucher]));

    const ledgerEntries = await VoucherEntry.find({
      ledgerId: ledger._id,
      voucherId: { $in: voucherIds },
    })
      .sort({ createdAt: 1 })
      .lean();

    let signedRunningBalance = balanceToSignedDebit(
      ledger.openingBalance,
      ledger.openingBalanceType,
    );
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = ledgerEntries
      .map((entry) => {
        const voucher = voucherById.get(String(entry.voucherId));
        return { entry, voucher };
      })
      .filter(({ voucher }) => Boolean(voucher))
      .sort((a, b) => new Date(a.voucher.date) - new Date(b.voucher.date))
      .map(({ entry, voucher }) => {
        const debit = roundMoney(entry.debit);
        const credit = roundMoney(entry.credit);
        signedRunningBalance = roundMoney(signedRunningBalance + debit - credit);
        totalDebit = roundMoney(totalDebit + debit);
        totalCredit = roundMoney(totalCredit + credit);
        const runningBalance = signedDebitToBalance(signedRunningBalance);

        return {
          entryId: entry._id,
          date: voucher.date,
          voucherId: voucher._id,
          voucherNo: voucher.voucherNo,
          voucherTypeCode: voucher.voucherTypeCode,
          voucherTypeName: voucher.voucherTypeId?.name || voucher.voucherTypeCode,
          referenceNo: voucher.referenceNo,
          narration: entry.narration || voucher.narration,
          debit,
          credit,
          runningBalance: runningBalance.balance,
          runningBalanceType: runningBalance.balanceType,
        };
      });

    const closingBalance = signedDebitToBalance(signedRunningBalance);

    return res.status(200).json({
      success: true,
      data: {
        ledger: {
          id: ledger._id,
          name: ledger.name,
          code: ledger.code,
          group: ledger.groupId,
          nature: ledger.groupId?.nature,
          openingBalance: ledger.openingBalance,
          openingBalanceType: ledger.openingBalanceType,
          currentBalance: ledger.currentBalance,
          currentBalanceType: ledger.currentBalanceType,
        },
        entries,
        totals: {
          totalDebit,
          totalCredit,
          closingBalance: closingBalance.balance,
          closingBalanceType: closingBalance.balanceType,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBasicTrialBalance = async (req, res) => {
  try {
    const ledgers = await Ledger.find({ isActive: true })
      .populate("groupId", "name code nature normalBalance")
      .sort({ name: 1 });

    const rows = ledgers.map((ledger) => {
      const signedBalance = balanceToSignedDebit(
        ledger.currentBalance,
        ledger.currentBalanceType,
      );
      return {
        ledgerId: ledger._id,
        ledgerName: ledger.name,
        code: ledger.code,
        groupName: ledger.groupId?.name,
        debitBalance: signedBalance >= 0 ? roundMoney(signedBalance) : 0,
        creditBalance: signedBalance < 0 ? Math.abs(roundMoney(signedBalance)) : 0,
      };
    });

    const totalDebit = roundMoney(rows.reduce((sum, row) => sum + row.debitBalance, 0));
    const totalCredit = roundMoney(rows.reduce((sum, row) => sum + row.creditBalance, 0));

    return res.status(200).json({
      success: true,
      data: {
        rows,
        totalDebit,
        totalCredit,
        difference: roundMoney(totalDebit - totalCredit),
        isBalanced: totalDebit === totalCredit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLedger = async (req, res) => {
  try {
    const ledger = await getLedgerById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLedgerByCodeController = async (req, res) => {
  try {
    const ledger = await getLedgerByCode(req.params.code);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLedgersByGroupController = async (req, res) => {
  try {
    const ledgers = await getLedgersByGroup(req.params.groupId);
    return res.status(200).json({ success: true, count: ledgers.length, data: ledgers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSystemLedgerController = async (req, res) => {
  try {
    const ledger = await getSystemLedger(req.params.ledgerType);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "System ledger not found" });
    }

    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    if (ledger.isSystemDefault) {
      ledger.isActive = false;
      await ledger.save();
      return res.status(200).json({ success: true, data: ledger });
    }

    await Ledger.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Ledger deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
