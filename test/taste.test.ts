import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ZevkSinyali } from '../src/wardrobe/types.js';
import { summarizeTaste } from '../src/wardrobe/taste.js';

let n = 0;
function z(kategori: string, tepki: ZevkSinyali['tepki'], etiketler: string[] = []): ZevkSinyali {
  n += 1;
  return { id: `z${n}`, ad: `${kategori} ${n}`, kategori, tepki, etiketler, tarih: '2026-10-15' };
}

describe('summarizeTaste', () => {
  it('boş girdide sıfır sayar ve güçlü sinyal üretmez', () => {
    const s = summarizeTaste([]);
    assert.deepEqual(s.toplam, { begendim: 0, olabilir: 0, olmaz: 0 });
    assert.deepEqual(s.gucluSinyaller, []);
  });

  it('kategori başına tepkileri sayar', () => {
    const s = summarizeTaste([z('pantolon', 'olmaz'), z('pantolon', 'olabilir'), z('mont', 'begendim')]);
    assert.deepEqual(s.kategoriler['pantolon'], { begendim: 0, olabilir: 1, olmaz: 1 });
    assert.deepEqual(s.kategoriler['mont'], { begendim: 1, olabilir: 0, olmaz: 0 });
  });

  it('en az 2 "olmaz" ve hiç "beğendim" yoksa kategoriyi reddedilen olarak işaretler', () => {
    const s = summarizeTaste([z('sweatshirt', 'olmaz'), z('sweatshirt', 'olmaz'), z('sweatshirt', 'olabilir')]);
    assert.ok(s.gucluSinyaller.some((g) => g.tur === 'reddediyor' && g.kategori === 'sweatshirt'));
  });

  it('tek bir "olmaz" güçlü sinyal sayılmaz', () => {
    const s = summarizeTaste([z('gömlek', 'olmaz')]);
    assert.deepEqual(s.gucluSinyaller, []);
  });

  it('en az 2 "beğendim" olan kategoriyi seviyor olarak işaretler', () => {
    const s = summarizeTaste([z('polo', 'begendim'), z('polo', 'begendim')]);
    assert.ok(s.gucluSinyaller.some((g) => g.tur === 'seviyor' && g.kategori === 'polo'));
  });

  it('etiketleri olumlu/olumsuz ağırlıklandırır; "olabilir" etiketi saymaz', () => {
    const s = summarizeTaste([
      z('pantolon', 'begendim', ['sade', 'kumaş']),
      z('mont', 'begendim', ['sade']),
      z('jogger', 'olmaz', ['fazla spor']),
      z('chino', 'olabilir', ['kalıp']),
    ]);
    assert.deepEqual(s.etiketler['sade'], { olumlu: 2, olumsuz: 0 });
    assert.deepEqual(s.etiketler['fazla spor'], { olumlu: 0, olumsuz: 1 });
    assert.equal(s.etiketler['kalıp'], undefined);
  });

  it('M2: __proto__ gibi anahtarlar Object.prototype\'ı kirletmez', () => {
    summarizeTaste([z('__proto__', 'begendim', ['__proto__', 'constructor'])]);
    assert.equal(({} as Record<string, unknown>)['begendim'], undefined);
    assert.equal(({} as Record<string, unknown>)['olumlu'], undefined);
  });

  it('kategorisiz kayıtları "diğer" altında toplar', () => {
    const s = summarizeTaste([{ id: 'x', ad: 'bilinmeyen', tepki: 'begendim', etiketler: [], tarih: '2026-10-15' }]);
    assert.equal(s.kategoriler['diğer']?.begendim, 1);
  });
});
