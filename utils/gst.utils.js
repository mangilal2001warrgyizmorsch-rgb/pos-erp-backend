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
