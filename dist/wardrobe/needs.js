import { normalize, parsePrice } from '../util.js';
import { COLOR_HEX } from './color.js';
import { classifyRole } from './logic.js';
const MAX_QUESTIONS = 2;
const VESILE = [
    { mekan: 'is', re: /(?<![\p{L}])(iş|ofis|işyeri|iş yeri|iş yerinde)(?![\p{L}])/u },
    { mekan: 'ozel', re: /akşam|arkadaş|dışarı|kafe|restoran|(?<![\p{L}])bar(?![\p{L}])|sosyal|buluşma|davet|düğün|(?<![\p{L}])date(?![\p{L}])|sevgili/u },
    { mekan: 'spor', re: /spor|koşu|antrenman|(?<![\p{L}])gym(?![\p{L}])|yürüyüş/u },
    { mekan: 'seyahat', re: /gezi|seyahat|tatil|yolculuk/u },
    { mekan: 'ev', re: /evde|ev için|ev kıyafeti/u },
    { mekan: 'gunluk', re: /günlük|her gün|gündelik/u },
];
const KALIP = [
    { kalip: 'slim', re: /slim|skinny|dar kesim/ },
    { kalip: 'oversize', re: /oversize/ },
    { kalip: 'baggy', re: /baggy/ },
    { kalip: 'straight', re: /straight|düz paça/ },
    { kalip: 'relaxed', re: /rahat|relaxed|bol kesim/ },
    { kalip: 'regular', re: /regular|normal kesim|standart/ },
];
const KUMAS = [
    { kumas: 'denim', re: /(?<![\p{L}])(kot|jean|denim)(?![\p{L}])/u },
    { kumas: 'pamuk', re: /pamuk/ },
    { kumas: 'keten', re: /keten/ },
    { kumas: 'yün', re: /(?<![\p{L}])(yün|yun)(?![\p{L}])/u },
    { kumas: 'triko', re: /triko/ },
];
const FORMALLIK = [
    { formallik: 'resmi', re: /resmi|klasik|takım/ },
    { formallik: 'smart', re: /smart|şık|özenli/ },
    { formallik: 'spor', re: /spor|eşofman/ },
    { formallik: 'gunluk', re: /casual|günlük|rahat/ },
];
const QUESTION = {
    rol: 'Tam olarak ne arıyorsun? (pantolon, mont, tişört, ayakkabı...)',
    vesile: 'Bunu nerede ve ne zaman giyeceksin? (iş, akşam çıkışı, günlük, spor, seyahat)',
    kombin: 'Bunu hangi parçalarınla giyeceksin? Dolabındaki en çok giydiklerinden bahseder misin?',
};
function parseBudget(hay) {
    // "2 bin", "2,5 bin", "2 bin 500 tl"
    const bin = hay.match(/(\d+(?:[.,]\d+)?)\s*bin(?:\s*(\d{1,3})(?!\d))?/);
    if (bin?.[1]) {
        const thousands = Math.round(Number.parseFloat(bin[1].replace(',', '.')) * 1000);
        return thousands + (bin[2] ? Number.parseInt(bin[2], 10) : 0);
    }
    const tl = hay.match(/(\d[\d.,]*)\s*(?:tl|₺|lira)/);
    return tl?.[1] ? parsePrice(tl[1]) : undefined;
}
/** "çok sportif olmasın", "slim olmasın", "mavi istemem": istenmeyenler ihtiyaç olarak okunmasın. */
const NEGATED = /(?:(?<![\p{L}])çok\s+)?[\p{L}]+\s+(?:olmasın|olmasa|olmamalı|istemiyorum|istemem)/gu;
/** Serbest cümleden ihtiyacı çıkarır (deterministik, LLM'siz) ve eksikleri/soruları belirler. */
export function parseNeed(text, opts = {}) {
    const hay = normalize(text).replace(NEGATED, ' ');
    let rol = classifyRole(hay);
    if (!rol && /(?<![\p{L}])kot(?![\p{L}])/u.test(hay))
        rol = 'alt';
    const vesile = VESILE.filter((v) => v.re.test(hay)).map((v) => v.mekan);
    const renk = Object.keys(COLOR_HEX).find((c) => hay.includes(normalize(c)));
    const kombin = opts.kombin ?? [];
    const eksik = [];
    if (!rol)
        eksik.push('rol');
    if (vesile.length === 0)
        eksik.push('vesile');
    if (kombin.length === 0)
        eksik.push('kombin');
    return {
        istek: text,
        rol,
        vesile,
        formallik: FORMALLIK.find((f) => f.re.test(hay))?.formallik,
        renk,
        kalip: KALIP.find((k) => k.re.test(hay))?.kalip,
        kumas: KUMAS.find((k) => k.re.test(hay))?.kumas,
        butceMax: parseBudget(hay),
        kombin,
        eksik,
        sorular: eksik.slice(0, MAX_QUESTIONS).map((slot) => QUESTION[slot]),
    };
}
/** İhtiyaç + profilden aramanın uyması gereken kısıtları birleştirir. */
export function needConstraints(need, profile) {
    const bedenByRol = {
        alt: profile.beden?.alt,
        ust: profile.beden?.ust,
        katman: profile.beden?.ust,
        dis: profile.beden?.ust,
        tekParca: profile.beden?.ust,
        ayakkabi: profile.beden?.ayakkabi,
    };
    return {
        beden: need.rol ? bedenByRol[need.rol] : undefined,
        kalipSevilen: profile.kalip?.sevilen ?? [],
        kalipKacinilan: profile.kalip?.kacinilan ?? [],
        palet: profile.palet,
        kacinanlar: profile.kacinanlar,
        butceMax: need.butceMax ?? profile.butceDavranisi?.tekUrunUst,
    };
}
//# sourceMappingURL=needs.js.map