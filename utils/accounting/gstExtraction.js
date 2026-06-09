import { extractGSTAmounts, roundMoney } from "../gst.utils.js";

export const extractGSTBreakup = (document = {}, items = null, context = {}) => {
  const breakup = extractGSTAmounts(document, items, context);
  const totalGST = roundMoney(breakup.totalTax);
  const gstRate = Number(document.gstRate || document.taxRate || 0)
    || Number((Array.isArray(items) ? items : document.items || [])[0]?.gstRate || 0)
    || Number((Array.isArray(items) ? items : document.items || [])[0]?.taxRate || 0);

  return {
    taxableAmount: roundMoney(breakup.taxableAmount),
    cgstAmount: roundMoney(breakup.cgst),
    sgstAmount: roundMoney(breakup.sgst),
    igstAmount: roundMoney(breakup.igst),
    totalGST,
    gstRate,
    source: breakup.taxSource,
    supplyType: breakup.supplyType,
    confidence: totalGST > 0 && breakup.missingFields.length === 0 ? "high" : totalGST > 0 ? "medium" : "low",
    warnings: breakup.missingFields,
    raw: breakup,
  };
};

export { extractGSTAmounts };

