# Accounting Root Cause Audit

Date: 2026-06-09

## Scope

This audit covers the accounting issues seen in a fresh POS ERP database:

- Cash & Bank reconciliation mismatches.
- SBI bank ledger not matching the selected SBI cash/bank account.
- Cash In Hand showing missing or misleading reconciliation state.
- Opening balances being mixed with transaction activity.
- GST reports showing zero while GST ledgers contain posted values.
- Party ledgers being missing or not linked during first purchase/sale/payment.

## Root Causes

### Cash & Bank ledger mapping

Business transactions store the selected cash/bank account on source documents and cash-bank transactions. Accounting vouchers must post to the ledger mapped by `BankAccount.accountingLedgerId`.

The sale, purchase, payment-in, and payment-out posting services were using default cash/bank ledgers instead of the selected `cashBankAccountId` in some bank-payment paths. This caused the cash/bank account balance and transaction balance to move on SBI, while the voucher entry could hit another bank ledger.

### Opening balance double counting

`BankAccount` stores:

- `openingBalance`
- `currentBalance`

The old account creation flow also created an `opening_cash` transaction and posted an opening voucher. Reconciliation then computed transaction balance as `openingBalance + transaction movement`, which double-counted legacy opening transactions.

The correct model is:

- Store opening balance on the account.
- Post opening balance to accounting through a dedicated opening balance journal.
- Do not create normal cash-bank transaction movement for new account openings.
- For legacy data, reconciliation must detect `opening_cash` transactions and avoid counting them twice.

### Cash ledger aggregation

Multiple cash accounts can map to one default Cash A/c ledger. A one-account-to-one-ledger comparison can show a false mismatch when a shared cash ledger is used. Reconciliation should compare shared cash ledger accounts in aggregate.

### GST extraction

GST fields are not always stored with the same names across sales, purchases, returns, and reports. Some reports used different field assumptions than voucher posting, so GST ledgers had posted values while reports showed zero.

The repair is to use a single GST extraction helper everywhere and store normalized GST amounts on source documents when possible.

### Party accounting ledgers

Customer and supplier models need stable `accountingLedgerId` links. First-time sale/purchase/payment posting must create or reuse the party ledger, link it to the party, and then post voucher entries to that linked ledger.

## Safe Repair Strategy

- Do not overwrite business balances directly.
- Do not mutate existing voucher entries blindly.
- Link missing cash/bank accounts to correct ledgers.
- Post missing opening balances through idempotent JOURNAL vouchers.
- Recalculate ledger balances from posted vouchers after mappings and opening vouchers are correct.
- Use debug and reconciliation APIs to expose remaining differences instead of hiding warnings.

## Important APIs

- `POST /api/accounting/reconciliation/cash-bank/link-ledgers`
- `GET /api/accounting/reconciliation/cash-bank/details`
- `POST /api/accounting/opening-balances/post-all`
- `POST /api/accounting/opening-balances/cash-bank/post-all`
- `POST /api/accounting/opening-balances/cash-bank/:accountId/post`
- `POST /api/accounting/reconciliation/ledgers/fix`

## Expected Fresh DB Flow

1. Initialize accounting defaults.
2. Link cash/bank ledgers.
3. Post cash/bank opening balances.
4. Recalculate ledger balances.
5. Repost missing source accounting only if health check reports missing postings.

