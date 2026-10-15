import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WardrobeProfile } from '../src/wardrobe/types.js';
import { applyAnswers, migrateProfile } from '../src/wardrobe/profile.js';
import { needConstraints, parseNeed } from '../src/wardrobe/needs.js';

function profile(): WardrobeProfile {
  return applyAnswers(
    migrateProfile(null),
    { 'beden.alt': '32/32', 'beden.ust': 'L', 'beden.ayakkabi': '42', 'kalip.sevilen': ['regular', 'relaxed'], 'kalip.kacinilan': ['slim'], butce: 30000 },
    'kullanici',
    '2026-10-16',
  ).profile;
}

describe('parseNeed', () => {
  it('iş + akşam, pantolon, kot, rahat: rol/vesile/kumaş/kalıbı çıkarır', () => {
    const n = parseNeed('hem iş yerinde hem akşam arkadaşlarımla dışarıda giyebileceğim rahat bir pantolon, kot olabilir');
    assert.equal(n.rol, 'alt');
    assert.ok(n.vesile.includes('is'));
    assert.ok(n.vesile.includes('ozel'));
    assert.equal(n.kumas, 'denim');
    assert.equal(n.kalip, 'relaxed');
  });

  it('seyahat vesilesini ve dış giyim rolünü yakalar', () => {
    const n = parseNeed('kış gezisi için mont lazım');
    assert.equal(n.rol, 'dis');
    assert.deepEqual(n.vesile, ['seyahat']);
  });

  it('bütçeyi (TL, bin) ve rengi çıkarır', () => {
    assert.equal(parseNeed('1.500 TL altı lacivert gömlek').butceMax, 1500);
    assert.equal(parseNeed('en fazla 2 bin liraya lacivert gömlek').butceMax, 2000);
    assert.equal(parseNeed('1.500 TL altı lacivert gömlek').renk, 'lacivert');
  });

  it('"2 bin 500 tl" bütçesini 2500 okur, "oyun" kelimesini yün sanmaz', () => {
    assert.equal(parseNeed('2 bin 500 tl altı gömlek').butceMax, 2500);
    assert.equal(parseNeed('yün kazak').kumas, 'yün');
    assert.equal(parseNeed('oyun için tişört').kumas, undefined);
  });

  it('olumsuz ifadeler ("çok sportif olmasın", "slim olmasın") vesile/formallik/kalıp sayılmaz', () => {
    const n = parseNeed('iş ve akşam için rahat bir kot pantolon, çok iddialı olmasın, çok sportif olmasın, slim olmasın');
    assert.ok(!n.vesile.includes('spor'));
    assert.notEqual(n.formallik, 'spor');
    assert.equal(n.kalip, 'relaxed');
    assert.ok(n.vesile.includes('is') && n.vesile.includes('ozel'));
  });

  it('olumsuzlanan rengi istenen renk saymaz', () => {
    assert.equal(parseNeed('mavi olmasın, lacivert gömlek').renk, 'lacivert');
  });

  it('rol bilinmiyorsa eksik listesine koyar ve ilk soru rolü sorar', () => {
    const n = parseNeed('bir şeye ihtiyacım var');
    assert.equal(n.rol, undefined);
    assert.ok(n.eksik.includes('rol'));
    assert.match(n.sorular[0] ?? '', /ne arıyorsun|hangi parça/i);
  });

  it('en fazla 2 soru döner ve dolap/kombin sorusu eksik kalan en son sorudur', () => {
    const n = parseNeed('pantolon');
    assert.ok(n.sorular.length <= 2);
    assert.ok(n.eksik.includes('vesile'));
  });

  it('kombin bilgisi verildiyse kombin sorusu çıkmaz', () => {
    const n = parseNeed('iş için pantolon', { kombin: ['beyaz gömlekle'] });
    assert.ok(!n.eksik.includes('kombin'));
  });
});

describe('needConstraints', () => {
  it('alt parçada pantolon bedenini, üstte üst bedeni kullanır', () => {
    assert.equal(needConstraints({ rol: 'alt' }, profile()).beden, '32/32');
    assert.equal(needConstraints({ rol: 'ust' }, profile()).beden, 'L');
    assert.equal(needConstraints({ rol: 'dis' }, profile()).beden, 'L');
    assert.equal(needConstraints({ rol: 'ayakkabi' }, profile()).beden, '42');
  });

  it('ihtiyaçtaki bütçe, profildeki tek-ürün sınırından önceliklidir', () => {
    const p = { ...profile(), butceDavranisi: { tekUrunUst: 3000 } };
    assert.equal(needConstraints({ rol: 'alt', butceMax: 1500 }, p).butceMax, 1500);
    assert.equal(needConstraints({ rol: 'alt' }, p).butceMax, 3000);
  });

  it('kalıp tercihlerini ve kaçınılanları profilden taşır', () => {
    const c = needConstraints({ rol: 'alt' }, profile());
    assert.deepEqual(c.kalipSevilen, ['regular', 'relaxed']);
    assert.deepEqual(c.kalipKacinilan, ['slim']);
  });
});
