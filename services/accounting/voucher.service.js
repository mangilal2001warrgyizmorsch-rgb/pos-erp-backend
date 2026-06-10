import mongoose from "mongoose";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import VoucherType from "../../models/accounting/VoucherType.model.js";
import FinancialYear from "../../models/accounting/FinancialYear.model.js";
import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import { VOUCHER_STATUS } from "../../constants/accounting.constants.js";
import { createAccountingError } from "../../utils/accountingError.js";
import { createAuditLog } from "../auditLog.service.js";
import { updateLedgerBalance } from "./ledger.service.js";
import { defaultVoucherTypes } from "./seedAccounting.service.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const padVoucherNumber = (number) => String(number).padStart(4, "0");

const formatAmount = (value) => `₹${roundMoney(value).toFixed(2)}`;

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  return (
    message.includes("Transaction numbers are only allowed on a replica set member or mongos")
    || message.includes("This MongoDB deployment does not support retryable writes")
  );
};

const runAccountingWrite = async (operation) => {
  const session = await mongoose.startSession();

  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
    }
  } finally {
    await session.endSession();
  }

  return operation(null);
};

const executeAccountingWrite = async (operation, session = null) => {
  if (session) {
    return operation(session);
  }

  return runAccountingWrite(operation);
};

const getActiveFinancialYear = async (session = null) => {
  const query = FinancialYear.findOne({ isActive: true, isClosed: false });
  if (session) query.session(session);
  return query;
};

export const getFinancialYearByDate = async (date, session = null) => {
  const voucherDate = new Date(date || Date.now());
  voucherDate.setHours(0, 0, 0, 0);
  const query = FinancialYear.findOne({
    startDate: { $lte: voucherDate },
    endDate: { $gte: voucherDate },
    isActive: true,
    isClosed: false,
  });
  if (session) query.session(session);
  return query;
};

const formatDate = (value) => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date(value));

const assertBooksUnlocked = async (date, session = null) => {
  const query = AccountingSettings.findOne().select("lockBooksTillDate");
  if (session) query.session(session);
  const settings = await query;
  if (!settings?.lockBooksTillDate) return;

  const voucherDate = new Date(date || Date.now());
  voucherDate.setHours(0, 0, 0, 0);
  const lockDate = new Date(settings.lockBooksTillDate);
  lockDate.setHours(23, 59, 59, 999);
  if (voucherDate <= lockDate) {
    throw createAccountingError(
      "BOOKS_LOCKED",
      `Books are locked till ${formatDate(lockDate)}. Accounting entry cannot be modified.`,
      { lockBooksTillDate: settings.lockBooksTillDate, voucherDate },
    );
  }
};

const resolveOpenFinancialYear = async (date, providedFinancialYearId, session = null) => {
  const voucherDate = new Date(date || Date.now());
  if (providedFinancialYearId) {
    const query = FinancialYear.findById(providedFinancialYearId);
    if (session) query.session(session);
    const financialYear = await query;
    if (!financialYear || financialYear.isClosed) {
      throw createAccountingError(
        "FINANCIAL_YEAR_CLOSED",
        "Financial year is closed or unavailable for voucher posting.",
        { financialYearId: providedFinancialYearId },
      );
    }
  }

  const financialYear = await getFinancialYearByDate(voucherDate, session);
  if (!financialYear) {
    throw createAccountingError(
      "FINANCIAL_YEAR_CLOSED",
      "No active financial year found for voucher date.",
      { voucherDate },
    );
  }
  return financialYear;
};

const findExistingPostedReferenceVoucher = async (payload, session = null) => {
  if (!payload.referenceModule || !payload.referenceId || payload.originalVoucherId) return null;
  const query = Voucher.findOne({
    referenceModule: payload.referenceModule,
    referenceId: payload.referenceId,
    voucherTypeCode: String(payload.voucherTypeCode || "").toUpperCase(),
    status: { $nin: [VOUCHER_STATUS.CANCELLED, VOUCHER_STATUS.REVERSED] },
  });
  if (session) query.session(session);
  return query;
};

