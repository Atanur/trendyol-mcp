import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PROFILE, type WardrobeProfile } from '../src/wardrobe/types.js';
import {
  FIELDS,
  applyAnswers,
  completeness,
  defaultsInUse,
  migrateProfile,
  nextQuestions,
  profileNote,
} from '../src/wardrobe/profile.js';

const TODAY = '2026-10-15';

function fresh(): WardrobeProfile {
  return migrateProfile(null);
}

describe('migrateProfile', () => {
  it('yeni kullanıcıda varsayılanları "varsayilan" kaynağıyla işaretler ve onboarded=false verir', () => {
    const p = fresh();
    assert.equal(p.meta?.schemaVersion, 2);
    assert.equal(p.meta?.onboarded, false);
    assert.equal(p.meta?.kaynaklar['butce'], 'varsayilan');
  });

  it('eski (v1) profilde varsayılanla aynı olanı "varsayilan", değişmiş olanı "kullanici" sayar', () => {
    const v1: WardrobeProfile = {
      ...DEFAULT_PROFILE,
      palet: { baz: ['lacivert', 'gri', 'ekru', 'siyah'], aksan: ['bordo', 'haki', 'taş'] },
    };
    const p = migrateProfile(v1);
    assert.equal(p.meta?.kaynaklar['butce'], 'varsayilan');
    assert.equal(p.meta?.kaynaklar['palet.baz'], 'kullanici');
    assert.equal(p.meta?.onboarded, false);
  });

  it('v2 profili olduğu gibi bırakır (idempotent)', () => {
    const once = migrateProfile(null);
    const twice = migrateProfile(once);
    assert.deepEqual(twice, once);
  });

  it('girdiyi değiştirmez (immutable)', () => {
    const v1: WardrobeProfile = structuredClone(DEFAULT_PROFILE);
    const snapshot = structuredClone(v1);
    migrateProfile(v1);
    assert.deepEqual(v1, snapshot);
  });
});

describe('completeness', () => {
  it('boş profilde tüm zorunlu alanlar eksik, yüzde 0', () => {
    const c = completeness(fresh());
    assert.equal(c.zorunluTamam, false);
    assert.ok(c.eksikZorunlu.length > 0);
    assert.equal(c.yuzde, 0);
  });

  it('varsayılan değerler dolu sayılmaz', () => {
    const c = completeness(fresh());
    assert.ok(c.eksikZorunlu.some((f) => f.id === 'butce'));
  });

  it('zorunlu alanlar kullanıcıdan gelince tamamlanır ve onboarded=true olur', () => {
    const required = FIELDS.filter((f) => f.zorunlu);
    const answers: Record<string, unknown> = {
      'amac.neden': 'kasım indiriminde dolabı yenilemek',
      butce: 30000,
      'beden.ust': 'L',
      'beden.alt': '32/32',
      'yasam.sehir': 'İstanbul',
      'yasam.haftalik': { is: 0, gunluk: 3, ozel: 2 },
      'palet.baz': ['lacivert', 'gri'],
      'kalip.sevilen': ['regular', 'relaxed'],
    };
    assert.deepEqual(
      required.map((f) => f.id).sort(),
      Object.keys(answers).sort(),
      'testteki zorunlu liste FIELDS ile uyumlu olmalı',
    );
    const { profile } = applyAnswers(fresh(), answers, 'kullanici', TODAY);
    const c = completeness(profile);
    assert.equal(c.zorunluTamam, true);
    assert.equal(profile.meta?.onboarded, true);
    assert.equal(c.yuzde > 0, true);
  });
});

describe('nextQuestions', () => {
  it('önce zorunlu alanları sorar, en fazla n tane', () => {
    const qs = nextQuestions(fresh(), 3);
    assert.equal(qs.length, 3);
    assert.ok(qs.every((q) => q.zorunlu));
  });

  it('cevaplanmış alanı tekrar sormaz', () => {
    const { profile } = applyAnswers(fresh(), { 'amac.neden': 'ayıklama' }, 'kullanici', TODAY);
    const ids = nextQuestions(profile, 20).map((q) => q.id);
    assert.ok(!ids.includes('amac.neden'));
  });

  it('her şey doluysa boş liste döner', () => {
    const all: Record<string, unknown> = {};
    for (const f of FIELDS) {
      all[f.id] =
        f.tip === 'sayi' ? 1 : f.tip === 'liste' ? ['x'] : f.tip === 'obje' ? { gunluk: 1 } : f.secenekler?.[0] ?? 'x';
    }
    const { profile } = applyAnswers(fresh(), all, 'kullanici', TODAY);
    assert.deepEqual(nextQuestions(profile, 5), []);
  });
});

