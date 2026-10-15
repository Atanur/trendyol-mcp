// Uçtan uca: instructions, araç listesi ve onboarding akışı. Gerçek veriye ASLA dokunmaz:
// veri dizini her çalıştırmada geçici bir klasöre yönlendirilir.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'trendyol-mcp-e2e-'));
const child = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, TRENDYOL_DATA_DIR: dataDir },
});

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
    try {
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    } catch {
      /* log satırı */
    }
  }
});

function request(method, params) {
  const id = ++nextId;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}

async function call(name, args = {}) {
  const res = await request('tools/call', { name, arguments: args });
  assert.ok(!res.error, `${name}: ${JSON.stringify(res.error)}`);
  const text = res.result.content[0].text;
  let json;
  if (!res.result.isError) {
    try {
      json = JSON.parse(text);
    } catch {
      /* düz metin yanıt (ör. browser_close) */
    }
  }
  return { isError: Boolean(res.result.isError), json, text };
}

let failed = false;
try {
  const init = await request('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'e2e-onboarding', version: '0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const instructions = init.result?.instructions ?? '';
  assert.match(instructions, /profile_status/, 'instructions profile_status içermeli');
  console.log('ok  instructions geldi (' + instructions.length + ' karakter)');

  const tools = (await request('tools/list', {})).result.tools.map((t) => t.name);
  for (const name of ['profile_status', 'onboarding_next', 'profile_import', 'taste_signals', 'profile_set', 'profile_get', 'session_resume', 'browser_close']) {
    assert.ok(tools.includes(name), `araç eksik: ${name}`);
  }
  console.log('ok  araçlar listede');

  let status = (await call('profile_status')).json;
  assert.equal(status.onboarded, false);
  assert.ok(status.siradakiSorular.length > 0);
  console.log('ok  yeni kullanıcı: onboarded=false, ' + status.eksikZorunlu.length + ' zorunlu eksik');

  const gap = (await call('generate_gap_list')).json;
  assert.ok(gap.varsayilanKullanilan?.includes('butce'), 'varsayılan kullanıldı bildirilmeli');
  console.log('ok  generate_gap_list varsayılan kullanımını bildiriyor');

  const step = (await call('onboarding_next', { cevaplar: { 'beden.alt': '32/32', butce: '30.000', 'palet.baz': 'lacivert, gri' } })).json;
  assert.deepEqual(step.uygulanan.sort(), ['beden.alt', 'butce', 'palet.baz']);
  assert.equal(step.reddedilen.length, 0);
  console.log('ok  onboarding_next cevapları kaydetti');

  const bad = (await call('onboarding_next', { cevaplar: { butce: 'çok', yok: 1 } })).json;
  assert.equal(bad.uygulanan.length, 0);
  assert.equal(bad.reddedilen.length, 2);
  console.log('ok  geçersiz cevaplar reddedildi');

  const rest = (
    await call('onboarding_next', {
      cevaplar: {
        'amac.neden': 'kasım indirimi',
        'yasam.sehir': 'İstanbul',
        'yasam.haftalik': { gunluk: 3, ozel: 2 },
        'beden.ust': 'L',
        'kalip.sevilen': ['regular', 'relaxed'],
      },
    })
  ).json;
  assert.equal(rest.onboarded, true);
  console.log('ok  zorunlular tamamlanınca onboarded=true');

  const imp = (await call('profile_import', { zevk: [{ ad: 'Test polo', tepki: 'begendim', etiketler: ['sade'], kategori: 'polo' }] })).json;
  assert.equal(imp.kaydedilenZevk, 1);
  const taste = (await call('taste_signals', { action: 'summary' })).json;
  assert.equal(taste.toplam.begendim, 1);
  console.log('ok  zevk içe aktarma ve özet');

  const need = (await call('need_start', { istek: 'hem iş yerinde hem akşam arkadaşlarımla giyebileceğim rahat bir pantolon, kot olabilir' })).json;
  assert.equal(need.ihtiyac.rol, 'alt');
  assert.ok(need.ihtiyac.vesile.includes('is') && need.ihtiyac.vesile.includes('ozel'));
  assert.equal(need.kisitlar.beden, '32/32');
  assert.ok(need.dolapSorusu, 'dolap boşken dolap sorusu gelmeli');
  console.log('ok  need_start: ihtiyaç, kısıtlar ve dolap sorusu');

  const added = (
    await call('wardrobe_quick_add', {
      satirlar: ['lacivert kot pantolon 32/32', '2 adet beyaz tişört L', 'bir şey'],
      ihtiyac_id: need.ihtiyac.id,
    })
  ).json;
  assert.equal(added.eklenen, 3);
  assert.equal(added.reddedilen.length, 1);
  console.log('ok  wardrobe_quick_add: 3 parça eklendi, 1 satır reddedildi');

  const upd = (await call('need_update', { id: need.ihtiyac.id, durum: 'karar' })).json;
  assert.equal(upd.ihtiyac.durum, 'karar');
  assert.deepEqual(upd.eksik, []);
  const listed = (await call('need_list', { durum: 'karar' })).json;
  assert.equal(listed.toplam, 1);
  console.log('ok  need_update ve need_list');

  const withCandidates = (
    await call('need_update', {
      id: need.ihtiyac.id,
      aday_ekle: [
        { ad: 'HLT Siyah Jean', url: 'https://example.test/a', fiyat: 1091, durum: 'secildi', not: 'tam kalıp' },
        { ad: 'AC&Co Lacivert Jean', url: 'https://example.test/b', fiyat: 1147 },
      ],
    })
  ).json;
  assert.equal(withCandidates.ihtiyac.adaylar.length, 2);
  assert.equal(withCandidates.tarayiciKapatildi, false, 'bitmemiş ihtiyaçta tarayıcı kapatılmamalı');

  const resume = (await call('session_resume')).json;
  assert.equal(resume.acik.length, 1);
  assert.match(resume.acik[0].sonrakiAdim, /HLT Siyah Jean/);
  console.log('ok  aday kaydı ve session_resume ("nerede kalmıştık")');

  const done = (await call('need_update', { id: need.ihtiyac.id, durum: 'alindi' })).json;
  assert.equal(done.tarayiciKapatildi, true, 'bitince tarayıcı kapatılmalı');
  assert.equal((await call('session_resume')).json.acik.length, 0);
  const closed = await call('browser_close');
  assert.match(closed.text, /kapat/i);
  console.log('ok  iş bitince tarayıcı kapanır, ihtiyaç açık listesinden düşer, browser_close çalışır');
} catch (error) {
  failed = true;
  console.error('BAŞARISIZ:', error.message);
} finally {
  child.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
