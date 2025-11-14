# 🔐💳 Auth, Payments & Credits - Complete Audit & Action Plan

**Date:** November 13, 2025  
**Current Status:** Partially Implemented  
**Target:** Production-Ready with Full Credit System

---

## 📊 **CURRENT STATE ANALYSIS**

### ✅ **WHAT YOU HAVE**

#### **1. Authentication System** (70% Complete)
**Files:**
- ✅ `server/routes/auth.ts` - Register, Login, Logout, Owner login
- ✅ `server/middleware/auth.ts` - Auth middleware
- ✅ `client/src/contexts/AuthContext.tsx` - Frontend auth context
- ✅ `client/src/hooks/use-auth.ts` - Auth hook
- ✅ `client/src/components/auth/RequireAuth.tsx` - Protected routes

**Features:**
- ✅ Email/password registration with bcrypt hashing
- ✅ Session-based authentication
- ✅ Owner/demo access system
- ✅ Password validation (8+ characters)
- ✅ Email validation
- ✅ Session management with express-session

**Missing/Issues:**
- ⚠️ No email verification
- ⚠️ No password reset flow
- ⚠️ No "Remember Me" functionality
- ⚠️ Session security settings need review
- ⚠️ No rate limiting on auth endpoints
- ⚠️ No 2FA/MFA option

---

#### **2. Stripe Integration** (60% Complete)
**Files:**
- ✅ `server/services/stripe.ts` - Checkout & webhook handling
- ✅ Stripe NPM package installed

**Features:**
- ✅ Checkout session creation
- ✅ Subscription management
- ✅ Webhook handling for events
- ✅ Customer creation
- ✅ Activation key generation
- ✅ Tier management (free, pro)

**Database Fields:**
```typescript
users table:
- stripeCustomerId: text
- stripeSubscriptionId: text
- subscriptionStatus: text (active, inactive, canceled, past_due)
- subscriptionTier: text (free, basic, pro) - default: "free"
- activationKey: text
```

**Missing/Issues:**
- ⚠️ No frontend checkout UI
- ⚠️ No billing page
- ⚠️ No subscription management page
- ⚠️ No pricing tiers defined
- ⚠️ Missing env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`
- ⚠️ No invoice/receipt handling
- ⚠️ No failed payment recovery
- ⚠️ Activation keys generated but not used

---

#### **3. Credit System** (40% Complete)
**Database Fields:**
```typescript
users table:
- credits: integer - default: 10 (free credits on signup)
- totalCreditsSpent: integer - default: 0
- monthlyGenerations: integer - default: 0
- lastUsageReset: timestamp - defaultNow()
```

**Missing:**
- ❌ No credit deduction logic implemented
- ❌ No credit top-up system
- ❌ No credit purchase page
- ❌ No credit usage tracking per feature
- ❌ No credit balance API endpoint
- ❌ No credit transaction history
- ❌ No monthly reset logic
- ❌ No credit packages defined
- ❌ No credit display in UI
- ❌ No low credit warnings

---

## 🎯 **WHAT NEEDS TO BE BUILT**

### **Priority 1: Critical** (Must Have)

#### **1. Complete Credit System** ⭐⭐⭐
**Why:** Core monetization mechanism
**Time:** 2-3 hours

**Components Needed:**
```
Backend:
- Credit deduction middleware
- Credit balance endpoint
- Credit transaction logging
- Credit top-up via Stripe
- Credit packages (100, 500, 1000, 5000 credits)

Frontend:
- Credit balance display in header
- Credit purchase modal
- Credit history page
- Low credit warnings
- Per-feature credit costs display

Integration:
- Deduct credits on:
  * Song generation
  * Beat generation
  * Melody generation
  * Lyrics generation
  * Song analysis
  * AI mixing
  * Transcription (new feature)
```

**Credit Pricing:**
```
Free Tier: 10 credits on signup
Pro Subscription: 1000 credits/month

Credit Packages:
- 100 credits = $4.99
- 500 credits = $19.99 (save 20%)
- 1000 credits = $34.99 (save 30%)
- 5000 credits = $149.99 (save 40%)

