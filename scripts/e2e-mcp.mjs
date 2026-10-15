import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const toolArgs = JSON.parse(args[0] ?? '{}');
const toolName = args[1] ?? 'trendyol_search_products';

const child = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
let nextId = 0;
const pending = new Map();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  }
});

function request(method, params) {
  const id = ++nextId;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 120000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}
const notify = (method, params) =>
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

try {
  await request('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'e2e', version: '0.0.0' },
  });
  notify('notifications/initialized', {});

  console.log(`calling ${toolName} with`, JSON.stringify(toolArgs));
  const response = await request('tools/call', { name: toolName, arguments: toolArgs });
  if (response.error) {
    console.error('RPC error:', JSON.stringify(response.error));
    process.exitCode = 1;
  } else {
    const result = response.result;
    console.log('isError:', result.isError ?? false);
    const textPart = (result.content ?? []).find((c) => c.type === 'text');
    if (textPart) {
      try {
        console.log(JSON.stringify(JSON.parse(textPart.text), null, 2));
      } catch {
        console.log(textPart.text);
      }
    }
  }
} catch (error) {
  console.error('e2e failed:', error.message);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
