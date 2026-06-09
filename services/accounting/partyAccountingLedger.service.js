import { getOrCreateSupplierLedger } from "./purchaseAccounting.service.js";
import { getOrCreateCustomerLedger } from "./salesAccounting.service.js";

const isMissingFoundationError = (error) => {
  const message = String(error?.message || "");
  return message.includes("account group is not configured")
    || message.includes("Sundry Creditors")
    || message.includes("Sundry Debtors");
};

export const ensureSupplierAccountingLedger = async (supplierId, session = null, createdBy = null, { required = false } = {}) => {
  if (!supplierId) return null;
  try {
    return await getOrCreateSupplierLedger(supplierId, session, createdBy);
  } catch (error) {
    if (!required && isMissingFoundationError(error)) {
      return null;
    }
    throw error;
  }
};

export const ensureCustomerAccountingLedger = async (customerId, session = null, createdBy = null, { required = false } = {}) => {
  if (!customerId) return null;
  try {
    return await getOrCreateCustomerLedger(customerId, session, createdBy);
  } catch (error) {
    if (!required && isMissingFoundationError(error)) {
      return null;
    }
    throw error;
  }
};
