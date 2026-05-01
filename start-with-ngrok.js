const { spawn } = require('child_process');

// Start ngrok tunnel to port 5000
console.log('🚀 Starting ngrok tunnel for port 5000...');

const ngrok = spawn('npx', ['ngrok', 'http', '5000'], {
  stdio: 'inherit',
  shell: true
});

ngrok.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  // Look for public URL in ngrok output
  if (output.includes('Forwarding')) {
    const match = output.match(/https:\/\/[^ ]+/);
    if (match) {
      const publicUrl = match[0];
      console.log(`\n✅ Public URL: ${publicUrl}`);
      console.log(`\n📝 Update your .env file:`);
      console.log(`PUBLIC_URL=${publicUrl}`);
      console.log(`\n🌐 Use this URL in browser: ${publicUrl}`);
    }
  }
});

ngrok.stderr.on('data', (data) => {
  console.error('Ngrok error:', data.toString());
});

ngrok.on('close', (code) => {
  console.log(`Ngrok process exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down ngrok...');
  ngrok.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down ngrok...');
  ngrok.kill('SIGTERM');
  process.exit(0);
});
