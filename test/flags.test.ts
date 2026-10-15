import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WardrobeProfile } from '../src/wardrobe/types.js';
import { migrateProfile } from '../src/wardrobe/profile.js';
import { flagProduct } from '../src/wardrobe/flags.js';

function strict(): WardrobeProfile {
  return {
    ...migrateProfile(null),
    kurallar: { slimYok: true, baskiYok: true, sentetikDeriYok: true, maxPolyester: 50 },
    kacinanlar: ['neon'],
    kalip: { sevilen: ['relaxed', 'regular', 'straight'], kacinilan: ['yüksek bel', 'dar paça'], bel: 'orta' },
    sevilenKumaslar: ['pamuk'],
    sevilmeyenKumaslar: ['deri'],
  };
}

const codes = (title: string, gender?: string, profile = strict()) =>
  flagProduct(title, profile, { gender }).uyarilar.map((f) => f.kod);

describe('flagProduct', () => {
  it('slim kuralı varsa slim/dar kesim başlığını ciddi işaretler ve eler', () => {
    const r = flagProduct('Erkek Beyaz %100 Pamuk Slim Fit Dar Kesim Bisiklet Yaka Tişört', strict());
    assert.ok(r.uyarilar.some((f) => f.kod === 'slim' && f.seviye === 'ciddi'));
    assert.equal(r.elenir, true);
  });

  it('kural yoksa slim bayrağı üretmez (yalnızca kullanıcının kuralları uygulanır)', () => {
    assert.deepEqual(codes('Slim Fit Pantolon', undefined, migrateProfile(null)), []);
  });

  it('Erkek aranırken kadın ürününü cinsiyet bayrağıyla eler', () => {
    assert.ok(codes('Jemmy Kadın %100 Organik Pamuk Relaxed Yırtmaçlı Beyaz T-shirt', 'Erkek').includes('cinsiyet'));
  });

  it('cinsiyet verilmediyse cinsiyet bayrağı üretmez', () => {
    assert.ok(!codes('Kadın Tişört').includes('cinsiyet'));
  });

  it('unisex ve "Erkek/unisex" başlığı cinsiyet bayrağı almaz', () => {
    assert.ok(!codes('Erkek/unisex Basic Tişört', 'Erkek').includes('cinsiyet'));
  });

  it('"Yüksel Bel" yazım hatasını da yüksek bel olarak yakalar', () => {
    assert.ok(codes('Straight Fit Yüksel Bel Düz Paça Erkek Lacivert Jean Pantolon').includes('yuksek-bel'));
  });

  it('dar paça başlığını yakalar', () => {
    assert.ok(codes('Cepli Vintage Straight Fit Dar Paça Jean').includes('dar-paca'));
  });

  it('"Baskısız" ürünü baskı sanmaz, "Baskılı" ürünü yakalar', () => {
    assert.ok(!codes('Siyah Basic Düz Baskısız Tişört').includes('baski'));
    assert.ok(codes('Baskılı Oversize Tişört').includes('baski'));
  });

  it('kaçınılan renk ve sevilmeyen kumaşı işaretler', () => {
    assert.ok(codes('Neon Yeşil Sweatshirt').includes('kacinilan-renk'));
    assert.ok(codes('Hakiki Deri Ceket').includes('kumas'));
  });

  it('sevilen kalıp ve kumaş olumlu sinyal olarak listelenir', () => {
    const r = flagProduct('Relaxed Fit %100 Pamuk Düz Tişört', strict());
    assert.deepEqual(r.uyarilar, []);
    assert.ok(r.olumlu.some((o) => /relaxed/i.test(o)));
    assert.ok(r.olumlu.some((o) => /pamuk/i.test(o)));
  });

  it('suni deri kuralı varsa suni deriyi ciddi işaretler', () => {
    assert.ok(codes('Erkek Suni Deri Ceket').includes('sentetik-deri'));
  });

  it('M1: BÜYÜK HARFLİ başlıkta da slim/print/high waist yakalanır (Türkçe İ/I)', () => {
    assert.ok(codes('ERKEK SLIM FIT PANTOLON').includes('slim'));
    assert.ok(codes('PRINT DESENLİ TİŞÖRT').includes('baski'));
    assert.ok(codes('HIGH WAIST JEAN').includes('yuksek-bel'));
  });

  it('H4: boş/boşluk string kaçınılan listeleri hiçbir ürünü elemez', () => {
    const p: WardrobeProfile = {
      ...strict(),
      kacinanlar: ['', '  '],
      kalip: { sevilen: [''], kacinilan: ['', ' '], bel: 'orta' },
      sevilmeyenKumaslar: [''],
      sevilenKumaslar: [''],
    };
    const r = flagProduct('Erkek 3 Adet Düz Tişört', p, { gender: 'Erkek' });
    assert.deepEqual(r.uyarilar, []);
    assert.deepEqual(r.olumlu, []);
  });

  it('başlıkta hem kadın hem erkek/unisex geçiyorsa cinsiyet bayrağı üretmez', () => {
    assert.ok(!codes('Kadın Erkek Unisex Tişört', 'Erkek').includes('cinsiyet'));
  });

  it('kısa paça kaçınıyorsa "bilek boy" / crop başlığını işaretler', () => {
    const p: WardrobeProfile = { ...strict(), kalip: { sevilen: ['regular'], kacinilan: ['kısa paça'], bel: 'orta' } };
    const kodlar = flagProduct('Erkek Lacivert Likralı Bilek Boy Kumaş Pantolon', p).uyarilar.map((f) => f.kod);
    assert.ok(kodlar.includes('kacinilan-kalip'));
    assert.ok(flagProduct('Crop Paça Pantolon', p).uyarilar.some((f) => f.kod === 'kacinilan-kalip'));
  });

  it('uyarı metni kullanıcının yazdığı özgün terimi gösterir (ı→i değiştirilmiş hâlini değil)', () => {
    const p: WardrobeProfile = { ...strict(), kalip: { sevilen: ['regular'], kacinilan: ['kısa paça'], bel: 'orta' } };
    const mesaj = flagProduct('Bilek Boy Pantolon', p).uyarilar[0]!.aciklama;
    assert.match(mesaj, /kısa paça/);
  });

  it('"sprint" gibi kelimelerin içindeki print baskı sayılmaz', () => {
    assert.ok(!codes('Sprint Koşu Tişörtü').includes('baski'));
  });
});
