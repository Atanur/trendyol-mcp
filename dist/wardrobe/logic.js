import { normalize } from '../util.js';
import { colorAffinity, paletteFit, isNeutral } from './color.js';
const FORMALITY_ORDER = ['spor', 'gunluk', 'smart', 'resmi'];
export const ROLE_LABELS = {
    ust: 'üst (gömlek/tişört/kazak)',
    alt: 'alt (pantolon/şort)',
    tekParca: 'tek parça (elbise/tulum/takım)',
    katman: 'katman (ceket/hırka/yelek)',
    dis: 'dış giyim (mont/kaban)',
    ayakkabi: 'ayakkabı',
    aksesuar: 'aksesuar',
};
export const CATEGORY_ROLE_HINTS = [
    { rol: 'dis', terms: ['mont', 'kaban', 'palto', 'pardösü', 'trençkot', 'parka'] },
    { rol: 'katman', terms: ['ceket', 'yelek', 'hırka', 'blazer', 'sweatshirt', 'kazak', 'polar'] },
    { rol: 'ust', terms: ['gömlek', 'tişört', 't-shirt', 'tshirt', 'sweat', 'polo', 'body', 'bluz', 'büstiyer', 'atlet', 'kazak'] },
    { rol: 'alt', terms: ['pantolon', 'jean', 'şort', 'tayt', 'chino', 'jogger', 'eşofman altı', 'etek'] },
    { rol: 'tekParca', terms: ['elbise', 'tulum', 'salopet', 'takım elbise', 'kostüm'] },
    { rol: 'ayakkabi', terms: ['ayakkabı', 'bot', 'sneaker', 'loafer', 'sandalet', 'çizme', 'terlik'] },
    { rol: 'aksesuar', terms: ['çanta', 'kemer', 'saat', 'şapka', 'gözlük', 'atkı', 'bere', 'aksesuar', 'kravat'] },
];
export function classifyRole(text) {
    const hay = normalize(text);
    for (const { rol, terms } of CATEGORY_ROLE_HINTS) {
        if (terms.some((t) => hay.includes(normalize(t))))
            return rol;
    }
    return undefined;
}
export function inferFormality(text) {
    const hay = normalize(text);
    if (/(takım|smokin|klasik|resmi|blazer|gömlek)/.test(hay))
        return 'resmi';
    if (/(eşofman|spor|sneaker|tayt|şort|koşu|atlet)/.test(hay))
        return 'spor';
    if (/(tişört|t-shirt|jean|sweatshirt|basic)/.test(hay))
        return 'gunluk';
    return 'smart';
}
export function fabricScore(item) {
    const notes = [];
    const comp = item.kompozisyon ?? [];
    if (comp.length === 0) {
        return { score: 50, notes: ['Kompozisyon bilgisi yok; kumaşı elle değerlendir.'] };
    }
    const get = (needle) => comp.filter((c) => normalize(c.material).includes(needle)).reduce((sum, c) => sum + (c.percent ?? 0), 0);
    const cotton = get('pamuk');
    const wool = get('yun') + get('wool') + get('yün');
    const linen = get('keten');
    const silk = get('ipek');
    const viscose = get('viskon') + get('viscose');
    const elastan = get('elastan') + get('lycra');
    const polyester = get('polyester') + get('poli');
    const acrylic = get('akrilik') + get('acrylic');
    const polyamide = get('poliamid') + get('polyamid') + get('naylon');
    let score = 45;
    score += Math.min(35, cotton * 0.35 + wool * 0.4 + linen * 0.4 + silk * 0.5 + viscose * 0.2);
    score -= polyester * 0.35;
    score -= acrylic * 0.4;
    score -= polyamide * 0.2;
    if (elastan > 0 && elastan <= 5) {
        score += 6;
        notes.push('Az elastan → esneklik ve form koruma artısı.');
    }
    if (polyester >= 50)
        notes.push('Kompozisyonun yarısından fazlası polyester → terletir, ömrü kısa.');
    if (cotton >= 90)
        notes.push('Yüksek pamuk oranı → nefes alır, konforlu.');
    if (wool >= 50)
        notes.push('Yüksek yün → sıcak ve dayanıklı.');
    if (linen >= 40)
        notes.push('Keten → yaz için serin, kolay kırışır.');
    return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}
