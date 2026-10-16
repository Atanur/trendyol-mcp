/**
 * Gerçek gözlemden: gizli (headless) Chrome varsayılan ayarlarla Trendyol'da Cloudflare tarafından
 * "Attention Required! | Cloudflare" başlıklı bir engel sayfasına düşüyor.
 */
const BLOCKED_TITLE = /attention required|just a moment|access denied|bir dakika|cloudflare/i;
const BLOCKED_TEXT = /verify you are human|checking your browser|robot olmadığınızı|tarayıcınız kontrol/i;
/** Sayfa bir bot-engeli / insan doğrulaması mı? Ürün adındaki "robot" gibi kelimeler engel sayılmaz. */
export function isBlockedPage(probe) {
    return BLOCKED_TITLE.test(probe.title) || BLOCKED_TEXT.test(probe.text);
}
/** Kullanıcı giriş/üyelik sayfasında işlem yapıyor olabilir: tarayıcı kapatılmamalı. */
export function isLoginUrl(url) {
    return /\/(giris|login|uyelik|sifre)/i.test(url);
}
//# sourceMappingURL=guard.js.map