import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import AccountGroup from "../../models/accounting/AccountGroup.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import Customer from "../../models/Customer.js";
import Sale from "../../models/Sale.js";
import BusinessProfile from "../../models/BusinessProfile.js";
import {
  LEDGER_TYPES,
  NORMAL_BALANCE,
  PARTY_TYPES,
} from "../../constants/accounting.constants.js";
import { postVoucher } from "./voucher.service.js";
import { extractGSTAmounts } from "../../utils/gst.utils.js";
import { getOrCreateCashBankLedger } from "./cashBankAccounting.service.js";

const SALE_REFERENCE_MODULE = "sale_invoice";

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

const createLedgerDocument = async (payload, session = null) => {
  if (!session) return Ledger.create(payload);
  const [ledger] = await Ledger.create([payload], { session });
  return ledger;
};

const addEntry = (entries, ledger, debit, credit, narration, extra = {}) => {
  const normalizedDebit = money(debit);
  const normalizedCredit = money(credit);
  if (normalizedDebit <= 0 && normalizedCredit <= 0) return;
  if (!ledger) {
    throw new Error("Accounting ledger is not configured for one or more sale voucher entries.");
  }

  entries.push({
    ledgerId: ledger._id,
    debit: normalizedDebit,
    credit: normalizedCredit,
    narration,
    ...extra,
  });
};

const firstLedger = async (...queries) => {
  for (const query of queries) {
    if (!query) continue;
    const ledger = await Ledger.findOne({ ...query, isActive: true });
    if (ledger) return ledger;
  }
  return null;
};

const ledgerByIdOrCode = async (ledgerId, code, ledgerType) => {
  return firstLedger(
    ledgerId ? { _id: ledgerId } : null,
    code ? { code: String(code).toUpperCase() } : null,
    ledgerType ? { ledgerType } : null,
  );
};

const ledgerByCode = async (code) => firstLedger({ code: String(code).toUpperCase() });

const requireLedger = async (label, ledgerId, code, ledgerType) => {
  const ledger = await ledgerByIdOrCode(ledgerId, code, ledgerType);
  if (!ledger) {
    throw new Error(`${label} ledger is not configured.`);
  }
  return ledger;
};

const getGSTContext = async () => {
  const profile = await BusinessProfile.findOne().select("state");
  return {
    businessState: profile?.state || "Rajasthan",
  };
};

export const getOrCreateCustomerLedger = async (customerId, sessionOrCreatedBy = null, maybeCreatedBy = null) => {
  const isSessionLike = typeof sessionOrCreatedBy?.withTransaction === "function";
  const session = isSessionLike ? sessionOrCreatedBy : null;
  const createdBy = isSessionLike ? maybeCreatedBy : sessionOrCreatedBy;

  if (!customerId) {
    throw new Error("Credit or partial sales require a customer for accounting posting.");
  }

  const customer = await queryWithSession(Customer.findById(customerId), session);
  if (!customer) {
    throw new Error("Customer not found for accounting posting.");
  }

  const linkedLedger = customer.accountingLedgerId
    ? await queryWithSession(Ledger.findOne({ _id: customer.accountingLedgerId, isActive: true }), session)
    : null;
  if (linkedLedger) return linkedLedger;

  let existingLedger = await queryWithSession(
    Ledger.findOne({
      partyId: customerId,
      partyType: PARTY_TYPES.CUSTOMER,
      isActive: true,
    }),
    session,
  );
  if (!existingLedger) {
    const candidates = await queryWithSession(
      Ledger.find({
        isActive: true,
        $or: [
          { ledgerType: LEDGER_TYPES.CUSTOMER },
          { partyType: PARTY_TYPES.CUSTOMER },
          { code: /^CUST-/ },
        ],
      }),
      session,
    );
    const targetName = normalizeLedgerName(`${customer.name} A/c`);
    existingLedger = candidates.find((ledger) => normalizeLedgerName(ledger.name) === targetName) || null;
  }
  if (existingLedger) {
    existingLedger.partyId = customer._id;
    existingLedger.partyType = PARTY_TYPES.CUSTOMER;
    existingLedger.ledgerType = LEDGER_TYPES.CUSTOMER;
    if (!existingLedger.gstDetails?.gstin && customer.gstNumber) {
      existingLedger.gstDetails = {
        ...existingLedger.gstDetails,
        gstin: customer.gstNumber,
        registrationType: customer.gstType,
      };
    }
    await existingLedger.save({ session, validateBeforeSave: false });
    customer.accountingLedgerId = existingLedger._id;
    await customer.save({ session, validateBeforeSave: false });
    return existingLedger;
  }

  const debtorGroup = await queryWithSession(
    AccountGroup.findOne({ code: "SUNDRY_DEBTORS", isActive: true }),
    session,
  );
  if (!debtorGroup) {
    throw new Error("Sundry Debtors account group is not configured.");
  }

  try {
    const ledger = await createLedgerDocument({
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
    }, session);
    customer.accountingLedgerId = ledger._id;
    await customer.save({ session, validateBeforeSave: false });
    return ledger;
  } catch (error) {
    if (error?.code === 11000) {
      const ledger = await queryWithSession(
        Ledger.findOne({
          partyId: customerId,
          partyType: PARTY_TYPES.CUSTOMER,
          isActive: true,
        }),
        session,
      );
      if (ledger) {
        customer.accountingLedgerId = ledger._id;
        await customer.save({ session, validateBeforeSave: false });
        return ledger;
      }
    }
    throw error;
  }
};

