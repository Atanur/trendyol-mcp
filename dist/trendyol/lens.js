import { normalize } from '../util.js';
const SIZING_TIGHT = { label: 'dar', terms: ['dar', 'dar geldi', 'dar kalıp', 'sıkı', 'sıkıyor', 'küçük geldi', 'küçük'] };
const SIZING_LOOSE = { label: 'bol', terms: ['bol', 'bol geldi', 'geniş', 'büyük geldi', 'büyük', 'gevşek'] };
const SIZING_TRUE = { label: 'tam', terms: ['tam kalıp', 'tam oldu', 'tam geldi', 'normal kalıp'] };
const QUALITY_BUCKETS = [
    { label: 'ince kumaş', terms: ['ince', 'çok ince', 'ince kumaş', 'şeffaf'] },
    { label: 'kalın kumaş', terms: ['kalın', 'kalın kumaş', 'tok'] },
    { label: 'kalitesiz', terms: ['kalitesiz', 'kalite yok', 'dandik', 'kötü kumaş', 'ucuz duruyor'] },
    { label: 'dikiş sorunu', terms: ['dikiş', 'dikişler', 'sökük', 'söküldü'] },
    { label: 'koku', terms: ['koku', 'kokuyor', 'kokusu'] },
    { label: 'sentetik/yapay', terms: ['sentetik', 'yapay', 'polyester'] },
    { label: 'çekme', terms: ['çekti', 'çekmiş', 'çekme yaptı', 'kısaldı', 'çekince'] },
    { label: 'renk farkı', terms: ['renk farklı', 'farklı renk', 'soluk', 'beklediğim renk', 'resimdeki gibi değil'] },
];
function countMatches(haystack, terms) {
    let count = 0;
    for (const term of terms) {
        const needle = normalize(term);
        let index = haystack.indexOf(needle);
        while (index >= 0) {
            count += 1;
            index = haystack.indexOf(needle, index + needle.length);
        }
    }
    return count;
}
export function analyzeLens(reviews) {
    const texts = reviews.map((r) => normalize(r.text)).join(' \n ');
    const total = reviews.length || 1;
    const tight = countMatches(texts, SIZING_TIGHT.terms);
    const loose = countMatches(texts, SIZING_LOOSE.terms);
    const trueToSize = countMatches(texts, SIZING_TRUE.terms);
    let verdict;
    if (tight > loose && tight > 0)
        verdict = 'Dar kalıp eğilimi — bir beden büyük düşün.';
    else if (loose > tight && loose > 0)
        verdict = 'Bol kalıp eğilimi — bir beden küçük düşün.';
    else if (trueToSize > 0)
        verdict = 'Genel olarak tam kalıp.';
    const complaints = QUALITY_BUCKETS.map((bucket) => {
        const count = countMatches(texts, bucket.terms);
        return { label: bucket.label, count, ratio: Number((count / total).toFixed(3)) };
    })
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count);
    const negative = complaints.filter((c) => ['kalitesiz', 'dikiş sorunu', 'koku', 'çekme', 'renk farkı'].includes(c.label));
    const negativeRatio = negative.reduce((sum, c) => sum + c.ratio, 0);
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - negativeRatio * 60)));
    return {
        reviewCount: reviews.length,
        sizing: {
            tight,
            loose,
            trueToSize,
            verdict,
            ratios: {
                tight: Number((tight / total).toFixed(3)),
                loose: Number((loose / total).toFixed(3)),
                trueToSize: Number((trueToSize / total).toFixed(3)),
            },
        },
        complaints,
        qualityScore,
    };
}
//# sourceMappingURL=lens.js.map