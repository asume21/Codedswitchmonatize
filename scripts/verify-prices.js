import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const priceIds = {
  'STUDIO': process.env.STRIPE_PRICE_ID_STUDIO,
  'CREATOR': process.env.STRIPE_PRICE_ID_CREATOR,
  'PRO_MEMBERSHIP': process.env.STRIPE_PRICE_ID_PRO_MEMBERSHIP,
  '100_CREDITS': process.env.STRIPE_PRICE_ID_100_CREDITS,
  '500_CREDITS': process.env.STRIPE_PRICE_ID_500_CREDITS,
  '1000_CREDITS': process.env.STRIPE_PRICE_ID_1000_CREDITS,
  '5000_CREDITS': process.env.STRIPE_PRICE_ID_5000_CREDITS,
};

async function verifyPrices() {
  console.log('\n🔍 Verifying Stripe Price IDs from .env...\n');
  
  for (const [name, priceId] of Object.entries(priceIds)) {
    if (!priceId) {
      console.log(`❌ ${name}: NOT SET in .env`);
      continue;
    }
    
    try {
      const price = await stripe.prices.retrieve(priceId);
      const product = await stripe.products.retrieve(price.product);
      
      console.log(`✅ ${name}:`);
      console.log(`   Price ID: ${priceId}`);
      console.log(`   Product: ${product.name}`);
      console.log(`   Amount: $${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`);
      console.log(`   Type: ${price.type}`);
      console.log('');
    } catch (error) {
      console.log(`❌ ${name}: INVALID - ${error.message}`);
      console.log(`   Price ID: ${priceId}`);
      console.log('');
    }
  }
  
  console.log('\n💡 If any prices are INVALID, you need to create them in Stripe Dashboard or use the create-products script.\n');
}

verifyPrices();
