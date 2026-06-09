# Accounting Test Checklist

Run this checklist after seeding accounting and enabling Accounting + Auto Voucher Posting in Accounting Settings.

## Transaction Flows

- [ ] Cash Sale posts Sales, Cash, GST/discount/round-off entries and updates customer only when applicable.
- [ ] Credit Sale posts Sales and Customer ledger entries.
- [ ] Partial Sale posts paid amount to Cash/Bank and balance to Customer ledger.
- [ ] Cash Purchase posts Purchase, Cash/Bank, GST/discount/shipping/round-off entries.
- [ ] Credit Purchase posts Purchase and Supplier ledger entries.
- [ ] Payment-In posts Receipt voucher and reduces Customer balance.
- [ ] Payment-Out posts Payment voucher and reduces Supplier payable.
- [ ] Expense posts Expense and Cash/Bank ledger entries.
- [ ] Cash In posts manual cash/bank adjustment voucher.
- [ ] Cash Out posts manual cash/bank adjustment voucher.
- [ ] Bank Transfer posts Contra voucher between source and destination ledgers.
- [ ] Sale Return posts Credit Note voucher and reverses sale/GST/customer/cash impact.
- [ ] Purchase Return posts Debit Note voucher and reverses purchase/GST/supplier/cash impact.
- [ ] Manual Journal validates debit equals credit before posting.
- [ ] Voucher Cancel reverses ledger balances and blocks repeat balance impact.
- [ ] Voucher Reverse creates an opposite voucher and blocks second reversal.

## Reports And Ledgers

- [ ] Ledger Statement shows every posted voucher line with unique row keys.
- [ ] Day Book shows posted voucher entries in date order.
- [ ] Trial Balance total debit equals total credit or clearly shows the difference.
- [ ] Profit & Loss reflects income and expense ledgers.
- [ ] Balance Sheet reflects asset and liability ledgers.
- [ ] GST Summary matches sales/purchase/return tax totals.
- [ ] Health Check reports no critical issues after clean posting.
- [ ] Ledger Reconciliation shows no mismatch after recalculation.

## Safety Checks

- [ ] Duplicate repost returns the existing voucher instead of creating another voucher.
- [ ] Missing posting health issue can be reposted from `/api/accounting/repost/missing`.
- [ ] Books locked date blocks posting, cancel, reverse, and repost on locked dates.
- [ ] Closed or missing financial year blocks posting with a readable error.
- [ ] Accounting Settings validation flags missing default/GST/inventory ledgers.
- [ ] Audit Logs record settings, voucher, repost, and ledger reconciliation actions.
- [ ] Cash & Bank reconciliation shows mapped cash/bank account differences.
- [ ] Party reconciliation shows customer/supplier business, party, and accounting balances.
- [ ] GST reconciliation is view-only and clearly reports differences.