Cost per operation:
- Song generation: 10 credits
- Beat generation: 5 credits
- Melody generation: 5 credits
- Lyrics generation: 3 credits
- Song analysis: 2 credits
- AI mixing: 8 credits
- Transcription: 5 credits
```

---

#### **2. Stripe Frontend Integration** ⭐⭐⭐
**Why:** Can't make money without checkout
**Time:** 1-2 hours

**Components:**
```
/client/src/pages/pricing.tsx
- Pricing tiers display
- Pro subscription: $29.99/month
- Free tier features vs Pro features
- "Start Free Trial" button
- "Subscribe to Pro" button

/client/src/pages/billing.tsx
- Current subscription status
- Cancel subscription
- Update payment method
- Invoice history
- Credit balance
- Credit purchase

/client/src/components/checkout/CheckoutModal.tsx
- Stripe Checkout integration
- Loading states
- Success/error handling

/client/src/components/checkout/CreditPurchaseModal.tsx
- Select credit package
- Instant checkout
- Success confirmation
```

---

#### **3. Auth Security Hardening** ⭐⭐
**Why:** Prevent account takeovers
**Time:** 1 hour

**Fixes Needed:**
```typescript
// Add rate limiting
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

router.post('/login', authLimiter, async (req, res) => { ... });

// Secure session settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax'
  }
}));

// Add CSRF protection
import csrf from 'csurf';
app.use(csrf());
```

---

### **Priority 2: Important** (Should Have)

#### **4. Password Reset Flow** ⭐⭐
**Time:** 1-2 hours

```
Backend:
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- Generate reset tokens (expire in 1 hour)
- Send reset email

Frontend:
- Forgot password page
- Reset password page
- Email sent confirmation
- Password reset success
```

---

#### **5. Email Verification** ⭐⭐
**Time:** 1-2 hours

```
Backend:
- Send verification email on signup
- GET /api/auth/verify-email/:token
- Resend verification endpoint

Frontend:
- Email verification prompt
- Resend verification button
- Verification success page

Database:
- Add emailVerified: boolean
- Add verificationToken: text
- Add verificationTokenExpiry: timestamp
```

---

#### **6. Subscription Management Page** ⭐⭐
**Time:** 1 hour

```
Features:
- View current plan
- Upgrade/downgrade
- Cancel subscription
- Reactivate subscription
- View upcoming invoice
- Update payment method
- Download invoices
```

---

### **Priority 3: Nice to Have**

#### **7. Two-Factor Authentication** ⭐
**Time:** 2-3 hours

#### **8. Social Login** ⭐
**Time:** 2-3 hours
- Google OAuth
- GitHub OAuth

#### **9. Credit Gifting** ⭐
**Time:** 1 hour

---

## 🚀 **IMPLEMENTATION PLAN**

### **Phase 1: Credit System (2-3 hours)**

**Step 1: Backend Credit Service**
```typescript
// server/services/credits.ts
- getCreditBalance(userId)
- deductCredits(userId, amount, reason)
- addCredits(userId, amount, reason)
- getCreditHistory(userId)
- createCreditPackage(packageType)
```

**Step 2: Credit Middleware**
```typescript
// server/middleware/requireCredits.ts
export function requireCredits(cost: number) {
  return async (req, res, next) => {
    // Check balance
    // Deduct if sufficient
    // Return 402 if insufficient
  }
}
```

**Step 3: Frontend Credit Display**
```typescript
// client/src/components/credits/CreditBalance.tsx
- Show current balance
- Link to purchase
- Usage this month

