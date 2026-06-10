import AccountingSettings from "../../models/accounting/AccountingSettings.model.js";
import Ledger from "../../models/accounting/Ledger.model.js";
import Product from "../../models/Product.js";
import Purchase from "../../models/Purchase.js";
import PurchaseReturn from "../../models/PurchaseReturn.js";
import Sale from "../../models/Sale.js";
import SalesReturn from "../../models/SalesReturn.js";
import Voucher from "../../models/accounting/Voucher.model.js";
import VoucherEntry from "../../models/accounting/VoucherEntry.model.js";
import {
  addGSTBucket,
  calculateGSTSplit,
  detectInvoiceType,
  extractGSTAmounts,
  makeEmptyGSTBucket,
  normalizeGSTIN,
  roundMoney,
  validateGSTINFormat,
} from "../../utils/gst.utils.js";

const gstLedgerCodes = ["OUTPUT_CGST", "OUTPUT_SGST", "OUTPUT_IGST", "INPUT_CGST", "INPUT_SGST", "INPUT_IGST"];

const getPeriod = (filters = {}) => {
  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

const dateFilter = (field, filters = {}) => {
  const { startDate, endDate } = getPeriod(filters);
  const filter = {};
  if (startDate || endDate) {
    filter[field] = {};
    if (startDate) filter[field].$gte = startDate;
    if (endDate) filter[field].$lte = endDate;
  }
  return filter;
};

const getGSTSettings = async () => {
  const settings = await AccountingSettings.findOne().lean();
  return {
    gstAccountingEnabled: Boolean(settings?.gstAccountingEnabled),
    warning: settings?.gstAccountingEnabled
      ? undefined
      : "GST accounting is currently disabled. Enable GST Accounting in Accounting Settings.",
  };
};

const itemTaxable = (item) => {
  const qty = Number(item.quantity || item.returnQty || 0);
  const price = Number(item.unitPrice || item.purchasePrice || item.pricePerUnit || 0);
  return roundMoney(Math.max(0, qty * price - Number(item.discountAmount || 0)));
};

const docTaxBucket = (doc) => extractGSTAmounts(doc, doc.items || [], {
  stateOfSupply: doc.stateOfSupply,
  partyStateCode: doc.customer?.stateCode || doc.supplier?.stateCode,
});

const splitReturnTax = async (returnDoc, SourceModel, sourceId) => {
  const totalTax = roundMoney(returnDoc.totalTax || returnDoc.items?.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0));
  if (totalTax <= 0) return { cgst: 0, sgst: 0, igst: 0, totalTax: 0 };

  const source = sourceId ? await SourceModel.findById(sourceId).lean() : null;
  const sourceCgst = roundMoney(source?.totalCgst || source?.cgstAmount || 0);
  const sourceSgst = roundMoney(source?.totalSgst || source?.sgstAmount || 0);
  const sourceIgst = roundMoney(source?.totalIgst || source?.igstAmount || 0);
  const sourceTotal = roundMoney(sourceCgst + sourceSgst + sourceIgst);
  if (sourceTotal > 0) {
    const cgst = roundMoney((totalTax * sourceCgst) / sourceTotal);
    const sgst = roundMoney((totalTax * sourceSgst) / sourceTotal);
    const igst = roundMoney(totalTax - cgst - sgst);
    return { cgst, sgst, igst, totalTax };
  }

  const supplyType = String(returnDoc.stateOfSupply || source?.stateOfSupply || "").toLowerCase().includes("inter")
    ? "inter"
    : "intra";
  return calculateGSTSplit(totalTax, supplyType);
};

const getSalesDocs = (filters = {}) => Sale.find({
  status: { $nin: ["cancelled", "draft"] },
  ...dateFilter("createdAt", filters),
}).populate("customer", "name gstNumber state stateCode").lean();

const getPurchaseDocs = (filters = {}) => Purchase.find({
  status: { $nin: ["cancelled", "draft"] },
  ...dateFilter("purchaseDate", filters),
}).populate("supplier", "name gstNumber state stateCode").lean();

const getSalesReturnDocs = (filters = {}) => SalesReturn.find({
  status: { $ne: "cancelled" },
  ...dateFilter("returnDate", filters),
}).lean();

