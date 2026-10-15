import { spawn } from 'node:child_process';

const category = process.argv[2] ?? 'offline';
const only = process.argv[3];

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

function request(method, params, timeoutMs = 150000) {
  const id = ++nextId;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

const ctx = {};
const P = 'https://www.trendyol.com/u-s-polo-assn/erkek-beyaz-uzun-kollu-basic-gomlek-50324708-vr013-p-1140342204';

const offline = [
  { name: 'profile_set', args: { hedef: { ust: 3, alt: 2, katman: 2, dis: 1, ayakkabi: 2 }, palet: { baz: ['siyah', 'beyaz', 'lacivert', 'gri'], aksan: ['bordo', 'haki'] }, kacinanlar: ['neon'], kurallar: { slimYok: true, sentetikDeriYok: true, baskiYok: true, maxPolyester: 50 }, butce: 30000, mekanMevsim: { is: { ilkbahar: 1, sonbahar: 1 }, spor: { yaz: 1 } } } },
  { name: 'profile_get', args: {} },
  { name: 'inventory_add', args: { items: [
    { ad: 'Lacivert Regular Fit Gömlek', kategori: 'Gömlek', renk: 'lacivert', kompozisyon: [{ material: 'Pamuk', percent: 100 }], sezon: ['ilkbahar', 'sonbahar'], formallik: 'resmi', mekan: ['is'], marka: 'Kiğılı', fiyat: 800 },
    { ad: 'Siyah Slim Fit Pantolon', kategori: 'Pantolon', renk: 'siyah', kompozisyon: [{ material: 'Polyester', percent: 70 }, { material: 'Elastan', percent: 30 }], kalip: 'Slim Fit', sezon: ['ilkbahar', 'sonbahar', 'kis'], formallik: 'smart', mekan: ['is', 'gunluk'], fiyat: 600 },
    { ad: 'Beyaz Basic Tişört', kategori: 'T-Shirt', renk: 'beyaz', kompozisyon: [{ material: 'Pamuk', percent: 100 }], sezon: ['yaz'], formallik: 'gunluk', mekan: ['gunluk'], fiyat: 200 },
  ] }, after: (r) => { ctx.itemId = r?.items?.[0]?.id; } },
  { name: 'inventory_list', args: {} },
  { name: 'inventory_update', args: () => ({ id: ctx.itemId, patch: { beden: 'L' } }) },
  { name: 'wear_log', args: () => ({ itemId: ctx.itemId, baglam: 'iş', memnuniyet: 5 }) },
  { name: 'brand_fit', args: { action: 'set', marka: 'Zara', beden: 'M', not: 'dar geldi' } },
  { name: 'brand_fit', args: { action: 'list' } },
  { name: 'donation_log', args: { action: 'add', ad: 'Eski kot ceket' } },
  { name: 'donation_log', args: { action: 'list' } },
  { name: 'post_purchase_update', args: { ad: 'Haki Chino Pantolon', kategori: 'Pantolon', renk: 'haki', fiyat: '750 TL', rol: 'alt' } },
  { name: 'return_tracker', args: { action: 'list' } },
  { name: 'generate_gap_list', args: {} },
  { name: 'check_against_profile', args: { ad: 'Siyah Slim Fit Polyester Pantolon', rol: 'alt', renk: 'siyah', kalip: 'Slim Fit', kompozisyon: [{ material: 'Polyester', percent: 70 }] } },
  { name: 'gap_match', args: { ad: 'Lacivert Gömlek', rol: 'ust', renk: 'lacivert' } },
  { name: 'color_match', args: { renk: 'bordo' } },
  { name: 'fabric_score', args: { kompozisyon: [{ material: 'Pamuk', percent: 95 }, { material: 'Elastan', percent: 5 }] } },
  { name: 'outfit_count', args: { candidate: { ad: 'Gri Gömlek', rol: 'ust', renk: 'gri' } } },
  { name: 'capsule_coverage', args: {} },
  { name: 'weak_link', args: {} },
  { name: 'travel_pack', args: { gun: 5, sezon: 'kis', mekan: 'is' } },
  { name: 'cost_per_wear', args: {} },
  { name: 'keep_or_go', args: {} },
  { name: 'one_in_one_out', args: { ad: 'Yeni Gömlek', rol: 'ust', renk: 'beyaz' } },
  { name: 'budget_basket', args: { lines: [{ ad: 'Gömlek', fiyat: '800 TL', rol: 'ust' }, { ad: 'Pantolon', fiyat: 600, rol: 'alt' }], budget: 30000 } },
  { name: 'shopping_order', args: {} },
  { name: 'impulse_guard', args: { candidate: { rol: 'ust', renk: 'beyaz', fiyat: 900 }, basket_total: 29500 } },
  { name: 'trendyol_cache_stats', args: {} },
  { name: 'trendyol_review_insights', args: { action: 'list' } },
  { name: 'trendyol_price_trend', args: {} },
];

const browser = [
  { name: 'browser_navigate', args: { url: 'https://example.com' } },
  { name: 'browser_snapshot', args: {} },
  { name: 'trendyol_home', args: {} },
  { name: 'trendyol_get_filter_options', args: { expand: false } },
  { name: 'trendyol_search_products', args: { gender: 'Erkek', filters: ['Gömlek'], sort: 'best_sellers', limit: 5, scroll_rounds: 0, with_insights: true } },
  { name: 'trendyol_get_products', args: { limit: 5 } },
  { name: 'trendyol_find', args: { description: 'lacivert erkek gömlek', limit: 4 } },
  { name: 'trendyol_product_detail', args: { url: P } },
  { name: 'trendyol_analyze_reviews', args: { url: P, limit: 20, scroll_rounds: 2 } },
  { name: 'trendyol_product_reviews', args: { url: P, limit: 10, scroll_rounds: 2 } },
  { name: 'trendyol_seller_check', args: { url: P } },
  { name: 'trendyol_find_similar', args: { url: P, limit: 5 } },
  { name: 'trendyol_fake_discount_check', args: { url: P } },
  { name: 'trendyol_watch_add', args: { url: P, label: 'beyaz gömlek', target_price: 650 } },
  { name: 'trendyol_watch_list', args: {} },
  { name: 'trendyol_watch_check', args: {} },
  { name: 'trendyol_watch_size_add', args: { url: P, size: 'M' } },
  { name: 'trendyol_size_stock_check', args: {} },
  { name: 'trendyol_size_watch_list', args: {} },
  { name: 'trendyol_shop_gap', args: { rol: 'katman', renk: 'lacivert', gender: 'Erkek', max_fiyat: 1500, limit: 4 } },
  { name: 'trendyol_import_to_wardrobe', args: { product: { url: P, title: 'Test Gömlek', price: '719,98 TL', brand: 'U.S. Polo Assn.' }, rol: 'ust', renk: 'beyaz', formallik: 'smart', persist: false } },
];

const extra = [
  { name: 'browser_navigate', args: { url: 'https://example.com' } },
  { name: 'browser_snapshot', args: {} },
  { name: 'browser_click', args: { text: 'Learn more' } },
  { name: 'browser_history', args: { action: 'back' } },
  { name: 'browser_press', args: { key: 'Escape' } },
  { name: 'browser_scroll', args: { direction: 'down', amount: 500 } },
  { name: 'browser_wait', args: { ms: 200 } },
  { name: 'browser_screenshot', args: {} },
  { name: 'browser_list_tabs', args: {} },
  { name: 'browser_switch_tab', args: { index: 0 } },
  { name: 'trendyol_compare_products', args: { urls: [P, 'https://www.trendyol.com/u-s-polo-assn/erkek-siyah-uzun-kollu-basic-gomlek-50324708-vr046-p-1140342209'] } },
  { name: 'inventory_list', args: {}, after: (r) => { ctx.anyItemId = r?.items?.[0]?.id; } },
  { name: 'inventory_remove', args: () => ({ id: ctx.anyItemId }) },
  { name: 'trendyol_watch_remove', args: { id_or_url: P } },
  { name: 'trendyol_cache_clear', args: {} },
  { name: 'trendyol_add_to_cart', args: { url: P, size: 'M', confirm: true } },
  { name: 'browser_navigate', args: { url: 'https://www.wikipedia.org' } },
  { name: 'browser_type', args: { target: 'Search Wikipedia', text: 'gömlek', submit: false } },
  { name: 'trendyol_open_product', args: { url: P } },
];

const loginDependent = [
  { name: 'trendyol_cart_summary', args: {} },
  { name: 'trendyol_favorites', args: { action: 'list' } },
  { name: 'coupon_tracker', args: { source: 'cart' } },
  { name: 'review_photo_summary', args: { url: P, limit: 10 } },
];

const suites = { offline, browser, loginDependent, extra, all: [...offline, ...browser] };
const steps = suites[category] ?? offline;
const selected = only ? steps.filter((s) => s.name.includes(only)) : steps;

function snippet(result) {
  if (result?.isError) return `ERROR: ${(result.content?.[0]?.text ?? '').slice(0, 120)}`;
  const text = result?.content?.find?.((c) => c.type === 'text')?.text ?? '';
  try {
    const obj = JSON.parse(text);
    const keys = Object.keys(obj).slice(0, 6).join(',');
    return `ok {${keys}}`;
  } catch {
    return text.replace(/\s+/g, ' ').slice(0, 100);
  }
}

let pass = 0;
let fail = 0;
try {
  await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'tester', version: '0' } });
  notify('notifications/initialized', {});

  for (const step of selected) {
    const args = typeof step.args === 'function' ? step.args() : step.args;
    const started = Date.now();
    let line;
    try {
      const response = await request('tools/call', { name: step.name, arguments: args });
      const ms = Date.now() - started;
      if (response.error) {
        fail += 1;
        line = `FAIL  ${step.name.padEnd(30)} ${String(ms).padStart(6)}ms  RPC ${JSON.stringify(response.error).slice(0, 100)}`;
      } else {
        const result = response.result;
        if (result.isError) fail += 1;
        else pass += 1;
        line = `${result.isError ? 'FAIL ' : 'PASS '} ${step.name.padEnd(30)} ${String(ms).padStart(6)}ms  ${snippet(result)}`;
        if (!result.isError && step.after) step.after(JSON.parse(result.content.find((c) => c.type === 'text').text));
      }
    } catch (error) {
      fail += 1;
      line = `FAIL  ${step.name.padEnd(30)} ${'      '}   ${error.message}`;
    }
    console.log(line);
  }
} finally {
  console.log(`\n== ${category}: ${pass} passed, ${fail} failed ==`);
  child.kill('SIGTERM');
}
