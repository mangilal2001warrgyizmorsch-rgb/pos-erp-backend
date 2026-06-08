import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import SalesReturn from "../../models/SalesReturn.js";
import PurchaseReturn from "../../models/PurchaseReturn.js";
import Sale from "../../models/Sale.js";
import Purchase from "../../models/Purchase.js";
import { LEDGER_TYPES, PARTY_TYPES } from "../../constants/accounting.constants.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";
import { getOrCreateSupplierLedger } from "./purchaseAccounting.service.js";
import { getOrCreateCustomerLedger } from "./salesAccounting.service.js";
import { postVoucher } from "./voucher.service.js";

const SALE_RETURN_REFERENCE_MODULE = "sale_return";
const PURCHASE_RETURN_REFERENCE_MODULE = "purchase_return";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const money = (value) => roundMoney(Math.max(0, Number(value || 0)));

const queryWithSession = (query, session = null) => {
  if (session) query.session(session);
  return query;
};

const addEntry = (entries, ledger, debit, credit, narration, extra = {}) => {
  const normalizedDebit = money(debit);
  const normalizedCredit = money(credit);
  if (normalizedDebit <= 0 && normalizedCredit <= 0) return;
  if (!ledger) {
    throw new Error("Accounting ledger is not configured for one or more return voucher entries.");
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

const ledgerByCode = async (code, session = null) => firstLedger([{ code: String(code).toUpperCase() }], session);

const requireLedger = async (label, ledgerId, code, ledgerType, session = null) => {
  const ledger = await ledgerByIdOrCode(ledgerId, code, ledgerType, session);
  if (!ledger) throw new Error(`${label} ledger is not configured.`);
  return ledger;
};

const markReturnAccounting = async (returnDoc, fields, session = null) => {
  returnDoc.accountingVoucherId = fields.accountingVoucherId ?? returnDoc.accountingVoucherId;
  returnDoc.accountingPosted = fields.accountingPosted ?? returnDoc.accountingPosted;
  returnDoc.accountingStatus = fields.accountingStatus ?? returnDoc.accountingStatus;
  returnDoc.accountingError = fields.accountingError;
  returnDoc.accountingPostedAt = fields.accountingStatus === "posted" ? new Date() : undefined;
  await returnDoc.save({ session });
};

const getExistingVoucher = async (returnDoc, referenceModule, session = null) => {
  if (returnDoc.accountingVoucherId) {
    const voucher = await queryWithSession(Voucher.findById(returnDoc.accountingVoucherId), session);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  return queryWithSession(
    Voucher.findOne({
      referenceModule,
      referenceId: returnDoc._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }),
    session,
  );
};

const getReturnTaxSplit = async (returnDoc, SourceModel, sourceId, session = null) => {
  const taxTotal = money(returnDoc.totalTax || returnDoc.items?.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0));
  if (taxTotal <= 0) return { cgst: 0, sgst: 0, igst: 0, total: 0, hasSplit: false };

  const source = sourceId ? await queryWithSession(SourceModel.findById(sourceId), session) : null;
  const sourceCgst = money(source?.totalCgst);
  const sourceSgst = money(source?.totalSgst);
  const sourceIgst = money(source?.totalIgst);
  const sourceTaxTotal = money(sourceCgst + sourceSgst + sourceIgst);

  if (sourceTaxTotal <= 0) {
    return { cgst: 0, sgst: 0, igst: taxTotal, total: taxTotal, hasSplit: false };
  }

  const cgst = roundMoney((taxTotal * sourceCgst) / sourceTaxTotal);
  const sgst = roundMoney((taxTotal * sourceSgst) / sourceTaxTotal);
  const igst = roundMoney(taxTotal - cgst - sgst);
  return { cgst, sgst, igst, total: taxTotal, hasSplit: true };
};

const getOutputTaxLedgers = async (session = null) => ({
  cgst: await ledgerByCode("OUTPUT_CGST", session),
  sgst: await ledgerByCode("OUTPUT_SGST", session),
  igst: await ledgerByCode("OUTPUT_IGST", session),
});

const getInputTaxLedgers = async (session = null) => ({
  cgst: await ledgerByCode("INPUT_CGST", session),
  sgst: await ledgerByCode("INPUT_SGST", session),
  igst: await ledgerByCode("INPUT_IGST", session),
});

export const postSaleReturnAccountingVoucher = async (
  saleReturnInput,
  { session = null, createdBy = null, source = "sale_return" } = {},
) => {
  const saleReturn = typeof saleReturnInput?.save === "function"
    ? saleReturnInput
    : await queryWithSession(SalesReturn.findById(saleReturnInput), session);

  if (!saleReturn) throw new Error("Sale return not found for accounting posting.");
  if (saleReturn.status === "cancelled") {
    return { skipped: true, reason: "Cancelled sale return is not posted to accounting." };
  }

  const existingVoucher = await getExistingVoucher(saleReturn, SALE_RETURN_REFERENCE_MODULE, session);
  if (existingVoucher) {
    if (saleReturn.customer) {
      await getOrCreateCustomerLedger(saleReturn.customer, session, createdBy);
    }
    await markReturnAccounting(saleReturn, {
      accountingVoucherId: existingVoucher._id,
      accountingPosted: existingVoucher.status === "POSTED",
      accountingStatus: existingVoucher.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    }, session);
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    await markReturnAccounting(saleReturn, {
      accountingStatus: "not_posted",
      accountingError: "Accounting auto posting is disabled.",
    }, session);
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const grandTotal = money(saleReturn.grandTotal);
  if (grandTotal <= 0) throw new Error("Sale return total must be greater than zero for accounting posting.");

  const taxSplit = await getReturnTaxSplit(saleReturn, Sale, saleReturn.sale, session);
  const roundOffAmount = roundMoney(saleReturn.roundOff);
  const returnDebit = money(grandTotal - taxSplit.total - roundOffAmount);
  const refundedAmount = saleReturn.refundType === "refund_now"
    ? Math.min(money(saleReturn.refundedAmount || grandTotal), grandTotal)
    : 0;
  const customerCredit = money(grandTotal - refundedAmount);

  const salesReturnLedger = await requireLedger(
    "Sales return",
    settings.defaultSalesReturnLedgerId,
    "SALES_RETURN",
    LEDGER_TYPES.SALES_RETURN,
    session,
  );
  const refundLedger = refundedAmount > 0
    ? await getOrCreateCashBankLedger(saleReturn.cashBankAccountId, settings, session, createdBy)
    : null;
  const customerLedger = customerCredit > 0
    ? await getOrCreateCustomerLedger(saleReturn.customer, session, createdBy)
    : null;

  const entries = [];
  const noteNo = saleReturn.creditNoteNo || saleReturn.returnNumber;
  const narration = `Credit Note ${noteNo}`;

  addEntry(entries, salesReturnLedger, returnDebit, 0, `${narration} - sales return`);

  if (taxSplit.total > 0) {
    const taxLedgers = await getOutputTaxLedgers(session);
    if (taxSplit.hasSplit) {
      addEntry(entries, taxLedgers.cgst, taxSplit.cgst, 0, `${narration} - output CGST reversal`);
      addEntry(entries, taxLedgers.sgst, taxSplit.sgst, 0, `${narration} - output SGST reversal`);
      addEntry(entries, taxLedgers.igst, taxSplit.igst, 0, `${narration} - output IGST reversal`);
    } else {
      const fallbackTaxLedger = taxLedgers.igst || taxLedgers.cgst || taxLedgers.sgst;
      if (!fallbackTaxLedger) throw new Error("Output GST ledger is not configured.");
      addEntry(entries, fallbackTaxLedger, taxSplit.total, 0, `${narration} - output GST reversal`);
    }
  }

  if (refundedAmount > 0) {
    addEntry(entries, refundLedger, 0, refundedAmount, `${narration} - customer refund`);
  }

  if (customerCredit > 0) {
    if (!customerLedger) throw new Error("Customer ledger is required for sale return credit.");
    addEntry(entries, customerLedger, 0, customerCredit, `${narration} - customer credit`, {
      partyId: saleReturn.customer,
      partyType: PARTY_TYPES.CUSTOMER,
    });
  }

  const debitTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.debit, 0));
  const creditTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.credit, 0));
  const residual = roundMoney(creditTotal - debitTotal);
  if (Math.abs(residual) > 0.009) {
    const roundOffLedger = await requireLedger(
      "Round off",
      settings.defaultRoundOffLedgerId,
      "ROUND_OFF",
      LEDGER_TYPES.ROUND_OFF,
      session,
    );
    if (residual > 0) {
      addEntry(entries, roundOffLedger, residual, 0, `${narration} - round off`);
    } else {
      addEntry(entries, roundOffLedger, 0, Math.abs(residual), `${narration} - round off`);
    }
  }

  const posted = await postVoucher({
    voucherTypeCode: "CREDIT_NOTE",
    date: saleReturn.returnDate || saleReturn.createdAt || new Date(),
    referenceModule: SALE_RETURN_REFERENCE_MODULE,
    referenceId: saleReturn._id,
    referenceNo: noteNo,
    narration,
    entries,
    createdBy,
    source,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  await markReturnAccounting(saleReturn, {
    accountingVoucherId: voucher._id,
    accountingPosted: true,
    accountingStatus: "posted",
    accountingError: undefined,
  }, session);

  return posted;
};

export const postPurchaseReturnAccountingVoucher = async (
  purchaseReturnInput,
  { session = null, createdBy = null, source = "purchase_return" } = {},
) => {
  const purchaseReturn = typeof purchaseReturnInput?.save === "function"
    ? purchaseReturnInput
    : await queryWithSession(PurchaseReturn.findById(purchaseReturnInput), session);

  if (!purchaseReturn) throw new Error("Purchase return not found for accounting posting.");
  if (purchaseReturn.status === "cancelled") {
    return { skipped: true, reason: "Cancelled purchase return is not posted to accounting." };
  }

  const existingVoucher = await getExistingVoucher(purchaseReturn, PURCHASE_RETURN_REFERENCE_MODULE, session);
  if (existingVoucher) {
    if (purchaseReturn.supplier) {
      await getOrCreateSupplierLedger(purchaseReturn.supplier, session, createdBy);
    }
    await markReturnAccounting(purchaseReturn, {
      accountingVoucherId: existingVoucher._id,
      accountingPosted: existingVoucher.status === "POSTED",
      accountingStatus: existingVoucher.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    }, session);
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    await markReturnAccounting(purchaseReturn, {
      accountingStatus: "not_posted",
      accountingError: "Accounting auto posting is disabled.",
    }, session);
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const grandTotal = money(purchaseReturn.grandTotal);
  if (grandTotal <= 0) throw new Error("Purchase return total must be greater than zero for accounting posting.");

  const taxSplit = await getReturnTaxSplit(purchaseReturn, Purchase, purchaseReturn.purchase, session);
  const roundOffAmount = roundMoney(purchaseReturn.roundOff);
  const returnCredit = money(grandTotal - taxSplit.total - roundOffAmount);
  const refundReceivedAmount = purchaseReturn.refundType === "refund_received"
    ? Math.min(money(purchaseReturn.refundReceivedAmount || grandTotal), grandTotal)
    : 0;
  const supplierDebit = money(grandTotal - refundReceivedAmount);

  const purchaseReturnLedger = await requireLedger(
    "Purchase return",
    settings.defaultPurchaseReturnLedgerId,
    "PURCHASE_RETURN",
    LEDGER_TYPES.PURCHASE_RETURN,
    session,
  );
  const refundLedger = refundReceivedAmount > 0
    ? await getOrCreateCashBankLedger(purchaseReturn.cashBankAccountId, settings, session, createdBy)
    : null;
  const supplierLedger = supplierDebit > 0
    ? await getOrCreateSupplierLedger(purchaseReturn.supplier, session, createdBy)
    : null;

  const entries = [];
  const noteNo = purchaseReturn.debitNoteNo || purchaseReturn.returnNumber;
  const narration = `Debit Note ${noteNo}`;

  if (refundReceivedAmount > 0) {
    addEntry(entries, refundLedger, refundReceivedAmount, 0, `${narration} - refund received`);
  }

  if (supplierDebit > 0) {
    if (!supplierLedger) throw new Error("Supplier ledger is required for purchase return debit.");
    addEntry(entries, supplierLedger, supplierDebit, 0, `${narration} - supplier debit`, {
      partyId: purchaseReturn.supplier,
      partyType: PARTY_TYPES.SUPPLIER,
    });
  }

  addEntry(entries, purchaseReturnLedger, 0, returnCredit, `${narration} - purchase return`);

  if (taxSplit.total > 0) {
    const taxLedgers = await getInputTaxLedgers(session);
    if (taxSplit.hasSplit) {
      addEntry(entries, taxLedgers.cgst, 0, taxSplit.cgst, `${narration} - input CGST reversal`);
      addEntry(entries, taxLedgers.sgst, 0, taxSplit.sgst, `${narration} - input SGST reversal`);
      addEntry(entries, taxLedgers.igst, 0, taxSplit.igst, `${narration} - input IGST reversal`);
    } else {
      const fallbackTaxLedger = taxLedgers.igst || taxLedgers.cgst || taxLedgers.sgst;
      if (!fallbackTaxLedger) throw new Error("Input GST ledger is not configured.");
      addEntry(entries, fallbackTaxLedger, 0, taxSplit.total, `${narration} - input GST reversal`);
    }
  }

  const debitTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.debit, 0));
  const creditTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.credit, 0));
  const residual = roundMoney(creditTotal - debitTotal);
  if (Math.abs(residual) > 0.009) {
    const roundOffLedger = await requireLedger(
      "Round off",
      settings.defaultRoundOffLedgerId,
      "ROUND_OFF",
      LEDGER_TYPES.ROUND_OFF,
      session,
    );
    if (residual > 0) {
      addEntry(entries, roundOffLedger, residual, 0, `${narration} - round off`);
    } else {
      addEntry(entries, roundOffLedger, 0, Math.abs(residual), `${narration} - round off`);
    }
  }

  const posted = await postVoucher({
    voucherTypeCode: "DEBIT_NOTE",
    date: purchaseReturn.returnDate || purchaseReturn.createdAt || new Date(),
    referenceModule: PURCHASE_RETURN_REFERENCE_MODULE,
    referenceId: purchaseReturn._id,
    referenceNo: noteNo,
    narration,
    entries,
    createdBy,
    source,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  await markReturnAccounting(purchaseReturn, {
    accountingVoucherId: voucher._id,
    accountingPosted: true,
    accountingStatus: "posted",
    accountingError: undefined,
  }, session);

  return posted;
};

export const SALE_RETURN_ACCOUNTING_REFERENCE_MODULE = SALE_RETURN_REFERENCE_MODULE;
export const PURCHASE_RETURN_ACCOUNTING_REFERENCE_MODULE = PURCHASE_RETURN_REFERENCE_MODULE;