const getPurchaseReturnDocs = (filters = {}) => PurchaseReturn.find({
  status: { $ne: "cancelled" },
  ...dateFilter("returnDate", filters),
}).lean();

const getProductMap = async (docs) => {
  const ids = new Set();
  docs.forEach((doc) => (doc.items || []).forEach((item) => {
    if (item.product) ids.add(String(item.product));
  }));
  const products = await Product.find({ _id: { $in: Array.from(ids) } }).select("name hsnCode unit taxRate").lean();
  return new Map(products.map((product) => [String(product._id), product]));
};

export const getOutputGSTReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const sales = await getSalesDocs(filters);
  const rows = sales.map((sale) => {
    const customerGSTIN = normalizeGSTIN(sale.customer?.gstNumber);
    const bucket = docTaxBucket(sale);
    return {
      date: sale.createdAt,
      invoiceNo: sale.invoiceNumber,
      customerName: sale.customerName || sale.customer?.name || "Walk-in Customer",
      customerGSTIN,
      invoiceType: detectInvoiceType(customerGSTIN),
      stateOfSupply: sale.stateOfSupply || sale.customer?.state || "",
      taxableAmount: bucket.taxableAmount,
      cgst: bucket.cgst,
      sgst: bucket.sgst,
      igst: bucket.igst,
      totalTax: bucket.totalTax,
      invoiceTotal: bucket.totalValue,
    };
  });
  const totals = rows.reduce((acc, row) => addGSTBucket(acc, { ...row, totalValue: row.invoiceTotal }), makeEmptyGSTBucket());
  const byInvoiceType = rows.reduce((acc, row) => {
    acc[row.invoiceType] = acc[row.invoiceType] || makeEmptyGSTBucket();
    addGSTBucket(acc[row.invoiceType], { ...row, totalValue: row.invoiceTotal });
    return acc;
  }, {});
  return { reportName: "Output GST Report", period: getPeriod(filters), ...settings, rows, totals, byInvoiceType };
};

export const getInputGSTReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const purchases = await getPurchaseDocs(filters);
  const rows = purchases.map((purchase) => {
    const supplierGSTIN = normalizeGSTIN(purchase.supplier?.gstNumber);
    const bucket = docTaxBucket(purchase);
    return {
      date: purchase.purchaseDate,
      billNo: purchase.purchaseNumber,
      supplierName: purchase.supplierName || purchase.supplier?.name || "Supplier",
      supplierGSTIN,
      stateOfSupply: purchase.stateOfSupply || purchase.supplier?.state || "",
      taxableAmount: bucket.taxableAmount,
      cgst: bucket.cgst,
      sgst: bucket.sgst,
      igst: bucket.igst,
      totalTax: bucket.totalTax,
      billTotal: bucket.totalValue,
      itcEligible: true,
      warning: supplierGSTIN ? "" : "Supplier GSTIN missing",
    };
  });
  const totals = rows.reduce((acc, row) => addGSTBucket(acc, { ...row, totalValue: row.billTotal }), makeEmptyGSTBucket());
  return { reportName: "Input GST Report", period: getPeriod(filters), ...settings, rows, totals };
};

const getReturnBuckets = async (filters = {}) => {
  const [salesReturns, purchaseReturns] = await Promise.all([getSalesReturnDocs(filters), getPurchaseReturnDocs(filters)]);
  const salesReturnRows = await Promise.all(salesReturns.map(async (ret) => {
    const split = await splitReturnTax(ret, Sale, ret.sale);
    return {
      taxableAmount: roundMoney(Number(ret.subtotal || 0) - Number(ret.totalDiscount || 0)),
      ...split,
      totalValue: ret.grandTotal,
    };
  }));
  const purchaseReturnRows = await Promise.all(purchaseReturns.map(async (ret) => {
    const split = await splitReturnTax(ret, Purchase, ret.purchase);
    return {
      taxableAmount: roundMoney(Number(ret.subtotal || 0) - Number(ret.totalDiscount || 0)),
      ...split,
      totalValue: ret.grandTotal,
    };
  }));
  const salesReturnTax = salesReturnRows.reduce((acc, row) => {
    return addGSTBucket(acc, {
      ...row,
    });
  }, makeEmptyGSTBucket());
  const purchaseReturnTax = purchaseReturnRows.reduce((acc, row) => {
    return addGSTBucket(acc, {
      ...row,
    });
  }, makeEmptyGSTBucket());
  return { salesReturnTax, purchaseReturnTax, salesReturns, purchaseReturns };
};

