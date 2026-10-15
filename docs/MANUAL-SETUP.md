# Plugin'siz (elle) kurulum ve yapılandırma

Çoğu kullanıcı için [plugin kurulumu](../README.md#kurulum) yeterlidir ve skill'leri de getirir. Claude Code dışında bir MCP istemcisi (ör. opencode) kullanıyorsan ya da sunucuyu kaynaktan çalıştırmak istiyorsan bu sayfayı izle.

## Gereksinimler

- Node.js 20+ ve [pnpm](https://pnpm.io)
- Google Chrome (Playwright sistem Chrome'unu kullanır, ek tarayıcı indirmesi gerekmez)

## Derleme

```bash
git clone https://github.com/Atanur/trendyol-mcp.git
cd trendyol-mcp
pnpm install
pnpm build
```

`dist/index.js` stdio üzerinden konuşan sunucunun giriş noktasıdır.

## İstemciye bağlama

**Claude Code**

```bash
claude mcp add trendyol -- node /MUTLAK/YOL/trendyol-mcp/dist/index.js
```

**opencode** (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "trendyol": {
      "type": "local",
      "command": ["node", "/MUTLAK/YOL/trendyol-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

**Genel `.mcp.json`**

```json
{
  "mcpServers": {
    "trendyol": { "command": "node", "args": ["/MUTLAK/YOL/trendyol-mcp/dist/index.js"] }
  }
}
```

> Elle kurduğun sunucuyu plugin ile birlikte çalıştırma: ikisi aynı Chrome profilini ve aynı `wardrobe.json` dosyasını paylaşır, çakışırlar. Plugin'e geçerken önce eskisini kaldır: `claude mcp remove trendyol -s user` (kapsamı görmek için `claude mcp get trendyol`).

## Yapılandırma

Hepsi isteğe bağlıdır; ortam değişkeni olarak verilir ([`.env.example`](../.env.example)).

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `TRENDYOL_DATA_DIR` | `~/.trendyol-mcp/data` | Profil, envanter, fiyat geçmişi ve takip listelerinin tutulduğu klasör |
| `TRENDYOL_PROFILE_DIR` | `~/.trendyol-mcp/chrome-profile` | Kalıcı Chrome profili (çerez ve oturum burada) |
| `TRENDYOL_CHANNEL` | `chrome` | Tarayıcı kanalı: `chrome`, `chrome-canary`, `msedge`, `chromium` |
| `TRENDYOL_HEADLESS` | `false` | `true` yaparsan pencere gizlenir (izleyemezsin) |
| `TRENDYOL_ENABLE_CART` | `true` | `false` yaparsan sepete ekleme aracı kapanır |
| `TRENDYOL_CDP_ENDPOINT` | boş | Doluysa kendi Chrome'unu açmak yerine bu CDP ucuna bağlanır |
| `TRENDYOL_BASE_URL` | `https://www.trendyol.com` | Site kökü. Kategori URL'leri sabit değildir, arayüzden keşfedilir |
| `TRENDYOL_VIEWPORT_WIDTH` / `HEIGHT` | `1440` / `900` | Masaüstü düzeni (sol filtre paneli için gerekli) |
| `TRENDYOL_NAV_TIMEOUT_MS` / `ACTION_TIMEOUT_MS` | `45000` / `15000` | Navigasyon ve aksiyon zaman aşımları |
| `TRENDYOL_SNAPSHOT_MAX_ITEMS` | `250` | Sayfa anlık görüntüsünde dönen en fazla öğe |
| `TRENDYOL_CACHE_TTL_MS` | `600000` | Ürün çıkarımı önbellek süresi |

## Verilerini yönetmek

Her şey `TRENDYOL_DATA_DIR` altındadır: profil ve envanter `wardrobe.json`, yorum analizleri `review-insights.json`, fiyat geçmişi ve takip listesi `trendyol-mcp.db`. Yedeklemek için klasörü kopyala, sıfırlamak için `wardrobe.json` dosyasını sil. MCP'yi veya plugin'i kaldırmak bu dosyaları silmez.
