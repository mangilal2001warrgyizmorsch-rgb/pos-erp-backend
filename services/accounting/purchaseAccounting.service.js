import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Purchase from "../../models/Purchase.js";
import Supplier from "../../models/Supplier.js";
import BusinessProfile from "../../models/BusinessProfile.js";
import {
  LEDGER_TYPES,
  NORMAL_BALANCE,
  PARTY_TYPES,
} from "../../constants/accounting.constants.js";
import { postVoucher } from "./voucher.service.js";
import { extractGSTAmounts } from "../../utils/gst.utils.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";

const PURCHASE_REFERENCE_MODULE = "purchase";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const money = (value) => roundMoney(Math.max(0, Number(value || 0)));

const shortId = (id) => String(id || "").slice(-8).toUpperCase();

const normalizeLedgerName = (value) => String(value || "")
  .toLowerCase()
  .replace(/\ba\/?c\b/g, "")
  .replace(/[^a-z0-9]/g, "");

const queryWithSession = (query, session = null) => {
  if (session) query.session(session);
  return query;
};

const addEntry = (entries, ledger, debit, credit, narration, extra = {}) => {
  const normalizedDebit = money(debit);
  const normalizedCredit = money(credit);
  if (normalizedDebit <= 0 && normalizedCredit <= 0) return;
  if (!ledger) {
    throw new Error("Accounting ledger is not configured for one or more purchase voucher entries.");
  }

  entries.push({
    ledgerId: ledger._id,
    debit: normalizedDebit,
    credit: normalizedCredit,
    narration,
    ...extra,
  });
};

const firstLedger = async (queries, session = null) => {
  for (const query of queries) {
    if (!query) continue;
    const ledger = await queryWithSession(Ledger.findOne({ ...query, isActive: true }), session);
    if (ledger) return ledger;
  }
  return null;
};

const ledgerByIdOrCode = async (ledgerId, code, ledgerType, session = null) => {
  return firstLedger(
    [
      ledgerId ? { _id: ledgerId } : null,
      code ? { code: String(code).toUpperCase() } : null,
      ledgerType ? { ledgerType } : null,
    ],
    session,
  );
};

const ledgerByCode = async (code, session = null) => {
  return firstLedger([{ code: String(code).toUpperCase() }], session);
};

const requireLedger = async (label, ledgerId, code, ledgerType, session = null) => {
  const ledger = await ledgerByIdOrCode(ledgerId, code, ledgerType, session);
  if (!ledger) {
    throw new Error(`${label} ledger is not configured.`);
  }
  return ledger;
};

const createLedgerDocument = async (payload, session = null) => {
  if (!session) return Ledger.create(payload);
  const [ledger] = await Ledger.create([payload], { session });
  return ledger;
};

export const getOrCreateSupplierLedger = async (supplierId, session = null, createdBy = null) => {
  if (!supplierId) {
    throw new Error("Credit or partial purchases require a supplier for accounting posting.");
  }

  const supplier = await queryWithSession(Supplier.findById(supplierId), session);
  if (!supplier) {
    throw new Error("Supplier not found for accounting posting.");
  }

  const linkedLedger = supplier.accountingLedgerId
    ? await queryWithSession(Ledger.findOne({ _id: supplier.accountingLedgerId, isActive: true }), session)
    : null;
  if (linkedLedger) return linkedLedger;

  let existingLedger = await queryWithSession(
    Ledger.findOne({
      partyId: supplierId,
      partyType: PARTY_TYPES.SUPPLIER,
      ledgerType: LEDGER_TYPES.SUPPLIER,
      isActive: true,
    }),
    session,
  );
  if (!existingLedger) {
    const candidates = await queryWithSession(
      Ledger.find({
        isActive: true,
        $or: [
          { ledgerType: LEDGER_TYPES.SUPPLIER },
          { partyType: PARTY_TYPES.SUPPLIER },
          { code: /^SUPPLIER-/ },
        ],
      }),
      session,
    );
    const targetName = normalizeLedgerName(`${supplier.name} A/c`);
    existingLedger = candidates.find((ledger) => normalizeLedgerName(ledger.name) === targetName) || null;
  }
  if (existingLedger) {
    existingLedger.partyId = supplier._id;
    existingLedger.partyType = PARTY_TYPES.SUPPLIER;
    existingLedger.ledgerType = LEDGER_TYPES.SUPPLIER;
    if (!existingLedger.gstDetails?.gstin && supplier.gstNumber) {
      existingLedger.gstDetails = {
        ...existingLedger.gstDetails,
        gstin: supplier.gstNumber,
        registrationType: supplier.gstType,
      };
    }
    await existingLedger.save({ session, validateBeforeSave: false });
    supplier.accountingLedgerId = existingLedger._id;
    await supplier.save({ session, validateBeforeSave: false });
    return existingLedger;
  }

  const creditorGroup = await queryWithSession(
    AccountGroup.findOne({ code: "SUNDRY_CREDITORS", isActive: true }),
    session,
  );
  if (!creditorGroup) {
    throw new Error("Sundry Creditors account group is not configured.");
  }

  try {
    const ledger = await createLedgerDocument({
      name: `${supplier.name} A/c`,
      code: `SUPPLIER-${shortId(supplier._id)}`,
      groupId: creditorGroup._id,
      ledgerType: LEDGER_TYPES.SUPPLIER,
      openingBalance: 0,
      openingBalanceType: NORMAL_BALANCE.CREDIT,
      currentBalance: 0,
      currentBalanceType: NORMAL_BALANCE.CREDIT,
      partyId: supplier._id,
      partyType: PARTY_TYPES.SUPPLIER,
      gstDetails: {
        gstin: supplier.gstNumber,
        registrationType: supplier.gstType,
      },
      isSystemDefault: false,
      isActive: true,
      createdBy,
    }, session);
    supplier.accountingLedgerId = ledger._id;
    await supplier.save({ session, validateBeforeSave: false });
    return ledger;
  } catch (error) {
    if (error?.code === 11000) {
      const ledger = await queryWithSession(
        Ledger.findOne({
          partyId: supplierId,
          partyType: PARTY_TYPES.SUPPLIER,
          ledgerType: LEDGER_TYPES.SUPPLIER,
          isActive: true,
        }),
        session,
      );
      if (ledger) {
        supplier.accountingLedgerId = ledger._id;
        await supplier.save({ session, validateBeforeSave: false });
        return ledger;
      }
    }
    throw error;
  }
};

