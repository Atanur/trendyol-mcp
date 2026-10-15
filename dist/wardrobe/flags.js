import { normalize } from '../util.js';
import { COLOR_HEX, isNeutral } from './color.js';
/**
 * Eşleştirme için normalleştirme: küçük harf + "ı"→"i". `toLocaleLowerCase('tr-TR')` büyük "I"'yı "ı" yaptığı
 * için "SLIM" → "slım" olur ve regex'ler kaçırırdı; hem başlık hem terimler bu fonksiyondan geçer.
 */
function norm(value) {
    return normalize(value).replace(/ı/g, 'i');
}
/** Boş/boşluk terimleri atar: boş terim her sınırda eşleşip ürünü haksız yere elerdi. */
function terms(list) {
    return (list ?? []).map(norm).filter(Boolean);
}
/** Eşleştirme için normalleşmiş `term` + kullanıcıya gösterilecek özgün `label` ("kısa paça", "kisa paça" değil). */
function labelled(list) {
    return (list ?? [])
        .map((raw) => ({ term: norm(raw), label: raw.trim() }))
        .filter((entry) => entry.term.length > 0);
}
/** Başlıkta (norm'lu, tam kelime) bir terim geçiyor mu? Zevk sinyali kategorileri için dışa açık. */
export function titleHasTerm(title, term) {
    const t = norm(term);
    return t.length > 0 && hasWord(norm(title), [t]);
}
/** Unicode duyarlı tam-kelime eşleşmesi (\b Türkçe harflerde güvenilmez). */
function hasWord(text, words) {
    const clean = words.filter(Boolean);
    if (clean.length === 0)
        return false;
    const alternation = clean.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`(?<![\\p{L}])(?:${alternation})(?![\\p{L}])`, 'u').test(text);
}
/** Kök eşleşmesi: "mavi" → "mavisi", "pamuk" → "pamuklu" (tam kelime başlangıcı, sonu serbest). */
function hasStem(text, stem) {
    if (!stem)
        return false;
    return new RegExp(`(?<![\\p{L}])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*`, 'u').test(text);
}
/** Aynı kalıbı anlatan başlık ifadeleri ("rahat kesim", "comfort fit" → relaxed). Anahtar norm'lu terimdir. */
const FIT_SYNONYMS = {
    relaxed: ['rahat kesim', 'comfort fit', 'loose fit'],
    regular: ['normal kesim', 'standart kesim'],
    straight: ['düz paça', 'duz paca'],
};
/** Kumaş terimlerinde anlam taşımayan sıfatlar: "kaliteli pamuk" → yalnızca "pamuk" aranır. */
const FABRIC_STOP_WORDS = new Set(['kaliteli', 'iyi', 'yumuşak', 'yumusak', 'sağlam', 'saglam']);
function fabricTokens(term) {
    return term.split(/\s+/).filter((token) => token && !FABRIC_STOP_WORDS.has(token));
}
/** Tüm anlamlı kumaş kelimeleri başlıkta geçiyor mu? `stem=true` ise "pamuk" → "pamuklu" da sayılır. */
function fabricMatches(hay, term, stem) {
    const tokens = fabricTokens(term);
    if (tokens.length === 0)
        return false;
    return tokens.every((token) => (stem ? hasStem(hay, token) : hasWord(hay, [token])));
}
const SLIM = /slim|skinny|dar kesim|dar fit|body fit/;
const YUKSEK_BEL = /y[üu]ks[ei]l bel|high ?waist/;
const DAR_PACA = /dar paça|dar paca|daralan paça|cigarette/;
const KISA_PACA = /bilek boy|crop|ankle|kisa pa[çc]a/;
const BASKI = /(?<![\p{L}])(baskili|baski|print|yazili|desenli)(?![\p{L}])/u;
const SUNI_DERI = /suni deri|sentetik deri|faux|deri görünüm|(?<![\p{L}])pu(?![\p{L}])/u;
/** Kullanıcının "kaçındığı" bir kalıp terimini başlıkta aranabilir kalıba çevirir (term zaten norm'lu ve boş değil). */
function avoidPattern(term) {
    if (/slim|skinny/.test(term))
        return SLIM;
    if (/y[üu]ksek bel|high/.test(term))
        return YUKSEK_BEL;
    if (/dar pa[çc]a/.test(term))
        return DAR_PACA;
    if (/kisa pa[çc]a/.test(term))
        return KISA_PACA;
    return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}
/**
 * Ürün BAŞLIĞINDAN deterministik bayraklar çıkarır. Yalnızca kullanıcının kendi
 * kurallarını/tercihlerini uygular; kural yoksa bayrak üretmez.
 */
