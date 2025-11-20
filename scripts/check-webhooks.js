import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkWebhooks() {
  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    
    console.log(`\n✅ Found ${webhooks.data.length} webhook(s) in your Stripe account:\n`);
    
    if (webhooks.data.length === 0) {
      console.log('❌ No webhooks configured yet!');
      console.log('\nYou need to create a webhook endpoint in Stripe Dashboard:');
      console.log('https://dashboard.stripe.com/test/webhooks\n');
      return;
    }
    
    webhooks.data.forEach((wh, index) => {
      console.log(`--- Webhook ${index + 1} ---`);
      console.log(`ID: ${wh.id}`);
      console.log(`URL: ${wh.url}`);
      console.log(`Status: ${wh.status}`);
      console.log(`Secret: ${wh.secret ? wh.secret.substring(0, 25) + '...' : 'N/A'}`);
      console.log(`Events: ${wh.enabled_events.slice(0, 5).join(', ')}${wh.enabled_events.length > 5 ? '...' : ''}`);
      console.log('');
    });
    
    console.log('\n💡 Copy the "Secret" value above and add it to your .env file:');
    console.log('STRIPE_WEBHOOK_SECRET=whsec_...\n');
    
  } catch (error) {
    console.error('❌ Error checking webhooks:', error.message);
  }
}

checkWebhooks();
