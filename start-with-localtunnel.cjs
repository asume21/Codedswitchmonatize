const { spawn } = require('child_process');

// Start localtunnel to port 5000
console.log('🚀 Starting localtunnel for port 5000...');

const tunnel = spawn('npx', ['localtunnel', '--port', '5000'], {
  stdio: 'inherit',
  shell: true
});

// Wait a moment for spawn to complete
setTimeout(() => {
  if (tunnel && tunnel.stdout && tunnel.stderr) {
    tunnel.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // Look for public URL in localtunnel output
      if (output.includes('your url is:')) {
        const match = output.match(/https:\/\/[^ ]+/);
        if (match) {
          const publicUrl = match[0];
          console.log(`\n✅ Public URL: ${publicUrl}`);
          console.log(`\n🌐 Use this URL in browser: ${publicUrl}`);
          console.log(`\n📝 This URL will work for Replicate API`);
          console.log(`\n🎯 Test stem separation at: ${publicUrl}`);
        }
      }
    });

    tunnel.stderr.on('data', (data) => {
      console.error('Localtunnel error:', data.toString());
    });

    tunnel.on('close', (code) => {
      console.log(`Localtunnel process exited with code ${code}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down tunnel...');
      tunnel.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down tunnel...');
      tunnel.kill('SIGTERM');
      process.exit(0);
    });
  } else {
    console.error('❌ Failed to start tunnel process');
  }
}, 1000);
