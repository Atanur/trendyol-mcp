import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlockedPage, isLoginUrl } from '../src/trendyol/guard.js';

describe('isBlockedPage', () => {
  it('Cloudflare engel başlıklarını yakalar (gerçek gözlem: "Attention Required! | Cloudflare")', () => {
    assert.equal(isBlockedPage({ title: 'Attention Required! | Cloudflare', text: '' }), true);
    assert.equal(isBlockedPage({ title: 'Just a moment...', text: '' }), true);
    assert.equal(isBlockedPage({ title: 'Access denied', text: '' }), true);
  });

  it('görünür sayfa metnindeki insan doğrulamasını yakalar', () => {
    assert.equal(isBlockedPage({ title: 'trendyol.com', text: 'Please verify you are human to continue' }), true);
    assert.equal(isBlockedPage({ title: 'trendyol.com', text: 'Lütfen robot olmadığınızı doğrulayın' }), true);
  });

  it('normal sayfayı engel saymaz', () => {
    assert.equal(isBlockedPage({ title: 'Arama Sonuçları - Trendyol', text: 'Kot pantolon 1.149 TL' }), false);
  });

  it('ürün adındaki "robot" kelimesini (ör. robot süpürge) engel saymaz', () => {
    assert.equal(isBlockedPage({ title: 'Robot Süpürge - Trendyol', text: 'Akıllı robot süpürge 4.999 TL' }), false);
  });
});

describe('isLoginUrl', () => {
  it('giriş ve üyelik sayfalarını tanır (kullanıcı orada işlem yapıyor olabilir)', () => {
    assert.equal(isLoginUrl('https://www.trendyol.com/giris?cb=%2F'), true);
    assert.equal(isLoginUrl('https://www.trendyol.com/login'), true);
    assert.equal(isLoginUrl('https://www.trendyol.com/uyelik'), true);
  });

  it('diğer sayfaları tanımaz', () => {
    assert.equal(isLoginUrl('https://www.trendyol.com/sr?q=kot'), false);
    assert.equal(isLoginUrl('about:blank'), false);
  });
});
