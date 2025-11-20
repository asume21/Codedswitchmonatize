# 🔧 Stripe Setup Guide - Fix "NOT CONFIGURED" Error

## ❌ Current Error:
```
500 ERROR: Stripe price ID not configured for [PACKAGE_NAME]
```

## 🎯 Solution: Create Stripe Products & Prices

### **Step 1: Go to Stripe Dashboard**
1. Visit: https://dashboard.stripe.com/test/products
2. Make sure you're in **TEST MODE** (toggle in top right)

---

### **Step 2: Create Products for Credit Packages**

#### **Product 1: 100 Credits (STARTER)**
1. Click "Add Product"
2. **Name**: `100 Credits - Starter Pack`
3. **Description**: `100 credits for CodedSwitch`
4. **Pricing**:
   - Model: `One-time`
   - Price: `$4.99 USD`
5. Click "Save product"
6. **Copy the Price ID** (starts with `price_...`)
7. Add to `.env`: `STRIPE_PRICE_ID_100_CREDITS=price_xxxxx`

#### **Product 2: 500 Credits (POPULAR)**
1. Click "Add Product"
2. **Name**: `500 Credits - Popular Pack`
3. **Description**: `500 credits for CodedSwitch - Save 20%`
4. **Pricing**:
   - Model: `One-time`
   - Price: `$19.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_500_CREDITS=price_xxxxx`

#### **Product 3: 1000 Credits (PRO)**
1. Click "Add Product"
2. **Name**: `1000 Credits - Pro Pack`
3. **Description**: `1000 credits for CodedSwitch - Save 30%`
4. **Pricing**:
   - Model: `One-time`
   - Price: `$34.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_1000_CREDITS=price_xxxxx`

#### **Product 4: 5000 Credits (ENTERPRISE)**
1. Click "Add Product"
2. **Name**: `5000 Credits - Enterprise Pack`
3. **Description**: `5000 credits for CodedSwitch - Save 40%`
4. **Pricing**:
   - Model: `One-time`
   - Price: `$149.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_5000_CREDITS=price_xxxxx`

---

### **Step 3: Create Subscription Products**

#### **Product 5: Creator Membership**
1. Click "Add Product"
2. **Name**: `Creator Membership`
3. **Description**: `200 monthly credits with rollover`
4. **Pricing**:
   - Model: `Recurring`
   - Billing period: `Monthly`
   - Price: `$9.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_CREATOR=price_xxxxx`

#### **Product 6: Pro Membership**
1. Click "Add Product"
2. **Name**: `Pro Membership`
3. **Description**: `750 monthly credits with rollover`
4. **Pricing**:
   - Model: `Recurring`
   - Billing period: `Monthly`
   - Price: `$29.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_PRO_MEMBERSHIP=price_xxxxx`

#### **Product 7: Studio Membership**
1. Click "Add Product"
2. **Name**: `Studio Membership`
3. **Description**: `2500 monthly credits with rollover`
4. **Pricing**:
   - Model: `Recurring`
   - Billing period: `Monthly`
   - Price: `$79.99 USD`
5. Click "Save product"
6. **Copy the Price ID**
7. Add to `.env`: `STRIPE_PRICE_ID_STUDIO=price_xxxxx`

---

### **Step 4: Update .env File**

Your `.env` should have ALL these variables:

```env
# Stripe Configuration (EXAMPLE - Replace with your actual keys)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLIC_KEY_HERE

# Credit Packages (One-time purchases)
STRIPE_PRICE_ID_100_CREDITS=price_xxxxx    # Replace with actual price ID
STRIPE_PRICE_ID_500_CREDITS=price_xxxxx    # Replace with actual price ID
STRIPE_PRICE_ID_1000_CREDITS=price_xxxxx   # Replace with actual price ID
STRIPE_PRICE_ID_5000_CREDITS=price_xxxxx   # Replace with actual price ID

# Memberships (Subscriptions)
STRIPE_PRICE_ID_CREATOR=price_xxxxx        # Replace with actual price ID
STRIPE_PRICE_ID_PRO_MEMBERSHIP=price_xxxxx # Replace with actual price ID
STRIPE_PRICE_ID_STUDIO=price_xxxxx         # Replace with actual price ID

# Webhook (get from Stripe Dashboard → Developers → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx          # Replace with actual webhook secret
```

---

### **Step 5: Setup Webhook (Important!)**

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. **Endpoint URL**: `http://localhost:5000/api/webhooks/stripe` (for local testing)
   - For production: `https://yourdomain.com/api/webhooks/stripe`
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

---

### **Step 6: Restart Server**

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

---

## ✅ **Verification Checklist:**

- [ ] All 7 products created in Stripe Dashboard
- [ ] All 7 price IDs copied to `.env`
- [ ] Webhook endpoint created
- [ ] Webhook secret copied to `.env`
- [ ] Server restarted
- [ ] Test purchase on `/buy-credits` page

---

## 🧪 **Test the Purchase Flow:**

1. Go to `http://localhost:5000/buy-credits`
2. Click "Buy Now" on any package
3. Should redirect to Stripe checkout page
4. Use test card: `4242 4242 4242 4242`
5. Any future date for expiry
6. Any 3-digit CVC
7. Complete payment
8. Should redirect back to success page
9. Credits should be added to your account

---

## 🚨 **Common Issues:**

### **Issue 1: "NOT CONFIGURED" Error**
- **Cause**: Missing price ID in `.env`
- **Fix**: Create the product in Stripe and add price ID to `.env`

### **Issue 2: "Invalid API Key"**
- **Cause**: Wrong Stripe secret key
- **Fix**: Copy correct key from Stripe Dashboard → Developers → API keys

### **Issue 3: "Webhook signature verification failed"**
- **Cause**: Wrong webhook secret
- **Fix**: Copy correct secret from Stripe Dashboard → Developers → Webhooks

### **Issue 4: Credits not added after payment**
- **Cause**: Webhook not configured or not working
- **Fix**: Check webhook logs in Stripe Dashboard

---

## 📝 **Quick Reference:**

| Package | Credits | Price | Env Variable |
|---------|---------|-------|--------------|
| Starter | 100 | $4.99 | `STRIPE_PRICE_ID_100_CREDITS` |
| Popular | 500 | $19.99 | `STRIPE_PRICE_ID_500_CREDITS` |
| Pro | 1000 | $34.99 | `STRIPE_PRICE_ID_1000_CREDITS` |
| Enterprise | 5000 | $149.99 | `STRIPE_PRICE_ID_5000_CREDITS` |
| Creator | 200/mo | $9.99/mo | `STRIPE_PRICE_ID_CREATOR` |
| Pro Membership | 750/mo | $29.99/mo | `STRIPE_PRICE_ID_PRO_MEMBERSHIP` |
| Studio | 2500/mo | $79.99/mo | `STRIPE_PRICE_ID_STUDIO` |

---

## 🎉 **After Setup:**

Your purchase system will be fully functional! Users can:
- ✅ Buy credit packages (one-time)
- ✅ Subscribe to memberships (monthly)
- ✅ View credit balance
- ✅ See transaction history
- ✅ Automatic credit delivery via webhooks

**Need help? Check Stripe docs: https://stripe.com/docs**
