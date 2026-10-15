import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Need } from '../src/wardrobe/types.js';
import { buildResume, isFinished, mergeAdaylar } from '../src/wardrobe/resume.js';

const TODAY = '2026-10-20';

function need(over: Partial<Need> = {}): Need {
  return {
    id: 'n1',
    istek: 'iş ve akşam için rahat kot pantolon',
    rol: 'alt',
    kombin: [],
    sorular: [],
    durum: 'arastiriliyor',
    olusturma: '2026-10-19',
    guncelleme: '2026-10-19',
    ...over,
  };
}

describe('isFinished', () => {
  it('yalnızca alındı/vazgeçildi bitmiş sayılır (karar hâlâ açıktır)', () => {
    assert.equal(isFinished('alindi'), true);
    assert.equal(isFinished('vazgecildi'), true);
    assert.equal(isFinished('karar'), false);
    assert.equal(isFinished('arastiriliyor'), false);
    assert.equal(isFinished('acik'), false);
  });
});

describe('mergeAdaylar', () => {
  it('yeni adayı ekler, tarih damgalar ve varsayılan durumu "inceleniyor" yapar', () => {
    const r = mergeAdaylar([], [{ ad: 'HLT Siyah Jean', url: 'https://t/a', fiyat: 1091 }], TODAY);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.durum, 'inceleniyor');
    assert.equal(r[0]!.tarih, TODAY);
  });

  it('aynı url\'yi tekrar eklemez, alanları günceller', () => {
    const first = mergeAdaylar([], [{ ad: 'HLT', url: 'https://t/a', fiyat: 1149 }], '2026-10-19');
    const second = mergeAdaylar(first, [{ ad: 'HLT', url: 'https://t/a', fiyat: 1091, durum: 'secildi', not: 'tam kalıp' }], TODAY);
    assert.equal(second.length, 1);
    assert.equal(second[0]!.fiyat, 1091);
    assert.equal(second[0]!.durum, 'secildi');
    assert.equal(second[0]!.not, 'tam kalıp');
  });

  it('url yoksa adı anahtar sayar (büyük/küçük harf ve boşluk farkını yok sayar)', () => {
    const first = mergeAdaylar([], [{ ad: 'Siyah Jean' }], TODAY);
    const second = mergeAdaylar(first, [{ ad: '  siyah jean ', not: 'x' }], TODAY);
    assert.equal(second.length, 1);
  });

  it('girdiyi değiştirmez', () => {
    const base = mergeAdaylar([], [{ ad: 'A' }], TODAY);
    const snapshot = structuredClone(base);
    mergeAdaylar(base, [{ ad: 'B' }], TODAY);
    assert.deepEqual(base, snapshot);
  });
});

describe('buildResume', () => {
  it('açık ihtiyaç yoksa bunu söyler', () => {
    const r = buildResume([need({ durum: 'alindi' }), need({ id: 'n2', durum: 'vazgecildi' })], TODAY);
    assert.deepEqual(r.acik, []);
    assert.match(r.mesaj, /açık ihtiyaç yok/i);
  });

  it('en son güncellenen ihtiyaç başta gelir', () => {
    const r = buildResume(
      [need({ id: 'eski', guncelleme: '2026-10-10' }), need({ id: 'yeni', guncelleme: '2026-10-19' })],
      TODAY,
    );
    assert.deepEqual(r.acik.map((e) => e.id), ['yeni', 'eski']);
  });

  it('aday yokken "aramaya başla", adaylar varken "karşılaştır" der', () => {
    const none = buildResume([need()], TODAY).acik[0]!;
    assert.match(none.sonrakiAdim, /ara/i);
    const some = buildResume([need({ adaylar: [{ ad: 'A', durum: 'inceleniyor', tarih: TODAY }, { ad: 'B', durum: 'inceleniyor', tarih: TODAY }] })], TODAY).acik[0]!;
    assert.match(some.sonrakiAdim, /2 aday/);
  });

  it('seçilmiş aday varsa satın alma onayını önerir', () => {
    const e = buildResume(
      [need({ durum: 'karar', adaylar: [{ ad: 'HLT Siyah Jean', durum: 'secildi', tarih: TODAY }] })],
      TODAY,
    ).acik[0]!;
    assert.match(e.sonrakiAdim, /HLT Siyah Jean/);
    assert.match(e.sonrakiAdim, /onay/i);
  });

  it('eksik soruları olan açık ihtiyaçta soruları hatırlatır', () => {
    const e = buildResume([need({ durum: 'acik', sorular: ['Bunu hangi parçalarınla giyeceksin?'] })], TODAY).acik[0]!;
    assert.match(e.sonrakiAdim, /hangi parçalarınla/);
  });

  it('14 günden eski ihtiyacı eskimiş işaretler ve geçerliliğini sormayı önerir', () => {
    const e = buildResume([need({ guncelleme: '2026-09-01' })], TODAY).acik[0]!;
    assert.equal(e.eskimis, true);
    assert.match(e.sonrakiAdim, /hâlâ geçerli/i);
    assert.equal(buildResume([need({ guncelleme: '2026-10-19' })], TODAY).acik[0]!.eskimis, false);
  });

  it('özet "bugün/dün/N gün önce" ve aday sayısını içerir', () => {
    const e = buildResume([need({ guncelleme: TODAY, adaylar: [{ ad: 'A', durum: 'inceleniyor', tarih: TODAY }] })], TODAY).acik[0]!;
    assert.match(e.ozet, /bugün/);
    assert.match(e.ozet, /1 aday/);
    assert.match(buildResume([need({ guncelleme: '2026-10-19' })], TODAY).acik[0]!.ozet, /dün/);
    assert.match(buildResume([need({ guncelleme: '2026-10-15' })], TODAY).acik[0]!.ozet, /5 gün önce/);
  });
});
