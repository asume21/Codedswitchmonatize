// Vitest global setup for server-side tests.
//
// services/stripe.ts captures STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET into
// module-scoped consts at import time. ESM import hoisting means we can't set
// these from inside a test file — by the time the test code runs, the service
// has already read empty strings. This file is registered via setupFiles in
// vitest.config.ts, which runs before any test module imports happen.
//
// Values are placeholders accepted by the Stripe SDK in test mode. The webhook
// secret must match what Stripe.webhooks.generateTestHeaderString uses to sign
// each test payload.

process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_secret';
process.env.NODE_ENV ??= 'test';
