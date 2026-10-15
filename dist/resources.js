import { getStore } from './store.js';
import { getWardrobe } from './wardrobe/db.js';
import { getReviewInsights } from './reviewinsights.js';
import { capsuleCoverage, generateGaps } from './wardrobe/logic.js';
export function registerResources(server) {
    server.registerResource('watchlist', 'trendyol://watchlist', {
        title: 'Trendyol price watchlist',
        mimeType: 'application/json',
    }, async (uri) => {
        const entries = await getStore().list();
        const payload = {
            count: entries.length,
            items: entries.map((entry) => ({
                id: entry.id,
                label: entry.label ?? entry.title,
                url: entry.url,
                brand: entry.brand,
                targetPrice: entry.targetPrice,
                baselinePrice: entry.baselinePrice,
                lastPrice: entry.lastPrice,
                lastCheckedAt: entry.lastCheckedAt,
                history: entry.history,
            })),
        };
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(payload, null, 2),
                },
            ],
        };
    });
    server.registerResource('wardrobe', 'trendyol://wardrobe', {
        title: 'Wardrobe inventory, profile and gaps',
        mimeType: 'application/json',
    }, async (uri) => {
        const store = getWardrobe();
        const [data, profile] = await Promise.all([store.snapshot(), store.getProfile()]);
        const payload = {
            itemCount: data.items.length,
            profile,
            gaps: generateGaps(profile, data.items).slice(0, 20),
            coverageEmpty: capsuleCoverage(profile, data.items).emptyCount,
            items: data.items,
        };
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(payload, null, 2),
                },
            ],
        };
    });
    server.registerResource('review-insights', 'trendyol://review-insights', {
        title: 'Saved product review analyses',
        mimeType: 'application/json',
    }, async (uri) => {
        const entries = await getReviewInsights().list();
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({ count: entries.length, items: entries }, null, 2),
                },
            ],
        };
    });
    server.registerResource('playbook', 'trendyol://playbook', {
        title: 'Shopping playbook (checklist)',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'text/markdown',
                text: [
                    '# Trendyol alışveriş playbook',
                    '',
                    '## Akış (her işlem)',
                    '1. **Anla** — niyet, kategori/rol, nitelikler (renk/kumaş/kalınlık/kalıp/desen), kısıtlar (bütçe/beden/marka/vesile), belirsizlikler.',
                    '2. **Planla** — araç sırası: get_filter_options → search_products (filtre/sıralama/sayfa) → product_detail → analyze_reviews → seller_check → fake_discount_check.',
                    '3. **Uygula** — UI üzerinden; gerekirse browser_snapshot ile konumlan.',
                    '4. **Doğrula** — trendyol_dogrula ile "geçerli mi?"; değilse filtreyi/sorguyu güncelle.',
                    '',
                    '## Kontrol listesi',
                    '- Kumaş/kompozisyon, kalınlık & mevsim uygunluğu',
                    '- Kalıp (slim/regular/oversize)',
                    '- Beden varyantları & stok',
                    '- Yorumlar (ince/kalın/çekti/dar/bol/terletir/kalitesiz) + AI özeti + beden yanlılığı',
                    '- Satıcı puanı, kargo, iade',
                    '- Fiyat, üstü çizili, son 10 günün en düşüğü, abartılı indirim',
                    '- Profil uyumu (palet, kaçınılanlar, kurallar, bütçe)',
                    '',
                    '## Araçlar',
                    '- Ara: `trendyol_find`, `trendyol_get_filter_options`, `trendyol_search_products`, `trendyol_get_products`',
                    '- İncele: `trendyol_product_detail`, `trendyol_analyze_reviews`, `trendyol_seller_check`, `trendyol_find_similar`, `trendyol_compare_products`',
                    '- Fiyat: `trendyol_fake_discount_check`, `trendyol_price_trend`, `trendyol_watch_*`',
                    '- Gardırop: `inventory_*`, `profile_*`, `generate_gap_list`, `check_against_profile`, `impulse_guard`',
                    '- Kişiselleştirme: `profile_status` (her oturum başı), `onboarding_next`, `profile_import`, `taste_signals`, `need_start` → `need_update` → `need_list`, `wardrobe_quick_add`',
                    '',
                    '## Kişisel akış',
                    '1. `profile_status` → eksikse `onboarding_next` ile tanı (en fazla 3 soru).',
                    '2. İstek = ihtiyaç: `need_start` (en fazla 2 soru, dolap sorusu) → cevapları `need_update` / `wardrobe_quick_add` ile kaydet.',
                    '3. Ara: sonuçlardaki `kisisel` (uygun/dikkat/eleme, uyarılar, bedenOnerisi) kullanıcıya açıklanır; elenenler önerilmez.',
                    '4. Karar: `trendyol_evaluate_product` + `impulse_guard`; alındıysa `need_update(durum=alindi)` + `post_purchase_update`.',
                ].join('\n'),
            },
        ],
    }));
}
//# sourceMappingURL=resources.js.map