export function flagProduct(title, profile, opts = {}) {
    const hay = norm(title);
    const uyarilar = [];
    const olumlu = [];
    const add = (kod, seviye, aciklama) => {
        if (!uyarilar.some((f) => f.kod === kod))
            uyarilar.push({ kod, seviye, aciklama });
    };
    const avoided = terms(profile.kalip?.kacinilan);
    const avoidsSlim = Boolean(profile.kurallar.slimYok) || avoided.some((a) => /slim|skinny/.test(a));
    // Başlıkta hem kadın hem erkek/unisex geçiyorsa (ör. "Kadın Erkek Unisex") belirsizdir: elenmez.
    const womenWord = hasWord(hay, ['kadin', 'kiz', 'bayan', 'women', 'woman', 'ladies']);
    if (opts.gender && norm(opts.gender) === 'erkek' && womenWord && !hasWord(hay, ['erkek', 'unisex'])) {
        add('cinsiyet', 'ciddi', 'Kadın ürünü görünüyor (Erkek aranıyor).');
    }
    else if (opts.gender &&
        norm(opts.gender) === 'erkek' &&
        /(?<![\p{L}])(boyfriend|girlfriend|mom)(?![\p{L}])/u.test(hay) &&
        !hasWord(hay, ['erkek', 'unisex'])) {
        // "Boyfriend/Mom" jean'ler çoğunlukla kadın modelidir ve başlıkta "kadın" yazmaz.
        add('cinsiyet', 'uyari', 'Kadın modeli olabilir (boyfriend/mom).');
    }
    if (avoidsSlim && SLIM.test(hay))
        add('slim', 'ciddi', 'Slim/dar kesim kalıp: istemediğin kalıp.');
    const highWaistAvoided = avoided.some((a) => /y[üu]ksek bel|high/.test(a));
    if (YUKSEK_BEL.test(hay)) {
        if (highWaistAvoided)
            add('yuksek-bel', 'ciddi', 'Yüksek bel: kaçındığın kalıp.');
        else if (profile.kalip?.bel && profile.kalip.bel !== 'yuksek')
            add('yuksek-bel', 'uyari', `Yüksek bel; tercihin ${profile.kalip.bel} bel.`);
    }
    if (avoided.some((a) => /dar pa[çc]a/.test(a)) && DAR_PACA.test(hay))
        add('dar-paca', 'ciddi', 'Dar paça: kaçındığın kalıp.');
    for (const { term, label } of labelled(profile.kalip?.kacinilan)) {
        if (/slim|skinny|y[üu]ksek bel|high|dar pa[çc]a/.test(term))
            continue;
        if (avoidPattern(term).test(hay))
            add('kacinilan-kalip', 'uyari', `Kaçındığın kalıp: ${label}.`);
    }
    if (profile.kurallar.baskiYok && BASKI.test(hay.replace(/baskisiz|desensiz/g, ''))) {
        add('baski', 'ciddi', 'Baskılı/desenli ürün: istemediğin tür.');
    }
    if (profile.kurallar.sentetikDeriYok && SUNI_DERI.test(hay))
        add('sentetik-deri', 'ciddi', 'Suni/sentetik deri istemiyorsun.');
    for (const { term, label } of labelled(profile.kacinanlar)) {
        if (hasWord(hay, [term]))
            add('kacinilan-renk', 'ciddi', `Kaçındığın renk: ${label}.`);
    }
    for (const { term, label } of labelled(profile.sevilmeyenKumaslar)) {
        if (fabricMatches(hay, term, false))
            add('kumas', 'uyari', `Sevmediğin kumaş: ${label}.`);
    }
    // Palet: başlıktaki (nötr olmayan) renklerin hiçbiri paletinde değilse yumuşak uyarı; elemez.
    const palette = new Set([...terms(profile.palet.baz), ...terms(profile.palet.aksan)]);
    if (palette.size > 0) {
        const found = Object.keys(COLOR_HEX).filter((color) => hasStem(hay, norm(color)));
        const inPalette = found.some((color) => palette.has(norm(color)));
        const offPalette = found.filter((color) => !isNeutral(color));
        if (!inPalette && offPalette.length > 0)
            add('palet', 'uyari', `Palet dışı renk: ${offPalette[0]}.`);
    }
    for (const { term, label } of labelled(profile.kalip?.sevilen)) {
        const phrases = [term, ...(FIT_SYNONYMS[term] ?? []).map(norm)];
        if (hasWord(hay, phrases))
            olumlu.push(`Sevdiğin kalıp: ${label}.`);
    }
    for (const { term, label } of labelled(profile.sevilenKumaslar)) {
        if (fabricMatches(hay, term, true))
            olumlu.push(`Sevdiğin kumaş: ${label}.`);
    }
    return { uyarilar, olumlu, elenir: uyarilar.some((f) => f.seviye === 'ciddi') };
}
//# sourceMappingURL=flags.js.map