/**
 * Archive old/duplicate Stripe products
 * Run with: node scripts/cleanup-old-products.js
 */

import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

// Products to keep (created today with proper names)
const KEEP_PRODUCTS = [
  '100 Credits - Starter Pack',
  '500 Credits - Popular Pack',
  '1000 Credits - Pro Pack',
  '5000 Credits - Enterprise Pack',
  'Creator Membership',
  'Pro Membership',
  'Studio Membership',
];

async function cleanupProducts() {
  console.log('🧹 Cleaning up old/duplicate Stripe products...\n');
  
  try {
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    });
    
    console.log(`📦 Total Active Products: ${products.data.length}\n`);
    
    let archivedCount = 0;
    
    for (const product of products.data) {
      // Keep products with proper names
      if (KEEP_PRODUCTS.includes(product.name)) {
        console.log(`✅ KEEPING: ${product.name}`);
        continue;
      }
      
      // Archive old products with weird names or duplicates
      console.log(`🗑️  ARCHIVING: ${product.name} (${product.id})`);
      
      await stripe.products.update(product.id, {
        active: false,
      });
      
      archivedCount++;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Cleanup Complete!`);
    console.log(`   Kept: ${KEEP_PRODUCTS.length} products`);
    console.log(`   Archived: ${archivedCount} old products`);
    console.log(`\n📊 View dashboard: https://dashboard.stripe.com/test/products\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupProducts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
