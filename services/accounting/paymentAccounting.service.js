import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Customer from "../../models/Customer.js";
import Supplier from "../../models/Supplier.js";
import PaymentIn from "../../models/PaymentIn.js";
import PaymentOut from "../../models/PaymentOut.js";
import { postVoucher } from "./voucher.service.js";
import { LEDGER_TYPES, NORMAL_BALANCE, PARTY_TYPES } from "../../constants/accounting.constants.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const money = (value) => roundMoney(Math.max(0, Number(value || 0)));

const queryWithSession = (query, session = null) => {
  if (session) query.session(session);
  return query;
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
  if (!ledger) {
    throw new Error(`${label} ledger is not configured.`);
  }
  return ledger;
};

const shortId = (id) => String(id || "").slice(-8).toUpperCase();

const getOrCreateCustomerLedger = async (customerId, session = null, createdBy = null) => {
  if (!customerId) throw new Error("Payment-In requires a customer ledger for accounting posting.");

  const existingLedger = await queryWithSession(Ledger.findOne({ partyId: customerId, partyType: PARTY_TYPES.CUSTOMER, ledgerType: LEDGER_TYPES.CUSTOMER, isActive: true }), session);
  if (existingLedger) return existingLedger;

  const customer = await queryWithSession(Customer.findById(customerId), session);
  if (!customer) throw new Error("Customer not found for accounting posting.");

  const debtorGroup = await queryWithSession(AccountGroup.findOne({ code: "SUNDRY_DEBTORS", isActive: true }), session);
  if (!debtorGroup) throw new Error("Sundry Debtors account group is not configured.");

  try {
    return await Ledger.create([{
      name: `${customer.name} A/c`,
      code: `CUST-${shortId(customer._id)}`,
      groupId: debtorGroup._id,
      ledgerType: LEDGER_TYPES.CUSTOMER,
      openingBalance: 0,
      openingBalanceType: NORMAL_BALANCE.DEBIT,
      currentBalance: 0,
      currentBalanceType: NORMAL_BALANCE.DEBIT,
      partyId: customer._id,
      partyType: PARTY_TYPES.CUSTOMER,
      gstDetails: {
        gstin: customer.gstNumber,
        registrationType: customer.gstType,
      },
      isActive: true,
      createdBy,
    }], { session });
  } catch (error) {
    if (error?.code === 11000) {
      const ledger = await queryWithSession(Ledger.findOne({ partyId: customerId, partyType: PARTY_TYPES.CUSTOMER, ledgerType: LEDGER_TYPES.CUSTOMER, isActive: true }), session);
      if (ledger) return ledger;
    }
    throw error;
  }
};

const getOrCreateSupplierLedger = async (supplierId, session = null, createdBy = null) => {
  if (!supplierId) throw new Error("Payment-Out requires a supplier ledger for accounting posting.");

  const existingLedger = await queryWithSession(Ledger.findOne({ partyId: supplierId, partyType: PARTY_TYPES.SUPPLIER, ledgerType: LEDGER_TYPES.SUPPLIER, isActive: true }), session);
  if (existingLedger) return existingLedger;

  const supplier = await queryWithSession(Supplier.findById(supplierId), session);
  if (!supplier) throw new Error("Supplier not found for accounting posting.");

  const creditorGroup = await queryWithSession(AccountGroup.findOne({ code: "SUNDRY_CREDITORS", isActive: true }), session);
  if (!creditorGroup) throw new Error("Sundry Creditors account group is not configured.");

  try {
    return await Ledger.create([{
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
      isActive: true,
      createdBy,
    }], { session });
  } catch (error) {
    if (error?.code === 11000) {
      const ledger = await queryWithSession(Ledger.findOne({ partyId: supplierId, partyType: PARTY_TYPES.SUPPLIER, ledgerType: LEDGER_TYPES.SUPPLIER, isActive: true }), session);
      if (ledger) return ledger;
    }
    throw error;
  }
};

const getExistingVoucher = async (referenceModule, referenceId, session = null) => {
  return queryWithSession(Voucher.findOne({ referenceModule, referenceId }), session);
};

const addEntry = (entries, ledger, debit, credit, narration, extra = {}) => {
  const normalizedDebit = money(debit);
  const normalizedCredit = money(credit);
  if (normalizedDebit <= 0 && normalizedCredit <= 0) return;
  if (!ledger) throw new Error("Accounting ledger is not configured for one or more payment voucher entries.");

  entries.push({
    ledgerId: ledger._id,
    debit: normalizedDebit,
    credit: normalizedCredit,
    narration,
    ...extra,
  });
};

const isCashMode = (paymentMode) => String(paymentMode || "").toLowerCase() === "cash";

