import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrandFit, WardrobeProfile } from '../src/wardrobe/types.js';
import { migrateProfile } from '../src/wardrobe/profile.js';
import { eliminatedLast, personalizeProduct } from '../src/wardrobe/personalize.js';

function profile(): WardrobeProfile {
  return {
    ...migrateProfile(null),
    kurallar: { slimYok: true, baskiYok: true },
    kacinanlar: ['neon'],
    kalip: { sevilen: ['relaxed', 'regular'], kacinilan: ['yüksek bel'], bel: 'orta' },
    sevilenKumaslar: ['pamuk'],
    beden: { alt: '32/32', ust: 'L' },
  };
}

const brandFit: BrandFit[] = [{ marka: 'Mavi', beden: '33/32', not: 'dar geldi', tarih: '2026-10-01' }];
const ctx = { profile: profile(), gender: 'Erkek', rol: 'alt' as const, brandFit };

describe('personalizeProduct', () => {
  it('ciddi bayrak varsa "eleme" ve düşük skor verir', () => {
    const p = personalizeProduct({ title: 'Erkek Slim Fit Dar Kesim Pantolon', price: '999,90 TL', rating: 4.5 }, ctx);
    assert.equal(p.karar, 'eleme');
    assert.ok(p.skor <= 25);
    assert.ok(p.uyarilar.some((u) => /slim/i.test(u)));
  });

  it('temiz ve sevilen özellikli ürünü "uygun" yapar', () => {
    const p = personalizeProduct({ title: 'Erkek Relaxed Fit %100 Pamuk Pantolon', price: '799 TL', rating: 4.4 }, ctx);
    assert.equal(p.karar, 'uygun');
    assert.ok(p.skor >= 70);
    assert.ok(p.olumlu.length >= 2);
  });

  it('bütçe üstü fiyatı uyarır ve puanı düşürür', () => {
    const base = personalizeProduct({ title: 'Erkek Regular Fit Pantolon', price: '900 TL', rating: 4.4 }, { ...ctx, butceMax: 1500 });
    const over = personalizeProduct({ title: 'Erkek Regular Fit Pantolon', price: '2.000 TL', rating: 4.4 }, { ...ctx, butceMax: 1500 });
    assert.equal(base.butce, 'icinde');
    assert.equal(over.butce, 'ustunde');
    assert.ok(over.skor < base.skor);
    assert.equal(over.karar, 'dikkat');
  });

  it('marka-beden hafızası varsa beden önerisine yansıtır', () => {
    const p = personalizeProduct({ title: 'Regular Fit Pantolon', brand: 'Mavi', price: '1.000 TL' }, ctx);
    assert.match(p.bedenOnerisi ?? '', /33\/32/);
    assert.match(p.bedenOnerisi ?? '', /dar geldi/);
  });

  it('marka hafızası yoksa profil bedenini önerir', () => {
    const p = personalizeProduct({ title: 'Regular Fit Pantolon', brand: 'Koton', price: '1.000 TL' }, ctx);
    assert.match(p.bedenOnerisi ?? '', /32\/32/);
  });

  it('düşük puanı hafifçe cezalandırır', () => {
    const good = personalizeProduct({ title: 'Regular Fit Pantolon', rating: 4.5 }, ctx);
    const bad = personalizeProduct({ title: 'Regular Fit Pantolon', rating: 2.4 }, ctx);
    assert.ok(bad.skor < good.skor);
  });

  it('Erkek aranırken kadın ürününü eler', () => {
    const p = personalizeProduct({ title: 'Kadın Relaxed Fit Pantolon' }, ctx);
    assert.equal(p.karar, 'eleme');
  });
});

describe('eliminatedLast', () => {
  const row = (id: string, skor: number, karar: 'uygun' | 'dikkat' | 'eleme') => ({
    id,
    kisisel: { skor, karar, uyarilar: [], olumlu: [] },
  });

  it('elenenleri sona atar; kalanların ALAKA SIRASINI korur (skora göre yeniden sıralamaz)', () => {
    // a: en alakalı ama düşük kişisel skor; c: daha yüksek kişisel skor. Sıra a, c kalmalı.
    const rows = [row('a', 60, 'dikkat'), row('x', 20, 'eleme'), row('c', 95, 'uygun'), row('b', 70, 'uygun')];
    assert.deepEqual(eliminatedLast(rows).map((r) => r.id), ['a', 'c', 'b', 'x']);
  });

  it('elenen yoksa sırayı olduğu gibi bırakır ve girdiyi değiştirmez', () => {
    const rows = [row('a', 10, 'dikkat'), row('b', 90, 'uygun')];
    const snapshot = structuredClone(rows);
    assert.deepEqual(eliminatedLast(rows).map((r) => r.id), ['a', 'b']);
    assert.deepEqual(rows, snapshot);
  });
});