export const getGSTSummary = async (filters = {}) => {
  const settings = await getGSTSettings();
  const [output, input, returns] = await Promise.all([getOutputGSTReport(filters), getInputGSTReport(filters), getReturnBuckets(filters)]);
  const outputGST = makeEmptyGSTBucket();
  addGSTBucket(outputGST, output.totals);
  outputGST.cgst = roundMoney(outputGST.cgst - returns.salesReturnTax.cgst);
  outputGST.sgst = roundMoney(outputGST.sgst - returns.salesReturnTax.sgst);
  outputGST.igst = roundMoney(outputGST.igst - returns.salesReturnTax.igst);
  outputGST.totalTax = roundMoney(outputGST.cgst + outputGST.sgst + outputGST.igst);
  const inputGST = makeEmptyGSTBucket();
  addGSTBucket(inputGST, input.totals);
  inputGST.cgst = roundMoney(inputGST.cgst - returns.purchaseReturnTax.cgst);
  inputGST.sgst = roundMoney(inputGST.sgst - returns.purchaseReturnTax.sgst);
  inputGST.igst = roundMoney(inputGST.igst - returns.purchaseReturnTax.igst);
  inputGST.totalTax = roundMoney(inputGST.cgst + inputGST.sgst + inputGST.igst);
  const netPayable = roundMoney(outputGST.totalTax - inputGST.totalTax);
  return {
    reportName: "GST Summary",
    period: getPeriod(filters),
    ...settings,
    outputGST,
    inputGST,
    returns: {
      salesReturnTax: returns.salesReturnTax,
      purchaseReturnTax: returns.purchaseReturnTax,
    },
    netGST: {
      cgstPayable: Math.max(0, roundMoney(outputGST.cgst - inputGST.cgst)),
      sgstPayable: Math.max(0, roundMoney(outputGST.sgst - inputGST.sgst)),
      igstPayable: Math.max(0, roundMoney(outputGST.igst - inputGST.igst)),
      totalPayable: Math.max(0, netPayable),
      totalITC: inputGST.totalTax,
      netPayable,
    },
  };
};

const isMismatch = (a, b) => Math.abs(roundMoney(Number(a || 0)) - roundMoney(Number(b || 0))) > 0.001;

const buildGSTVoucherPostings = async (vouchers = []) => {
  const ledgers = await Ledger.find({ code: { $in: gstLedgerCodes } }).lean();
  const ledgerById = new Map(ledgers.map((ledger) => [String(ledger._id), ledger]));
  const entries = vouchers.length
    ? await VoucherEntry.find({ voucherId: { $in: vouchers.map((voucher) => voucher._id) }, ledgerId: { $in: ledgers.map((ledger) => ledger._id) } }).lean()
    : [];
  const postingsByVoucher = new Map();

  entries.forEach((entry) => {
    const voucherId = String(entry.voucherId);
    const ledger = ledgerById.get(String(entry.ledgerId));
    const code = ledger?.code || entry.ledgerCode;
    const posting = postingsByVoucher.get(voucherId) || new Map();
    const totals = posting.get(code) || { debit: 0, credit: 0 };
    totals.debit = roundMoney(totals.debit + Number(entry.debit || 0));
    totals.credit = roundMoney(totals.credit + Number(entry.credit || 0));
    posting.set(code, totals);
    postingsByVoucher.set(voucherId, posting);
  });

  return {
    postingsByVoucher,
    ledgerByCode: new Map(ledgers.map((ledger) => [ledger.code, ledger])),
  };
};

