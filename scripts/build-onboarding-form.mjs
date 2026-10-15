// onboarding/form.html dosyasını FIELDS kaydından üretir (tek doğruluk kaynağı).
// Kullanım: pnpm build && node scripts/build-onboarding-form.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FIELDS } from '../dist/wardrobe/profile.js';

const SECTION_TITLES = {
  amac: 'Amaç',
  yasam: 'Yaşam ve ortam',
  beden: 'Beden ve vücut',
  stil: 'Stil, kalıp ve renk',
  butce: 'Bütçe',
};
const MEKANLAR = [
  ['is', 'İş/okul'],
  ['gunluk', 'Günlük'],
  ['ozel', 'Sosyal/özel'],
  ['spor', 'Spor'],
  ['seyahat', 'Seyahat'],
  ['ev', 'Evde'],
];

const sections = Object.entries(SECTION_TITLES).map(([bolum, title]) => ({
  bolum,
  title,
  fields: FIELDS.filter((f) => f.bolum === bolum),
}));

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kişisel Profil Formu</title>
<style>
  :root { --bg:#faf8f5; --card:#fff; --ink:#222; --mute:#6b6b6b; --line:#e4dfd7; --accent:#7a4e2d; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1b1917; --card:#252220; --ink:#eee; --mute:#a39e97; --line:#3a3632; --accent:#d9a577; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 system-ui,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px 120px; }
  h1 { margin:0 0 4px; font-size:1.6rem; }
  .lead { color:var(--mute); margin:0 0 24px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:20px; }
  section h2 { margin:0 0 8px; font-size:1.15rem; color:var(--accent); }
  label { display:block; font-weight:600; margin:16px 0 4px; }
  .hint { display:block; font-weight:400; color:var(--mute); font-size:.85rem; }
  .req { color:var(--accent); }
  input[type=text], input[type=number], select { width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); font:inherit; }
  .week { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; margin-top:6px; }
  .week label { margin:0; font-weight:400; font-size:.85rem; }
  .bar { position:fixed; left:0; right:0; bottom:0; background:var(--card); border-top:1px solid var(--line); padding:12px 16px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
  button { padding:10px 18px; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:var(--bg); font:inherit; cursor:pointer; }
  button.ghost { background:transparent; color:var(--accent); }
  #status { align-self:center; color:var(--mute); font-size:.85rem; }
</style>
</head>
<body>
<main>
  <h1>Kişisel Profil Formu</h1>
  <p class="lead">Sana özel öneriler için temel bilgiler. <span class="req">*</span> işaretliler gerekli, gerisi isteğe bağlı; boş bırakabilirsin. Cevapların yalnızca bu tarayıcıda kalır. Bitince "JSON olarak indir"i kullan ve dosyanın içeriğini asistana <code>profile_import</code> ile ilet.</p>
  <form id="form"></form>
</main>
<div class="bar">
  <button type="button" id="dl">JSON olarak indir</button>
  <button type="button" class="ghost" id="cp">Panoya kopyala</button>
  <button type="button" class="ghost" id="rs">Temizle</button>
  <span id="status"></span>
</div>
<script>
const SECTIONS = ${JSON.stringify(sections)};
const MEKANLAR = ${JSON.stringify(MEKANLAR)};
const KEY = 'trendyol-mcp-onboarding-v1';
const form = document.getElementById('form');
const statusEl = document.getElementById('status');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function field(f) {
  const hint = [f.ipucu, f.ornek ? 'Örn: ' + f.ornek : ''].filter(Boolean).join(' · ');
  const head = '<label for="' + esc(f.id) + '">' + esc(f.soru) + (f.zorunlu ? ' <span class="req">*</span>' : '') + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>';
  if (f.tip === 'obje') {
    const cells = MEKANLAR.map(([k, l]) => '<label>' + esc(l) + '<input type="number" min="0" max="7" data-week="' + k + '"></label>').join('');
    return head.replace(' for="' + esc(f.id) + '"', '') + '<div class="week" data-obj="' + esc(f.id) + '">' + cells + '</div>';
  }
  if (f.tip === 'secim') return head + '<select id="' + esc(f.id) + '" data-id="' + esc(f.id) + '"><option value="">Seç</option>' + f.secenekler.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>';
  if (f.tip === 'sayi') return head + '<input type="number" id="' + esc(f.id) + '" data-id="' + esc(f.id) + '" min="0">';
  return head + '<input type="text" id="' + esc(f.id) + '" data-id="' + esc(f.id) + '"' + (f.tip === 'liste' ? ' placeholder="virgülle ayır"' : '') + '>';
}

form.innerHTML = SECTIONS.map((s) => '<section><h2>' + esc(s.title) + '</h2>' + s.fields.map(field).join('') + '</section>').join('');

function collect() {
  const alanlar = {};
  for (const s of SECTIONS) for (const f of s.fields) {
    if (f.tip === 'obje') {
      const week = {};
      form.querySelectorAll('[data-obj="' + f.id + '"] [data-week]').forEach((i) => { if (i.value !== '') week[i.dataset.week] = Number(i.value); });
      if (Object.keys(week).length) alanlar[f.id] = week;
      continue;
    }
    const el = form.querySelector('[data-id="' + f.id + '"]');
    const raw = el ? el.value.trim() : '';
    if (!raw) continue;
    alanlar[f.id] = f.tip === 'sayi' ? Number(raw) : f.tip === 'liste' ? raw.split(',').map((p) => p.trim()).filter(Boolean) : raw;
  }
  return { alanlar };
}

function restore() {
  try {
    const { alanlar = {} } = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const s of SECTIONS) for (const f of s.fields) {
      const v = alanlar[f.id]; if (v === undefined) continue;
      if (f.tip === 'obje') form.querySelectorAll('[data-obj="' + f.id + '"] [data-week]').forEach((i) => { if (v[i.dataset.week] !== undefined) i.value = v[i.dataset.week]; });
      else { const el = form.querySelector('[data-id="' + f.id + '"]'); if (el) el.value = Array.isArray(v) ? v.join(', ') : v; }
    }
  } catch (e) { /* depolama yok: boş başla */ }
}

let timer;
form.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(collect())); statusEl.textContent = 'Kaydedildi'; }
    catch (e) { statusEl.textContent = 'Otomatik kayıt çalışmıyor, indirmeyi unutma'; }
  }, 400);
});

const json = () => JSON.stringify(collect(), null, 2);
document.getElementById('dl').onclick = () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json()], { type: 'application/json' })), download: 'profil.json' });
  a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById('cp').onclick = async () => {
  try { await navigator.clipboard.writeText(json()); statusEl.textContent = 'Kopyalandı'; }
  catch (e) { statusEl.textContent = 'Kopyalanamadı, indirmeyi dene'; }
};
document.getElementById('rs').onclick = () => {
  if (!confirm('Tüm cevaplar silinsin mi?')) return;
  form.reset();
  try { localStorage.removeItem(KEY); } catch (e) {}
  statusEl.textContent = 'Temizlendi';
};
restore();
</script>
</body>
</html>
`;

const out = path.join(import.meta.dirname, '..', 'onboarding', 'form.html');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, html, 'utf8');
console.log(`yazıldı: ${out} (${FIELDS.length} alan)`);
