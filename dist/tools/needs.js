import * as z from 'zod/v4';
import { getWardrobe } from '../wardrobe/db.js';
import { ROLE_LABELS, generateGaps, inferFormality } from '../wardrobe/logic.js';
import { needConstraints, parseNeed } from '../wardrobe/needs.js';
import { profileNote } from '../wardrobe/profile.js';
import { parseWardrobeLine } from '../wardrobe/quickadd.js';
import { buildResume, isFinished, mergeAdaylar } from '../wardrobe/resume.js';
import { closeBrowser } from '../browser.js';
import { errorResult, jsonResult } from '../util.js';
const ROLE = ['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar'];
const MEKAN = ['is', 'gunluk', 'ozel', 'spor', 'seyahat', 'ev'];
const DURUM = ['acik', 'arastiriliyor', 'karar', 'alindi', 'vazgecildi'];
/** Dolapta bu rolde bu kadar parçadan azı varsa "dolabı öğrenme" sorusu sorulur. */
const SPARSE_ROLE_COUNT = 3;
const MAX_LISTED_PIECES = 8;
const MAX_COPIES_PER_LINE = 5;
function missingSlots(need) {
    const missing = [];
    if (!need.rol)
        missing.push('rol');
    if (!need.vesile || need.vesile.length === 0)
        missing.push('vesile');
    if (need.kombin.length === 0)
        missing.push('kombin');
    return missing;
}
export function registerNeedTools(server) {
    server.registerTool('need_start', {
        title: 'Start from the real need',
        description: 'HER ALIŞVERİŞ İSTEĞİNİN İLK ADIMI (ürün aramadan önce). Kullanıcının cümlesinden asıl ihtiyacı çıkarır (ne, nerede giyilecek, ne ile), profilden arama kısıtlarını (beden, kalıp, bütçe, palet) birleştirir, dolapta o rolde ne olduğunu gösterir ve eksikse EN FAZLA 2 soru döner. "sorular"ı kullanıcıya sor, cevapları need_update / wardrobe_quick_add ile kaydet, sonra aramaya geç.',
        inputSchema: z.object({
            istek: z.string().describe('Kullanıcının ham isteği, ör. "iş ve akşam için rahat bir kot pantolon".'),
            kombin: z.array(z.string()).optional().describe('Kullanıcı bununla ne giyeceğini söylediyse.'),
            rol: z.enum(ROLE).optional().describe('Cümleden çıkarılamazsa sen belirt.'),
            vesile: z.array(z.enum(MEKAN)).optional(),
            butce_max: z.number().optional(),
        }),
    }, async ({ istek, kombin, rol, vesile, butce_max }) => {
        const store = getWardrobe();
        const [profile, items] = await Promise.all([store.getProfile(), store.listItems()]);
        const parsed = parseNeed(istek, { kombin });
        const finalRol = (rol ?? parsed.rol);
        const finalVesile = (vesile ?? parsed.vesile);
        const butceMax = butce_max ?? parsed.butceMax;
        const draft = { rol: finalRol, vesile: finalVesile, kombin: parsed.kombin };
        const eksik = missingSlots(draft);
        const need = await store.addNeed({
            istek,
            rol: finalRol,
            vesile: finalVesile,
            formallik: parsed.formallik,
            renk: parsed.renk,
            kalip: parsed.kalip,
            kumas: parsed.kumas,
            butceMax,
            kombin: parsed.kombin,
            sorular: parsed.sorular,
            durum: eksik.includes('rol') || eksik.includes('vesile') ? 'acik' : 'arastiriliyor',
        });
        const roleItems = finalRol ? items.filter((i) => i.rol === finalRol) : [];
        const roleGaps = finalRol ? generateGaps(profile, items).filter((g) => g.rol === finalRol) : [];
        const dolapSorusu = finalRol && roleItems.length < SPARSE_ROLE_COUNT
            ? `Dolabında şu an ${ROLE_LABELS[finalRol]} olarak hangi parçalar var? Kısaca say (ör. "lacivert kot 32/32, siyah chino"), ben kaydedeyim.`
            : undefined;
        return jsonResult({
            ihtiyac: need,
            eksik,
            sorular: parsed.sorular,
            dolapSorusu,
            kisitlar: needConstraints({ rol: finalRol, butceMax }, profile),
            dolapBaglami: finalRol
                ? {
                    rol: finalRol,
                    mevcutAdet: roleItems.length,
                    hedef: profile.hedef[finalRol],
                    parcalar: roleItems.slice(0, MAX_LISTED_PIECES).map((i) => i.ad),
                    acikAdet: roleGaps.reduce((sum, g) => sum + g.adet, 0),
                }
                : undefined,
            sonrakiAdim: eksik.includes('rol')
                ? 'Önce ne aradığını netleştir (sorular).'
                : 'Eksik bilgileri (sorular) tamamla; ardından trendyol_find / trendyol_search_products ile ara (kisisel değerlendirme sonuçlarda gelir), karar öncesi trendyol_evaluate_product + impulse_guard.',
            ...profileNote(profile),
        });
    });
    server.registerTool('need_update', {
        title: 'Update a need',
        description: 'İhtiyaç kaydını günceller: kombin notu ekle, kısa listeye aday ekle (aday_ekle), durumu değiştir (arastiriliyor/karar/alindi/vazgecildi), eksik alanları tamamla. durum=alindi veya vazgecildi olunca iş bitmiş sayılır ve Chrome otomatik kapatılır.',
        inputSchema: z.object({
            id: z.string(),
            kombin_ekle: z.array(z.string()).optional(),
            durum: z.enum(DURUM).optional(),
            rol: z.enum(ROLE).optional(),
            vesile: z.array(z.enum(MEKAN)).optional(),
            renk: z.string().optional(),
            kalip: z.string().optional(),
            kumas: z.string().optional(),
            butce_max: z.number().optional(),
            purchase_id: z.string().optional(),
            aday_ekle: z
                .array(z.object({
                ad: z.string().trim().min(1),
                url: z.string().trim().min(1).optional(),
                fiyat: z.number().nonnegative().optional(),
                durum: z.enum(['inceleniyor', 'secildi', 'elendi']).optional(),
                not: z.string().optional(),
            }))
                .optional()
                .describe('Kısa listeye ürün ekle/güncelle (aynı url/ad tekrar eklenmez). Oturum kapansa da "nerede kalmıştık" bilinsin diye bakılan her aday kaydedilmeli.'),
        }),
    }, async ({ id, kombin_ekle, durum, rol, vesile, renk, kalip, kumas, butce_max, purchase_id, aday_ekle }) => {
        const store = getWardrobe();
        if (!(await store.listNeeds()).some((n) => n.id === id))
            return errorResult(`ihtiyaç bulunamadı: ${id}`);
        const today = new Date().toISOString().slice(0, 10);
        const patchFor = (current) => ({
            ...(aday_ekle ? { adaylar: mergeAdaylar(current.adaylar ?? [], aday_ekle, today) } : {}),
            ...(kombin_ekle ? { kombin: [...current.kombin, ...kombin_ekle] } : {}),
            ...(durum ? { durum: durum } : {}),
            ...(rol ? { rol: rol } : {}),
            ...(vesile ? { vesile: vesile } : {}),
            ...(renk ? { renk } : {}),
            ...(kalip ? { kalip } : {}),
            ...(kumas ? { kumas } : {}),
            ...(butce_max !== undefined ? { butceMax: butce_max } : {}),
            ...(purchase_id ? { purchaseId: purchase_id } : {}),
        });
        const updated = await store.updateNeed(id, patchFor);
        // İş bitti (alındı/vazgeçildi): Chrome açık kalmasın. Başarısızlık güncellemeyi bozmamalı.
        let tarayiciKapatildi = false;
        if (updated && isFinished(updated.durum)) {
            tarayiciKapatildi = await closeBrowser().then(() => true, () => false);
        }
        return jsonResult({ ihtiyac: updated, eksik: updated ? missingSlots(updated) : [], tarayiciKapatildi });
    });
    server.registerTool('session_resume', {
        title: 'Where did we leave off?',
        description: 'OTURUM BAŞINDA (profile_status sonrası) ÇAĞIR. Açık ihtiyaçları, kısa listedeki adayları ve her biri için bir sonraki adımı özetler. Açık ihtiyaç varsa kullanıcıya "geçen sefer X\'te kalmıştık, devam edelim mi?" diye sor; 14 günden eskiyse önce hâlâ geçerli mi diye sor.',
        inputSchema: z.object({}),
    }, async () => {
        const needs = await getWardrobe().listNeeds();
        return jsonResult(buildResume(needs, new Date().toISOString().slice(0, 10)));
    });
    server.registerTool('need_list', {
        title: 'List needs',
        description: 'Kayıtlı ihtiyaçları listeler (isteğe bağlı durum filtresi).',
        inputSchema: z.object({ durum: z.enum(DURUM).optional() }),
    }, async ({ durum }) => {
        const all = await getWardrobe().listNeeds();
        const needs = durum ? all.filter((n) => n.durum === durum) : all;
        return jsonResult({ toplam: needs.length, ihtiyaclar: needs });
    });
    server.registerTool('wardrobe_quick_add', {
        title: 'Quickly add wardrobe pieces from plain lines',
        description: 'Sohbette öğrenilen dolap parçalarını hızlıca kaydeder: her satır serbest metin ("lacivert kot pantolon 32/32", "2 adet beyaz tişört L"). Rol çıkarılamayan satırlar reddedilir ve raporlanır. ihtiyac_id verilirse eklenen parçalar o ihtiyacın "kombin" notlarına da yazılır.',
        inputSchema: z.object({
            satirlar: z.array(z.string()).min(1),
            ihtiyac_id: z.string().optional(),
        }),
    }, async ({ satirlar, ihtiyac_id }) => {
        const store = getWardrobe();
        const eklenen = [];
        const reddedilen = [];
        const kirpilan = [];
        for (const line of satirlar) {
            const parsed = parseWardrobeLine(line);
            if (!parsed.ok) {
                reddedilen.push({ satir: parsed.satir, neden: parsed.neden });
                continue;
            }
            const copies = Math.min(parsed.item.adet, MAX_COPIES_PER_LINE);
            if (parsed.item.adet > MAX_COPIES_PER_LINE) {
                kirpilan.push({ satir: line, istenen: parsed.item.adet, eklenen: copies });
            }
            for (let i = 0; i < copies; i += 1) {
                const item = await store.addItem({
                    ad: parsed.item.ad,
                    rol: parsed.item.rol,
                    renk: parsed.item.renk,
                    beden: parsed.item.beden,
                    formallik: inferFormality(parsed.item.ad),
                });
                eklenen.push({ id: item.id, ad: item.ad, rol: item.rol, renk: parsed.item.renk, beden: parsed.item.beden });
            }
        }
        let ihtiyac;
        if (ihtiyac_id && eklenen.length > 0) {
            const names = [...new Set(eklenen.map((e) => e.ad))];
            ihtiyac = await store.updateNeed(ihtiyac_id, (current) => ({ kombin: [...current.kombin, ...names] }));
        }
        return jsonResult({ eklenen: eklenen.length, parcalar: eklenen, reddedilen, kirpilan, ihtiyac });
    });
}
//# sourceMappingURL=needs.js.map