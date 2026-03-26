import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.WEBEAR_BASE_URL || 'http://localhost:4001';

const mcpServer = spawn('node', [path.join(__dirname, 'dist/index.js')], {
  env: { ...process.env, WEBEAR_BASE_URL: baseUrl },
  stdio: ['pipe', 'pipe', 'pipe']
});

function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const req = { jsonrpc: "2.0", id, method, params };
    
    let buffer = '';
    const listener = (data) => {
      buffer += data.toString();
      const messages = buffer.split('\n');
      buffer = messages.pop() || '';
      for (const msg of messages) {
        if (!msg.trim()) continue;
        try {
          const parsed = JSON.parse(msg);
          if (parsed.id === id) {
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
  await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1" }
  });
  await sendRequest("notifications/initialized", {});

  try {
      console.log("Analyzing audio...");
      const analyzeRes = await sendRequest("tools/call", {
          name: "analyze_audio",
          arguments: { capture_id: "573dd24a-2724-40f3-8262-231a6904335d" }
      });
      console.log('Analyze Result:', JSON.stringify(analyzeRes, null, 2));
  } catch(e) { console.error('Analyze error', e) }
  
  try {
      console.log("\\nDescribing audio...");
      const describeRes = await sendRequest("tools/call", {
          name: "describe_audio",
          arguments: { capture_id: "573dd24a-2724-40f3-8262-231a6904335d" }
      });
      console.log('Describe Result:', JSON.stringify(describeRes, null, 2));
  } catch(e) { console.error('Describe error', e) }

  mcpServer.kill();
  process.exit(0);
}
run();
