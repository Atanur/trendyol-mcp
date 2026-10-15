import { normalize } from '../util.js';
export const COLOR_HEX = {
    siyah: '#000000',
    beyaz: '#ffffff',
    ekru: '#f5f0e6',
    krem: '#f0e6d2',
    bej: '#d8c3a5',
    karamel: '#c47f3d',
    taba: '#a9714b',
    kahverengi: '#6b4423',
    gri: '#808080',
    'açık gri': '#c0c0c0',
    antrasit: '#2f2f2f',
    'füme': '#3b3b3b',
    lacivert: '#1b2a49',
    mavi: '#1f4e9c',
    'açık mavi': '#6fa8dc',
    turkuaz: '#1abc9c',
    yeşil: '#2e7d32',
    haki: '#7a7a4b',
    zeytin: '#556b2f',
    bordo: '#6d071a',
    kırmızı: '#c62828',
    pembe: '#e91e63',
    mor: '#6a1b9a',
    lila: '#b39ddb',
    sarı: '#f9a825',
    hardal: '#d4a017',
    turuncu: '#ef6c00',
    gümüş: '#b0b0b0',
    altın: '#c9a227',
};
const NEUTRALS = ['siyah', 'beyaz', 'ekru', 'krem', 'bej', 'gri', 'antrasit', 'füme', 'lacivert', 'kahverengi', 'taba'];
export function toHex(name) {
    const key = normalize(name);
    if (COLOR_HEX[key])
        return COLOR_HEX[key];
    const found = Object.keys(COLOR_HEX).find((k) => key.includes(k) || k.includes(key));
    return found ? COLOR_HEX[found] : undefined;
}
export function isNeutral(name) {
    const key = normalize(name);
    return NEUTRALS.some((n) => key.includes(n));
}
function hexToRgb(hex) {
    const value = hex.replace('#', '');
    return [
        Number.parseInt(value.slice(0, 2), 16),
        Number.parseInt(value.slice(2, 4), 16),
        Number.parseInt(value.slice(4, 6), 16),
    ];
}
export function colorDistance(a, b) {
    const ha = toHex(a);
    const hb = toHex(b);
    if (!ha || !hb)
        return undefined;
    const [r1, g1, b1] = hexToRgb(ha);
    const [r2, g2, b2] = hexToRgb(hb);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
export function nearestColorName(hex) {
    let best;
    let bestDistance = Infinity;
    for (const [name, value] of Object.entries(COLOR_HEX)) {
        const distance = colorDistance(hex, value);
        if (distance !== undefined && distance < bestDistance) {
            bestDistance = distance;
            best = name;
        }
    }
    return best;
}
export function colorAffinity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb)
        return 'aynı';
    if (isNeutral(a) || isNeutral(b))
        return 'nötr-uyumlu';
    const distance = colorDistance(a, b);
    if (distance === undefined)
        return 'uyumlu';
    if (distance < 80)
        return 'çakışık';
    if (distance < 220)
        return 'uyumlu';
    return 'kontrast';
}
export function paletteFit(color, palette) {
    const key = normalize(color);
    if (palette.baz.some((c) => normalize(c) === key))
        return { yuva: 'baz', score: 100 };
    if (palette.aksan.some((c) => normalize(c) === key))
        return { yuva: 'aksan', score: 80 };
    const nearBaz = palette.baz.some((c) => (colorDistance(color, c) ?? 999) < 90);
    if (nearBaz)
        return { yuva: 'baz', score: 70 };
    if (isNeutral(color))
        return { score: 55 };
    return { score: 25 };
}
//# sourceMappingURL=color.js.map