// client/src/components/credits/CreditPurchaseModal.tsx
- Select package
- Checkout
```

**Step 4: Integration**
```typescript
// Add to all AI endpoints:
router.post('/api/songs/generate', 
  requireAuth, 
  requireCredits(10), // NEW!
  async (req, res) => { ... }
);
```

---

### **Phase 2: Stripe Frontend (1-2 hours)**

**Step 1: Pricing Page**
- Design pricing tiers
- Add CTA buttons
- Link to checkout

**Step 2: Checkout Flow**
- Create Stripe Checkout session
- Redirect to Stripe
- Handle success/cancel

**Step 3: Billing Dashboard**
- Show subscription status
- Manage subscription
- Purchase credits

---

### **Phase 3: Security (1 hour)**

**Step 1: Rate Limiting**
- Add express-rate-limit
- Apply to auth endpoints
- Add to all API endpoints

**Step 2: Session Security**
- Update session config
- Add CSRF protection
- Secure cookie settings

**Step 3: Input Validation**
- Review all Zod schemas
- Add sanitization
- Prevent SQL injection

---

## 📋 **REQUIRED ENV VARIABLES**

```bash
# Auth
SESSION_SECRET=your-super-secret-session-key-min-32-chars
OWNER_KEY=your-owner-key-for-demo-access

# Stripe
STRIPE_SECRET_KEY=sk_test_... (get from Stripe dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (get from Stripe webhooks)
STRIPE_PRICE_ID_PRO=price_... (create in Stripe dashboard)
STRIPE_PRICE_ID_100_CREDITS=price_...
STRIPE_PRICE_ID_500_CREDITS=price_...
STRIPE_PRICE_ID_1000_CREDITS=price_...
STRIPE_PRICE_ID_5000_CREDITS=price_...

# App
APP_URL=https://www.codedswitch.com
```

---

## 🧪 **TESTING CHECKLIST**

### **Auth Testing:**
- [ ] Register new user
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (should fail)
- [ ] Logout
- [ ] Protected routes work
- [ ] Session persists across page refresh
- [ ] Owner login works

### **Stripe Testing:**
- [ ] Create checkout session
- [ ] Complete payment (test mode)
- [ ] Webhook receives event
- [ ] User tier updated to pro
- [ ] Subscription shows in dashboard
- [ ] Cancel subscription
- [ ] Reactivate subscription

### **Credit Testing:**
- [ ] New user has 10 credits
- [ ] Credit deduction works
- [ ] Insufficient credits blocked
- [ ] Credit purchase works
- [ ] Credit history logs
- [ ] Pro users get monthly credits
- [ ] Monthly reset works

---

## 💡 **RECOMMENDED PRICING STRATEGY**

### **Free Tier:**
- 10 credits on signup
- All features available
- Pay-as-you-go with credit purchases
- Perfect for trying the platform

### **Pro Subscription: $29.99/month**
- 1000 credits/month (auto-renew)
- ~100 song generations
- Priority AI processing
- Advanced analytics
- Save $150/month vs buying credits

### **Enterprise: Custom**
- Unlimited credits
- White-label option
- API access
- Dedicated support

---

## 🎯 **SUCCESS METRICS**

After implementation, you should have:

✅ **100% working auth system**
- Secure sessions
- Rate limiting
- Password hashing
- Protected routes

✅ **100% working payment system**
- Stripe checkout
- Webhook handling
- Subscription management
- Invoice generation

✅ **100% working credit system**
- Credit balance tracking
- Automatic deduction
- Purchase flow
- Usage history
- Monthly resets

✅ **Monetization ready**
- Can accept payments
- Can track usage
- Can manage subscriptions
- Can generate revenue

---

## ⏱️ **TOTAL TIME ESTIMATE**

| Phase | Time |
|-------|------|
| Credit System | 2-3 hours |
| Stripe Frontend | 1-2 hours |
| Security Hardening | 1 hour |
| Testing | 1 hour |
| **Total** | **5-7 hours** |

---

## 🎯 **IMMEDIATE NEXT STEPS**

**I recommend this order:**

1. ⭐ **Build Credit System** (highest ROI)
2. ⭐ **Add Stripe Frontend** (enable payments)
3. ⭐ **Security Hardening** (protect users)
4. ⭐ **Testing** (ensure it works)

**Each step is independent, so we can tackle them one at a time!**

---

**Ready to implement? Which part should we start with?**

1. 💳 **Credit System** - Full implementation with deduction, tracking, and purchase
2. 🛒 **Stripe Frontend** - Checkout, billing dashboard, credit purchase
3. 🔐 **Security** - Rate limiting, CSRF, session hardening
4. 📧 **Email System** - Verification, password reset

**Your choice!** 🚀
