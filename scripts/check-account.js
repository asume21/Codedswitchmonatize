import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkAccount() {
  try {
    const account = await stripe.accounts.retrieve();
    console.log('\n📊 Stripe Account Info:');
    console.log('Account ID:', account.id);
    console.log('Email:', account.email || 'N/A');
    console.log('Business Name:', account.business_profile?.name || 'N/A');
    console.log('Country:', account.country);
    console.log('\n✅ This is the account your products are in!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAccount();