const markSaleAccounting = async (saleId, fields) => {
  await Sale.findByIdAndUpdate(saleId, {
    ...fields,
    accountingPostedAt: fields.accountingStatus === "posted" ? new Date() : undefined,
  });
};

const getExistingVoucher = async (sale) => {
  if (sale.accountingVoucherId) {
    const voucher = await Voucher.findById(sale.accountingVoucherId);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  return Voucher.findOne({
    referenceModule: SALE_REFERENCE_MODULE,
    referenceId: sale._id,
    status: { $nin: ["CANCELLED", "REVERSED"] },
  });
};

export const postSaleAccountingVoucher = async (saleInput, { createdBy } = {}) => {
  const sale = typeof saleInput?.populate === "function"
    ? saleInput
    : await Sale.findById(saleInput);

  if (!sale) {
    throw new Error("Sale not found for accounting posting.");
  }

  const existingVoucher = await getExistingVoucher(sale);
  if (existingVoucher) {
    await markSaleAccounting(sale._id, {
      accountingVoucherId: existingVoucher._id,
      accountingPosted: existingVoucher.status === "POSTED",
      accountingStatus: existingVoucher.status === "POSTED" ? "posted" : "failed",
      accountingError: undefined,
    });
    return { skipped: true, voucher: existingVoucher };
  }

  const settings = await AccountingSettings.findOne();
  if (!settings?.accountingEnabled || !settings?.autoVoucherPosting) {
    return { skipped: true, reason: "Accounting auto posting is disabled." };
  }

  const grandTotal = money(sale.totalAmount);
  if (grandTotal <= 0) {
    throw new Error("Sale total must be greater than zero for accounting posting.");
  }

  const netPaid = Math.min(money(Number(sale.amountPaid || 0) - Number(sale.changeAmount || 0)), grandTotal);
  const creditAmount = money(grandTotal - netPaid);
  const taxBucket = extractGSTAmounts(sale, sale.items || [], {
    ...await getGSTContext(),
    stateOfSupply: sale.stateOfSupply,
  });
  const taxSplitTotal = money(taxBucket.cgst) + money(taxBucket.sgst) + money(taxBucket.igst);
  const taxTotal = money(taxSplitTotal || taxBucket.totalTax || sale.taxAmount);
  const discountAmount = money(sale.discountAmount);

  const salesLedger = await requireLedger(
    "Sales",
    settings.defaultSalesLedgerId,
    "SALES",
    LEDGER_TYPES.SALES,
  );
  const discountLedger = discountAmount > 0
    ? await ledgerByIdOrCode(settings.defaultDiscountGivenLedgerId, "DISCOUNT_GIVEN", LEDGER_TYPES.DISCOUNT)
    : null;
  const discountDebit = discountLedger ? discountAmount : 0;
  const salesCredit = money(Number(sale.subtotal || 0) - (discountLedger ? 0 : discountAmount));
  const residual = roundMoney(grandTotal + discountDebit - salesCredit - taxTotal);
  const roundOffLedger = Math.abs(residual) > 0.009
    ? await requireLedger("Round off", settings.defaultRoundOffLedgerId, "ROUND_OFF", LEDGER_TYPES.ROUND_OFF)
    : null;
  const customerLedger = creditAmount > 0
    ? await getOrCreateCustomerLedger(sale.customer, createdBy)
    : null;

  const entries = [];
  const narration = `Sales invoice ${sale.invoiceNumber}`;

  if (netPaid > 0) {
    const receiptLedger = sale.paymentMethod === "cash"
      ? await getOrCreateCashBankLedger(null, settings, null, createdBy)
      : await getOrCreateCashBankLedger(sale.cashBankAccountId, settings, null, createdBy);
    addEntry(entries, receiptLedger, netPaid, 0, `${narration} - payment received`);
  }

  if (creditAmount > 0) {
    addEntry(entries, customerLedger, creditAmount, 0, `${narration} - receivable`, {
      partyId: sale.customer,
      partyType: PARTY_TYPES.CUSTOMER,
    });
  }

  if (discountDebit > 0) {
    addEntry(entries, discountLedger, discountDebit, 0, `${narration} - discount given`);
  }

  addEntry(entries, salesLedger, 0, salesCredit, `${narration} - sales`);

  if (taxTotal > 0) {
    const taxLedgers = {
      cgst: await ledgerByCode("OUTPUT_CGST"),
      sgst: await ledgerByCode("OUTPUT_SGST"),
      igst: await ledgerByCode("OUTPUT_IGST"),
    };

    if (taxSplitTotal > 0) {
      addEntry(entries, taxLedgers.cgst, 0, money(taxBucket.cgst), `${narration} - output CGST`);
      addEntry(entries, taxLedgers.sgst, 0, money(taxBucket.sgst), `${narration} - output SGST`);
      addEntry(entries, taxLedgers.igst, 0, money(taxBucket.igst), `${narration} - output IGST`);
    } else {
      throw new Error("Sale GST cannot be posted because the GST split could not be determined. Set state of supply or CGST/SGST/IGST amounts before posting.");
    }
  }

  if (roundOffLedger && residual > 0) {
    addEntry(entries, roundOffLedger, 0, residual, `${narration} - round off`);
  }
  if (roundOffLedger && residual < 0) {
    addEntry(entries, roundOffLedger, Math.abs(residual), 0, `${narration} - round off`);
  }

  const posted = await postVoucher({
    voucherTypeCode: "SALES",
    date: sale.createdAt || new Date(),
    referenceModule: SALE_REFERENCE_MODULE,
    referenceId: sale._id,
    referenceNo: sale.invoiceNumber,
    narration,
    entries,
    createdBy,
  }, createdBy);

  await markSaleAccounting(sale._id, {
    accountingVoucherId: posted.voucher._id,
    accountingPosted: true,
    accountingStatus: "posted",
    accountingError: undefined,
  });

  return posted;
};

export const markSaleAccountingFailure = async (saleId, error) => {
  await markSaleAccounting(saleId, {
    accountingPosted: false,
    accountingStatus: "failed",
    accountingError: String(error?.message || error || "Accounting posting failed").slice(0, 500),
  });
};

export const SALE_ACCOUNTING_REFERENCE_MODULE = SALE_REFERENCE_MODULE;
