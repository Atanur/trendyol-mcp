# Araçlar, prompt'lar ve akışlar

Bu sayfa sunucunun araçlarının referansıdır. Normal kullanımda araçları sen çağırmazsın, asistan akışa göre kendisi kullanır ([README](../README.md#nasıl-çalışır)). Plugin ile kurulduğunda araçların tam adı `mcp__plugin_trendyol-wardrobe_trendyol__<araç>` biçimindedir; aşağıda kısa adlarıyla anılır.

## Kişiselleştirme

| Araç | Ne yapar |
| --- | --- |
| `profile_status` | Her oturumun ilk adımı. Profilin tamamlanma durumunu, eksik zorunlu bilgileri ve sıradaki soruları verir. |
| `onboarding_next` | Cevapları profile kaydeder ve sıradaki soruları döner. Alan yolu → değer (`"beden.alt": "32/32"`). |
| `profile_import` | Dışarıda toplanmış profil/zevk verisini içe aktarır ([`onboarding/form.html`](../onboarding/form.html) çıktısı). Geçersiz alanlar reddedilir ve raporlanır. |
| `need_start` | Cümleden asıl ihtiyacı çıkarır (rol, vesile, kumaş, kalıp, bütçe), profilden kısıtları ekler, dolap bağlamını gösterir, en fazla 2 soru sorar. Olumsuz ifadeleri ("çok sportif olmasın") yok sayar. |
| `need_update` | İhtiyacı güncelle: kombin notu, durum ve **kısa liste** (`aday_ekle`: ad, url, fiyat, durum `inceleniyor/secildi/elendi`, not). `durum=alindi` veya `vazgecildi` olunca iş bitmiş sayılır ve **Chrome otomatik kapanır**. |
| `need_list` | İhtiyaçları listele (durum filtresiyle). |
| `session_resume` | **"Nerede kalmıştık?"** Açık ihtiyaçları, kısa listedeki adayları ve her biri için bir sonraki adımı özetler. 14 günden eski ihtiyaçları "eskimiş" işaretler. Her oturumun başında `profile_status`'tan sonra çağrılır. |
| `wardrobe_quick_add` | "lacivert kot pantolon 32/32" gibi serbest satırlardan envanter kaydı oluşturur. |
| `taste_signals` | Beğendim / olabilir / olmaz sinyallerini kaydeder ve özetler. Özetteki çıkarımlar kullanıcıya doğrulatılır. |

### Kişisel değerlendirme (`kisisel` alanı)

`trendyol_search_products` ve `trendyol_find` sonuçlarındaki her ürüne eklenir. Başlık, fiyat, puan ve marka-beden hafızasından deterministik olarak hesaplanır:

- `karar`: `uygun`, `dikkat` veya `eleme`. Elenenler `trendyol_find`'da listenin sonuna taşınır, diğerlerinin alaka sırası bozulmaz.
- `uyarilar`: kadın modeli (başlıkta "kadın" yazmasa da boyfriend/mom), slim/dar kesim, yüksek bel, dar/kısa paça (bilek boy, crop), baskı, suni deri, kaçınılan renk, **palet dışı renk**, sevilmeyen kumaş, bütçe üstü fiyat, düşük puan, **daha önce en az 2 kez reddettiğin tür**.
- `olumlu`: sevdiğin kalıp (rahat kesim ve comfort fit de relaxed sayılır), sevdiğin kumaş, sık beğendiğin tür.
- `bedenOnerisi`: marka-beden hafızası varsa o, yoksa profildeki bedenin.

## Arama ve keşif

| Araç | Ne yapar |
| --- | --- |
| `trendyol_find` | **Doğal dille ara**: "lacivert rahat kot pantolon, çok dar olmasın, 1500 TL altı". Renk, tür, kalıp, kumaş, bütçe, cinsiyeti çıkarıp arar, skorlar ve `kisisel` ekler. |
| `trendyol_search_products` | Kategori/arama + çoklu filtre + fiyat aralığı + sıralama + sayfalama (parametreler aşağıda). |
| `trendyol_get_filter_options` | Sol panel filtrelerini (grup ve tüm seçenekler) ve hızlı filtreleri listeler. |
| `trendyol_get_products`, `trendyol_open_product`, `trendyol_home` | Açık listedeki ürünleri çıkar, bir ürünü aç, ana sayfa. |

## Ürün zekâsı

| Araç | Ne yapar |
| --- | --- |
| `trendyol_evaluate_product` | **Tek çağrıda değerlendirme**: detay, yorumlar (sahtelik dahil), satıcı riski, indirim (son 10 günün en düşüğü) ve benzer ürünler. |
| `trendyol_analyze_reviews` | Beden yanlılığı (dar/bol/tam), şikâyet oranları, kalite skoru, sahte yorum sinyalleri ve Trendyol AI özeti. Sonuç yerelde saklanır. |
| `trendyol_product_detail`, `trendyol_product_reviews` | Kalıp, kumaş, varyantlar ve stok; ham yorumlar. |
| `trendyol_seller_check` | Satıcı puanı, kargo, iade politikası ve risk bayrakları. |
| `trendyol_compare_products`, `trendyol_find_similar` | Yan yana karşılaştırma ve benzer (daha ucuz) alternatifler. |
| `trendyol_review_insights`, `review_photo_summary` | Kayıtlı yorum analizlerini yönet; yorum fotoğraflarını topla. |

## Fiyat ve stok takibi

`trendyol_watch_add`, `trendyol_watch_list`, `trendyol_watch_remove`, `trendyol_watch_check` (fiyat düşüşü ve hedef uyarısı), `trendyol_fake_discount_check` ("önce zam sonra indirim" tespiti), `trendyol_price_trend`, `trendyol_watch_size_add`, `trendyol_size_stock_check`, `trendyol_size_watch_list` (beden stoğa girince/tükenince uyarı).

## Sepet ve favori (ödeme yok)

`trendyol_add_to_cart` (`confirm: true` gerekir), `trendyol_cart_summary`, `trendyol_favorites`. `TRENDYOL_ENABLE_CART=false` sepet aracını kapatır.

## Gardırop ve bütçe

| Grup | Araçlar |
| --- | --- |
| Envanter | `inventory_add`, `inventory_list`, `inventory_update`, `inventory_remove` |
| Profil | `profile_get`, `profile_set` (hedef parça sayıları, palet, kurallar, bütçe, mekân×mevsim matrisi) |
| Kayıtlar | `wear_log`, `brand_fit` (marka→beden hafızası), `donation_log`, `post_purchase_update` (14 gün iade tarihi) |
| Zekâ | `generate_gap_list`, `check_against_profile`, `gap_match`, `color_match`, `fabric_score`, `outfit_count`, `capsule_coverage`, `weak_link`, `cost_per_wear`, `keep_or_go`, `one_in_one_out`, `travel_pack` |
| Alışveriş akışı | `budget_basket`, `shopping_order`, `impulse_guard`, `coupon_tracker`, `return_tracker` |
| Köprü | `trendyol_shop_gap`, `trendyol_import_to_wardrobe` |

Kayıtlı yorum analizi `check_against_profile`, `impulse_guard`, `compare_products`, `find_similar` ve `shop_gap` içinde otomatik kullanılır ("dar kalıp → bir beden büyük").

## Düşük seviye tarayıcı araçları

`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press`, `browser_select_option`, `browser_scroll`, `browser_screenshot`, `browser_wait`, `browser_history`, `browser_list_tabs`, `browser_switch_tab` ve **`browser_close`** (iş bitince Chrome penceresini ve sekmelerini kapatır; oturum profilde kalır, sonraki işlemde tarayıcı yeniden açılır; kendi Chrome'una bağlıyken (CDP) hiçbir şey kapatmaz). Trendyol arayüzü değişirse bunlarla elle konumlanılabilir: `browser_navigate → browser_snapshot → browser_click(e12) → browser_type → …`

## Prompt'lar ve kaynaklar

| Prompt | Amaç |
| --- | --- |
| `kisisel_baslangic` | Seni tanıma (onboarding) sohbetini başlatır. |
| `trendyol_beyin` | Bir isteği analiz eder, kontrol listesiyle plan çıkarır. |
| `trendyol_dogrula` | Bulunan ürünü isteğe göre madde madde denetler. |
| `trendyol_urun_degerlendir` | Bir ürün linkinden "al / düşün / alma" kararı üretir. |

Kaynaklar: `trendyol://playbook` (akış ve kontrol listesi), `trendyol://wardrobe`, `trendyol://watchlist`, `trendyol://review-insights`. Sunucu bağlanınca ayrıca kısa bir Türkçe `instructions` metni gönderir; skill desteği olmayan istemcilerde de akışı bu yönlendirir.

## `trendyol_search_products` parametreleri

| Parametre | Açıklama |
| --- | --- |
| `query` | Arama kutusuna yazılacak metin |
| `gender` | `Erkek` (varsayılan) veya `Kadın` |
| `filters` | Sol panel etiketleri (marka, kategori, beden, renk...) |
| `price_min`, `price_max` | Fiyat aralığı (TL) |
| `sort` | `best_sellers`, `most_reviewed`, `highest_rating`, `price_asc`, `price_desc`, `newest`, `relevance` |
| `quick_filters` | `Yüksek Puanlı Ürünler`, `Flaş Ürünler`, `Kargo Bedava`... |
| `pages`, `limit` | Gezilecek sayfa sayısı, dönen en fazla ürün |
| `kisisel` | Sonuçları profile göre işaretle (varsayılan `true`) |
| `rol` | Beden önerisi için aranan parçanın rolü |
| `with_insights` | Kayıtlı yorum içgörüsünü (beden/kalite) ürünlere ekle |
| `open_first` | İlk ürünü aç ve detayını getir |

## Örnek akışlar

```text
# Doğal dille arama, ardından derin inceleme
trendyol_find({ description: "lacivert rahat kot pantolon, çok dar olmasın", gender: "Erkek" })
trendyol_evaluate_product({ url: "<ürün>" })
impulse_guard({ candidate: { rol: "alt", renk: "lacivert", fiyat: 1147 } })

# Fiyat takibi (kasım indirimi için)
trendyol_watch_add({ url: "<ürün>", label: "lacivert jean", target_price: 900 })
trendyol_watch_check({})

# Dolap ve bütçe (tarayıcı gerekmez)
wardrobe_quick_add({ satirlar: ["lacivert kot pantolon 32/32", "2 adet beyaz tişört L"] })
generate_gap_list({})
budget_basket({ lines: [{ ad: "Jean", fiyat: "1147 TL", rol: "alt" }], budget: 30000 })
```