export function formalityGap(a, b) {
    return Math.abs(FORMALITY_ORDER.indexOf(a) - FORMALITY_ORDER.indexOf(b));
}
export function outfitCompatible(a, b) {
    const affinity = colorAffinity(a.renk, b.renk);
    if (affinity === 'çakışık')
        return false;
    if (formalityGap(a.formallik, b.formallik) > 1)
        return false;
    if (a.sezon.length && b.sezon.length && !a.sezon.some((s) => b.sezon.includes(s)))
        return false;
    return true;
}
export function outfitCount(items) {
    const tops = items.filter((i) => i.rol === 'ust');
    const bottoms = items.filter((i) => i.rol === 'alt');
    const dresses = items.filter((i) => i.rol === 'tekParca');
    let count = dresses.length;
    for (const top of tops)
        for (const bottom of bottoms)
            if (outfitCompatible(top, bottom))
                count += 1;
    return count;
}
export function outfitCountWith(items, newItem) {
    return outfitCount([...items, newItem]);
}
export function partnerCount(item, items) {
    const others = items.filter((i) => i.id !== item.id);
    let count = 0;
    for (const other of others) {
        if (item.rol === 'ust' && other.rol === 'alt' && outfitCompatible(item, other))
            count += 1;
        else if (item.rol === 'alt' && other.rol === 'ust' && outfitCompatible(item, other))
            count += 1;
        else if (['katman', 'dis'].includes(item.rol) && ['ust', 'alt', 'tekParca'].includes(other.rol))
            count += 1;
        else if (item.rol === 'ayakkabi' || item.rol === 'aksesuar')
            count += 1;
    }
    return count;
}
export function weakLinks(items, threshold = 2) {
    return items
        .filter((i) => !['ayakkabi', 'aksesuar'].includes(i.rol))
        .map((item) => ({ item, partners: partnerCount(item, items) }))
        .filter((entry) => entry.partners < threshold)
        .sort((a, b) => a.partners - b.partners);
}
export function capsuleCoverage(profile, items) {
    const matrix = profile.mekanMevsim ?? {};
    const cells = [];
    for (const [mekan, sezonMap] of Object.entries(matrix)) {
        for (const [sezon, need] of Object.entries(sezonMap ?? {})) {
            const have = items.filter((i) => {
                const mekanOk = (i.mekan ?? ['gunluk']).includes(mekan);
                const sezonOk = i.sezon.includes(sezon);
                return mekanOk && sezonOk;
            }).length;
            cells.push({ mekan, sezon, have, need, empty: have < need });
        }
    }
    return { cells, emptyCount: cells.filter((c) => c.empty).length };
}
export function costPerWear(item, wearLogs) {
    const wears = wearLogs.filter((w) => w.itemId === item.id).length || item.giyimSayisi;
    if (!item.fiyat)
        return { wears, note: 'Fiyat yok; CPW hesaplanamadı.' };
    const cpw = item.fiyat / Math.max(1, wears);
    const target = 20;
    const projected = wears === 0 ? item.fiyat : Math.round(item.fiyat / Math.max(wears, target / 2));
    let note = '';
    if (wears === 0)
        note = 'Hiç giyilmemiş; CPW çok yüksek.';
    else if (cpw > 100)
        note = 'CPW yüksek; sık giyilmiyor.';
    else if (cpw <= 20)
        note = 'CPW düşük; verimli parça.';
    return { wears, cpw: Math.round(cpw), projected, note };
}
export function keepOrGo(item, wearLogs) {
    const { cpw } = costPerWear(item, wearLogs);
    if (item.durum === 'yipranmis')
        return { verdict: 'çıksın', reason: 'Yıpranmış durumda.', cpw };
    if (item.giyimSayisi === 0 && item.fiyat && item.fiyat > 500)
        return { verdict: 'çıksın', reason: 'Hiç giyilmemiş ve pahalı.', cpw };
    if (item.giyimSayisi <= 1)
        return { verdict: 'çıksın', reason: 'Çok az giyilmiş.', cpw };
    if (cpw !== undefined && cpw > 120)
        return { verdict: 'çıksın', reason: 'CPW çok yüksek.', cpw };
    return { verdict: 'kalsın', reason: 'Yeterince kullanılıyor.', cpw };
}
export function oneInOneOut(newItem, items, profile) {
    const roleItems = items.filter((i) => i.rol === newItem.rol);
    const target = profile.hedef[newItem.rol] ?? roleItems.length + 1;
    const over = roleItems.length + 1 - target;
    if (over <= 0)
        return [];
    const ranked = [...roleItems].sort((a, b) => {
        if (a.giyimSayisi !== b.giyimSayisi)
            return a.giyimSayisi - b.giyimSayisi;
        const durumRank = { yipranmis: 0, orta: 1, iyi: 2 };
        return durumRank[a.durum] - durumRank[b.durum];
    });
    return ranked.slice(0, over);
}
export function generateGaps(profile, items) {
    const gaps = [];
    for (const [rol, target] of Object.entries(profile.hedef)) {
        const have = items.filter((i) => i.rol === rol).length;
        const deficit = (target ?? 0) - have;
        if (deficit > 0) {
            gaps.push({
                id: `gap_${rol}`,
                rol,
                baslik: `${deficit} adet ${ROLE_LABELS[rol]}`,
                adet: deficit,
                oncelik: deficit >= 3 ? 'yuksek' : deficit === 2 ? 'orta' : 'dusuk',
                gerekce: `Hedef ${target}, mevcut ${have}.`,
            });
        }
    }
    const coverage = capsuleCoverage(profile, items);
    for (const cell of coverage.cells.filter((c) => c.empty)) {
        gaps.push({
            id: `gap_${cell.mekan}_${cell.sezon}`,
            rol: 'ust',
            baslik: `${cell.mekan} × ${cell.sezon} için parça eksik`,
            adet: cell.need - cell.have,
            oncelik: 'orta',
            gerekce: `Bu hücrede ${cell.have} parça var, en az ${cell.need} olmalı.`,
        });
    }
    const rank = { yuksek: 0, orta: 1, dusuk: 2 };
    return gaps.sort((a, b) => rank[a.oncelik] - rank[b.oncelik] || b.adet - a.adet);
}
export function checkAgainstProfile(item, profile) {
    const reasons = [];
    const rules = profile.kurallar;
    const fit = normalize(`${item.kalip ?? ''} ${item.ad}`);
    if (rules.slimYok && /slim|skinny/.test(fit))
        reasons.push('İstenmeyen kalıp: slim/skinny.');
    const material = normalize(`${item.kumas ?? ''} ${(item.kompozisyon ?? []).map((c) => c.material).join(' ')}`);
    if (rules.sentetikDeriYok && /(suni deri|sentetik deri|poliüretan|faux|pu deri)/.test(material)) {
        reasons.push('Sentetik/suni deri istenmiyor.');
    }
    if (rules.baskiYok && (item.baski || /baskı|print/.test(normalize(item.ad))))
        reasons.push('Baskılı ürün istenmiyor.');
    const poly = (item.kompozisyon ?? [])
        .filter((c) => /polyester|poli/.test(normalize(c.material)))
        .reduce((sum, c) => sum + (c.percent ?? 0), 0);
    if (rules.maxPolyester !== undefined && poly > rules.maxPolyester)
        reasons.push(`Polyester %${poly} > sınır %${rules.maxPolyester}.`);
    const color = normalize(item.renk);
    if (profile.kacinanlar.some((c) => normalize(c) === color)) {
        return { verdict: 'eleme', score: 0, reasons: [...reasons, `Kaçınılan renk: ${item.renk}.`] };
    }
    const palette = paletteFit(item.renk, profile.palet);
    if (palette.yuva)
        reasons.push(`Palet: ${palette.yuva} (${item.renk}).`);
    else
        reasons.push(`Palet dışı renk: ${item.renk}.`);
    const hard = reasons.some((r) => /istenmiyor|Kaçınılan/i.test(r));
    const ruleReasons = reasons.filter((r) => !r.startsWith('Palet')).length;
    const score = Math.max(0, Math.min(100, palette.score - ruleReasons * 18));
    const verdict = hard || score < 30 ? 'eleme' : score < 65 || ruleReasons > 0 ? 'şüpheli' : 'uygun';
    return { verdict, score, reasons };
}
export function travelPack(items, options) {
    const pool = items.filter((i) => i.sezon.includes(options.sezon));
    const mekan = options.mekan;
    const byMekan = mekan ? pool.filter((i) => (i.mekan ?? ['gunluk']).includes(mekan)) : pool;
    const source = byMekan.length >= 6 ? byMekan : pool;
    const pick = (rol, count) => source.filter((i) => i.rol === rol).sort((a, b) => b.giyimSayisi - a.giyimSayisi).slice(0, count);
    const days = Math.max(1, options.gun);
    const tops = Math.max(2, Math.ceil(days / 2) + 1);
    const bottoms = Math.max(1, Math.ceil(days / 3) + 1);
    const pack = [
        ...pick('ust', tops),
        ...pick('alt', bottoms),
        ...pick('tekParca', days >= 4 ? 1 : 0),
        ...pick('katman', 2),
        ...pick('dis', options.sezon === 'kis' ? 1 : 0),
        ...pick('ayakkabi', 2),
        ...pick('aksesuar', 1),
    ];
    return pack;
}
export function budgetBasket(lines, budget) {
    const total = lines.reduce((sum, l) => sum + (l.fiyat || 0), 0);
    const shares = {};
    for (const line of lines) {
        const key = line.rol ?? line.kategori ?? 'diğer';
        shares[key] = (shares[key] ?? 0) + (line.fiyat || 0);
    }
    const sharePct = {};
    for (const [key, value] of Object.entries(shares))
        sharePct[key] = total ? Number(((value / total) * 100).toFixed(1)) : 0;
    return {
        total,
        count: lines.length,
        shares,
        sharePct,
        budget: budget ?? null,
        remaining: budget !== undefined ? budget - total : null,
        withinBudget: budget === undefined ? null : total <= budget,
    };
}
export function shoppingOrder(gaps, urgentRoles = []) {
    const rank = { yuksek: 0, orta: 1, dusuk: 2 };
    return [...gaps].sort((a, b) => {
        const urgency = Number(urgentRoles.includes(b.rol)) - Number(urgentRoles.includes(a.rol));
        if (urgency !== 0)
            return urgency;
        return rank[a.oncelik] - rank[b.oncelik] || b.adet - a.adet;
    });
}
export function impulseGuard(candidate, ctx) {
    const reasons = [];
    let bad = 0;
    const gap = ctx.gaps.find((g) => g.rol === candidate.rol);
    if (gap)
        reasons.push(`İhtiyaç listesinde var: ${gap.baslik}.`);
    else {
        reasons.push('İhtiyaç (gap) listesinde yok.');
        bad += 1;
    }
    const duplicates = ctx.items.filter((i) => i.rol === candidate.rol && colorAffinity(i.renk, candidate.renk) === 'aynı');
    if (duplicates.length) {
        reasons.push(`Dolapta benzeri var (${duplicates.length} adet).`);
        bad += 2;
    }
    if (ctx.profile.butce !== undefined && candidate.fiyat !== undefined) {
        const projected = (ctx.basketTotal ?? 0) + candidate.fiyat;
        if (projected > ctx.profile.butce) {
            reasons.push(`Bütçe aşımı: ${projected} > ${ctx.profile.butce}.`);
            bad += 2;
        }
    }
    const check = checkAgainstProfile({ ...candidate, kategori: candidate.rol, ad: '' }, ctx.profile);
    if (check.verdict === 'eleme') {
        reasons.push(...check.reasons);
        bad += 3;
    }
    const verdict = bad >= 3 ? 'vazgeç' : bad >= 1 ? 'bekle' : 'al';
    return { verdict, reasons };
}
//# sourceMappingURL=logic.js.map