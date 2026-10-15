/** Bir kategoriyi "güçlü sinyal" saymak için gereken en az tepki sayısı. */
const MIN_SIGNAL = 2;
function zero() {
    return { begendim: 0, olabilir: 0, olmaz: 0 };
}
/**
 * Zevk sinyallerini özetler. Çıkarımlar **öneridir**: profile yazılmadan önce
 * kullanıcıya onaylatılmalıdır (kaynak "cikarim" → onay → "kullanici").
 */
export function summarizeTaste(signals) {
    const toplam = zero();
    // Kullanıcı/LLM kaynaklı anahtarlar ("__proto__" gibi) Object.prototype'ı kirletmesin: prototipsiz nesne.
    const kategoriler = Object.create(null);
    const etiketler = Object.create(null);
    for (const signal of signals) {
        toplam[signal.tepki] += 1;
        const key = signal.kategori?.trim() || 'diğer';
        kategoriler[key] ??= zero();
        kategoriler[key][signal.tepki] += 1;
        if (signal.tepki === 'olabilir')
            continue;
        for (const tag of signal.etiketler) {
            etiketler[tag] ??= { olumlu: 0, olumsuz: 0 };
            if (signal.tepki === 'begendim')
                etiketler[tag].olumlu += 1;
            else
                etiketler[tag].olumsuz += 1;
        }
    }
    const gucluSinyaller = [];
    for (const [kategori, counts] of Object.entries(kategoriler)) {
        if (counts.begendim >= MIN_SIGNAL) {
            gucluSinyaller.push({ tur: 'seviyor', kategori, aciklama: `${kategori}: ${counts.begendim} kez beğenildi.` });
        }
        else if (counts.olmaz >= MIN_SIGNAL && counts.begendim === 0) {
            gucluSinyaller.push({ tur: 'reddediyor', kategori, aciklama: `${kategori}: ${counts.olmaz} kez reddedildi, hiç beğenilmedi.` });
        }
    }
    return { toplam, kategoriler, etiketler, gucluSinyaller };
}
//# sourceMappingURL=taste.js.map