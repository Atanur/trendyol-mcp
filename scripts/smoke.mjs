import { spawn } from 'node:child_process';

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
      console.log('non-json line:', line.slice(0, 120));
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
  const payload = { jsonrpc: '2.0', id, method, params };
  child.stdin.write(JSON.stringify(payload) + '\n');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

try {
  const init = await request('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0.0.0' },
  });
  console.log('serverInfo:', JSON.stringify(init.result?.serverInfo));
  console.log('protocolVersion:', init.result?.protocolVersion);

  notify('notifications/initialized', {});

  const tools = await request('tools/list', {});
  const names = tools.result.tools.map((tool) => tool.name);
  console.log(`tools (${names.length}):`);
  for (const name of names) console.log('  -', name);

  const resources = await request('resources/list', {});
  console.log(`resources (${resources.result?.resources?.length ?? 0}):`);
  for (const resource of resources.result?.resources ?? []) {
    console.log('  -', resource.uri);
  }

  const prompts = await request('prompts/list', {});
  console.log(`prompts (${prompts.result?.prompts?.length ?? 0}):`);
  for (const prompt of prompts.result?.prompts ?? []) {
    console.log('  -', prompt.name);
  }

  const read = await request('resources/read', { uri: 'trendyol://watchlist' });
  const first = read.result?.contents?.[0];
  console.log('watchlist resource:', first ? first.text.slice(0, 200) : 'empty');

  const wardrobe = await request('resources/read', { uri: 'trendyol://wardrobe' });
  const wtext = wardrobe.result?.contents?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(wtext);
    console.log('wardrobe resource:', `itemCount=${parsed.itemCount} gaps=${parsed.gaps?.length} coverageEmpty=${parsed.coverageEmpty}`);
  } catch {
    console.log('wardrobe resource: (parse failed)');
  }

  const brain = await request('prompts/get', { name: 'trendyol_beyin', arguments: { istek: 'kalın kışlık gömlek arıyorum' } });
  const btext = brain.result?.messages?.[0]?.content?.text ?? '';
  console.log('brain prompt:', btext ? `OK (${btext.length} char) — ${btext.slice(0, 90).replace(/\n/g, ' ')}…` : '(yok)');
} catch (error) {
  console.error('smoke failed:', error.message);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