describe('applyAnswers', () => {
  it('iç içe yola yazar, kaynağı işaretler, girdiyi değiştirmez', () => {
    const base = fresh();
    const snapshot = structuredClone(base);
    const { profile, uygulanan } = applyAnswers(base, { 'beden.alt': '32/32' }, 'kullanici', TODAY);
    assert.equal(profile.beden?.alt, '32/32');
    assert.equal(profile.meta?.kaynaklar['beden.alt'], 'kullanici');
    assert.deepEqual(uygulanan, ['beden.alt']);
    assert.deepEqual(base, snapshot);
  });

  it('sayı alanına sayısal metin gelirse sayıya çevirir', () => {
    const { profile } = applyAnswers(fresh(), { butce: '30.000' }, 'kullanici', TODAY);
    assert.equal(profile.butce, 30000);
  });

  it('liste alanına virgüllü metin gelirse diziye böler', () => {
    const { profile } = applyAnswers(fresh(), { 'palet.baz': 'lacivert, gri ,ekru' }, 'kullanici', TODAY);
    assert.deepEqual(profile.palet.baz, ['lacivert', 'gri', 'ekru']);
  });

  it('geçersiz değeri reddeder ve profile yazmaz', () => {
    const base = fresh();
    const { profile, reddedilen, uygulanan } = applyAnswers(
      base,
      { butce: 'çok', 'beden.alt': '', 'bilinmeyen.alan': 'x' },
      'kullanici',
      TODAY,
    );
    assert.equal(uygulanan.length, 0);
    assert.equal(reddedilen.length, 3);
    assert.equal(profile.butce, base.butce);
  });

  it('çıkarım kaynağıyla yazılan alan "cikarim" olarak işaretlenir ve dolu sayılmaz', () => {
    const { profile } = applyAnswers(fresh(), { 'kalip.sevilen': ['regular'] }, 'cikarim', TODAY);
    assert.equal(profile.meta?.kaynaklar['kalip.sevilen'], 'cikarim');
    const ids = completeness(profile).eksikZorunlu.map((f) => f.id);
    assert.ok(ids.includes('kalip.sevilen'), 'çıkarım kullanıcı onayı olmadan zorunluyu kapatmaz');
  });
});

describe('inceleme düzeltmeleri', () => {
  const REQUIRED: Record<string, unknown> = {
    'amac.neden': 'ayıklama',
    butce: 25000,
    'beden.ust': 'L',
    'beden.alt': '32/32',
    'yasam.sehir': 'İstanbul',
    'yasam.haftalik': { gunluk: 3 },
    'palet.baz': ['lacivert'],
    'kalip.sevilen': ['regular'],
  };

  it('H1: çıkarım, kullanıcının onayladığı değeri ezmez ve reddedilenlere yazılır', () => {
    const { profile: filled } = applyAnswers(fresh(), REQUIRED, 'kullanici', TODAY);
    const r = applyAnswers(filled, { 'beden.alt': '34/34' }, 'cikarim', TODAY);
    assert.equal(r.profile.beden?.alt, '32/32');
    assert.equal(r.profile.meta?.kaynaklar['beden.alt'], 'kullanici');
    assert.equal(r.profile.meta?.onboarded, true);
    assert.equal(r.reddedilen.length, 1);
    assert.match(r.reddedilen[0]!.neden, /korunuyor/);
  });

  it('H1: çıkarım henüz dolu olmayan alana yazılabilir', () => {
    const r = applyAnswers(fresh(), { 'kalip.sevilen': ['regular'] }, 'cikarim', TODAY);
    assert.deepEqual(r.uygulanan, ['kalip.sevilen']);
  });

  it('H2: onboarding bitince profileNote boş döner (sürekli "profil tamamlanmadı" demez)', () => {
    const { profile } = applyAnswers(fresh(), REQUIRED, 'kullanici', TODAY);
    assert.deepEqual(profileNote(profile), {});
  });

  it('M4: "30 bin" 30000 olur, işaretli/anlamsız sayı reddedilir', () => {
    assert.equal(applyAnswers(fresh(), { butce: '30 bin' }, 'kullanici', TODAY).profile.butce, 30000);
    assert.equal(applyAnswers(fresh(), { butce: '1.500 TL' }, 'kullanici', TODAY).profile.butce, 1500);
    assert.equal(applyAnswers(fresh(), { butce: '-5' }, 'kullanici', TODAY).uygulanan.length, 0);
    assert.equal(applyAnswers(fresh(), { butce: '30 bin altı lira ama' }, 'kullanici', TODAY).uygulanan.length, 0);
  });

  it('M3: kaynaklar eksik v2 meta çökmez', () => {
    const broken = { ...fresh(), meta: { schemaVersion: 2, onboarded: false } } as unknown as WardrobeProfile;
    const r = applyAnswers(broken, { butce: 1000 }, 'kullanici', TODAY);
    assert.equal(r.profile.butce, 1000);
  });
});

describe('profileNote', () => {
  it('hazır olmayan profilde varsayılan listesi ve açıklama döner', () => {
    const note = profileNote(fresh());
    assert.ok(note.varsayilanKullanilan?.includes('butce'));
    assert.match(note.profilNotu ?? '', /profile_status/);
  });

  it('kullanıcının doldurduğu alanlar varsayılan listesinden düşer', () => {
    const answers: Record<string, unknown> = {
      'amac.neden': 'ayıklama',
      butce: 25000,
      'beden.ust': 'L',
      'beden.alt': '32/32',
      'yasam.sehir': 'İstanbul',
      'yasam.haftalik': { gunluk: 3 },
      'palet.baz': ['lacivert'],
      'kalip.sevilen': ['regular'],
      'palet.aksan': ['bordo'],
      kacinanlar: ['neon'],
    };
    const { profile } = applyAnswers(fresh(), answers, 'kullanici', TODAY);
    // hedef/kurallar/sezonSayisi hâlâ varsayılan: kullanıcı onlara dokunmadıkça bildirilir.
    const note = profileNote(profile);
    assert.ok(!note.varsayilanKullanilan?.includes('butce'));
    assert.ok(!note.varsayilanKullanilan?.includes('palet.baz'));
  });
});

describe('defaultsInUse', () => {
  it('hâlâ varsayılan olan alanları listeler', () => {
    const used = defaultsInUse(fresh());
    assert.ok(used.includes('butce'));
  });

  it('kullanıcı yazınca listeden düşer', () => {
    const { profile } = applyAnswers(fresh(), { butce: 25000 }, 'kullanici', TODAY);
    assert.ok(!defaultsInUse(profile).includes('butce'));
  });
});
