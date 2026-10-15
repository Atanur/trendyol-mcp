import * as z from 'zod/v4';
import { getWardrobe, returnDeadline } from '../wardrobe/db.js';
import { classifyRole, inferFormality } from '../wardrobe/logic.js';
import { errorResult, jsonResult, parsePrice } from '../util.js';
const ROLE = ['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar'];
const SEZON = ['ilkbahar', 'yaz', 'sonbahar', 'kis'];
const FORMALLIK = ['resmi', 'smart', 'gunluk', 'spor'];
const MEKAN = ['is', 'gunluk', 'ozel', 'spor', 'seyahat', 'ev'];
const itemInput = z.object({
    ad: z.string(),
    rol: z.enum(ROLE).optional().describe('Boşsa kategori/ad üzerinden tahmin edilir.'),
    kategori: z.string().optional(),
    renk: z.string().optional(),
    kumas: z.string().optional(),
    kompozisyon: z.array(z.object({ material: z.string(), percent: z.number().optional() })).optional(),
    kalip: z.string().optional(),
    baski: z.boolean().optional(),
    sezon: z.array(z.enum(SEZON)).optional(),
    formallik: z.enum(FORMALLIK).optional(),
    mekan: z.array(z.enum(MEKAN)).optional(),
    marka: z.string().optional(),
    beden: z.string().optional(),
    fiyat: z.number().optional(),
    durum: z.enum(['iyi', 'orta', 'yipranmis']).optional(),
    giyimSayisi: z.number().optional(),
    foto: z.string().optional(),
    kaynakUrl: z.string().optional(),
});
export function registerInventoryTools(server) {
    server.registerTool('inventory_add', {
        title: 'Add wardrobe items',
        description: 'Store one or many inventory items (the table you extract from a photo). Role is inferred from category/name when omitted.',
        inputSchema: z.object({
            items: z.array(itemInput).min(1),
        }),
    }, async ({ items }) => {
        const store = getWardrobe();
        const added = [];
        for (const input of items) {
            const rol = (input.rol ?? classifyRole(`${input.kategori ?? ''} ${input.ad}`));
            if (!rol) {
                return errorResult(`"${input.ad}" için rol belirlenemedi; 'rol' alanını ver.`);
            }
            const item = await store.addItem({
                ...input,
                rol,
                kategori: input.kategori ?? input.ad,
                formallik: (input.formallik ?? inferFormality(input.ad)),
                kompozisyon: input.kompozisyon,
                sezon: input.sezon,
                mekan: input.mekan,
            });
            added.push(item);
        }
        return jsonResult({ added: added.length, items: added });
    });
    server.registerTool('inventory_list', { title: 'List wardrobe items', description: 'List all stored inventory items.', inputSchema: z.object({}) }, async () => {
        const items = await getWardrobe().listItems();
        const byRole = {};
        for (const item of items)
            byRole[item.rol] = (byRole[item.rol] ?? 0) + 1;
        return jsonResult({ count: items.length, byRole, items });
    });
    server.registerTool('inventory_update', {
        title: 'Update a wardrobe item',
        description: 'Patch a stored item by id.',
        inputSchema: z.object({ id: z.string(), patch: itemInput.partial() }),
    }, async ({ id, patch }) => {
        const item = await getWardrobe().updateItem(id, patch);
        return item ? jsonResult({ item }) : errorResult(`item bulunamadı: ${id}`);
    });
    server.registerTool('inventory_remove', { title: 'Remove a wardrobe item', description: 'Remove an item by id.', inputSchema: z.object({ id: z.string() }) }, async ({ id }) => jsonResult({ removed: await getWardrobe().removeItem(id) }));
    server.registerTool('profile_set', {
        title: 'Set wardrobe profile',
        description: 'Store/merge the wardrobe profile: role targets (~50 pieces), color palette (baz/aksan), avoided colors, rules (slim/sentetik deri/baskı/polyester), budget, and the mekan×mevsim coverage matrix.',
        inputSchema: z.object({
            hedef: z.record(z.string(), z.number()).optional().describe('Rol başına hedef adet (ör. {"ust":12,"alt":8}).'),
            palet: z.object({ baz: z.array(z.string()), aksan: z.array(z.string()) }).partial().optional(),
            kacinanlar: z.array(z.string().trim().min(1)).optional(),
            kurallar: z
                .object({
                slimYok: z.boolean().optional(),
                sentetikDeriYok: z.boolean().optional(),
                baskiYok: z.boolean().optional(),
                maxPolyester: z.number().optional(),
            })
                .optional(),
            butce: z.number().optional(),
            sezonSayisi: z.union([z.literal(2), z.literal(4)]).optional(),
            mekanMevsim: z
                .record(z.string(), z.record(z.string(), z.number()))
                .optional()
                .describe('Mekan → { sezon: min adet } matrisi.'),
            formallikMerkezi: z.number().optional(),
            // v2 bölümleri (kişiselleştirme). Adım adım toplamak için onboarding_next daha uygundur.
            amac: z.object({ neden: z.string(), yonelim: z.array(z.string()), pencere: z.string() }).partial().optional(),
            yasam: z
                .object({
                sehir: z.string(),
                iklim: z.string(),
                isOrtami: z.string(),
                haftalik: z.partialRecord(z.enum(MEKAN), z.number().min(0).max(7)),
                spor: z.string(),
                seyahat: z.string(),
                ozelEtkinlikler: z.string(),
            })
                .partial()
                .optional(),
            beden: z
                .object({
                boy: z.number().nonnegative(),
                kilo: z.number().nonnegative(),
                hedefKilo: z.number().nonnegative(),
                ust: z.string().trim().min(1),
                alt: z.string().trim().min(1),
                ayakkabi: z.string().trim().min(1),
                vucutNotlari: z.array(z.string().trim().min(1)),
            })
                .partial()
                .optional(),
            kalip: z
                .object({
                sevilen: z.array(z.string().trim().min(1)),
                kacinilan: z.array(z.string().trim().min(1)),
                pacaKurali: z.string(),
                bel: z.enum(['dusuk', 'orta', 'yuksek']),
            })
                .partial()
                .optional(),
            butceDavranisi: z
                .object({
                tekUrunUst: z.number().nonnegative(),
                taksit: z.enum(['hayir', 'gerekirse', 'serbest']),
                egilim: z.enum(['planli', 'durtusel', 'karisik']),
            })
                .partial()
                .optional(),
            stilKelimeleri: z.array(z.string().trim().min(1)).optional(),
            sevilenKumaslar: z.array(z.string().trim().min(1)).optional(),
            sevilmeyenKumaslar: z.array(z.string().trim().min(1)).optional(),
        }),
    }, async (patch) => {
        const profile = await getWardrobe().setProfile(patch);
        return jsonResult({ profile });
    });
    server.registerTool('profile_get', { title: 'Get wardrobe profile', description: 'Return the stored profile (or defaults).', inputSchema: z.object({}) }, async () => jsonResult({ profile: await getWardrobe().getProfile() }));
    server.registerTool('wear_log', {
        title: 'Log a wear',
        description: 'Record that an item was worn (bumps its wear count and last-worn date).',
        inputSchema: z.object({ itemId: z.string(), tarih: z.string().optional(), baglam: z.string().optional(), memnuniyet: z.number().min(1).max(5).optional() }),
    }, async ({ itemId, tarih, baglam, memnuniyet }) => {
        const log = await getWardrobe().addWear({ itemId, tarih: tarih ?? new Date().toISOString().slice(0, 10), baglam, memnuniyet });
        return jsonResult({ log });
    });
    server.registerTool('brand_fit', {
        title: 'Brand fit memory',
        description: 'Store or list per-brand sizing memory (e.g. "Mavi 32/32 oldu, Zara dar geldi").',
        inputSchema: z.object({
            action: z.enum(['set', 'list']),
            marka: z.string().optional(),
            beden: z.string().optional(),
            not: z.string().optional(),
        }),
    }, async ({ action, marka, beden, not }) => {
        const store = getWardrobe();
        if (action === 'list')
            return jsonResult({ entries: await store.listBrandFit() });
        if (!marka || !beden)
            return errorResult('set için marka ve beden gerekli.');
        const entry = await store.setBrandFit({ marka, beden, not, tarih: new Date().toISOString().slice(0, 10) });
        return jsonResult({ entry });
    });
    server.registerTool('donation_log', {
        title: 'Donation log',
        description: 'Record or list donated pieces.',
        inputSchema: z.object({ action: z.enum(['add', 'list']), ad: z.string().optional(), itemId: z.string().optional(), not: z.string().optional() }),
    }, async ({ action, ad, itemId, not }) => {
        const store = getWardrobe();
        if (action === 'list') {
            const donations = await store.listDonations();
            return jsonResult({ total: donations.length, donations });
        }
        if (!ad)
            return errorResult('add için ad gerekli.');
        const donation = await store.addDonation({ ad, itemId, not });
        return jsonResult({ donation });
    });
    server.registerTool('post_purchase_update', {
        title: 'Post-purchase update',
        description: 'After buying: record the purchase (with a 14-day return deadline), optionally add it to the inventory, and mark related gaps as progressed.',
        inputSchema: z.object({
            ad: z.string(),
            url: z.string().optional(),
            fiyat: z.union([z.number(), z.string()]).optional(),
            marka: z.string().optional(),
            beden: z.string().optional(),
            kategori: z.string().optional(),
            rol: z.enum(ROLE).optional(),
            renk: z.string().optional(),
            add_to_inventory: z.boolean().optional(),
            return_days: z.number().optional(),
            beden_not: z.string().optional().describe('Beden uyum notu; marka+beden verilirse marka-beden hafızasına yazılır.'),
        }),
    }, async ({ ad, url, fiyat, marka, beden, kategori, rol, renk, add_to_inventory, return_days, beden_not }) => {
        const store = getWardrobe();
        const today = new Date().toISOString().slice(0, 10);
        const resolvedRole = (rol ?? classifyRole(`${kategori ?? ''} ${ad}`));
        let item;
        if (add_to_inventory ?? true) {
            item = await store.addItem({
                ad,
                rol: resolvedRole ?? 'ust',
                kategori: kategori ?? ad,
                renk,
                marka,
                beden,
                fiyat: typeof fiyat === 'string' ? parsePrice(fiyat) : fiyat,
                kaynakUrl: url,
            });
        }
        const purchase = await store.addPurchase({
            ad,
            url,
            fiyat: typeof fiyat === 'string' ? parsePrice(fiyat) : fiyat,
            marka,
            beden,
            kategori,
            rol: resolvedRole,
            alimTarihi: today,
            iadeSonTarih: returnDeadline(today, return_days ?? 14),
            itemId: item?.id,
        });
        const brandFit = marka && beden ? await store.setBrandFit({ marka, beden, not: beden_not, tarih: today }) : undefined;
        return jsonResult({ purchase, item, brandFit });
    });
}
//# sourceMappingURL=inventory.js.map