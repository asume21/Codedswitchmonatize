#!/usr/bin/env node

/**
 * Environment Setup Script for CodedSwitch
 * This script helps configure all required environment variables
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE = path.join(__dirname, '..', '.env.example');

// Required environment variables with descriptions
const ENV_VARS = {
  // Core Application
  'NODE_ENV': {
    description: 'Environment (development/production)',
    default: 'development',
    required: true
  },
  'PORT': {
    description: 'Server port',
    default: '5000',
    required: true
  },
  'SESSION_SECRET': {
    description: 'Secret for session encryption',
    default: 'your-session-secret-here',
    required: true
  },
  'OWNER_KEY': {
    description: 'Owner authentication key',
    default: 'owner-key-12345',
    required: true
  },
  'OWNER_EMAIL': {
    description: 'Owner email for infinite credits',
    default: '',
    required: false
  },
  'APP_URL': {
    description: 'Application URL',
    default: 'http://localhost:5000',
    required: true
  },

  // AI Services
  'REPLICATE_API_TOKEN': {
    description: 'Replicate API token for music generation',
    default: '',
    required: true
  },
  'XAI_API_KEY': {
    description: 'XAI (Grok) API key for lyrics and analysis',
    default: '',
    required: true
  },
  'OPENAI_API_KEY': {
    description: 'OpenAI API key (optional)',
    default: '',
    required: false
  },

  // Stripe Payment System
  'STRIPE_SECRET_KEY': {
    description: 'Stripe secret key',
    default: '',
    required: true
  },
  'VITE_STRIPE_PUBLIC_KEY': {
    description: 'Stripe public key (client-side)',
    default: '',
    required: true
  },
  'STRIPE_WEBHOOK_SECRET': {
    description: 'Stripe webhook secret',
    default: '',
    required: true
  },

  // Credit Packages (One-time purchases)
  'STRIPE_PRICE_ID_100_CREDITS': {
    description: 'Stripe price ID for 100 credits',
    default: '',
    required: true
  },
  'STRIPE_PRICE_ID_500_CREDITS': {
    description: 'Stripe price ID for 500 credits',
    default: '',
    required: true
  },
  'STRIPE_PRICE_ID_1000_CREDITS': {
    description: 'Stripe price ID for 1000 credits',
    default: '',
    required: true
  },
  'STRIPE_PRICE_ID_5000_CREDITS': {
    description: 'Stripe price ID for 5000 credits',
    default: '',
    required: true
  },

  // Memberships (Subscriptions)
  'STRIPE_PRICE_ID_CREATOR': {
    description: 'Stripe price ID for Creator membership',
    default: '',
    required: true
  },
  'STRIPE_PRICE_ID_PRO_MEMBERSHIP': {
    description: 'Stripe price ID for Pro membership',
    default: '',
    required: true
  },
  'STRIPE_PRICE_ID_STUDIO': {
    description: 'Stripe price ID for Studio membership',
    default: '',
    required: true
  },

  // Database (Optional)
  'DATABASE_URL': {
    description: 'PostgreSQL database URL',
    default: '',
    required: false
  },

  // Analytics (Optional)
  'VITE_GA_MEASUREMENT_ID': {
    description: 'Google Analytics measurement ID',
    default: '',
    required: false
  }
};

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function generateSecureKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function setupEnvironment() {
  console.log('🚀 CodedSwitch Environment Setup\n');
  console.log('This script will help you configure all required environment variables.\n');

  // Check if .env file exists
  let existingEnv = {};
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    existingEnv = envContent.split('\n').reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        acc[key] = valueParts.join('=');
      }
      return acc;
    }, {});
    console.log('✅ Found existing .env file\n');
  }

  console.log('📝 Configure Environment Variables:\n');

  const newEnv = {};

  for (const [key, config] of Object.entries(ENV_VARS)) {
    const existingValue = existingEnv[key] || config.default;
    let value = existingValue;

    if (config.required && !existingValue) {
      if (key.includes('SECRET') || key.includes('KEY')) {
        console.log(`\n🔐 ${key}: ${config.description}`);
        const useGenerated = await question('Generate secure key automatically? (Y/n): ');
        if (useGenerated.toLowerCase() === 'y' || useGenerated.toLowerCase() === 'yes' || useGenerated === '') {
          value = generateSecureKey();
          console.log(`Generated: ${value}\n`);
        } else {
          value = await question(`Enter ${key}: `);
        }
      } else if (key.includes('STRIPE')) {
        console.log(`\n💳 ${key}: ${config.description}`);
        console.log('💡 Get this from your Stripe Dashboard');
        value = await question(`Enter ${key}: `);
      } else {
        console.log(`\n⚙️ ${key}: ${config.description}`);
        value = await question(`Enter ${key} (default: ${config.default}): `) || config.default;
      }
    } else if (existingValue) {
      console.log(`✅ ${key}: Already configured (${existingValue.substring(0, 20)}${existingValue.length > 20 ? '...' : ''})`);
      const change = await question('Change this value? (y/N): ');
      if (change.toLowerCase() === 'y' || change.toLowerCase() === 'yes') {
        if (key.includes('SECRET') || key.includes('KEY')) {
          value = await question(`Enter new ${key}: `);
        } else {
          value = await question(`Enter new ${key} (current: ${existingValue}): `) || existingValue;
        }
      }
    }

    newEnv[key] = value;
  }

  // Write .env file
  const envContent = Object.entries(newEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`\n✅ Environment variables saved to ${ENV_FILE}`);

  // Create .env.example if it doesn't exist
  if (!fs.existsSync(ENV_EXAMPLE)) {
    const exampleContent = Object.entries(ENV_VARS)
      .map(([key, config]) => {
        const comment = `# ${config.description}${config.required ? ' (Required)' : ' (Optional)'}`;
        return `${comment}\n${key}=${config.default}`;
      })
      .join('\n\n');
    
    fs.writeFileSync(ENV_EXAMPLE, exampleContent);
    console.log(`✅ Created ${ENV_EXAMPLE}`);
  }

  console.log('\n🎉 Setup Complete!\n');
  console.log('Next steps:');
  console.log('1. Review the generated .env file');
  console.log('2. Set up Stripe products using: npm run setup-stripe-products');
  console.log('3. Start the application: npm run dev');
  console.log('4. Test the payment flow at http://localhost:5000/buy-credits');

  rl.close();
}

// Run the setup
setupEnvironment().catch(console.error);
