export class AccountingError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "AccountingError";
    this.code = code;
    this.details = details;
  }
}

export const createAccountingError = (code, message, details = undefined) => (
  new AccountingError(code, message, details)
);

export const isAccountingError = (error) => error instanceof AccountingError;
