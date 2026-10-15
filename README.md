# trendyol-mcp

Trendyol üzerinde **gerçek bir tarayıcıyı (Chrome) kullanıcı gibi sürerek** ürün arayan bir
[MCP](https://modelcontextprotocol.io) sunucusu. Hardcoded linklere/selector'lara bağlı değildir:
sayfadaki etkileşimli UI öğelerini `e1, e2, ...` gibi ref'lere çevirir, sol paneldeki
**kategori / marka / cinsiyet / beden / renk / fiyat** filtrelerini ve sıralamayı
(en çok satan, en çok değerlendirilen, en yüksek puanlı...) tek tek tıklar ve sonuçtaki ürünleri
çıkarır.

Tarayıcı **görünür** açılır ve senin makinende kalıcı bir profille çalışır, yani tüm süreci canlı
izleyebilir, gerekirse müdahale edebilirsin (örn. giriş yapmak, captcha geçmek).

Ayrıca: ürün detayı + varyant/stok, **yorum & Trendyol AI özeti**, fiyat takibi (yerel geçmiş +
düşüş uyarısı), sepet önizleme & favoriler ve **wardrobe-optimizer** için "boşluğu al" entegrasyonu.

## Neye benziyor

```
trendyol_get_filter_options  ->  { Kategori:[Gömlek,Kazak&Hırka,...], Marka:[...], Cinsiyet:[Erkek,Kadın], ... }
trendyol_search_products     ->  { filters, sort, products:[{title, price, brand, rating, url, image, badges}] }
```

## Kişiselleştirme: ihtiyaç önce, dolap yol boyunca

Trendyol'da bir şey ararken aslında bir **ihtiyacın** vardır. Bu sunucu, ürün listesine atlamadan önce seni ve dolabını tanır:

```
profile_status  ->  (eksikse) onboarding_next  ->  need_start  ->  ara  ->  değerlendir  ->  karar
                                                       |
                                  dolap sorusu: "elindeki parçalar?" -> wardrobe_quick_add
```

- **Onboarding:** `profile_status` profilin tamamlanma durumunu ve sıradaki soruları verir; `onboarding_next` cevapları kaydeder (adım adım, her MCP istemcisinde çalışır). Varsayılanlar "dolu" sayılmaz, bu yüzden hiç doldurmamış biri sahte bir profille "kişiselleştirilmiş" gibi davranılmaz.
- **İhtiyaç:** `need_start("iş ve akşam için rahat bir kot pantolon")` rolü, vesileyi, kumaşı, kalıbı, bütçeyi çıkarır; profilden beden/kalıp/palet kısıtlarını ekler; dolapta o rolde ne olduğunu gösterir ve en fazla 2 soru sorar.
- **Kişisel değerlendirme:** `trendyol_search_products` ve `trendyol_find` sonuçlarına `kisisel` ekler: `karar` (uygun/dikkat/eleme), `uyarilar` (kadın ürünü sızması, slim, yüksek bel, baskı, kaçınılan renk...), `bedenOnerisi` (marka-beden hafızası veya profil bedeni). Tamamen deterministik, başlık/fiyat/puan temelli.
- **Zevk:** `taste_signals` ile beğeni sinyalleri kaydedilir; özet bir **çıkarımdır**, profile yazılmadan önce kullanıcıya doğrulatılır.
- **Dışarıdan veri:** `onboarding/form.html` (profil alanlarından üretilen form) JSON olarak indirilip `profile_import` ile aktarılabilir. Formu yeniden üretmek için: `pnpm build && pnpm build:form`.
- **Sunucu `instructions`:** bağlanınca modele akışı (tanı → ihtiyaç → ara → değerlendir) söyler; skill desteği olmayan istemcilerde de çalışır.

> Elicitation (sunucunun kullanıcıya form göstermesi) bilerek kullanılmadı: SDK'da `elicitInput` yeni protokol sürümünde kullanımdan kalkıyor ve istemci desteği değişken. Adım adım araçlar her yerde çalışır.

### Gizlilik ve veri

Tüm profil, envanter, ihtiyaç ve zevk verisi **yalnızca bu makinede** `TRENDYOL_DATA_DIR/wardrobe.json` içinde tutulur; hiçbir yere gönderilmez. Boy/kilo gibi hassas alanlar isteğe bağlıdır. Chrome oturumu `TRENDYOL_PROFILE_DIR` altında kalır. Veriyi sıfırlamak için bu dosyaları sil.

## Claude Code plugin olarak kurulum (paylaşım)

Bu repo aynı zamanda bir Claude Code plugin'idir (MCP sunucusu + `kisisel-alisveris` ve `gardirop-kurulumu` skill'leri). Derlenmiş `dist/` bilerek repoda tutulur: plugin kurulumunda derleme adımı çalışmaz.

