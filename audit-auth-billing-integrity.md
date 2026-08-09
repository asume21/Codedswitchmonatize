# Authorization and money-integrity audit — 2026-08-02

Scope: authenticated paid routes, subscription entitlements, Stripe Checkout/webhooks, and the durable credit ledger. This audit reads the live server paths only; it does not modify application code.

Validation run: `npm run test:unit -- server/api/__tests__/webhook.test.ts server/__tests__/credits.test.ts` — 2 files, 13 tests passed.

## Findings (most severe first)

- **Title:** Credit debits can commit without their ledger row, and retries can charge the balance again
  - **Files + line numbers:** `server/services/credits.ts:170-197`; `server/storage.ts:2068-2079`; `server/services/stripe.ts:336-359`; `server/storage.ts:2082-2100`; `server/services/stripe.ts:110-124`
  - **Which one wins at runtime, and the precise mechanism that decides:** The `users.credits` SQL `UPDATE` wins because it commits before the separate `credit_transactions` insert. `CreditService.deductCredits` calls `atomicDeductCredits` and only then `logCreditTransaction`, with no database transaction spanning them. The refund/dispute path repeats the same pattern with `atomicAddCredits(-amount)` followed by `logCreditTransaction`. In the webhook path, a ledger-insert failure releases the Stripe event claim, so Stripe's retry applies the negative balance change again.
  - **Observable symptom:** A transient ledger/database error can return a 500 after a user's balance has already fallen, leaving no matching transaction history. Retrying a generation can deduct again. For one Stripe refund or dispute, a retry after that failure can claw back the same credits multiple times, including into a negative balance.
  - **Confidence:** HIGH

- **Title:** Active paid subscribers are treated as free by the live professional-song gate
  - **Files + line numbers:** `server/routes/audio.ts:71-77`; `server/middleware/tierEnforcement.ts:9-15`; `server/middleware/tierEnforcement.ts:41-54`; `server/services/stripe.ts:185-201`; `server/services/stripe.ts:285-298`
  - **Which one wins at runtime, and the precise mechanism that decides:** `subscription.status` wins over `user.subscriptionTier` because `tierEnforcement` evaluates `subscription?.status || user.subscriptionTier`. Stripe persists an active subscription record with `status: "active"`; `active` is not a key in `TIER_LEVELS`, so `TIER_LEVELS["active"] || 0` resolves to free level 0. The mounted `/api/songs/generate-professional` route then rejects the request because it requires `pro` level 1.
  - **Observable symptom:** A customer with an active paid subscription and its normal subscription record receives `403 Upgrade required`, with `currentTier: "active"`, when trying professional song generation.
  - **Confidence:** HIGH

- **Title:** Subscription lifecycle webhooks overwrite Creator and Studio purchases as Pro
  - **Files + line numbers:** `server/routes/credits.ts:357-438`; `server/services/stripe.ts:22-33`; `server/services/stripe.ts:156-201`; `server/services/stripe.ts:270-299`
  - **Which one wins at runtime, and the precise mechanism that decides:** Checkout correctly writes the chosen `creator`, `pro`, or `studio` tier into both Checkout and Subscription metadata. But each `customer.subscription.created` or `customer.subscription.updated` event ignores that metadata, calls `deriveTier(status)`, and writes its result to `users.subscriptionTier`. Since `deriveTier("active")` always returns `"pro"`, that later webhook update overwrites Creator or Studio. An `invoice.paid` event may later restore metadata-derived tier, but nothing guarantees its ordering relative to future subscription updates.
  - **Observable symptom:** Creator customers can receive Pro-level identity/entitlements; Studio customers can lose Studio-specific identity/entitlements and be represented as Pro after a subscription update.
  - **Confidence:** HIGH

- **Title:** Credit packs are fulfilled on Checkout completion even when funds are not yet available
  - **Files + line numbers:** `server/routes/credits.ts:327-343`; `server/services/stripe.ts:127-179`
  - **Which one wins at runtime, and the precise mechanism that decides:** The `checkout.session.completed` branch grants the credit package whenever the session has valid metadata and a payment-intent ID. It never tests `session.payment_status`, and the switch has no `checkout.session.async_payment_succeeded` or `checkout.session.async_payment_failed` case. The checkout creator also does not restrict payment methods to immediate methods. Stripe documents that a completed Checkout session can still have unavailable funds for delayed methods and directs fulfillment to use payment status plus the async-success event ([Stripe Checkout fulfillment documentation](https://docs.stripe.com/checkout/fulfillment)).
  - **Observable symptom:** If delayed payment methods are enabled for Checkout, a customer can receive and spend a credit pack while payment is still processing; an eventual payment failure is ignored and leaves the credits granted.
  - **Confidence:** MEDIUM

- **Title:** Refund and dispute clawbacks silently stop once the original purchase is older than 500 transactions
  - **Files + line numbers:** `server/services/stripe.ts:319-332`; `server/storage.ts:2312-2320`; `shared/schema.ts:53-67`
  - **Which one wins at runtime, and the precise mechanism that decides:** The refund/dispute handler asks for only the 500 newest transactions, because `getCreditTransactions` sorts descending and applies `.limit(limit)`. If the original positive purchase is older than that window, `.find(...)` cannot see it; the handler logs a warning and `break`s without clawing back credits. The payment-intent ID exists only inside unindexed JSON metadata on the ledger row, so there is no direct lookup to recover the older purchase.
  - **Observable symptom:** A high-volume account can receive a refund or chargeback for an older credit purchase and retain all credits from that refunded payment. Re-delivery of the same webhook repeats the same no-op.
  - **Confidence:** HIGH
