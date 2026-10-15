import { normalize } from '../util.js';
const SUPERLATIVES = [
    'mükemmel', 'harika', 'muhteşem', 'süper', 'efsane', 'kusursuz', 'fevkalade', 'inanılmaz',
    'mukemmel', 'harıka', 'muthis', 'super', 'olağanüstü', 'on numara', 'fiyat performans kralı',
];
const GENERIC_TEMPLATES = [
    'çok güzel', 'cok guzel', 'harika ürün', 'harika urun', 'çok kaliteli', 'cok kaliteli', 'tavsiye ederim',
    'tavsiye ederım', 'çok beğendim', 'cok begendim', 'süper ürün', 'güzel ürün', 'kaliteli ürün', 'alın pişman olmazsınız',
];
export function analyzeAuthenticity(reviews) {
    const total = reviews.length || 1;
    // duplicate text detection
    const freq = new Map();
    for (const review of reviews) {
        const key = normalize(review.text).slice(0, 120);
        if (key.length < 8)
            continue;
        freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const signals = {
        noAttributes: 0,
        shortPositive: 0,
        superlativeHeavy: 0,
        duplicate: 0,
        exclamationHeavy: 0,
        genericTemplate: 0,
    };
    const flagged = [];
    for (const review of reviews) {
        const text = review.text;
        const hay = normalize(text);
        const reasons = [];
        let suspicion = 0;
        const hasSuperlative = SUPERLATIVES.some((s) => hay.includes(normalize(s)));
        const superlativeCount = SUPERLATIVES.filter((s) => hay.includes(normalize(s))).length;
        const isShort = text.length < 25;
        const isGeneric = GENERIC_TEMPLATES.some((t) => hay === normalize(t) || (isShort && hay.includes(normalize(t))));
        const exclamations = (text.match(/!/g) ?? []).length;
        const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
        const noAttr = !review.size;
        const dupKey = normalize(text).slice(0, 120);
        const isDuplicate = dupKey.length >= 8 && (freq.get(dupKey) ?? 0) > 1;
        if ((review.rating ?? 0) >= 5 && isShort) {
            suspicion += 0.3;
            reasons.push('Kısa + tam puan');
            signals.shortPositive += 1;
        }
        if (isGeneric) {
            suspicion += 0.3;
            reasons.push('Şablon/genel övgü');
            signals.genericTemplate += 1;
        }
        if (superlativeCount >= 2 || (hasSuperlative && isShort)) {
            suspicion += 0.2;
            reasons.push('Aşırı övgü');
            signals.superlativeHeavy += 1;
        }
        if (isDuplicate) {
            suspicion += 0.45;
            reasons.push('Aynı/benzer metin tekrarı');
            signals.duplicate += 1;
        }
        if (exclamations >= 2 || emojis >= 3) {
            suspicion += 0.15;
            reasons.push('Aşırı ünlem/emoji');
            signals.exclamationHeavy += 1;
        }
        if (noAttr) {
            suspicion += 0.1;
            reasons.push('Beden/boy-kilo bilgisi yok');
            signals.noAttributes += 1;
        }
        suspicion = Math.min(1, Number(suspicion.toFixed(2)));
        if (suspicion >= 0.5)
            flagged.push({ text: text.slice(0, 200), rating: review.rating, suspicion, reasons });
    }
    const suspiciousCount = flagged.length;
    const fakeRatio = Number((suspiciousCount / total).toFixed(3));
    const noAttrRatio = signals.noAttributes / total;
    const dupRatio = signals.duplicate / total;
    const authenticityScore = Math.max(0, Math.min(100, Math.round(100 - fakeRatio * 70 - noAttrRatio * 10 - dupRatio * 15)));
    return {
        reviewCount: reviews.length,
        suspiciousCount,
        fakeRatio,
        authenticityScore,
        signals,
        flagged: flagged.slice(0, 15),
    };
}
//# sourceMappingURL=authenticity.js.map