export const getGSTDebugReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const [sales, purchases] = await Promise.all([getSalesDocs(filters), getPurchaseDocs(filters)]);
  const referenceQuery = [];
  if (sales.length) referenceQuery.push({ referenceModule: "sale_invoice", referenceId: { $in: sales.map((doc) => doc._id) } });
  if (purchases.length) referenceQuery.push({ referenceModule: "purchase", referenceId: { $in: purchases.map((doc) => doc._id) } });
  const vouchers = referenceQuery.length
    ? await Voucher.find({ status: "POSTED", $or: referenceQuery }).lean()
    : [];
  const voucherByReference = new Map(vouchers.map((voucher) => [`${voucher.referenceModule}:${String(voucher.referenceId)}`, voucher]));
  const { postingsByVoucher, ledgerByCode } = await buildGSTVoucherPostings(vouchers);

  const buildRows = (docs, docType) => docs.map((doc) => {
    const bucket = docTaxBucket(doc);
    const partyName = docType === "sale"
      ? doc.customerName || doc.customer?.name || "Walk-in Customer"
      : doc.supplierName || doc.supplier?.name || "Supplier";
    const gstin = normalizeGSTIN(docType === "sale" ? doc.customer?.gstNumber : doc.supplier?.gstNumber);
    const referenceModule = docType === "sale" ? "sale_invoice" : "purchase";
    const voucher = voucherByReference.get(`${referenceModule}:${String(doc._id)}`) || null;
    const voucherPostings = voucher ? postingsByVoucher.get(String(voucher._id)) || new Map() : new Map();
    const postingRows = gstLedgerCodes.map((code) => {
      const ledger = ledgerByCode.get(code);
      const totals = voucherPostings.get(code) || { debit: 0, credit: 0 };
      const signed = roundMoney(totals.debit - totals.credit);
      const amountKey = code.endsWith("_CGST") ? "cgst" : code.endsWith("_SGST") ? "sgst" : "igst";
      const expectedAmount = docType === "sale"
        ? code.startsWith("OUTPUT_") ? bucket[amountKey] : 0
        : code.startsWith("INPUT_") ? bucket[amountKey] : 0;
      const expectedSigned = code.startsWith("OUTPUT_")
        ? docType === "sale" ? -expectedAmount : 0
        : docType === "purchase" ? expectedAmount : 0;
      return {
        ledgerCode: code,
        ledgerName: ledger?.name || code,
        expectedAmount,
        debit: totals.debit,
        credit: totals.credit,
        signed,
        expectedSigned,
        status: isMismatch(signed, expectedSigned) ? "mismatch" : "ok",
      };
    });

    return {
      docType,
      docId: doc._id,
      docNo: docType === "sale" ? doc.invoiceNumber : doc.purchaseNumber,
      date: docType === "sale" ? doc.createdAt : doc.purchaseDate,
      partyName,
      partyGSTIN: gstin,
      taxSource: bucket.taxSource,
      headerTax: bucket.headerTax,
      itemTax: bucket.itemTax,
      selectedTax: {
        cgst: bucket.cgst,
        sgst: bucket.sgst,
        igst: bucket.igst,
        totalTax: bucket.totalTax,
      },
      extractedTaxableAmount: bucket.taxableAmount,
      extractedCGST: bucket.cgst,
      extractedSGST: bucket.sgst,
      extractedIGST: bucket.igst,
      missingFields: bucket.missingFields,
      totalValue: bucket.totalValue,
      voucherId: voucher?._id || null,
      voucherNo: voucher?.voucherNo || null,
      voucherDate: voucher?.date || null,
      gstPostings: postingRows,
      status: voucher ? (postingRows.some((row) => row.status === "mismatch") ? "mismatch" : "ok") : "missing_voucher",
    };
  });

  const rows = [
    ...buildRows(sales, "sale"),
    ...buildRows(purchases, "purchase"),
  ];
  const outputGST = rows
    .filter((row) => row.docType === "sale")
    .reduce((acc, row) => addGSTBucket(acc, {
      taxableAmount: row.extractedTaxableAmount,
      cgst: row.extractedCGST,
      sgst: row.extractedSGST,
      igst: row.extractedIGST,
      totalTax: row.selectedTax.totalTax,
      totalValue: row.totalValue,
    }), makeEmptyGSTBucket());
  const inputGST = rows
    .filter((row) => row.docType === "purchase")
    .reduce((acc, row) => addGSTBucket(acc, {
      taxableAmount: row.extractedTaxableAmount,
      cgst: row.extractedCGST,
      sgst: row.extractedSGST,
      igst: row.extractedIGST,
      totalTax: row.selectedTax.totalTax,
      totalValue: row.totalValue,
    }), makeEmptyGSTBucket());
  const mismatches = rows
    .filter((row) => row.status !== "ok" || row.missingFields.length > 0)
    .map((row) => ({
      docType: row.docType,
      docId: row.docId,
      docNo: row.docNo,
      partyName: row.partyName,
      status: row.status,
      missingFields: row.missingFields,
      gstPostings: row.gstPostings.filter((posting) => posting.status !== "ok"),
      suggestedFix: row.status === "missing_voucher"
        ? "Post or repost accounting voucher for this document."
        : row.missingFields.length
          ? "Review GST source fields, tax split, and state of supply."
          : "Review GST ledger postings against extracted GST amounts.",
    }));

  return {
    reportName: "GST Debug Report",
    period: getPeriod(filters),
    ...settings,
    outputGST,
    inputGST,
    rows,
    mismatches,
    totals: {
      sales: sales.length,
      purchases: purchases.length,
      mismatches: mismatches.length,
    },
  };
};

