import * as z from 'zod/v4';
import { getWardrobe } from '../wardrobe/db.js';
import { completeness, defaultsInUse, nextQuestions } from '../wardrobe/profile.js';
import { summarizeTaste } from '../wardrobe/taste.js';
import { errorResult, jsonResult } from '../util.js';
const PRIVACY_NOTE = 'Tüm bilgiler yalnızca bu makinede (TRENDYOL_DATA_DIR/wardrobe.json) saklanır; hiçbir yere gönderilmez. Boy/kilo gibi hassas alanlar isteğe bağlıdır, kullanıcı atlayabilir.';
function questionView(field) {
    return {
        id: field.id,
        soru: field.soru,
        ipucu: field.ipucu,
        ornek: field.ornek,
        tip: field.tip,
        secenekler: field.secenekler,
        zorunlu: field.zorunlu,
        hassas: field.hassas,
    };
}
export function statusView(profile, count = 3) {
    const c = completeness(profile);
    const sorular = nextQuestions(profile, count).map(questionView);
    const mesaj = c.zorunluTamam
        ? 'Profil kullanıma hazır. İstersen isteğe bağlı bilgilerle derinleştirebilirsin; aksi halde ihtiyaç akışına (need_start) geç.'
        : `Alışverişe başlamadan önce ${c.eksikZorunlu.length} temel bilgi eksik. Kullanıcıya doğal bir sohbetle şu soruları sor (tek seferde en fazla ${count}), cevapları onboarding_next ile kaydet.`;
    return {
        onboarded: c.zorunluTamam,
        yuzde: c.yuzde,
        eksikZorunlu: c.eksikZorunlu.map((f) => f.id),
        varsayilanKullanilan: defaultsInUse(profile),
        siradakiSorular: sorular,
        mesaj,
        gizlilik: PRIVACY_NOTE,
    };
}
const zevkInput = z.object({
    ad: z.string().trim().min(1),
    tepki: z.enum(['begendim', 'olabilir', 'olmaz']),
    etiketler: z.array(z.string().trim().min(1)).optional(),
    kategori: z.string().trim().min(1).optional(),
    marka: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
});
export function registerOnboardingTools(server) {
    server.registerTool('profile_status', {
        title: 'Profile status',
        description: 'HER OTURUMUN İLK ADIMI. Kişisel profilin tamamlanma durumunu, eksik zorunlu bilgileri ve sıradaki soruları döndürür. onboarded=false ise alışverişe geçmeden önce kullanıcıyı tanı (onboarding_next).',
        inputSchema: z.object({}),
    }, async () => jsonResult(statusView(await getWardrobe().getProfile())));
    server.registerTool('onboarding_next', {
        title: 'Onboarding: answer and get next questions',
        description: 'Kullanıcının cevaplarını profile kaydeder ve sıradaki soruları verir. Serbest metni sen alanlara eşle: anahtar = alan yolu (ör. "beden.alt", "butce", "palet.baz"), değer = tip uygun (sayı/liste/metin). Cevap vermeden çağırırsan sadece sıradaki soruları döner. kaynak="cikarim" yalnızca kullanıcı henüz onaylamadığı çıkarımlar içindir (dolu sayılmaz).',
        inputSchema: z.object({
            cevaplar: z.record(z.string(), z.unknown()).optional().describe('{ "beden.alt": "32/32", "butce": 30000, "palet.baz": ["lacivert","gri"] }'),
            kaynak: z.enum(['kullanici', 'cikarim']).optional(),
            adet: z.number().int().min(1).max(5).optional().describe('Sıradaki kaç soru dönsün (varsayılan 3).'),
        }),
    }, async ({ cevaplar, kaynak, adet }) => {
        const store = getWardrobe();
        let uygulanan = [];
        let reddedilen = [];
        if (cevaplar && Object.keys(cevaplar).length > 0) {
            const result = await store.applyProfileAnswers(cevaplar, kaynak ?? 'kullanici');
            uygulanan = result.uygulanan;
            reddedilen = result.reddedilen;
        }
        return jsonResult({ uygulanan, reddedilen, ...statusView(await store.getProfile(), adet ?? 3) });
    });
    server.registerTool('profile_import', {
        title: 'Import profile and taste data',
        description: 'Dışarıda toplanmış profil/zevk verisini içe aktarır (onboarding/form.html ve quiz.html dışa aktarımı). Biçim: { alanlar: { "<alan yolu>": değer }, zevk: [{ad, tepki, etiketler?, kategori?, marka?, url?}] }. Bilinmeyen/geçersiz alanlar reddedilir ve raporlanır.',
        inputSchema: z.object({
            alanlar: z.record(z.string(), z.unknown()).optional(),
            zevk: z.array(zevkInput).optional(),
        }),
    }, async ({ alanlar, zevk }) => {
        if (!alanlar && !zevk)
            return errorResult('alanlar veya zevk verilmeli.');
        const store = getWardrobe();
        let uygulanan = [];
        let reddedilen = [];
        if (alanlar && Object.keys(alanlar).length > 0) {
            const result = await store.applyProfileAnswers(alanlar, 'kullanici');
            uygulanan = result.uygulanan;
            reddedilen = result.reddedilen;
        }
        const kaydedilenZevk = zevk ? (await store.addZevk(zevk.map((z0) => ({ ...z0, etiketler: z0.etiketler ?? [] })))).length : 0;
        return jsonResult({ uygulanan, reddedilen, kaydedilenZevk, ...statusView(await store.getProfile()) });
    });
    server.registerTool('taste_signals', {
        title: 'Taste signals (liked / maybe / no)',
        description: 'Beğeni sinyallerini kaydet/listele/özetle. "add": kullanıcının beğendiği/beğenmediği ürünler. "summary": kategori ve etiket bazlı özet + güçlü sinyaller. Özetteki çıkarımları profile YAZMADAN önce kullanıcıya doğrulat.',
        inputSchema: z.object({
            action: z.enum(['add', 'list', 'summary']),
            sinyaller: z.array(zevkInput).optional(),
        }),
    }, async ({ action, sinyaller }) => {
        const store = getWardrobe();
        if (action === 'add') {
            if (!sinyaller?.length)
                return errorResult('add için sinyaller gerekli.');
            const saved = await store.addZevk(sinyaller.map((s) => ({ ...s, etiketler: s.etiketler ?? [] })));
            return jsonResult({ kaydedilen: saved.length });
        }
        const all = await store.listZevk();
        if (action === 'list')
            return jsonResult({ toplam: all.length, sinyaller: all });
        return jsonResult({
            ...summarizeTaste(all),
            not: 'Bunlar çıkarımdır: kullanıcıya doğrulat, sonra onboarding_next ile (kaynak=kullanici) kaydet.',
        });
    });
}
//# sourceMappingURL=onboarding.js.map