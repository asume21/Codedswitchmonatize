import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.WEBEAR_BASE_URL || 'http://localhost:4001';

const mcpServer = spawn('node', [path.join(__dirname, 'dist/index.js')], {
  env: { ...process.env, WEBEAR_BASE_URL: baseUrl },
  stdio: ['pipe', 'pipe', 'pipe']
});

mcpServer.stderr.on('data', data => console.error(`[MCP STDERR]: ${data}`));

function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const id = Date.now();
    const req = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    
    let buffer = '';
    const listener = (data) => {
      buffer += data.toString();
      const messages = buffer.split('\n');
      buffer = messages.pop() || ''; // Keep incomplete part
      
      for (const msg of messages) {
        if (!msg.trim()) continue;
        try {
          const parsed = JSON.parse(msg);
          if (parsed.id === id || parsed.result) {
            mcpServer.stdout.removeListener('data', listener);
            resolve(parsed);
          }
        } catch(e) {}
      }
    };
    mcpServer.stdout.on('data', listener);
    mcpServer.stdin.write(JSON.stringify(req) + '\n');
  });
}

async function run() {
  console.log(`Initializing MCP connected to ${baseUrl}...`);
  const initRes = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
  });
  console.log('Initialize Result:', JSON.stringify(initRes, null, 2));
  await sendRequest("notifications/initialized", {});

  console.log('\\nCalling capture_audio (3 seconds)...');
  const captureRes = await sendRequest("tools/call", {
      name: "capture_audio",
      arguments: { duration_ms: 3000 }
  });
  
  console.log('Capture Result:', JSON.stringify(captureRes, null, 2));

  if (captureRes.result?.content?.[0]?.text) {
      const text = captureRes.result.content[0].text;
      const match = text.match(/ID:\\s*([a-zA-Z0-9-]+)/);
      if (match) {
          const capId = match[1];
          console.log(`\\nCalling analyze_audio on Capture ID: ${capId} ...`);
          const analyzeRes = await sendRequest("tools/call", {
              name: "analyze_audio",
              arguments: { capture_id: capId }
          });
          console.log('Analyze Result:', JSON.stringify(analyzeRes, null, 2));
          
          // Also call describe_audio if desired, but we'll stick to analyze for now to avoid needing API keys here.
      } else {
          console.log('Could not extract capture ID');
      }
  }

  mcpServer.kill();
  process.exit(0);
}
run();