export const postPaymentInAccountingVoucher = async (
  paymentInput,
  { session = null, createdBy = null, source = "payment_in" } = {},
) => {
  const payment = typeof paymentInput?.save === "function"
    ? paymentInput
    : await queryWithSession(PaymentIn.findById(paymentInput), session);

  if (!payment) {
    throw new Error("Payment-In not found for accounting posting.");
  }

  const existingVoucher = payment.accountingVoucherId
    ? await queryWithSession(Voucher.findById(payment.accountingVoucherId), session)
    : await getExistingVoucher("payment_in", payment._id, session);

  if (existingVoucher) {
    payment.accountingVoucherId = existingVoucher._id;
    payment.accountingPosted = existingVoucher.status === "POSTED";
    payment.accountingStatus = existingVoucher.status === "POSTED" ? "posted" : "failed";
    payment.accountingError = undefined;
    await payment.save({ session });
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const amount = money(payment.amountReceived);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero for accounting posting.");
  }

  const customerLedger = await getOrCreateCustomerLedger(payment.partyId, session, createdBy);
  const cashLedger = await requireLedger("Cash", settings.defaultCashLedgerId, "CASH", LEDGER_TYPES.CASH, session);
  const bankLedger = await requireLedger("Bank", settings.defaultBankLedgerId, "PRIMARY_BANK", LEDGER_TYPES.BANK, session);
  const paymentLedger = isCashMode(payment.paymentMode) ? cashLedger : bankLedger;

  const receiptLabel = payment.receiptNo || String(payment._id).slice(-8).toUpperCase();
  const paymentNarration = `Receipt ${receiptLabel}`;
  const partyNarration = payment.linkedInvoiceId
    ? `Payment received against Sales Invoice ${payment.linkedInvoiceId}`
    : `Payment received from customer Receipt ${receiptLabel}`;

  const entries = [];
  addEntry(entries, paymentLedger, amount, 0, `Amount received from Customer against Receipt ${receiptLabel}`);
  addEntry(entries, customerLedger, 0, amount, partyNarration, {
    partyId: payment.partyId,
    partyType: PARTY_TYPES.CUSTOMER,
  });

  const posted = await postVoucher({
    voucherTypeCode: "RECEIPT",
    date: payment.date || new Date(),
    referenceModule: "payment_in",
    referenceId: payment._id,
    referenceNo: payment.receiptNo,
    narration: paymentNarration,
    entries,
    createdBy,
    source,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  payment.accountingVoucherId = voucher._id;
  payment.accountingPosted = true;
  payment.accountingStatus = "posted";
  payment.accountingPostedAt = new Date();
  payment.accountingError = undefined;
  await payment.save({ session });

  return { voucher };
};

export const postPaymentOutAccountingVoucher = async (
  paymentInput,
  { session = null, createdBy = null, source = "payment_out" } = {},
) => {
  const payment = typeof paymentInput?.save === "function"
    ? paymentInput
    : await queryWithSession(PaymentOut.findById(paymentInput), session);

  if (!payment) {
    throw new Error("Payment-Out not found for accounting posting.");
  }

  const existingVoucher = payment.accountingVoucherId
    ? await queryWithSession(Voucher.findById(payment.accountingVoucherId), session)
    : await getExistingVoucher("payment_out", payment._id, session);

  if (existingVoucher) {
    payment.accountingVoucherId = existingVoucher._id;
    payment.accountingPosted = existingVoucher.status === "POSTED";
    payment.accountingStatus = existingVoucher.status === "POSTED" ? "posted" : "failed";
    payment.accountingError = undefined;
    await payment.save({ session });
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await queryWithSession(AccountingSettings.findOne(), session);
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const amount = money(payment.amountPaid);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero for accounting posting.");
  }

  const supplierLedger = await getOrCreateSupplierLedger(payment.partyId, session, createdBy);
  const cashLedger = await requireLedger("Cash", settings.defaultCashLedgerId, "CASH", LEDGER_TYPES.CASH, session);
  const bankLedger = await requireLedger("Bank", settings.defaultBankLedgerId, "PRIMARY_BANK", LEDGER_TYPES.BANK, session);
  const paymentLedger = isCashMode(payment.paymentMode) ? cashLedger : bankLedger;

  const receiptLabel = payment.receiptNo || String(payment._id).slice(-8).toUpperCase();
  const paymentNarration = `Payment ${receiptLabel}`;
  const supplierNarration = payment.linkedPurchaseId
    ? `Payment made against Purchase Bill ${payment.linkedPurchaseId}`
    : `Payment made to Supplier against Payment ${receiptLabel}`;

  const entries = [];
  addEntry(entries, supplierLedger, amount, 0, supplierNarration, {
    partyId: payment.partyId,
    partyType: PARTY_TYPES.SUPPLIER,
  });
  addEntry(entries, paymentLedger, 0, amount, `Amount paid to supplier Payment ${receiptLabel}`);

  const posted = await postVoucher({
    voucherTypeCode: "PAYMENT",
    date: payment.date || new Date(),
    referenceModule: "payment_out",
    referenceId: payment._id,
    referenceNo: payment.receiptNo,
    narration: paymentNarration,
    entries,
    createdBy,
    source,
  }, createdBy, { session });

  const voucher = posted.voucher || posted;
  payment.accountingVoucherId = voucher._id;
  payment.accountingPosted = true;
  payment.accountingStatus = "posted";
  payment.accountingPostedAt = new Date();
  payment.accountingError = undefined;
  await payment.save({ session });

  return { voucher };
};
