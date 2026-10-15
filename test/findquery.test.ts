import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFindQuery } from '../src/wardrobe/findquery.js';

describe('buildFindQuery', () => {
  it('kot/jean/denim kumaşını sorguya ekler (aksi halde hiç kot pantolon gelmez)', () => {
    assert.equal(buildFindQuery({ colors: ['lacivert'], garment: 'pantolon', fabric: 'kot' }, 'Erkek', 'x'), 'lacivert kot pantolon Erkek');
    assert.equal(buildFindQuery({ colors: [], garment: 'pantolon', fabric: 'denim' }, 'Erkek', 'x'), 'denim pantolon Erkek');
  });

  it('diğer kumaşları sorguya eklemez (gereksiz daraltma yapmasın)', () => {
    assert.equal(buildFindQuery({ colors: ['gri'], garment: 'gömlek', fabric: 'pamuk' }, 'Erkek', 'x'), 'gri gömlek Erkek');
  });

  it('kumaş zaten parçanın adındaysa ("jean") tekrar etmez', () => {
    assert.equal(buildFindQuery({ colors: [], garment: 'jean', fabric: 'kot' }, 'Erkek', 'x'), 'jean Erkek');
  });

  it('hiçbir ipucu yoksa açıklamanın ilk 3 kelimesine düşer', () => {
    assert.equal(buildFindQuery({ colors: [] }, '', 'rahat bir şey arıyorum şimdi'), 'rahat bir şey');
  });
});
