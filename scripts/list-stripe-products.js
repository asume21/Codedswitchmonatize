/**
 * List all Stripe products
 * Run with: node scripts/list-stripe-products.js
 */

import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

async function listProducts() {
  console.log('🔍 Fetching all products from Stripe...\n');
  
  try {
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    });
    
    console.log(`📦 Total Active Products: ${products.data.length}\n`);
    
    if (products.data.length === 0) {
      console.log('❌ No products found! Run setup-stripe-products.js to create them.\n');
      return;
    }
    
    for (const product of products.data) {
      console.log(`\n📦 ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Description: ${product.description || 'N/A'}`);
      console.log(`   Created: ${new Date(product.created * 1000).toLocaleString()}`);
      
      // Get prices for this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });
      
      if (prices.data.length > 0) {
        prices.data.forEach(price => {
          const amount = (price.unit_amount / 100).toFixed(2);
          const recurring = price.recurring ? ` (${price.recurring.interval}ly)` : ' (one-time)';
          console.log(`   💰 Price: $${amount} ${price.currency.toUpperCase()}${recurring}`);
          console.log(`   💳 Price ID: ${price.id}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ View in dashboard: https://dashboard.stripe.com/test/products\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listProducts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
