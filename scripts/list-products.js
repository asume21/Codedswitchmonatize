import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function listProducts() {
  try {
    console.log('\n🔍 Fetching all products from your Stripe account...\n');
    
    const products = await stripe.products.list({ limit: 100 });
    
    console.log(`✅ Found ${products.data.length} total product(s):\n`);
    
    if (products.data.length === 0) {
      console.log('❌ No products found in your account!');
      return;
    }
    
    products.data.forEach((product, index) => {
      console.log(`--- Product ${index + 1} ---`);
      console.log(`ID: ${product.id}`);
      console.log(`Name: ${product.name}`);
      console.log(`Active: ${product.active ? '✅ Yes' : '❌ No'}`);
      console.log(`Created: ${new Date(product.created * 1000).toLocaleString()}`);
      console.log(`Description: ${product.description || 'N/A'}`);
      console.log('');
    });
    
    // Also list prices
    console.log('\n💰 Fetching all prices...\n');
    const prices = await stripe.prices.list({ limit: 100 });
    
    console.log(`✅ Found ${prices.data.length} price(s):\n`);
    
    prices.data.forEach((price, index) => {
      console.log(`--- Price ${index + 1} ---`);
      console.log(`ID: ${price.id}`);
      console.log(`Product: ${price.product}`);
      console.log(`Amount: $${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`);
      console.log(`Type: ${price.type}`);
      console.log(`Active: ${price.active ? '✅ Yes' : '❌ No'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listProducts();
