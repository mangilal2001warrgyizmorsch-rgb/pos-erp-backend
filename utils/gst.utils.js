export const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const normalizeGSTIN = (gstin = "") => String(gstin || "").trim().toUpperCase();

export const validateGSTINFormat = (gstin = "") => {
  const normalized = normalizeGSTIN(gstin);
  if (!normalized) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized);
};

export const detectInvoiceType = (partyGSTIN = "") => (normalizeGSTIN(partyGSTIN) ? "B2B" : "B2C");

export const calculateGSTSplit = (taxAmount, supplyType = "intra") => {
  const tax = roundMoney(taxAmount);
  if (String(supplyType).toLowerCase() === "inter") {
    return { cgst: 0, sgst: 0, igst: tax, totalTax: tax };
  }
  const half = roundMoney(tax / 2);
  return { cgst: half, sgst: roundMoney(tax - half), igst: 0, totalTax: tax };
};

const firstNumber = (source, fields = []) => {
  for (const field of fields) {
    const value = Number(source?.[field] || 0);
    if (value) return roundMoney(value);
  }
  return 0;
};

const sumItemFields = (items = [], fields = []) => roundMoney(
  (items || []).reduce((sum, item) => sum + firstNumber(item, fields), 0),
);

const getItemTaxable = (item) => {
  const explicit = firstNumber(item, ["taxableAmount", "amount", "lineAmount"]);
  if (explicit) return explicit;
  const qty = Number(item.quantity || item.returnQty || 0);
  const price = Number(item.unitPrice || item.purchasePrice || item.pricePerUnit || item.rate || 0);
  return roundMoney(Math.max(0, qty * price - Number(item.discountAmount || item.discount || 0)));
};

const inferSupplyType = (document = {}, context = {}) => {
  const explicit = String(context.supplyType || document.supplyType || document.invoiceType || "").toLowerCase();
  if (explicit.includes("inter")) return "inter";
  if (explicit.includes("intra")) return "intra";

  const stateOfSupply = String(document.stateOfSupply || document.placeOfSupply || context.stateOfSupply || "").trim().toLowerCase();
  const businessState = String(context.businessState || context.businessStateCode || "").trim().toLowerCase();
  const partyState = String(document.partyState || document.customerState || document.supplierState || document.customer?.state || document.supplier?.state || "").trim().toLowerCase();
  const partyStateCode = String(document.customer?.stateCode || document.supplier?.stateCode || context.partyStateCode || "").trim().toLowerCase();
  const businessStateCode = String(context.businessStateCode || "").trim().toLowerCase();

  if (stateOfSupply && businessState && stateOfSupply !== businessState) return "inter";
  if (stateOfSupply && businessState && stateOfSupply === businessState) return "intra";
  if (partyStateCode && businessStateCode && partyStateCode !== businessStateCode) return "inter";
  if (partyStateCode && businessStateCode && partyStateCode === businessStateCode) return "intra";
  if (partyState && businessState && partyState !== businessState) return "inter";
  if (partyState && businessState && partyState === businessState) return "intra";

  return null;
};