const normalizeVoucherPayload = (payloadOrVoucherData, maybeEntries = undefined) => {
  if (maybeEntries !== undefined) {
    return {
      ...payloadOrVoucherData,
      entries: maybeEntries,
    };
  }

  return payloadOrVoucherData || {};
};

const getVoucherTypeByCode = async (voucherTypeCode, session = null) => {
  if (!voucherTypeCode) {
    throw new Error("Voucher type code is required.");
  }

  const upperCode = String(voucherTypeCode).toUpperCase();
  const query = VoucherType.findOne({
    code: upperCode,
    isActive: true,
  });
  if (session) query.session(session);

  let voucherType = await query;
  if (voucherType) {
    return voucherType;
  }

  // Reactivate an existing voucher type if it was created but marked inactive.
  const inactiveQuery = VoucherType.findOne({ code: upperCode });
  if (session) inactiveQuery.session(session);
  voucherType = await inactiveQuery;
  if (voucherType) {
    if (!voucherType.isActive) {
      voucherType.isActive = true;
      await voucherType.save({ session });
    }
    return voucherType;
  }

  // If the voucher type is part of the default set, create it on demand.
  const defaultType = defaultVoucherTypes.find((type) => String(type.code).toUpperCase() === upperCode);
  if (defaultType) {
    const createData = {
      ...defaultType,
      suffix: "",
      currentNumber: 0,
      numberingMethod: "automatic",
      isSystemDefault: true,
      isActive: true,
    };
    const created = await VoucherType.create([createData], session ? { session } : undefined);
    return Array.isArray(created) ? created[0] : created;
  }

  throw new Error("Voucher type not found.");
};

export const generateVoucherNo = async (voucherTypeCode, session = null) => {
  const voucherType = await getVoucherTypeByCode(voucherTypeCode, session);

  if (voucherType.numberingMethod === "manual") {
    return null;
  }

  const updateOptions = { new: true };
  if (session) updateOptions.session = session;

  const updatedVoucherType = await VoucherType.findOneAndUpdate(
    {
      _id: voucherType._id,
      numberingMethod: { $ne: "manual" },
    },
    { $inc: { currentNumber: 1 } },
    updateOptions,
  );

  if (!updatedVoucherType) {
    return null;
  }

  return `${updatedVoucherType.prefix || ""}${padVoucherNumber(updatedVoucherType.currentNumber)}${updatedVoucherType.suffix || ""}`;
};

