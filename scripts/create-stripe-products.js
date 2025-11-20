import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const products = [
  // One-time credit packs
  {
    name: '100 Credits - Starter Pack',
    description: '100 AI generation credits for music creation',
    amount: 499, // $4.99
    type: 'one_time',
    envKey: 'STRIPE_PRICE_ID_100_CREDITS'
  },
  {
    name: '500 Credits - Popular Pack',
    description: '500 AI generation credits - Save 20%',
    amount: 1999, // $19.99
    type: 'one_time',
    envKey: 'STRIPE_PRICE_ID_500_CREDITS'
  },
  {
    name: '1000 Credits - Pro Pack',
    description: '1000 AI generation credits - Save 30%',
    amount: 3499, // $34.99
    type: 'one_time',
    envKey: 'STRIPE_PRICE_ID_1000_CREDITS'
  },
  {
    name: '5000 Credits - Enterprise Pack',
    description: '5000 AI generation credits - Save 40%',
    amount: 14999, // $149.99
    type: 'one_time',
    envKey: 'STRIPE_PRICE_ID_5000_CREDITS'
  },
  
  // Monthly subscriptions
  {
    name: 'Creator Membership',
    description: '200 monthly credits with rollover - Perfect for hobbyists',
    amount: 999, // $9.99/month
    type: 'recurring',
    interval: 'month',
    envKey: 'STRIPE_PRICE_ID_CREATOR'
  },
  {
    name: 'Pro Membership',
    description: '750 monthly credits with rollover - Best for professionals',
    amount: 2999, // $29.99/month
    type: 'recurring',
    interval: 'month',
    envKey: 'STRIPE_PRICE_ID_PRO_MEMBERSHIP'
  },
  {
    name: 'Studio Membership',
    description: '2500 monthly credits with rollover - For teams and studios',
    amount: 7999, // $79.99/month
    type: 'recurring',
    interval: 'month',
    envKey: 'STRIPE_PRICE_ID_STUDIO'
  }
];

async function createProducts() {
  console.log('\n🚀 Creating Stripe Products and Prices...\n');
  
  const envUpdates = [];
  
  for (const productData of products) {
    try {
      // Create product
      const product = await stripe.products.create({
        name: productData.name,
        description: productData.description,
        active: true,
      });
      
      console.log(`✅ Created Product: ${product.name}`);
      console.log(`   Product ID: ${product.id}`);
      
      // Create price
      const priceConfig = {
        product: product.id,
        currency: 'usd',
        unit_amount: productData.amount,
      };
      
      if (productData.type === 'recurring') {
        priceConfig.recurring = { interval: productData.interval };
      }
      
      const price = await stripe.prices.create(priceConfig);
      
      console.log(`   Price ID: ${price.id}`);
      console.log(`   Amount: $${(price.unit_amount / 100).toFixed(2)}`);
      console.log(`   Type: ${productData.type}`);
      console.log('');
      
      envUpdates.push(`${productData.envKey}=${price.id}`);
      
    } catch (error) {
      console.error(`❌ Error creating ${productData.name}:`, error.message);
      console.log('');
    }
  }
  
  console.log('\n📝 Update your .env file with these new Price IDs:\n');
  console.log('─'.repeat(60));
  envUpdates.forEach(line => console.log(line));
  console.log('─'.repeat(60));
  console.log('\n✅ Done! Copy the above lines to your .env file.\n');
}

createProducts();