const markPurchaseAccounting = async (purchase, fields, session = null) => {
  purchase.accountingVoucherId = fields.accountingVoucherId ?? purchase.accountingVoucherId;
  purchase.accountingPosted = fields.accountingPosted ?? purchase.accountingPosted;
  purchase.accountingStatus = fields.accountingStatus ?? purchase.accountingStatus;
  purchase.accountingError = fields.accountingError;
  purchase.accountingPostedAt = fields.accountingStatus === "posted" ? new Date() : undefined;
  await purchase.save({ session });
};

export const markPurchaseAccountingFailure = async (purchaseId, error) => {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return;
  await markPurchaseAccounting(purchase, {
    accountingPosted: false,
    accountingStatus: "failed",
    accountingError: String(error?.message || error || "Accounting posting failed").slice(0, 500),
  });
};

const getExistingVoucher = async (purchase, session = null) => {
  if (purchase.accountingVoucherId) {
    const voucher = await queryWithSession(Voucher.findById(purchase.accountingVoucherId), session);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  return queryWithSession(
    Voucher.findOne({
      referenceModule: PURCHASE_REFERENCE_MODULE,
      referenceId: purchase._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
};

const getInputTaxLedgers = async (session = null) => ({
  cgst: await ledgerByCode("INPUT_CGST", session),
  sgst: await ledgerByCode("INPUT_SGST", session),
  igst: await ledgerByCode("INPUT_IGST", session),
});

const getGSTContext = async (session = null) => {
  const profile = await queryWithSession(BusinessProfile.findOne().select("state"), session);
  return {
    businessState: profile?.state || "Rajasthan",
  };
};

export const postPurchaseAccountingVoucher = async (
  purchaseInput,
  { session = null, createdBy = null, source = "purchase_bill" } = {},
) => {
  const purchase = typeof purchaseInput?.save === "function"
    ? purchaseInput
    : await queryWithSession(Purchase.findById(purchaseInput), session);

  if (!purchase) {
    throw new Error("Purchase not found for accounting posting.");
  }

  if (!["confirmed", "received"].includes(purchase.status)) {
    return { skipped: true, reason: "Draft or inactive purchase is not posted to accounting." };
  }

  const existingVoucher = await getExistingVoucher(purchase, session);
  if (existingVoucher) {
    if (purchase.supplier) {
      await getOrCreateSupplierLedger(purchase.supplier, session, createdBy);
    }

    await markPurchaseAccounting(purchase, {
      accountingVoucherId: existingVoucher._id,
      accountingPosted: existingVoucher.status === "POSTED",
      accountingStatus: existingVoucher.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    }, session);
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const grandTotal = money(purchase.totalAmount);
  if (grandTotal <= 0) {
    throw new Error("Purchase total must be greater than zero for accounting posting.");
  }

  const taxBucket = extractGSTAmounts(purchase, purchase.items || [], {
    ...await getGSTContext(session),
    stateOfSupply: purchase.stateOfSupply,
    partyStateCode: purchase.supplier?.stateCode,
  });
  const taxSplitTotal = money(taxBucket.cgst) + money(taxBucket.sgst) + money(taxBucket.igst);
  const taxTotal = money(taxSplitTotal || taxBucket.totalTax || purchase.taxAmount);
  const roundOffAmount = roundMoney(purchase.roundOff);
  const paidAmount = purchase.paymentMethod === "credit"
    ? 0
    : Math.min(money(purchase.amountPaid), grandTotal);
  const creditAmount = money(grandTotal - paidAmount);

  const purchaseLedger = await ledgerByIdOrCode(
    settings.defaultPurchaseLedgerId,
    "PURCHASE",
    LEDGER_TYPES.PURCHASE,
    session,
  );
  if (!purchaseLedger) {
    throw new Error("Purchase ledger is not configured.");
  }

  const purchaseDebit = money(grandTotal - taxTotal - roundOffAmount);
  const residual = roundMoney(grandTotal - purchaseDebit - taxTotal);
  const roundOffLedger = Math.abs(residual) > 0.009
    ? await requireLedger("Round off", settings.defaultRoundOffLedgerId, "ROUND_OFF", LEDGER_TYPES.ROUND_OFF, session)
    : null;
  const supplierLedger = purchase.supplier
    ? await getOrCreateSupplierLedger(purchase.supplier, session, createdBy)
    : null;

  const entries = [];
  const billNo = purchase.purchaseNumber || purchase.invoiceNumber;

  addEntry(entries, purchaseLedger, purchaseDebit, 0, `Purchase against Bill ${billNo}`);

  if (taxTotal > 0) {
    const taxLedgers = await getInputTaxLedgers(session);

    if (taxSplitTotal > 0) {
      addEntry(entries, taxLedgers.cgst, money(taxBucket.cgst), 0, `Input CGST on Purchase Bill ${billNo}`);
      addEntry(entries, taxLedgers.sgst, money(taxBucket.sgst), 0, `Input SGST on Purchase Bill ${billNo}`);
      addEntry(entries, taxLedgers.igst, money(taxBucket.igst), 0, `Input IGST on Purchase Bill ${billNo}`);
    } else {
      throw new Error("Purchase GST cannot be posted because the GST split could not be determined. Set state of supply or CGST/SGST/IGST amounts before posting.");
    }
  }

  if (roundOffLedger && residual < 0) {
    addEntry(entries, roundOffLedger, Math.abs(residual), 0, `Round off adjustment on Purchase Bill ${billNo}`);
  }

  if (supplierLedger) {
    addEntry(entries, supplierLedger, 0, grandTotal, `Purchase liability against Bill ${billNo}`, {
      partyId: purchase.supplier,
      partyType: PARTY_TYPES.SUPPLIER,
    });
  } else if (creditAmount > 0) {
    throw new Error("Credit or partial purchases require a supplier for accounting posting.");
  }

  if (paidAmount > 0) {
    const paymentLedger = purchase.paymentMethod === "cash"
      ? await getOrCreateCashBankLedger(null, settings, session, createdBy)
      : await getOrCreateCashBankLedger(purchase.cashBankAccountId, settings, session, createdBy);

    if (supplierLedger) {
      addEntry(entries, supplierLedger, paidAmount, 0, `Payment made against Purchase Bill ${billNo}`, {
        partyId: purchase.supplier,
        partyType: PARTY_TYPES.SUPPLIER,
      });
    }

    addEntry(entries, paymentLedger, 0, paidAmount, `Payment made against Purchase Bill ${billNo}`);
  }

  if (roundOffLedger && residual > 0) {
    addEntry(entries, roundOffLedger, 0, residual, `Round off adjustment on Purchase Bill ${billNo}`);
  }

  const posted = await postVoucher({
    voucherTypeCode: "PURCHASE",
    date: purchase.purchaseDate || purchase.createdAt || new Date(),
    referenceModule: PURCHASE_REFERENCE_MODULE,
    referenceId: purchase._id,
    referenceNo: billNo,
    narration: `Purchase Bill ${billNo}`,
    entries,
    createdBy,
    source,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  await markPurchaseAccounting(purchase, {
    accountingVoucherId: voucher._id,
    accountingPosted: true,
    accountingStatus: "posted",
    accountingError: undefined,
  }, session);

  return posted;
};

export const PURCHASE_ACCOUNTING_REFERENCE_MODULE = PURCHASE_REFERENCE_MODULE;
