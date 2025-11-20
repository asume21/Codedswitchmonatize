/**
 * Stripe Product Setup Script
 * Automatically creates all credit packages and membership products
 * Run with: node scripts/setup-stripe-products.js
 */

import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

const products = [
  // Credit Packages (One-time purchases)
  {
    name: '100 Credits - Starter Pack',
    description: '100 credits for CodedSwitch music generation',
    type: 'one_time',
    price: 499, // $4.99
    envVar: 'STRIPE_PRICE_ID_100_CREDITS',
  },
  {
    name: '500 Credits - Popular Pack',
    description: '500 credits for CodedSwitch - Save 20%',
    type: 'one_time',
    price: 1999, // $19.99
    envVar: 'STRIPE_PRICE_ID_500_CREDITS',
  },
  {
    name: '1000 Credits - Pro Pack',
    description: '1000 credits for CodedSwitch - Save 30%',
    type: 'one_time',
    price: 3499, // $34.99
    envVar: 'STRIPE_PRICE_ID_1000_CREDITS',
  },
  {
    name: '5000 Credits - Enterprise Pack',
    description: '5000 credits for CodedSwitch - Save 40%',
    type: 'one_time',
    price: 14999, // $149.99
    envVar: 'STRIPE_PRICE_ID_5000_CREDITS',
  },
  
  // Membership Subscriptions
  {
    name: 'Creator Membership',
    description: '200 monthly credits with rollover for CodedSwitch',
    type: 'recurring',
    price: 999, // $9.99/month
    envVar: 'STRIPE_PRICE_ID_CREATOR',
  },
  {
    name: 'Pro Membership',
    description: '750 monthly credits with rollover for CodedSwitch',
    type: 'recurring',
    price: 2999, // $29.99/month
    envVar: 'STRIPE_PRICE_ID_PRO_MEMBERSHIP',
  },
  {
    name: 'Studio Membership',
    description: '2500 monthly credits with rollover for CodedSwitch',
    type: 'recurring',
    price: 7999, // $79.99/month
    envVar: 'STRIPE_PRICE_ID_STUDIO',
  },
];

async function createProducts() {
  console.log('🚀 Starting Stripe Product Creation...\n');
  
  const results = [];
  
  for (const productData of products) {
    try {
      console.log(`📦 Creating: ${productData.name}...`);
      
      // Create product
      const product = await stripe.products.create({
        name: productData.name,
        description: productData.description,
      });
      
      console.log(`   ✅ Product created: ${product.id}`);
      
      // Create price
      const priceConfig = {
        product: product.id,
        unit_amount: productData.price,
        currency: 'usd',
      };
      
      if (productData.type === 'recurring') {
        priceConfig.recurring = { interval: 'month' };
      }
      
      const price = await stripe.prices.create(priceConfig);
      
      console.log(`   💰 Price created: ${price.id}`);
      console.log(`   📝 Add to .env: ${productData.envVar}=${price.id}\n`);
      
      results.push({
        productName: productData.name,
        productId: product.id,
        priceId: price.id,
        envVar: productData.envVar,
      });
      
    } catch (error) {
      console.error(`   ❌ Error creating ${productData.name}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ SETUP COMPLETE! Copy these to your .env file:\n');
  console.log('# Credit Packages (One-time purchases)');
  
  results.forEach(result => {
    console.log(`${result.envVar}=${result.priceId}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Summary:');
  console.log(`   Total products created: ${results.length}`);
  console.log(`   View in Stripe: https://dashboard.stripe.com/test/products`);
  console.log('\n⚠️  IMPORTANT: Copy the price IDs above to your .env file and restart the server!\n');
}

// Run the script
createProducts()
  .then(() => {
    console.log('✨ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
