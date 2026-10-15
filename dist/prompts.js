import * as z from 'zod/v4';
const CHECKLIST = `
KIYAFET KONTROL LİSTESİ (her aday için mümkün olduğunca doğrula):
- Kumaş & kompozisyon: Materyal Bileşeni / Kumaş Tipi (Dokuma/Örme), kalınlık ve mevsim uygunluğu
  (ör. "kalın kışlık" → yün/kaşmir/polar/üç iplik, yüksek gramaj; "yazlık" → keten/pamuk/viskon, ince dokuma).
- Kalıp (fit): slim/regular/oversize/relaxed; istenmeyen kalıbı ele.
- Beden & stok: beden varyantları ve stokta olup olmadığı (beden tablosu, model boyu/kilosu).
- Yorumlar: "ince/kalın/çekti/dar/bol/terletir/kokuyor/dikiş/kalitesiz" gibi sinyaller + Trendyol AI özeti + beden yanlılığı.
- Satıcı & iade: satıcı puanı, ücretsiz kargo, iade süresi, risk bayrakları.
- Fiyat: güncel fiyat, üstü çizili fiyat, "son 10 günün en düşük fiyatı", gerçek/abartılı indirim.
- Profil uyumu: renk paleti, kaçınılanlar, kurallar (slim/sentetik deri/baskı/polyester), bütçe.
`.trim();
function brainText(args) {
    return [
        'Sen Trendyol alışveriş asistanının BEYNİSİN. Görünür tarayıcıyı UI üzerinden süreceksin; hardcoded linklere güvenme.',
        'Amacın: kullanıcının isteğini önce ANLAMAK, sonra bir PLAN çıkarmak, planı araçlarla UYGULAMAK ve sonunda DOĞRULAMAK.',
        '',
        `İSTEK: ${args.istek}`,
        args.cinsiyet ? `Cinsiyet ipucu: ${args.cinsiyet}` : '',
        args.butce ? `Bütçe ipucu: ${args.butce}` : '',
        args.baglam ? `Bağlam: ${args.baglam}` : '',
        '',
        'ADIM 0 — TANI: profile_status çağır. onboarded=false ise önce kullanıcıyı tanı (onboarding_next, en fazla 3 soru). Sonra need_start({ istek }) ile asıl ihtiyacı ve profil kısıtlarını al; sorular varsa kullanıcıya sor.',
        '',
        'ADIM 1 — ANLA (şimdiye kadar öğrendiklerinle; henüz arama yapma, sadece düşün ve yaz):',
        '- Niyet: ürün mü aranıyor, karşılaştırma mı, analiz mi, izleme mi?',
        '- Kategori & rol: üst/alt/katman/dış/ayakkabı/aksesuar; hangi giysi (gömlek, kazak, mont...).',
        '- Nitelikler: renk, kumaş, kalınlık/mevsim, kalıp, desen/baskı, kol/yaka tipi.',
        '- Kısıtlar: bütçe, beden, marka (varsa), vesile (iş/düğün/günlük/spor).',
        '- Belirsizlikler: neyi bilmiyorsun ve arama sırasında neyi doğrulaman gerekiyor?',
        '',
        'ADIM 2 — PLAN (kısa, madde madde):',
        '- Hangi araçlar, hangi sırayla? Örn: trendyol_find / trendyol_get_filter_options → trendyol_search_products (filtre+sıralama+sayfa) → trendyol_product_detail → trendyol_analyze_reviews → trendyol_seller_check → trendyol_fake_discount_check.',
        '- Her aday için hangi kontrol yapılacak (aşağıdaki liste).',
        '',
        CHECKLIST,
        '',
        'ADIM 3 — UYGULA: Planı araç çağrılarıyla yürüt. UI değişirse browser_snapshot ile konumlan. Emin olmadığın yerde kullanıcıya tek soru sor.',
        '',
        'ADIM 4 — DOĞRULA: En iyi 1-3 aday için trendyol_dogrula prompt’unu çalıştır (istek + bulunan özet) ve "geçerli mi?" sorusunu yanıtla. Eksik/yanlışsa filtreleri/sorguyu güncelleyip tekrar dene.',
        '',
        'ÇIKTI: (1) anladığın kriterler, (2) plan, (3) en iyi adaylar (ad/marka/fiyat/puan/neden), (4) doğrulama sonucu, (5) gerekirse takip önerisi (izleme, benzer, alternatif).',
    ]
        .filter(Boolean)
        .join('\n');
}
function verifyText(args) {
    return [
        'Trendyol alışveriş asistanının DOĞRULAMA adımındasın. Bulunan sonucu, kullanıcının isteğine göre denetle.',
        '',
        `İSTEK: ${args.istek}`,
        `BULUNAN: ${args.bulunan}`,
        '',
        'Yap:',
        '- İsteğin her kriterini (kategori, renk, kumaş/kalınlık, mevsim, kalıp, beden/stok, bütçe, vesile) tek tek eşleştir.',
        '- Her kriter için "eşleşti / kısmen / eşleşmedi" de ve KANIT ver (ürün bilgisi, yorum, fiyat).',
        '- Emin olmadığın noktaları belirt (ör. kumaş kompozisyonu eksikse trendyol_product_detail ile doğrula).',
        '- Genel karar: "geçerli" / "kısmen geçerli" / "geçersiz".',
        '- Geçersizse: hangi filtre/sorgu değişmeli ve hangi araçlarla yeniden deneneceğini yaz.',
        '',
        'Kısa ve kanıta dayalı yanıtla.',
    ].join('\n');
}
const ONBOARDING_TEXT = [
    'Kullanıcıyı tanıyıp kişisel profilini kurmanı istiyorum. Dostça ve kısa ol; form doldurtma, sohbet et.',
    '',
    '1) profile_status çağır. onboarded=true ise ne bildiğini kısaca özetle ve neyi değiştirmek/derinleştirmek istediğini sor.',
    '2) onboarded=false ise siradakiSorular’ı en fazla 3’er soru halinde, doğal cümlelerle sor. Kullanıcının cevabını alan yollarına eşleyip onboarding_next({ cevaplar }) ile kaydet. Reddedilen alan olursa nedenini söyleyip yeniden sor.',
    '3) Boy/kilo gibi hassas alanlar isteğe bağlı: sorarken verilerin yalnızca bu makinede kaldığını söyle, atlamasına izin ver.',
    '4) Kullanıcı dışarıda doldurduğu bir form/JSON getirirse profile_import ile aktar. Beğendiği/beğenmediği ürünler için taste_signals kullan; özetteki çıkarımları kaydetmeden önce kullanıcıya doğrulat.',
    '5) Zorunlu bilgiler tamamlanınca dolabını tanımak için sor: “En çok giydiğin 5-6 parça neler?” ve wardrobe_quick_add ile kaydet. Sonra ne için alışveriş yapmak istediğini sor (need_start).',
].join('\n');
export function registerPrompts(server) {
    server.registerPrompt('kisisel_baslangic', {
        title: 'Kişisel başlangıç (onboarding)',
        description: 'Kullanıcıyı tanır: amaç, yaşam, beden, kalıp, stil ve bütçe. İlk kurulumda ya da profili güncellerken çalıştır.',
        argsSchema: z.object({}),
    }, () => ({ messages: [{ role: 'user', content: { type: 'text', text: ONBOARDING_TEXT } }] }));
    server.registerPrompt('trendyol_beyin', {
        title: 'Trendyol beyni (analiz + plan)',
        description: 'HER İŞLEMİN BAŞLANGICI. Ham isteği analiz eder, kıyafet kontrol listesiyle detaylı bir plan çıkarır, araçları sıralar ve sonunda doğrulamayı söyler. Bir alışveriş/ürün isteği geldiğinde önce bunu çalıştır.',
        argsSchema: z.object({
            istek: z.string().describe('Kullanıcının ham isteği, örn. "kalın kışlık bir gömlek arıyorum".'),
            cinsiyet: z.string().optional(),
            butce: z.string().optional(),
            baglam: z.string().optional(),
        }),
    }, (args) => ({
        messages: [{ role: 'user', content: { type: 'text', text: brainText(args) } }],
    }));
    server.registerPrompt('trendyol_dogrula', {
        title: 'Trendyol doğrulama (geçerli mi?)',
        description: 'İŞLEMİN BİTİŞİ. Bulunan link/içeriği, isteğe göre madde madde denetler ve "geçerli mi?" kararını kanıtla verir. Beynin son adımı.',
        argsSchema: z.object({
            istek: z.string(),
            bulunan: z.string().describe('Bulunan aday(lar)ın özeti (ad/marka/fiyat/özellik/link).'),
        }),
    }, (args) => ({
        messages: [{ role: 'user', content: { type: 'text', text: verifyText(args) } }],
    }));
    server.registerPrompt('trendyol_urun_degerlendir', {
        title: 'Ürün değerlendir (link → yargı)',
        description: 'Bir ürün linki verildiğinde: detay + yorumlar (beden/şikayet + sahtelik sinyalleri) + satıcı riski + indirim + benzer ürün kıyası ile değerlendirir ve net bir "al / düşün / alma" yargısı kurar.',
        argsSchema: z.object({
            url: z.string().describe('Değerlendirilecek ürün linki.'),
            istek: z.string().optional().describe('Kullanıcının beklentisi (ör. "kalın kışlık gömlek").'),
        }),
    }, ({ url, istek }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: [
                        'Bir Trendyol ürününü değerlendireceksin. Görünür tarayıcıyı kullan.',
                        '',
                        `Ürün: ${url}`,
                        istek ? `Beklenti: ${istek}` : '',
                        '',
                        '1) trendyol_evaluate_product({ url }) çağır — detay, yorumlar+sahtelik sinyalleri, satıcı riski, indirim ve benzer ürünler tek seferde gelir.',
                        '2) SAHTE YORUM kontrolü: reviews.authenticity.fakeRatio ve flagged listesine bak. Aşırı kısa+tam puanlı, şablon övgü, tekrar eden metin, ünlem/emoji yığını, beden/boy-kilo bilgisi olmayan yorumlar şüphelidir. Bu oranı nihai puanda hafifçe cezalandır.',
                        '3) KALIP: reviews.sizing.verdict → "dar kalıp, bir beden büyük düşün" gibi somut öneri.',
                        '4) KALİTE/KUMAŞ: product.fabric/fabricType + reviews.qualityScore ve şikayet oranları (ince kumaş, dikiş, çekme, terletir).',
                        '5) FİYAT: price.discountPct, product.lowestPrice10d (son 10 günün en düşüğü) ve kayıtlı geçmiş → "gerçek indirim mi, abartılı mı".',
                        '6) SATICI: seller.riskLevel + flags (iade/kargo).',
                        '7) KIYAS: similar listesindeki benzer ürünlerle fiyat/puan farkını değerlendir; gerekirse en iyi 1-2 alternatifi trendyol_product_detail ile derinleştir.',
                        '',
                        'Sonuç: kısa bir "özet", "artılar", "eksiler/riskler", sahte yorum notu, beden önerisi ve net KARAR (al / düşün / alma) + gerekçe. İsteğe göre uygunluk (kalın kışlık mı vb.) belirt.',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                },
            },
        ],
    }));
    server.registerPrompt('urun-avi', {
        title: 'Trendyol ürün avı',
        description: 'Hedefe göre yönlendirilmiş ürün avı (beynin basit bir örneği).',
        argsSchema: z.object({
            hedef: z.string(),
            butce: z.string().optional(),
            beden: z.string().optional(),
            renk: z.string().optional(),
            marka: z.string().optional(),
            cinsiyet: z.string().optional(),
        }),
    }, ({ hedef, butce, beden, renk, marka, cinsiyet }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: [
                        'Sen Trendyol üzerinde alışveriş asistanısın. Görünür tarayıcıyı UI üzerinden süreceksin (linklere güvenme).',
                        '',
                        `İstenen: ${hedef}`,
                        renk ? `Renk: ${renk}` : '',
                        marka ? `Marka: ${marka}` : '',
                        beden ? `Beden: ${beden}` : '',
                        cinsiyet ? `Cinsiyet: ${cinsiyet}` : '',
                        butce ? `Bütçe: <= ${butce} TL` : '',
                        '',
                        'Adımlar:',
                        '1) trendyol_get_filter_options ile mevcut kategori/marka/cinsiyet/beden/renk seçeneklerini gör.',
                        '2) trendyol_search_products çağırarak aramayı yap; uygun filtreleri (kategori, marka, renk, beden) ve fiyat aralığını uygula, en çok satan/en yüksek puanlı sıralamasını kullan ve gerekirse birkaç sayfa topla.',
                        '3) Adayları bütçe, renk uyumu ve puana göre 3-5 taneye indir.',
                        '4) En iyi aday için trendyol_product_detail ve gerekirse trendyol_analyze_reviews ile detay/yorum özeti çıkar.',
                        '5) Sonucu; ürün adı, marka, fiyat, puan, kısa artı/eksi özeti ve doğrudan ürün linki ile sun. Fiyatı düşerse takip için trendyol_watch_add öner.',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                },
            },
        ],
    }));
}
//# sourceMappingURL=prompts.js.map