export const validateVoucherEntries = (entries = []) => {
  if (!Array.isArray(entries)) {
    throw new Error("Voucher entries are required.");
  }

  if (entries.length < 2) {
    throw new Error("At least two voucher entries are required.");
  }

  let totalDebit = 0;
  let totalCredit = 0;

  entries.forEach((entry, index) => {
    if (!entry.ledgerId) {
      throw new Error(`Ledger is required in voucher entry ${index + 1}.`);
    }

    const debit = roundMoney(entry.debit);
    const credit = roundMoney(entry.credit);

    if (debit < 0) {
      throw new Error("Debit cannot be negative.");
    }

    if (credit < 0) {
      throw new Error("Credit cannot be negative.");
    }

    if (debit > 0 && credit > 0) {
      throw new Error("Debit and Credit cannot both be entered in the same line.");
    }

    if (debit === 0 && credit === 0) {
      throw new Error("Either Debit or Credit is required in each voucher entry.");
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Voucher is not balanced. Debit ${formatAmount(totalDebit)} does not equal Credit ${formatAmount(totalCredit)}.`,
    );
  }

  return {
    totalDebit,
    totalCredit,
    isBalanced: true,
  };
};

const hydrateEntriesWithLedgerNames = async (entries, session = null) => {
  const ledgerIds = entries.map((entry) => entry.ledgerId);
  const query = Ledger.find({ _id: { $in: ledgerIds }, isActive: true });
  if (session) query.session(session);

  const ledgers = await query;
  const ledgersById = new Map(ledgers.map((ledger) => [String(ledger._id), ledger]));

  return entries.map((entry) => {
    const ledger = ledgersById.get(String(entry.ledgerId));
    if (!ledger) {
      throw new Error("Ledger not found.");
    }

    return {
      ...entry,
      ledgerId: ledger._id,
      ledgerName: entry.ledgerName || ledger.name,
      debit: roundMoney(entry.debit),
      credit: roundMoney(entry.credit),
      partyType: entry.partyType || "none",
    };
  });
};

const createVoucherEntries = async (voucherId, entries, session = null) => {
  return VoucherEntry.insertMany(
    entries.map((entry) => ({
      ...entry,
      voucherId,
    })),
    { session },
  );
};

const applyEntriesToLedgers = async (entries, session) => {
  for (const entry of entries) {
    await updateLedgerBalance(entry.ledgerId, entry.debit, entry.credit, session);
  }
};

const reverseEntriesOnLedgers = async (entries, session) => {
  for (const entry of entries) {
    await updateLedgerBalance(entry.ledgerId, entry.credit, entry.debit, session);
  }
};

const createVoucherDocument = async (payload, totals, status, session) => {
  const voucherType = payload.voucherTypeId
    ? await VoucherType.findById(payload.voucherTypeId).session(session)
    : await getVoucherTypeByCode(payload.voucherTypeCode, session);
  if (!voucherType) {
    throw new Error("Voucher type not found.");
  }
  const voucherTypeCode = voucherType.code;
  const voucherDate = payload.date || Date.now();
  await assertBooksUnlocked(voucherDate, session);
  const financialYear = await resolveOpenFinancialYear(voucherDate, payload.financialYearId, session);
  const voucherNo = payload.voucherNo || await generateVoucherNo(voucherTypeCode, session);

  if (!voucherNo) {
    throw new Error("Voucher number is required for manual voucher types.");
  }

  const [voucher] = await Voucher.create(
    [
      {
        voucherNo,
        voucherTypeId: voucherType._id,
        voucherTypeCode,
        date: voucherDate,
        financialYearId: financialYear._id,
        referenceModule: payload.referenceModule,
        referenceId: payload.referenceId,
        referenceNo: payload.referenceNo,
        narration: payload.narration,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        status,
        createdBy: payload.createdBy,
        postedAt: status === VOUCHER_STATUS.POSTED ? new Date() : undefined,
        originalVoucherId: payload.originalVoucherId,
      },
    ],
    { session },
  );

  return voucher;
};

export const createDraftVoucher = async (payloadOrVoucherData, maybeEntries = undefined) => {
  const payload = normalizeVoucherPayload(payloadOrVoucherData, maybeEntries);
  const result = await runAccountingWrite(async (session) => {
    const hydratedEntries = await hydrateEntriesWithLedgerNames(payload.entries || [], session);
    const totals = validateVoucherEntries(hydratedEntries);
    const voucher = await createVoucherDocument(payload, totals, VOUCHER_STATUS.DRAFT, session);
    const entries = await createVoucherEntries(voucher._id, hydratedEntries, session);
    return { voucher, entries };
  });

  return getVoucherById(result.voucher._id);
};

export const postDraftVoucher = async (voucherId, userId = null, options = {}) => {
  const postedVoucherId = await executeAccountingWrite(async (session) => {
    const voucher = await Voucher.findById(voucherId).session(session);
    if (!voucher) {
      throw new Error("Voucher not found.");
    }

    if (voucher.status === VOUCHER_STATUS.POSTED) {
      throw new Error("Voucher is already posted.");
    }

    if (voucher.status === VOUCHER_STATUS.CANCELLED) {
      throw new Error("Cancelled voucher cannot be posted.");
    }

    if (voucher.status === VOUCHER_STATUS.REVERSED) {
      throw new Error("Reversed voucher cannot be posted.");
    }

    await assertBooksUnlocked(voucher.date, session);
    const financialYear = await resolveOpenFinancialYear(voucher.date, voucher.financialYearId, session);

    const entries = await VoucherEntry.find({ voucherId: voucher._id }).session(session);
    const hydratedEntries = await hydrateEntriesWithLedgerNames(entries.map((entry) => entry.toObject()), session);
    const totals = validateVoucherEntries(hydratedEntries);

    await applyEntriesToLedgers(hydratedEntries, session);

    voucher.totalDebit = totals.totalDebit;
    voucher.totalCredit = totals.totalCredit;
    voucher.status = VOUCHER_STATUS.POSTED;
    voucher.financialYearId = financialYear._id;
    voucher.postedAt = new Date();
    if (!voucher.createdBy && userId) voucher.createdBy = userId;
    await voucher.save({ session });
    return voucher._id;
  }, options.session);

  await createAuditLog({
    userId,
    action: "VOUCHER_POSTED",
    module: "accounting_voucher",
    referenceId: postedVoucherId,
    description: "Accounting voucher posted",
  });

  return getVoucherById(postedVoucherId);
};

export const postVoucher = async (payloadOrVoucherId, userId = null, options = {}) => {
  if (typeof payloadOrVoucherId === "string" || payloadOrVoucherId instanceof mongoose.Types.ObjectId) {
    return postDraftVoucher(payloadOrVoucherId, userId, options);
  }

  const payload = payloadOrVoucherId || {};
  const result = await executeAccountingWrite(async (session) => {
    const existingVoucher = await findExistingPostedReferenceVoucher(payload, session);
    if (existingVoucher) {
      if (options.session) {
        const entries = await VoucherEntry.find({ voucherId: existingVoucher._id }).session(session);
        return { voucher: existingVoucher, entries, skipped: true };
      }
      throw createAccountingError(
        "DUPLICATE_VOUCHER",
        "Accounting voucher already exists for this reference.",
        {
          voucherId: existingVoucher._id,
          voucherNo: existingVoucher.voucherNo,
          referenceModule: payload.referenceModule,
          referenceId: payload.referenceId,
        },
      );
    }

    const hydratedEntries = await hydrateEntriesWithLedgerNames(payload.entries || [], session);
    const totals = validateVoucherEntries(hydratedEntries);
    const voucher = await createVoucherDocument(
      { ...payload, createdBy: payload.createdBy || userId },
      totals,
      VOUCHER_STATUS.POSTED,
      session,
    );
    const entries = await createVoucherEntries(voucher._id, hydratedEntries, session);
    await applyEntriesToLedgers(hydratedEntries, session);
    return { voucher, entries };
  }, options.session);

  if (options.session) {
    return result;
  }

  await createAuditLog({
    userId,
    action: "VOUCHER_CREATED",
    module: payload.referenceModule || "accounting_voucher",
    referenceId: result.voucher._id,
    referenceNo: result.voucher.voucherNo,
    description: "Accounting voucher created and posted",
    newData: result.voucher,
  });

  return getVoucherById(result.voucher._id);
};

export const cancelVoucher = async (voucherId, cancellationReason, userId = null, options = {}) => {
  const usingExternalSession = Boolean(options.session);
  const cancelledVoucherId = await executeAccountingWrite(async (session) => {
    const voucher = await Voucher.findById(voucherId).session(session);
    if (!voucher) {
      throw new Error("Voucher not found.");
    }

    if (voucher.status === VOUCHER_STATUS.CANCELLED) {
      return voucher._id;
    }

    await assertBooksUnlocked(voucher.date, session);

    if (voucher.status === VOUCHER_STATUS.POSTED) {
      if (voucher.reversalVoucherId) {
        throw new Error("Voucher with a reversal entry cannot be cancelled.");
      }
      const entries = await VoucherEntry.find({ voucherId: voucher._id }).session(session);
      await reverseEntriesOnLedgers(entries, session);
    } else if (voucher.status === VOUCHER_STATUS.REVERSED) {
      throw new Error("Reversed voucher cannot be cancelled.");
    }

    voucher.status = VOUCHER_STATUS.CANCELLED;
    voucher.cancelledAt = new Date();
    voucher.cancelledBy = userId || voucher.cancelledBy;
    voucher.cancellationReason = cancellationReason;
    await voucher.save({ session });
    return voucher._id;
  }, options.session);

  if (!usingExternalSession) {
    await createAuditLog({
      userId,
      action: "VOUCHER_CANCELLED",
      module: "accounting_voucher",
      referenceId: cancelledVoucherId,
      description: cancellationReason || "Accounting voucher cancelled",
    });
  }

  if (usingExternalSession) {
    return Voucher.findById(cancelledVoucherId).session(options.session);
  }

  return getVoucherById(cancelledVoucherId);
};

export const reverseVoucher = async (voucherId, reason, userId = null) => {
  const reversalVoucherId = await runAccountingWrite(async (session) => {
    const voucher = await Voucher.findById(voucherId).session(session);
    if (!voucher) {
      throw new Error("Voucher not found.");
    }

    if (voucher.status !== VOUCHER_STATUS.POSTED) {
      throw new Error("Only posted vouchers can be reversed.");
    }

    if (voucher.reversalVoucherId) {
      throw new Error("Voucher has already been reversed.");
    }

    await assertBooksUnlocked(voucher.date, session);

    const originalEntries = await VoucherEntry.find({ voucherId: voucher._id }).session(session);
    const reversalEntries = originalEntries.map((entry) => ({
      ledgerId: entry.ledgerId,
      ledgerName: entry.ledgerName,
      debit: roundMoney(entry.credit),
      credit: roundMoney(entry.debit),
      partyId: entry.partyId,
      partyType: entry.partyType,
      costCenterId: entry.costCenterId,
      narration: `Reversal of ${voucher.voucherNo}`,
    }));

    const hydratedEntries = await hydrateEntriesWithLedgerNames(reversalEntries, session);
    const totals = validateVoucherEntries(hydratedEntries);
    const reversalVoucher = await createVoucherDocument(
      {
        voucherTypeCode: "JOURNAL",
        date: new Date(),
        referenceModule: "ACCOUNTING_VOUCHER",
        referenceId: voucher._id,
        referenceNo: voucher.voucherNo,
        narration: `Reversal of Voucher No: ${voucher.voucherNo}${reason ? ` - Reason: ${reason}` : ""}`,
        createdBy: userId,
        originalVoucherId: voucher._id,
      },
      totals,
      VOUCHER_STATUS.POSTED,
      session,
    );

    await createVoucherEntries(reversalVoucher._id, hydratedEntries, session);
    await applyEntriesToLedgers(hydratedEntries, session);

    voucher.reversedAt = new Date();
    voucher.reversedBy = userId || voucher.reversedBy;
    voucher.reversalReason = reason;
    voucher.reversalVoucherId = reversalVoucher._id;
    voucher.status = VOUCHER_STATUS.REVERSED;
    await voucher.save({ session });

    return reversalVoucher._id;
  });

  await createAuditLog({
    userId,
    action: "VOUCHER_REVERSED",
    module: "accounting_voucher",
    referenceId: reversalVoucherId,
    description: reason || "Accounting voucher reversed",
  });

  return getVoucherById(reversalVoucherId);
};

export const getVoucherById = async (voucherId) => {
  const voucher = await Voucher.findById(voucherId)
    .populate("voucherTypeId", "name code")
    .populate("financialYearId", "name startDate endDate")
    .populate("originalVoucherId", "voucherNo date status")
    .populate("reversalVoucherId", "voucherNo date status");

  if (!voucher) {
    return null;
  }

  const entries = await VoucherEntry.find({ voucherId })
    .populate({
      path: "ledgerId",
      select: "name code ledgerType groupId",
      populate: {
        path: "groupId",
        select: "name code nature normalBalance",
      },
    })
    .sort({ createdAt: 1 });

  return { voucher, entries };
};

export const createAndPostTestVoucher = async (payload, userId = null) => {
  const entries = [];

  for (const entry of payload.entries || []) {
    if (!entry.ledgerCode) {
      throw new Error("Ledger code is required for test voucher entries.");
    }

    const ledger = await Ledger.findOne({
      code: String(entry.ledgerCode).toUpperCase(),
      isActive: true,
    });

    if (!ledger) {
      throw new Error(`Ledger not found for code ${entry.ledgerCode}.`);
    }

    entries.push({
      ledgerId: ledger._id,
      debit: entry.debit,
      credit: entry.credit,
      narration: entry.narration,
    });
  }

  return postVoucher({
    voucherTypeCode: "JOURNAL",
    date: payload.date || Date.now(),
    narration: payload.narration || "Manual test journal voucher",
    referenceModule: "ACCOUNTING_TEST",
    referenceNo: payload.referenceNo,
    entries,
    createdBy: userId,
  }, userId);
};