export const getGSTPayableSummary = async (filters = {}) => {
  const summary = await getGSTSummary(filters);
  const output = { cgst: summary.outputGST.cgst, sgst: summary.outputGST.sgst, igst: summary.outputGST.igst, total: summary.outputGST.totalTax };
  const input = { cgst: summary.inputGST.cgst, sgst: summary.inputGST.sgst, igst: summary.inputGST.igst, total: summary.inputGST.totalTax };
  const payable = {
    cgst: Math.max(0, roundMoney(output.cgst - input.cgst)),
    sgst: Math.max(0, roundMoney(output.sgst - input.sgst)),
    igst: Math.max(0, roundMoney(output.igst - input.igst)),
    total: 0,
  };
  payable.total = roundMoney(payable.cgst + payable.sgst + payable.igst);
  const excessITC = {
    cgst: Math.max(0, roundMoney(input.cgst - output.cgst)),
    sgst: Math.max(0, roundMoney(input.sgst - output.sgst)),
    igst: Math.max(0, roundMoney(input.igst - output.igst)),
    total: 0,
  };
  excessITC.total = roundMoney(excessITC.cgst + excessITC.sgst + excessITC.igst);
  return { reportName: "GST Payable / ITC Summary", period: summary.period, gstAccountingEnabled: summary.gstAccountingEnabled, warning: summary.warning, output, input, payable, excessITC };
};

