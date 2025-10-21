// Test DATABASE_URL connection
require('dotenv').config();
const { Client } = require('pg');

console.log('🔍 Testing DATABASE_URL...');
console.log('DATABASE_URL exists?', !!process.env.DATABASE_URL);
console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway.app') 
    ? { rejectUnauthorized: false } 
    : false
});

async function testConnection() {
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query test passed:', result.rows[0]);
    
    await client.end();
    console.log('✅ Connection closed cleanly');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
