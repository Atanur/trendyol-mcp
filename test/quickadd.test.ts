import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWardrobeLine } from '../src/wardrobe/quickadd.js';

describe('parseWardrobeLine', () => {
  it('rol ve rengi çıkarır, adı korur', () => {
    const r = parseWardrobeLine('lacivert kot pantolon');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.item.rol, 'alt');
      assert.equal(r.item.renk, 'lacivert');
      assert.equal(r.item.ad, 'lacivert kot pantolon');
    }
  });

  it('üst beden harfini ve pantolon bel/boy ölçüsünü yakalar', () => {
    const a = parseWardrobeLine('beyaz basic tişört L');
    const b = parseWardrobeLine('siyah chino pantolon 32/32');
    assert.ok(a.ok && a.item.beden === 'L');
    assert.ok(b.ok && b.item.beden === '32/32');
  });

  it('"2 adet" gibi ifadeyi adet olarak okur', () => {
    const r = parseWardrobeLine('2 adet gri tişört');
    assert.ok(r.ok && r.item.adet === 2);
  });

  it('rol çıkarılamazsa reddeder ve nedenini söyler', () => {
    const r = parseWardrobeLine('bir şey');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.neden, /rol/i);
  });

  it('M7: sıfır adedi reddeder', () => {
    const r = parseWardrobeLine('0 adet beyaz tişört');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.neden, /adet/i);
  });

  it('boş satırı reddeder', () => {
    assert.equal(parseWardrobeLine('   ').ok, false);
  });

  it('rengi bilinmiyorsa "belirtilmemiş" bırakmaz, alanı boş geçer', () => {
    const r = parseWardrobeLine('eski mont');
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.item.renk, undefined);
  });
});
