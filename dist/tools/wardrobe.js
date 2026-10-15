import * as z from 'zod/v4';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPage } from '../browser.js';
import { config } from '../config.js';
import { openCategory, performSearch, prepareFilters, applySort, applyPriceRange, resolveCategory } from '../trendyol/actions.js';
import { getReviewInsights } from '../reviewinsights.js';
import { getWardrobe } from '../wardrobe/db.js';
import { generateGaps } from '../wardrobe/logic.js';
import { scrapeProducts } from '../trendyol/scrape.js';
import { errorResult, jsonResult, normalize, parsePrice, shortId } from '../util.js';
const ROL = ['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar'];
const FORMALLIK = ['resmi', 'smart', 'gunluk', 'spor'];
const SEZON = ['ilkbahar', 'yaz', 'sonbahar', 'kis'];
const ROL_KEYWORDS = {
    ust: ['gömlek', 'gomlek', 'tişört', 'tshirt', 't-shirt', 'kazak', 'sweatshirt', 'sweat', 'polo', 'body', 'bluz', 'büstiyer', 'sweater'],
    alt: ['pantolon', 'jean', 'şort', 'sort', 'tayt', 'eşofman altı', 'chino', 'jogger'],
    tekParca: ['elbise', 'tulum', 'salopet', 'takım elbise', 'tulum'],
    katman: ['ceket', 'yelek', 'hırka', 'hirka', 'blazer', 'kaban', 'mont', 'pardösü', 'trençkot', 'rüzgarlık', 'polar'],
    dis: ['palto', 'kaban', 'mont', 'pardösü', 'trençkot'],
    ayakkabi: ['ayakkabı', 'ayakkabi', 'bot', 'sneaker', 'spor ayakkabı', 'loafer', 'sandalet', 'çizme'],
    aksesuar: ['çanta', 'kemer', 'saat', 'şapka', 'gözlük', 'atkı', 'bere', 'aksesuar'],
};
const ROL_FILTERS = {
    ust: ['Gömlek', 'T-Shirt', 'Kazak&Hırka', 'Sweatshirt', 'Polo Yaka T-shirt'],
    alt: ['Pantolon', 'Jeans', 'Şort', 'Tayt'],
    tekParca: ['Takım Elbise', 'Elbise', 'Tulum&Salopet'],
    katman: ['Ceket & Yelek', 'Kaban & Mont', 'Pardösü & Trençkot', 'Yağmurluk & Rüzgarlık'],
    dis: ['Kaban & Mont', 'Pardösü & Trençkot', 'Ceket & Yelek'],
};
const COLORS = [
    'siyah', 'beyaz', 'gri', 'antrasit', 'lacivert', 'mavi', 'bej', 'krem', 'ekru', 'kahverengi',
    'bordo', 'kırmızı', 'kirmizi', 'yeşil', 'yesil', 'haki', 'zeytin', 'sarı', 'sari', 'turuncu',
    'pembe', 'mor', 'lila', 'karamel', 'taba', 'gümüş', 'altın', 'füme', 'fume',
];
const FORALLIK_KEYWORDS = {
    resmi: ['takım', 'smokin', 'klasik', 'resmi', 'gömlek', 'blazer'],
    smart: ['gömlek', 'kazak', 'hırka', 'chino', 'polo', 'blazer'],
    gunluk: ['tişört', 't-shirt', 'jean', 'sweatshirt', 'günlük', 'basic'],
    spor: ['eşofman', 'spor', 'sneaker', 'tayt', 'şort', 'atlet', 'koşu'],
};
function buildQuery(input) {
    if (input.query)
        return input.query;
    const parts = [];
    if (input.brand)
        parts.push(input.brand);
    if (input.renk)
        parts.push(input.renk);
    if (input.rol && ROL_KEYWORDS[input.rol])
        parts.push(ROL_KEYWORDS[input.rol][0]);
    if (input.formallik && input.rol !== 'ayakkabi')
        parts.push('');
    return parts.filter(Boolean).join(' ').trim();
}
function scoreProduct(product, input) {
    const hay = normalize(`${product.title} ${product.brand ?? ''}`);
    const reasons = [];
    let score = 0;
    if (input.rol && ROL_KEYWORDS[input.rol]) {
        if (ROL_KEYWORDS[input.rol].some((k) => hay.includes(normalize(k)))) {
            score += 25;
            reasons.push('kategori eşleşti');
        }
    }
    if (input.renk && hay.includes(normalize(input.renk))) {
        score += 30;
        reasons.push(`renk "${input.renk}"`);
    }
    else if (input.palette?.length) {
        const hit = input.palette.find((c) => hay.includes(normalize(c)));
        if (hit) {
            score += 25;
            reasons.push(`palet rengi "${hit}"`);
        }
    }
    if (input.formallik && FORALLIK_KEYWORDS[input.formallik]?.some((k) => hay.includes(normalize(k)))) {
        score += 15;
        reasons.push(`formallik ~${input.formallik}`);
    }
    if (input.brand && hay.includes(normalize(input.brand))) {
        score += 15;
        reasons.push('marka eşleşti');
    }
    const price = parsePrice(product.price ?? undefined);
    if (input.max_fiyat !== undefined && price !== undefined) {
        if (price <= input.max_fiyat) {
            score += 15;
            reasons.push('bütçe içinde');
        }
        else {
            score -= 20;
            reasons.push('bütçe üstü');
        }
    }
    if ((product.rating ?? 0) >= 4) {
        score += 10;
        reasons.push('puan ≥ 4');
    }
    if ((product.reviews ?? 0) >= 20)
        score += 5;
    return { score: Math.max(0, Math.min(100, score)), reasons };
}
function toWardrobeItem(product, mapping) {
    return {
        id: shortId('item_'),
        ad: product.title.slice(0, 80),
        rol: mapping.rol,
        kategori: mapping.kategori ?? mapping.rol,
        renk: mapping.renk,
        paletYuvasi: mapping.paletYuvasi,
        kumas: mapping.kumas,
        sezon: mapping.sezon ?? ['ilkbahar', 'sonbahar'],
        formallik: mapping.formallik,
        marka: product.brand,
        beden: mapping.beden,
        fiyat: parsePrice(product.price ?? undefined),
        alimTarihi: new Date().toISOString().slice(0, 10),
        durum: 'iyi',
        giyimSayisi: 0,
        foto: product.image,
        kaynakUrl: product.url,
    };
}
async function appendImport(item) {
    await mkdir(config.dataDir, { recursive: true });
    const file = path.join(config.dataDir, 'wardrobe-import.json');
    let list = [];
    try {
        list = JSON.parse(await readFile(file, 'utf8'));
    }
    catch {
        list = [];
    }
    list.push(item);
    await writeFile(file, JSON.stringify(list, null, 2), 'utf8');
    return file;
}
export function registerWardrobeTools(server) {
    server.registerTool('trendyol_shop_gap', {
        title: 'Shop a wardrobe gap',
        description: 'Given a wardrobe gap (role + color + size + budget + formality), search Trendyol through the real UI and return ranked candidate products with a ready-to-import wardrobe item payload.',
        inputSchema: z.object({
            rol: z.enum(ROL).optional().describe('Garment role in the capsule.'),
            query: z.string().optional().describe('Free-text search (overrides derived query).'),
            renk: z.string().optional().describe('Desired color name, e.g. "lacivert".'),
            palette: z.array(z.string()).optional().describe('Alternative acceptable colors.'),
            beden: z.string().optional().describe('Size to keep on the item payload.'),
            formallik: z.enum(FORMALLIK).optional(),
            sezon: z.array(z.enum(SEZON)).optional(),
            brand: z.string().optional(),
            max_fiyat: z.number().optional(),
            min_fiyat: z.number().optional(),
            gender: z.string().optional().describe('"Erkek" (default) or "Kadın".'),
            category_url: z.string().optional(),
            from_gap: z.boolean().optional().describe('Auto-pick the role from the top of the generated gap list.'),
            sort: z.enum(['best_sellers', 'most_reviewed', 'highest_rating', 'price_asc', 'relevance']).optional(),
            limit: z.number().int().min(1).max(60).optional().describe('Candidates to return (default 12).'),
        }),
    }, async (input) => {
        try {
            const page = await getPage();
            const gender = input.gender ?? 'Erkek';
            let rol = input.rol;
            if (!rol && input.from_gap) {
                const store = getWardrobe();
                const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
                rol = generateGaps(profile, items)[0]?.rol;
            }
            await openCategory(page, await resolveCategory(page, { category_url: input.category_url, gender }));
            await prepareFilters(page);
            const query = buildQuery({ ...input, rol, gender }) || `${gender} ${rol ?? ''}`.trim();
            const searched = await performSearch(page, `${query} ${gender}`.trim());
            if (input.min_fiyat !== undefined || input.max_fiyat !== undefined) {
                await applyPriceRange(page, input.min_fiyat, input.max_fiyat);
            }
            await applySort(page, input.sort ?? 'best_sellers');
            const limit = input.limit ?? 12;
            const products = await page.evaluate(scrapeProducts, Math.min(60, limit * 2));
            const ranked = products
                .map((product) => ({ product, ...scoreProduct(product, input) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            const insightStore = getReviewInsights();
            const brandFit = await getWardrobe().listBrandFit();
            const candidates = await Promise.all(ranked.map(async (row) => {
                const insight = await insightStore.get(row.product.url);
                const fit = brandFit.find((b) => row.product.brand && b.marka.toLocaleLowerCase('tr-TR') === row.product.brand.toLocaleLowerCase('tr-TR'));
                return {
                    score: row.score,
                    reasons: row.reasons,
                    title: row.product.title,
                    price: row.product.price,
                    brand: row.product.brand,
                    rating: row.product.rating,
                    url: row.product.url,
                    image: row.product.image,
                    reviewInsight: insight
                        ? { sizing: insight.sizing.verdict, qualityScore: insight.qualityScore }
                        : undefined,
                    brandFit: fit ? { beden: fit.beden, not: fit.not } : undefined,
                    item: rol && input.renk
                        ? toWardrobeItem(row.product, {
                            rol,
                            renk: input.renk,
                            sezon: input.sezon,
                            formallik: input.formallik ?? 'smart',
                            beden: fit?.beden ?? input.beden,
                        })
                        : undefined,
                };
            }));
            return jsonResult({
                url: page.url(),
                searched,
                criteria: { gender, rol, query, ...input },
                count: candidates.length,
                candidates,
            });
        }
        catch (error) {
            return errorResult(`shop_gap başarısız: ${error.message}`);
        }
    });
    server.registerTool('trendyol_import_to_wardrobe', {
        title: 'Build a wardrobe item from a product',
        description: 'Normalize a Trendyol product into the wardrobe-optimizer { Item } schema (ad, rol, kategori, renk, sezon, formallik, marka, beden, fiyat, foto...). Optionally append it to a local wardrobe-import.json file.',
        inputSchema: z.object({
            product: z
                .object({
                url: z.string(),
                title: z.string(),
                price: z.string().optional(),
                brand: z.string().optional(),
                image: z.string().optional(),
            })
                .describe('Product object from shop_gap/search, or a minimal {url,title}.'),
            rol: z.enum(ROL),
            renk: z.string(),
            formallik: z.enum(FORMALLIK).default('smart'),
            kategori: z.string().optional(),
            beden: z.string().optional(),
            sezon: z.array(z.enum(SEZON)).optional(),
            paletYuvasi: z.enum(['baz', 'aksan']).optional(),
            kumas: z.string().optional(),
            persist: z.boolean().optional().describe('Append to wardrobe-import.json (default true).'),
        }),
    }, async ({ product, ...mapping }) => {
        try {
            const brandFit = await getWardrobe().listBrandFit();
            const fit = product.brand
                ? brandFit.find((b) => b.marka.toLocaleLowerCase('tr-TR') === product.brand.toLocaleLowerCase('tr-TR'))
                : undefined;
            const item = toWardrobeItem(product, { ...mapping, beden: mapping.beden ?? fit?.beden });
            const file = (mapping.persist ?? true) ? await appendImport(item) : undefined;
            return jsonResult({
                item,
                brandFit: fit ? { beden: fit.beden, not: fit.not } : undefined,
                persistedTo: file,
                note: 'Bu item wardrobe-optimizer Item şemasına uyar; uygulamadaki items tablosuna ekleyin veya wardrobe-import.json dosyasını içe aktarın.',
            });
        }
        catch (error) {
            return errorResult(`import_to_wardrobe başarısız: ${error.message}`);
        }
    });
}
//# sourceMappingURL=wardrobe.js.map