### Kurulum

Gereksinimler: [Claude Code](https://code.claude.com), Google Chrome (veya `TRENDYOL_CHANNEL` ile başka bir kanal), Node.js 20+.

```bash
# 1) Marketplace'i ekle
claude plugin marketplace add Atanur/trendyol-mcp

# 2) Plugin'i kur
claude plugin install trendyol-wardrobe@trendyol-wardrobe-market
```

Kurulumdan sonra Claude Code'u yeniden başlat (ya da oturumda `/reload-plugins`). İlk kullanımda asistan seni tanımak için birkaç soru sorar; sohbeti `/trendyol-wardrobe:kisisel-alisveris` skill'i veya "Trendyol'da pantolon bakıyorum" gibi bir cümleyle başlatabilirsin.

Kurulumu kontrol et:

```bash
claude plugin list
claude mcp list        # "plugin:trendyol-wardrobe:trendyol" görünmeli
```

### Daha önce MCP'yi elle eklediysen

Aynı sunucuyu hem elle hem plugin olarak çalıştırma: ikisi aynı Chrome profilini ve aynı `wardrobe.json` dosyasını paylaşır, çakışırlar. Önce eskisini kaldır:

```bash
claude mcp get trendyol                 # hangi kapsamda kayıtlı olduğunu gösterir
claude mcp remove trendyol -s user      # kullanıcı kapsamındaysa
# proje kapsamındaysa:  claude mcp remove trendyol -s project
# opencode kullanıyorsan opencode.json içindeki "trendyol" kaydını sil
```

Verilerin (profil, envanter) `~/.trendyol-mcp/data/` altında kalır; MCP'yi kaldırmak onları silmez.

### Güncelleme ve kaldırma

```bash
claude plugin marketplace update trendyol-wardrobe-market
claude plugin update trendyol-wardrobe@trendyol-wardrobe-market
claude plugin uninstall trendyol-wardrobe@trendyol-wardrobe-market
```

### Yerelde deneme (yayınlamadan)

```bash
claude plugin validate .
claude --plugin-dir /path/to/trendyol-mcp
```

### Katkıda bulunanlar için notlar

- `dist/` bilerek repoda tutulur: plugin kurulumunda derleme adımı çalışmaz. Kaynak değiştirince `pnpm build` çalıştırıp `dist/`'i de commit'le.
- Plugin kurulumu `pnpm-lock.yaml`'ı okumaz, **`package-lock.json`** ister. Bağımlılıklar (`package.json`) değişince:
  ```bash
  pnpm lock:npm        # temiz bir geçici dizinde npm kilidini yeniden üretir
  ```
  sonra `package-lock.json`'u commit'le.
- Testler: `pnpm test` ve `node scripts/e2e-onboarding.mjs`.

## Lisans ve uyarılar

MIT lisansı, bkz. [LICENSE](LICENSE). Bu proje **Trendyol ile bağlantılı değildir** ve resmi bir ürün değildir. Trendyol'un genel arayüzünü senin adına, senin tarayıcında sürer; Trendyol'un kullanım koşullarına ve `robots.txt`/hız sınırlarına uymak senin sorumluluğundadır. Kişisel verilerin yalnızca kendi makinende tutulur (bkz. Gizlilik ve veri).

## Kurulum

```bash
pnpm install
pnpm build
```

İlk çalıştırmada Playwright, sistem Chrome'u (`channel: "chrome"`) ile açılır; ek indirme gerekmez.
Chrome yoksa `TRENDYOL_CHANNEL` ile başka bir kanal (`chrome`, `chrome-canary`, `msedge`, `chromium`) seç.

## Host'a bağlama (stdio)

Sunucu stdio transport kullanır. Derlenmiş giriş noktası: `dist/index.js`.

### opencode (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "trendyol": {
      "type": "local",
      "command": ["node", "/ABSOLUTE/PATH/trendyol-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Claude Code

```bash
claude mcp add trendyol -- node /ABSOLUTE/PATH/trendyol-mcp/dist/index.js
```

veya `.mcp.json`:

```json
{
  "mcpServers": {
    "trendyol": { "command": "node", "args": ["/ABSOLUTE/PATH/trendyol-mcp/dist/index.js"] }
  }
}
```

## Yapılandırma (env)

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `TRENDYOL_BASE_URL` | `https://www.trendyol.com` | Site kökü. **Kategori URL'leri sabit değil** — erkek/kadın giyim kategorisi UI'dan keşfedilir ve önbelleğe alınır |
| `TRENDYOL_PROFILE_DIR` | `~/.trendyol-mcp/chrome-profile` | Kalıcı Chrome profili (çerez/oturum burada) |
| `TRENDYOL_CHANNEL` | `chrome` | Playwright tarayıcı kanalı |
| `TRENDYOL_HEADLESS` | `false` | `true` yaparsan pencereyi gizler (izleyemezsin) |
| `TRENDYOL_VIEWPORT_WIDTH/HEIGHT` | `1440` / `900` | Masaüstü düzeni (sol filtre paneli için) |
| `TRENDYOL_CDP_ENDPOINT` | (boş) | Doluysa kendi Chrome'unu açmak yerine bu CDP ucuna bağlanır |
| `TRENDYOL_NAV_TIMEOUT_MS` | `45000` | Navigasyon zaman aşımı |
| `TRENDYOL_ACTION_TIMEOUT_MS` | `15000` | Aksiyon zaman aşımı |
| `TRENDYOL_SNAPSHOT_MAX_ITEMS` | `250` | Snapshot'ta dönen maksimum öğe |
| `TRENDYOL_DATA_DIR` | `~/.trendyol-mcp/data` | Fiyat geçmişi/watchlist + gardırop içe aktarım dosyaları |
| `TRENDYOL_ENABLE_CART` | `true` | `false` yaparsan sepet ekleme aracı kapanır |
| `TRENDYOL_CACHE_TTL_MS` | `600000` | Ürün çıkarımı önbellek süresi |

## Araçlar

**Düşük seviye (UI sürücüsü)**

- `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press`
- `browser_select_option`, `browser_scroll`, `browser_screenshot`
- `browser_wait`, `browser_history`, `browser_list_tabs`, `browser_switch_tab`

**Arama & keşif**

- `trendyol_home` — ana sayfa + snapshot
- `trendyol_get_filter_options` — sol panel filtrelerini (grup + tüm seçenekler) ve quick-filter'ları listele
- `trendyol_search_products` — kategori/arama + çoklu filtre + fiyat aralığı + sıralama + sayfalama
- `trendyol_get_products` — açık liste sayfasındaki ürünleri çıkar (opsiyonel sıralama/sayfa)
- `trendyol_open_product` — bir ürünü aç ve detayını getir
- `trendyol_find` — **doğal dille bul**: "smart casual lacivert blazer, çok dar olmasın, 1500 TL altı" → renk/tür/kalıp/kumaş/tarz/bütçe/cinsiyet çıkarıp arayıp skorlar (marka bilmesen de)

**Ürün zekâsı**

- `trendyol_product_detail` — başlık/fiyat/marka/puan/satıcı, **kalıp & kumaş tipi**, tüm ürün özellikleri (Materyal/Renk/Desen...), **beden & renk varyantları (stoklu)**, görseller, kargo, iade
- `trendyol_analyze_reviews` — beden yanlılığı (dar/bol/tam), şikâyet oranları (ince kumaş, dikiş, koku, çekme, sentetik...), kalite skoru, **sahte-yorum sinyalleri** (`authenticity`: fakeRatio, şüpheli yorumlar, şablon övgü/tekrar/ünlem/kısa-tam puan) + **Trendyol AI özeti**. Sonuç otomatik kaydedilir (`review-insights.json`).
- `trendyol_evaluate_product` — **tek çağrıda değerlendirme**: link ver → detay + yorumlar(+sahtelik) + satıcı riski + indirim (10-gün-en-düşük) + benzer ürün kıyası + `verdictHints`
- `trendyol_review_insights` — kaydedilmiş yorum analizlerini listele / getir / sil. `trendyol_compare_products` kayıtlı analizi otomatik iliştirir.
- `trendyol_product_reviews` — ham yorumlar + istatistik + anahtar kelimeler
- `trendyol_seller_check` — satıcı adı/puanı, ücretsiz kargo, iade politikası + risk bayrakları
- `trendyol_find_similar` — aynı marka + giyim türü + cinsiyette benzer (opsiyonel daha ucuz) alternatifler
- `trendyol_compare_products` — birden çok ürünü yan yana karşılaştır
- `review_photo_summary` — yorum fotoğraflarını toplar (görsel analiz için vision modeli gerekir)

**Sepet & favori** (ödeme yok)

- `trendyol_add_to_cart` (`confirm:true`), `trendyol_cart_summary`, `trendyol_favorites`

**Fiyat & stok takibi**

- `trendyol_watch_add`, `trendyol_watch_list`, `trendyol_watch_remove`, `trendyol_watch_check`
- `trendyol_fake_discount_check` — "önce zam sonra indirim" / abartılı indirim tespiti
- `trendyol_price_trend` — kayıtlı fiyat geçmişinden min/medyan/maks + trend (yükseliyor/düşüyor/stabil)
- `trendyol_watch_size_add`, `trendyol_size_stock_check`, `trendyol_size_watch_list` — beden stoğa girince/tükenince uyarı

**Kişiselleştirme (onboarding, ihtiyaç, zevk)**

- `profile_status`, `onboarding_next`, `profile_import` — tanıma, adım adım onboarding, dış veri aktarımı
- `need_start`, `need_update`, `need_list` — asıl ihtiyaç kaydı, profilden kısıtlar, dolap bağlamı ve sorular
- `wardrobe_quick_add` — "lacivert kot pantolon 32/32" gibi serbest satırlardan envanter
- `taste_signals` — beğendim/olabilir/olmaz sinyalleri ve özet (çıkarımlar onaylanır)

**Gardırop envanteri & profil**

- `inventory_add`, `inventory_list`, `inventory_update`, `inventory_remove`
- `profile_set`, `profile_get` — hedef (~50 parça), palet (baz/aksan), kaçınılanlar, kurallar (slim/sentetik deri/baskı/polyester), bütçe, mekan×mevsim matrisi
- `wear_log`, `brand_fit` (marka→beden hafızası), `donation_log`, `post_purchase_update` (satın alma + 14 gün iade tarihi; marka+beden verilirse **marka-beden hafızasına otomatik** yazılır)

**Gardırop zekâsı**

- `generate_gap_list` — profil hedefi + kapsama + zayıf halkaları birleştirip **öncelikli eksik listesi**
- `check_against_profile` — uygun / şüpheli / eleme + skor
- `gap_match`, `color_match`, `fabric_score`
- `outfit_count` (yeni parça kaç kombin ekler), `capsule_coverage`, `weak_link`
- `cost_per_wear`, `keep_or_go`, `one_in_one_out`, `travel_pack`

**Alışveriş akışı**

- `budget_basket` (kategori payı + bütçe + **kayıtlı yorumu kötü satır uyarısı**), `shopping_order` (alış sırası), `impulse_guard` (gap/bütçe/benzer + yorum uyarısı)
- `coupon_tracker`, `return_tracker`

**Trendyol → gardırop köprüsü**

- `trendyol_shop_gap` — boşluk kriterleriyle ara, skorla, içe aktarılabilir `item` üret. `gender` ile **Erkek/Kadın** kategori, `from_gap` ile en üstteki boşluğu otomatik seçer; adaylara **kayıtlı yorum analizi** (`reviewInsight`) ve **marka-beden hafızası** (`brandFit`) iliştirir.
- `trendyol_import_to_wardrobe` — ürünü uygulamanın `Item` şemasına normalize et

> **Çapraz akış:** kayıtlı yorum analizi `check_against_profile`, `impulse_guard`, `compare_products`, `find_similar` ve `shop_gap` içinde otomatik kullanılır (örn. "dar kalıp → bir beden büyük"). Marka-beden hafızası `shop_gap` adaylarında önerilen bedene yansır.

**Altyapı / MCP**

- `trendyol_cache_clear`, `trendyol_cache_stats`
- Resources: `trendyol://watchlist`, `trendyol://wardrobe`, `trendyol://review-insights`, `trendyol://playbook`

## Beyin (MCP skill'leri = prompt'lar)

Bu sunucunun "beyni" tool değil, **MCP prompt**'larıdır — her işlem bunların üzerinden yürür:

- **`trendyol_beyin`** (başlangıç): ham isteği analiz eder → kıyafet kontrol listesiyle **detaylı plan** çıkarır → hangi araçları hangi sırayla çağıracağını söyler. Örn. "kalın kışlık gömlek" → kumaş/kalınlık/mevsim, kalıp, beden-stok, yorumlar, satıcı/iade, fiyat kontrollerini planlar.
- **`trendyol_dogrula`** (bitiş): bulunan link/içeriği isteğe göre madde madde denetler, **"geçerli mi?"** kararını kanıtla verir; değilse filtre/sorgu önerir.
- **`trendyol_urun_degerlendir`** (link → yargı): bir ürün linkini detay + yorum(+sahtelik) + satıcı + indirim + benzer kıyasla değerlendirir; "al / düşün / alma" kararı + gerekçe üretir.
- **`kisisel_baslangic`**: kullanıcıyı tanıma (onboarding) sohbetini başlatır.
- `urun-avi`: beynin basit bir örneği.
- Resource `trendyol://playbook`: akış + kontrol listesi + araç haritası (beynin bilgi tabanı).

> Akış: `trendyol_beyin` → araçlar → `trendyol_dogrula`. MCP host'unda (opencode/Claude) prompt'lar `/` menüsünde veya `prompts/get` ile görünür.

### `trendyol_search_products` parametreleri

| Parametre | Açıklama |
| --- | --- |
| `query` | Arama kutusuna yazılacak metin |
| `category_url` | Kategori URL'i (varsayılan erkek giyim) |
| `filters` | Sol panel etiketleri (çoklu verilebilir: marka/kategori/beden/renk...) |
| `gender` | Cinsiyet: `Erkek` (varsayılan) / `Kadın`. `category_url` verilmezse **ilgili giyim kategorisi** seçilir; `category_url` verilirse cinsiyet filtre olarak tıklanır |
| `price_min` / `price_max` | Fiyat aralığı (sol "Fiyat" grubu) |
| `sort` | `best_sellers` \| `most_reviewed` \| `highest_rating` \| `price_asc` \| `price_desc` \| `newest` \| `relevance` |
| `quick_filters` | `Yüksek Puanlı Ürünler`, `Flaş Ürünler`, `Kargo Bedava`... |
| `pages` | Kaç sonuç sayfası gezileceği (varsayılan 1) |
| `expand_filters` | Gizli filtreleri aç (varsayılan `true`) |
| `limit` | Dönen maksimum ürün (varsayılan 24) |
| `open_first` | İlk ürünü aç ve detayını getir |
| `with_insights` | Sonuçlara kayıtlı yorum içgörüsünü (beden/kalite) iliştir (`get_products`'ta da var) |

## Örnek akışlar

```
# 1) Filtreli arama + sıralama + sayfalama
trendyol_get_filter_options({ category_url: ".../erkek-giyim-x-g2-c82" })
trendyol_search_products({ gender: "Erkek", filters: ["Gömlek"], price_min: 250, price_max: 700,
                           sort: "best_sellers", pages: 2, limit: 30 })

# 2) Detay + yorum özeti
trendyol_product_detail({ url: "<ürün>" })
trendyol_product_reviews({ url: "<ürün>", limit: 20 })

# 3) Fiyat takibi
trendyol_watch_add({ url: "<ürün>", label: "lacivert blazer", target_price: 1200 })
trendyol_watch_check({})           # düşüş/hedef uyarısı

# 4) Gardırop boşluğunu al
trendyol_shop_gap({ rol: "katman", renk: "lacivert", beden: "M", max_fiyat: 1500 })
trendyol_import_to_wardrobe({ product: {...}, rol: "katman", renk: "lacivert", formallik: "smart" })

# 5) Gardırop zekâsı (tarayıcı gerekmez)
profile_set({ hedef: { ust: 12, alt: 8, katman: 7, dis: 4 }, palet: { baz: ["siyah","lacivert"], aksan: ["bordo"] },
              kurallar: { slimYok: true, maxPolyester: 50 }, butce: 30000,
              mekanMevsim: { is: { ilkbahar: 2, sonbahar: 2 }, spor: { yaz: 2 } } })
inventory_add({ items: [{ ad: "Lacivert Regular Fit Gömlek", renk: "lacivert", kompozisyon: [{ material: "Pamuk", percent: 100 }] }] })
generate_gap_list({})                       # öncelikli eksik listesi
check_against_profile({ ad: "Slim Polyester Pantolon", rol: "alt", renk: "siyah", kalip: "Slim Fit",
                        kompozisyon: [{ material: "Polyester", percent: 70 }] })
outfit_count({ candidate: { ad: "Gri Gömlek", rol: "ust", renk: "gri" } })
budget_basket({ lines: [{ ad: "Gömlek", fiyat: "800 TL", rol: "ust" }], budget: 30000 })
impulse_guard({ candidate: { rol: "ust", renk: "beyaz", fiyat: 900 }, basket_total: 29500 })
```

UI elemanları değişirse düşük seviye araçlarla manuel sür:

```
browser_navigate -> browser_snapshot -> browser_click(e12) -> browser_type(text:"...", submit:true) -> browser_snapshot -> ...
```

## Geliştirme

```bash
pnpm dev          # tsx ile doğrudan çalıştır
pnpm typecheck
pnpm build
pnpm test                          # birim testleri (node:test)
node scripts/e2e-onboarding.mjs    # onboarding + ihtiyaç akışı, geçici veri dizininde
pnpm build:form                    # onboarding/form.html'i profil alanlarından üret
node scripts/smoke.mjs                                     # initialize + tools/resources/prompts
node scripts/e2e-mcp.mjs '{"gender":"Erkek","sort":"best_sellers"}' trendyol_search_products
```

## Notlar

- Bu araç Trendyol'un **genel UI'ını kullanıcı gibi** sürer. Kullanım koşullarına ve `robots.txt`/rate
  limitlere saygı göster; aşırı/otomatik yoğun istekten kaçın.
- Ürün verisi sayfadan **heuristik** olarak çıkarılır; UI değiştiğinde `browser_snapshot` ile durumu
  görüp düşük seviye araçlarla konumlanmak en dayanıklı yoldur.
- Chrome açıkken oturum/çerez kalıcı profilde tutulur; giriş yapman gerekirse aynı pencerede yapabilirsin.