export const getHSNSummary = async (filters = {}) => {
  const settings = await getGSTSettings();
  const type = filters.type || "both";
  const [sales, purchases] = await Promise.all([
    type !== "purchase" ? getSalesDocs(filters) : [],
    type !== "sales" ? getPurchaseDocs(filters) : [],
  ]);
  const productMap = await getProductMap([...sales, ...purchases]);
  const grouped = new Map();
  const addItems = (docs, source) => {
    docs.forEach((doc) => (doc.items || []).forEach((item) => {
      const product = productMap.get(String(item.product));
      const hsn = product?.hsnCode || "Missing HSN";
      const taxRate = Number(item.taxRate || 0);
      const key = `${source}-${hsn}-${taxRate}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          hsn,
          description: product?.name || item.name || item.itemName || "Item",
          unit: product?.unit || item.unit || "piece",
          taxRate,
          quantity: 0,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
          totalValue: 0,
          source,
        });
      }
      const row = grouped.get(key);
      const taxable = itemTaxable(item);
      const bucket = extractGSTAmounts({}, [item]);
      row.quantity = roundMoney(row.quantity + Number(item.quantity || 0));
      row.taxableValue = roundMoney(row.taxableValue + taxable);
      row.cgst = roundMoney(row.cgst + bucket.cgst);
      row.sgst = roundMoney(row.sgst + bucket.sgst);
      row.igst = roundMoney(row.igst + bucket.igst);
      row.totalTax = roundMoney(row.totalTax + bucket.totalTax);
      row.totalValue = roundMoney(row.totalValue + Number(item.total || taxable));
    }));
  };
  addItems(sales, "sales");
  addItems(purchases, "purchase");
  return { reportName: "HSN Summary", period: getPeriod(filters), ...settings, rows: Array.from(grouped.values()) };
};

export const getGSTR1StyleReport = async (filters = {}) => {
  const output = await getOutputGSTReport(filters);
  const returns = await getSalesReturnDocs(filters);
  const hsnSummary = await getHSNSummary({ ...filters, type: "sales" });
  return {
    reportName: "GSTR-1 Style Sales Report",
    period: output.period,
    gstAccountingEnabled: output.gstAccountingEnabled,
    warning: output.warning,
    note: "This is a GSTR-1 style internal report. It does not directly file GST return.",
    b2b: output.rows.filter((row) => row.invoiceType === "B2B"),
    b2c: output.rows.filter((row) => row.invoiceType === "B2C"),
    creditNotes: returns.map((ret) => ({
      creditNoteNo: ret.creditNoteNo,
      originalInvoiceNo: ret.invoiceNumber,
      date: ret.returnDate,
      customerGSTIN: normalizeGSTIN(ret.customerGstNo),
      taxableValue: roundMoney(Number(ret.subtotal || 0) - Number(ret.totalDiscount || 0)),
      taxReversal: roundMoney(ret.totalTax || 0),
      total: roundMoney(ret.grandTotal || 0),
    })),
    hsnSummary: hsnSummary.rows,
  };
};

export const getGSTR3BStyleSummary = async (filters = {}) => {
  const summary = await getGSTSummary(filters);
  return {
    reportName: "GSTR-3B Style Summary",
    period: summary.period,
    gstAccountingEnabled: summary.gstAccountingEnabled,
    warning: summary.warning,
    note: "This is a GSTR-3B style internal summary for review.",
    outwardSupplies: summary.outputGST,
    inwardITC: summary.inputGST,
    adjustments: summary.returns,
    netTaxPayable: summary.netGST,
  };
};

export const getGSTLedgerReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const ledgers = await Ledger.find({ code: { $in: gstLedgerCodes }, isActive: true }).lean();
  const ledgerIds = ledgers.map((ledger) => ledger._id);
  const ledgerById = new Map(ledgers.map((ledger) => [String(ledger._id), ledger]));
  const vouchers = await Voucher.find({ status: "POSTED", ...dateFilter("date", filters) }).sort({ date: 1, createdAt: 1 }).lean();
  const voucherById = new Map(vouchers.map((voucher) => [String(voucher._id), voucher]));
  const entries = await VoucherEntry.find({ ledgerId: { $in: ledgerIds }, voucherId: { $in: vouchers.map((voucher) => voucher._id) } }).lean();
  let running = 0;
  const rows = entries.map((entry) => ({ entry, voucher: voucherById.get(String(entry.voucherId)) }))
    .filter(({ voucher }) => Boolean(voucher))
    .sort((a, b) => new Date(a.voucher.date) - new Date(b.voucher.date))
    .map(({ entry, voucher }) => {
      running = roundMoney(running + Number(entry.debit || 0) - Number(entry.credit || 0));
      return {
        date: voucher.date,
        voucherType: voucher.voucherTypeCode,
        voucherNo: voucher.voucherNo,
        referenceNo: voucher.referenceNo,
        ledger: ledgerById.get(String(entry.ledgerId))?.name || entry.ledgerName,
        debit: roundMoney(entry.debit),
        credit: roundMoney(entry.credit),
        balance: Math.abs(running),
        balanceType: running < 0 ? "CREDIT" : "DEBIT",
        narration: entry.narration || voucher.narration,
      };
    });
  return { reportName: "GST Ledger Report", period: getPeriod(filters), ...settings, rows };
};

export const getGSTPartyWiseReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const [sales, purchases] = await Promise.all([getSalesDocs(filters), getPurchaseDocs(filters)]);
  const partyType = filters.partyType || "all";
  const rows = [];
  if (partyType !== "supplier") {
    sales.forEach((sale) => rows.push({
      partyType: "customer",
      partyName: sale.customerName || sale.customer?.name || "Walk-in Customer",
      gstin: normalizeGSTIN(sale.customer?.gstNumber),
      ...docTaxBucket(sale),
    }));
  }
  if (partyType !== "customer") {
    purchases.forEach((purchase) => rows.push({
      partyType: "supplier",
      partyName: purchase.supplierName || purchase.supplier?.name || "Supplier",
      gstin: normalizeGSTIN(purchase.supplier?.gstNumber),
      ...docTaxBucket(purchase),
    }));
  }
  return { reportName: "GST Party-wise Report", period: getPeriod(filters), ...settings, rows };
};

export const getGSTExceptionReport = async (filters = {}) => {
  const settings = await getGSTSettings();
  const [sales, purchases] = await Promise.all([getSalesDocs(filters), getPurchaseDocs(filters)]);
  const productMap = await getProductMap([...sales, ...purchases]);
  const rows = [];
  const addIssue = (module, documentNo, date, party, issueType, severity, suggestedFix) => {
    rows.push({ module, documentNo, date, party, issueType, severity, suggestedFix });
  };
  sales.forEach((sale) => {
    const totalTax = roundMoney(Number(sale.totalCgst || 0) + Number(sale.totalSgst || 0) + Number(sale.totalIgst || 0));
    if (roundMoney(sale.taxAmount) !== totalTax) addIssue("Sales", sale.invoiceNumber, sale.createdAt, sale.customerName, "Tax amount mismatch", "medium", "Review invoice tax split and total tax.");
    if (sale.taxAmount > 0 && !sale.stateOfSupply && !sale.customer?.state) addIssue("Sales", sale.invoiceNumber, sale.createdAt, sale.customerName, "State of supply missing", "medium", "Set place/state of supply.");
    (sale.items || []).forEach((item) => {
      const product = productMap.get(String(item.product));
      if (!product?.hsnCode) addIssue("Sales", sale.invoiceNumber, sale.createdAt, sale.customerName, "Product HSN missing", "low", `Add HSN for ${item.name}.`);
      if (Number(item.taxRate || 0) <= 0 && Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0) > 0) addIssue("Sales", sale.invoiceNumber, sale.createdAt, sale.customerName, "GST rate missing", "medium", `Set GST rate for ${item.name}.`);
    });
  });
  purchases.forEach((purchase) => {
    const supplierGSTIN = normalizeGSTIN(purchase.supplier?.gstNumber);
    if (!supplierGSTIN) addIssue("Purchase", purchase.purchaseNumber, purchase.purchaseDate, purchase.supplierName || purchase.supplier?.name, "Supplier GSTIN missing", "high", "Add supplier GSTIN for ITC records.");
    if (supplierGSTIN && !validateGSTINFormat(supplierGSTIN)) addIssue("Purchase", purchase.purchaseNumber, purchase.purchaseDate, purchase.supplierName || purchase.supplier?.name, "Supplier GSTIN invalid", "high", "Correct supplier GSTIN format.");
    if (purchase.taxAmount > 0 && !purchase.stateOfSupply && !purchase.supplier?.state) addIssue("Purchase", purchase.purchaseNumber, purchase.purchaseDate, purchase.supplierName || purchase.supplier?.name, "State of supply missing", "medium", "Set place/state of supply.");
    (purchase.items || []).forEach((item) => {
      const product = productMap.get(String(item.product));
      if (!product?.hsnCode) addIssue("Purchase", purchase.purchaseNumber, purchase.purchaseDate, purchase.supplierName || purchase.supplier?.name, "Product HSN missing", "low", `Add HSN for ${item.name}.`);
      if (Number(item.taxRate || 0) <= 0 && Number(item.taxAmount || item.cgst || item.sgst || item.igst || 0) > 0) addIssue("Purchase", purchase.purchaseNumber, purchase.purchaseDate, purchase.supplierName || purchase.supplier?.name, "GST rate missing", "medium", `Set GST rate for ${item.name}.`);
    });
  });
  const counts = rows.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
  return { reportName: "GST Exception Report", period: getPeriod(filters), ...settings, rows, counts };
};
