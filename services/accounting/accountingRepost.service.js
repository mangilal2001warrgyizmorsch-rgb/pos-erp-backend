import Voucher from "../../models/accounting/Voucher.model.js";
import Sale from "../../models/Sale.js";
import Purchase from "../../models/Purchase.js";
import PaymentIn from "../../models/PaymentIn.js";
import PaymentOut from "../../models/PaymentOut.js";
import Expense from "../../models/Expense.js";
import SalesReturn from "../../models/SalesReturn.js";
import PurchaseReturn from "../../models/PurchaseReturn.js";
import CashBankTransaction from "../../models/CashBankTransaction.js";
import { postSaleAccountingVoucher } from "./salesAccounting.service.js";
import { postPurchaseAccountingVoucher } from "./purchaseAccounting.service.js";
import { postPaymentInAccountingVoucher, postPaymentOutAccountingVoucher } from "./paymentAccounting.service.js";
import { postExpenseAccountingVoucher } from "./expenseAccounting.service.js";
import { postSaleReturnAccountingVoucher, postPurchaseReturnAccountingVoucher } from "./returnAccounting.service.js";
import { postBankTransferVoucher, postCashBankTransactionVoucher } from "./cashBankAccounting.service.js";

const moduleConfig = {
  sale: {
    model: Sale,
    referenceModule: "sale_invoice",
    post: (doc, userId) => postSaleAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  purchase: {
    model: Purchase,
    referenceModule: "purchase",
    post: (doc, userId) => postPurchaseAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  payment_in: {
    model: PaymentIn,
    referenceModule: "payment_in",
    post: (doc, userId) => postPaymentInAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  payment_out: {
    model: PaymentOut,
    referenceModule: "payment_out",
    post: (doc, userId) => postPaymentOutAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  expense: {
    model: Expense,
    referenceModule: "expense",
    post: (doc, userId) => postExpenseAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  sale_return: {
    model: SalesReturn,
    referenceModule: "sale_return",
    post: (doc, userId) => postSaleReturnAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  purchase_return: {
    model: PurchaseReturn,
    referenceModule: "purchase_return",
    post: (doc, userId) => postPurchaseReturnAccountingVoucher(doc, { createdBy: userId, source: "repost_missing" }),
  },
  cash_bank_transaction: {
    model: CashBankTransaction,
    referenceModule: null,
    post: async (doc, userId) => {
      if (doc.referenceModule === "bank_transfer" && doc.referenceId) {
        const transferTransactions = await CashBankTransaction.find({
          referenceModule: "bank_transfer",
          referenceId: doc.referenceId,
          status: "completed",
        });
        const sourceTx = transferTransactions.find((tx) => tx.direction === "out");
        const destTx = transferTransactions.find((tx) => tx.direction === "in");
        return postBankTransferVoucher(doc.referenceId, sourceTx, destTx, { createdBy: userId });
      }
      return postCashBankTransactionVoucher(doc, { createdBy: userId });
    },
  },
};

const findExistingVoucher = async (module, doc) => {
  const config = moduleConfig[module];
  if (!config) throw new Error("Unsupported accounting repost module.");
  if (doc.accountingVoucherId) {
    const voucher = await Voucher.findById(doc.accountingVoucherId);
    if (voucher && !["CANCELLED", "REVERSED"].includes(voucher.status)) return voucher;
  }

  const referenceModule = config.referenceModule || (doc.referenceModule === "bank_transfer" ? "bank_transfer" : null);
  const referenceId = referenceModule === "bank_transfer" ? doc.referenceId : doc._id;
  if (!referenceModule || !referenceId) return null;

  return Voucher.findOne({
    referenceModule,
    referenceId,
    status: { $nin: ["CANCELLED", "REVERSED"] },
  });
};

export const repostMissingAccounting = async ({ module, referenceId, userId }) => {
  const config = moduleConfig[module];
  if (!config) throw new Error("Unsupported accounting repost module.");

  const doc = await config.model.findById(referenceId);
  if (!doc) throw new Error("Source document not found for accounting repost.");

  const existing = await findExistingVoucher(module, doc);
  if (existing) {
    return { skipped: true, voucher: existing, message: "Accounting voucher already exists." };
  }

  const result = await config.post(doc, userId);
  return { ...result, skipped: Boolean(result?.skipped) };
};

export const repostMissingAccountingBatch = async ({ items = [], userId }) => {
  const results = [];
  for (const item of items) {
    try {
      const result = await repostMissingAccounting({ ...item, userId });
      results.push({ ...item, success: true, data: result });
    } catch (error) {
      results.push({ ...item, success: false, message: error.message });
    }
  }
  return results;
};
