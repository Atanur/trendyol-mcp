import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// config.dataDir import sırasında okunur: gerçek veriye dokunmamak için ÖNCE yönlendir.
let dir: string;
let getWardrobe: typeof import('../src/wardrobe/db.js').getWardrobe;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'trendyol-mcp-db-test-'));
  process.env['TRENDYOL_DATA_DIR'] = dir;
  ({ getWardrobe } = await import('../src/wardrobe/db.js'));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('WardrobeStore', () => {
  it('H3: boş/boşluk url\'li zevk sinyalleri birbirini silmez', async () => {
    const store = getWardrobe();
    await store.addZevk([
      { ad: 'a', url: '', tepki: 'begendim', etiketler: [] },
      { ad: 'b', url: '', tepki: 'olmaz', etiketler: [] },
      { ad: 'c', url: '   ', tepki: 'olabilir', etiketler: [] },
    ]);
    const all = await store.listZevk();
    assert.deepEqual(all.map((z) => z.ad).sort(), ['a', 'b', 'c']);
  });

  it('aynı ürün (url) için son tepki geçerli olur', async () => {
    const store = getWardrobe();
    await store.addZevk([{ ad: 'x', url: 'https://t/x', tepki: 'olmaz', etiketler: [] }]);
    await store.addZevk([{ ad: 'x', url: 'https://t/x', tepki: 'begendim', etiketler: [] }]);
    const x = (await store.listZevk()).filter((z) => z.url === 'https://t/x');
    assert.equal(x.length, 1);
    assert.equal(x[0]!.tepki, 'begendim');
  });

  it('M6: eşzamanlı 25 yazma hata vermez ve hiçbiri kaybolmaz', async () => {
    const store = getWardrobe();
    const before = (await store.listNeeds()).length;
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.addNeed({ istek: `ihtiyaç ${i}`, kombin: [], sorular: [], durum: 'acik' }),
      ),
    );
    assert.equal((await store.listNeeds()).length, before + 25);
  });

  it('M6: eşzamanlı profil güncellemeleri birbirini ezmez', async () => {
    const store = getWardrobe();
    await Promise.all([
      store.applyProfileAnswers({ 'beden.alt': '32/32' }, 'kullanici'),
      store.setProfile({ butce: 1234 }),
      store.applyProfileAnswers({ 'beden.ust': 'L' }, 'kullanici'),
    ]);
    const p = await store.getProfile();
    assert.equal(p.beden?.alt, '32/32');
    assert.equal(p.beden?.ust, 'L');
    assert.equal(p.butce, 1234);
  });

  it('M6: updateNeed fonksiyonla okuma-değiştirme-yazmayı atomik yapar', async () => {
    const store = getWardrobe();
    const need = await store.addNeed({ istek: 'kombin testi', kombin: [], sorular: [], durum: 'acik' });
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => store.updateNeed(need.id, (cur) => ({ kombin: [...cur.kombin, `parça ${i}`] }))),
    );
    const updated = (await store.listNeeds()).find((n) => n.id === need.id)!;
    assert.equal(updated.kombin.length, 10);
  });

  it('applyProfileAnswers uygulananları ve reddedilenleri döner', async () => {
    const r = await getWardrobe().applyProfileAnswers({ butce: 'çok', 'yasam.sehir': 'İstanbul' }, 'kullanici');
    assert.deepEqual(r.uygulanan, ['yasam.sehir']);
    assert.equal(r.reddedilen.length, 1);
  });
});
