# 🎯 **STRIPE PRODUCTS TO CREATE**

## 📋 **COMPLETE CHECKLIST**

Go to: https://dashboard.stripe.com/products

**Make sure you're in LIVE mode** (toggle in top right)

---

## 🔄 **RECURRING SUBSCRIPTIONS (3 products)**

### **1. CodedSwitch Creator** ⭐
```
Product Information:
  Name: CodedSwitch Creator
  Description: 200 monthly credits with rollover. Perfect for regular creators.
  
Pricing:
  ☑ Recurring
  Billing period: Monthly
  Price: $9.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH CREATOR
  
Features to highlight:
  - 200 credits per month
  - Credits rollover up to 400
  - Priority support
  - No ads
  - Early access to features
  - Premium templates
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_CREATOR=price_xxxxx`

---

### **2. CodedSwitch Pro** 🚀
```
Product Information:
  Name: CodedSwitch Pro
  Description: 750 monthly credits with rollover. For professional musicians and producers.
  
Pricing:
  ☑ Recurring
  Billing period: Monthly
  Price: $29.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH PRO
  
Features to highlight:
  - 750 credits per month
  - Credits rollover up to 1500
  - Priority queue
  - Advanced analytics
  - Commercial license
  - API access
  - Advanced AI models
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_PRO_MEMBERSHIP=price_xxxxx`

---

### **3. CodedSwitch Studio** 💼
```
Product Information:
  Name: CodedSwitch Studio
  Description: 2500 monthly credits with rollover. Enterprise solution for studios and teams.
  
Pricing:
  ☑ Recurring
  Billing period: Monthly
  Price: $79.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH STUDIO
  
Features to highlight:
  - 2500 credits per month
  - Credits rollover up to 5000
  - Team collaboration (5 seats)
  - White-label branding
  - Dedicated support
  - Custom integrations
  - Phone support
  - Training sessions
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_STUDIO=price_xxxxx`

---

## 💰 **ONE-TIME CREDIT PACKS (4 products)**

### **4. 100 Credits - Starter Pack**
```
Product Information:
  Name: 100 Credits - Starter Pack
  Description: 100 credits for CodedSwitch AI features. Try before you subscribe!
  
Pricing:
  ☑ One time
  Price: $4.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH 100CR
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_100_CREDITS=price_xxxxx`

---

### **5. 500 Credits - Popular Pack** 🔥
```
Product Information:
  Name: 500 Credits - Popular Pack
  Description: 500 credits for CodedSwitch AI features. Save 20%!
  
Pricing:
  ☑ One time
  Price: $19.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH 500CR
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_500_CREDITS=price_xxxxx`

---

### **6. 1000 Credits - Pro Pack** 💎
```
Product Information:
  Name: 1000 Credits - Pro Pack
  Description: 1000 credits for CodedSwitch AI features. Save 30%!
  
Pricing:
  ☑ One time
  Price: $34.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH 1000CR
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_1000_CREDITS=price_xxxxx`

---

### **7. 5000 Credits - Enterprise Pack** 🏢
```
Product Information:
  Name: 5000 Credits - Enterprise Pack
  Description: 5000 credits for CodedSwitch AI features. Save 40%!
  
Pricing:
  ☑ One time
  Price: $149.99 USD
  
Advanced options:
  Statement descriptor: CODEDSWITCH 5000CR
```

**After saving, copy the Price ID:** `price_xxxxx`  
**Add to .env as:** `STRIPE_PRICE_ID_5000_CREDITS=price_xxxxx`

---

## 📝 **SUMMARY: 7 PRODUCTS TOTAL**

### **Recurring Subscriptions (3):**
1. ✅ Creator - $9.99/month → 200 credits/month
2. ✅ Pro - $29.99/month → 750 credits/month
3. ✅ Studio - $79.99/month → 2500 credits/month

### **One-Time Purchases (4):**
4. ✅ Starter - $4.99 → 100 credits
5. ✅ Popular - $19.99 → 500 credits
6. ✅ Pro - $34.99 → 1000 credits
7. ✅ Enterprise - $149.99 → 5000 credits

---

## 🔧 **AFTER CREATING ALL PRODUCTS**

### **Update your .env file with these 7 price IDs:**

```env
# Membership Subscriptions (Recurring)
STRIPE_PRICE_ID_CREATOR=price_xxxxx
STRIPE_PRICE_ID_PRO_MEMBERSHIP=price_xxxxx
STRIPE_PRICE_ID_STUDIO=price_xxxxx

# One-Time Credit Packs
STRIPE_PRICE_ID_100_CREDITS=price_xxxxx
STRIPE_PRICE_ID_500_CREDITS=price_xxxxx
STRIPE_PRICE_ID_1000_CREDITS=price_xxxxx
STRIPE_PRICE_ID_5000_CREDITS=price_xxxxx
```

---

## ✅ **VERIFICATION CHECKLIST**

After creating all products:

- [ ] All 7 products created in Stripe Dashboard
- [ ] All 7 price IDs copied
- [ ] All 7 price IDs added to .env file
- [ ] Webhook configured for `checkout.session.completed`
- [ ] Webhook secret in .env: `STRIPE_WEBHOOK_SECRET`
- [ ] Test mode products created (optional, for testing)
- [ ] Live mode products created (for production)

---

## 🧪 **TESTING CHECKLIST**

Before going live:

- [ ] Test Creator subscription checkout
- [ ] Test Pro subscription checkout
- [ ] Test Studio subscription checkout
- [ ] Test 100 credits purchase
- [ ] Test 500 credits purchase
- [ ] Test 1000 credits purchase
- [ ] Test 5000 credits purchase
- [ ] Verify webhook receives events
- [ ] Verify credits are added to user account
- [ ] Verify transaction is logged in database
- [ ] Test subscription cancellation
- [ ] Test credit rollover logic

---

## 💰 **REVENUE POTENTIAL**

### **If you get 100 paying customers:**

**Subscriptions (70 users):**
```
30 Creator × $9.99 = $299.70/month
30 Pro × $29.99 = $899.70/month
10 Studio × $79.99 = $799.90/month
────────────────────────────────
Subtotal: $1,999.30/month
Annual: $23,991.60
```

**One-Time Purchases (30 users/month):**
```
10 × $4.99 = $49.90
10 × $19.99 = $199.90
5 × $34.99 = $174.95
5 × $149.99 = $749.95
────────────────────────────────
Subtotal: $1,174.70/month
Annual: $14,096.40
```

**Total Revenue:**
```
Monthly: $3,174/month
Annual: $38,088/year
```

**With 500 customers:**
```
Monthly: $15,870/month
Annual: $190,440/year
```

**With 1000 customers:**
```
Monthly: $31,740/month
Annual: $380,880/year
```

---

## 🎯 **NEXT STEPS**

1. **Create all 7 products in Stripe** (30 minutes)
2. **Copy all 7 price IDs**
3. **Update .env file**
4. **Restart your server**
5. **Test with Stripe test cards**
6. **Build frontend UI** (next task)
7. **Go live!** 🚀

---

## 📞 **NEED HELP?**

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Docs: https://stripe.com/docs
- Test Cards: https://stripe.com/docs/testing

---

**Ready to create these products? Let me know when you have the price IDs!** 🎉
