import { normalize, truncate } from '../util.js';
/** Bu ihtiyaç durumları "iş bitti" demektir: tarayıcı kapatılır, ihtiyaç "açık" listesinden düşer. */
const FINISHED = ['alindi', 'vazgecildi'];
/** Bu kadar gündür dokunulmayan açık ihtiyaç "eskimiş" sayılır; devam etmeden önce geçerliliği sorulur. */
const STALE_DAYS = 14;
const SUMMARY_LENGTH = 60;
const MS_PER_DAY = 86_400_000;
export function isFinished(durum) {
    return FINISHED.includes(durum);
}
function keyOf(item) {
    return normalize(item.url?.trim() || item.ad);
}
/**
 * Kısa listeyi birleştirir: aynı ürün (url, yoksa ad) tekrar eklenmez, alanları güncellenir.
 * Girdiyi değiştirmez.
 */
export function mergeAdaylar(existing, incoming, today) {
    const result = existing.map((aday) => ({ ...aday }));
    for (const input of incoming) {
        const index = result.findIndex((aday) => keyOf(aday) === keyOf(input));
        if (index >= 0) {
            const current = result[index];
            result[index] = {
                ...current,
                ...(input.url !== undefined ? { url: input.url } : {}),
                ...(input.fiyat !== undefined ? { fiyat: input.fiyat } : {}),
                ...(input.durum !== undefined ? { durum: input.durum } : {}),
                ...(input.not !== undefined ? { not: input.not } : {}),
                tarih: today,
            };
        }
        else {
            result.push({
                ad: input.ad,
                ...(input.url !== undefined ? { url: input.url } : {}),
                ...(input.fiyat !== undefined ? { fiyat: input.fiyat } : {}),
                durum: input.durum ?? 'inceleniyor',
                ...(input.not !== undefined ? { not: input.not } : {}),
                tarih: today,
            });
        }
    }
    return result;
}
function daysBetween(from, to) {
    return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY));
}
function whenText(days) {
    if (days === 0)
        return 'bugün';
    if (days === 1)
        return 'dün';
    return `${days} gün önce`;
}
function nextStep(need, stale, days) {
    const adaylar = need.adaylar ?? [];
    const selected = adaylar.find((a) => a.durum === 'secildi');
    const reviewing = adaylar.filter((a) => a.durum === 'inceleniyor');
    let step;
    if (selected) {
        step = `Seçilen aday: ${selected.ad}. Satın alma için kullanıcıdan açık onay iste; alındıysa post_purchase_update ve need_update(durum=alindi).`;
    }
    else if (need.durum === 'acik') {
        step = need.sorular.length > 0 ? `Eksik bilgileri sor: ${need.sorular.join(' ')}` : 'İhtiyacı netleştir (ne, nerede, neyle giyilecek).';
    }
    else if (reviewing.length > 0) {
        step = `${reviewing.length} adayı derinlemesine karşılaştır (trendyol_evaluate_product) ve birini seç.`;
    }
    else {
        step = 'Aramaya başla (trendyol_find) ve uygun adayları need_update(aday_ekle) ile kaydet.';
    }
    return stale ? `${step} ${days} gündür dokunulmadı: önce hâlâ geçerli mi diye sor.` : step;
}
/**
 * Açık ihtiyaçlardan "nerede kalmıştık" özeti üretir: en son güncellenen başta,
 * her biri için aday sayısı ve bir sonraki adım. Bitmiş ihtiyaçlar (alındı/vazgeçildi) dahil edilmez.
 */
export function buildResume(needs, today, staleDays = STALE_DAYS) {
    const open = needs
        .filter((need) => !isFinished(need.durum))
        .sort((a, b) => b.guncelleme.localeCompare(a.guncelleme) || b.olusturma.localeCompare(a.olusturma));
    const acik = open.map((need) => {
        const gunOnce = daysBetween(need.guncelleme, today);
        const eskimis = gunOnce >= staleDays;
        const adaylar = need.adaylar ?? [];
        return {
            id: need.id,
            istek: need.istek,
            rol: need.rol,
            durum: need.durum,
            adaylar,
            guncelleme: need.guncelleme,
            gunOnce,
            eskimis,
            ozet: `${truncate(need.istek, SUMMARY_LENGTH)} · ${need.rol ?? 'rol belirsiz'} · ${need.durum} · ${adaylar.length} aday · ${whenText(gunOnce)}`,
            sonrakiAdim: nextStep(need, eskimis, gunOnce),
        };
    });
    const mesaj = acik.length === 0 ? 'Açık ihtiyaç yok.' : `${acik.length} açık ihtiyaç var. En son: ${acik[0].ozet}`;
    return { acik, mesaj };
}
//# sourceMappingURL=resume.js.map