export const extractGSTAmounts = (document = {}, itemsInput = null, context = {}) => {
  const items = Array.isArray(itemsInput) ? itemsInput : (Array.isArray(document.items) ? document.items : []);
  const header = {
    cgst: firstNumber(document, ["cgstAmount", "totalCgst", "totalCGST", "cgst"]),
    sgst: firstNumber(document, ["sgstAmount", "totalSgst", "totalSGST", "sgst"]),
    igst: firstNumber(document, ["igstAmount", "totalIgst", "totalIGST", "igst"]),
  };
  const item = {
    cgst: sumItemFields(items, ["cgstAmount", "cgst"]),
    sgst: sumItemFields(items, ["sgstAmount", "sgst"]),
    igst: sumItemFields(items, ["igstAmount", "igst"]),
  };

  const headerSplitTotal = roundMoney(header.cgst + header.sgst + header.igst);
  const itemSplitTotal = roundMoney(item.cgst + item.sgst + item.igst);
  const selected = headerSplitTotal > 0 ? header : itemSplitTotal > 0 ? item : { cgst: 0, sgst: 0, igst: 0 };
  let totalTax = headerSplitTotal || itemSplitTotal || firstNumber(document, ["taxAmount", "totalTax", "gstAmount", "totalGst", "totalGST"]);
  if (!totalTax) {
    totalTax = sumItemFields(items, ["taxAmount", "gstAmount"]);
  }

  let { cgst, sgst, igst } = selected;
  const taxSource = headerSplitTotal > 0 ? "header_split" : itemSplitTotal > 0 ? "item_split" : totalTax > 0 ? "total_tax" : "none";
  const inferredSupplyType = inferSupplyType(document, context);
  if (!headerSplitTotal && !itemSplitTotal && totalTax > 0 && inferredSupplyType) {
    const split = calculateGSTSplit(totalTax, inferredSupplyType);
    cgst = split.cgst;
    sgst = split.sgst;
    igst = split.igst;
  }

  const taxableFromHeader = firstNumber(document, ["taxableAmount"]);
  const subtotal = firstNumber(document, ["subtotal", "subTotal"]);
  const taxableAmount = taxableFromHeader || roundMoney(
    (subtotal || items.reduce((sum, row) => sum + getItemTaxable(row), 0))
    - Number(document.discountAmount || document.totalDiscount || 0),
  );
  const totalValue = firstNumber(document, ["grandTotal", "totalAmount", "total", "billTotal", "invoiceTotal"]);
  const missingFields = [];
  if (!headerSplitTotal && !itemSplitTotal && !totalTax) missingFields.push("gst_amount");
  if (totalTax > 0 && !headerSplitTotal && !itemSplitTotal && !inferredSupplyType) missingFields.push("supply_type");

  return {
    taxableAmount: roundMoney(taxableAmount),
    cgst: roundMoney(cgst),
    sgst: roundMoney(sgst),
    igst: roundMoney(igst),
    totalTax: roundMoney(cgst + sgst + igst || totalTax),
    totalValue: roundMoney(totalValue),
    taxSource,
    supplyType: inferredSupplyType,
    missingFields,
    headerTax: {
      ...header,
      totalTax: firstNumber(document, ["taxAmount", "totalTax", "gstAmount", "totalGst", "totalGST"]),
    },
    itemTax: {
      ...item,
      totalTax: sumItemFields(items, ["taxAmount", "gstAmount"]),
    },
  };
};

export const getTaxableAmountFromItems = (items = []) => roundMoney(
  items.reduce((sum, item) => {
    const gross = Number(item.quantity || item.returnQty || 0) * Number(item.unitPrice || item.purchasePrice || item.pricePerUnit || 0);
    const discount = Number(item.discountAmount || 0);
    return sum + Math.max(0, gross - discount);
  }, 0),
);

export const getTaxAmountFromItems = (items = []) => roundMoney(
  items.reduce((sum, item) => sum + Number(item.taxAmount || item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0), 0),
);

export const makeEmptyGSTBucket = () => ({
  taxableAmount: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  totalTax: 0,
  totalValue: 0,
});

export const addGSTBucket = (target, source) => {
  target.taxableAmount = roundMoney(target.taxableAmount + Number(source.taxableAmount || 0));
  target.cgst = roundMoney(target.cgst + Number(source.cgst || 0));
  target.sgst = roundMoney(target.sgst + Number(source.sgst || 0));
  target.igst = roundMoney(target.igst + Number(source.igst || 0));
  target.totalTax = roundMoney(target.totalTax + Number(source.totalTax || 0));
  target.totalValue = roundMoney(target.totalValue + Number(source.totalValue || 0));
  return target;
};
