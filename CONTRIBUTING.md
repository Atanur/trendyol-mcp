# Katkıda bulunma

Katkıların için teşekkürler. Hata bildirimi, öneri ve pull request'lerin hepsi açık.

## Geliştirme ortamı

Node.js 20+, [pnpm](https://pnpm.io) ve Google Chrome gerekir.

```bash
git clone https://github.com/Atanur/trendyol-mcp.git && cd trendyol-mcp
pnpm install
pnpm build
```

| Komut | Ne yapar |
| --- | --- |
| `pnpm dev` | Sunucuyu `tsx` ile doğrudan çalıştırır |
| `pnpm typecheck` | Tip kontrolü |
| `pnpm test` | Birim testleri (`node:test`) |
| `node scripts/e2e-onboarding.mjs` | Onboarding ve ihtiyaç akışının uçtan uca testi (geçici veri dizininde, gerçek verine dokunmaz) |
| `node scripts/smoke.mjs` | Sunucu açılıyor mu, araçlar/prompt'lar/kaynaklar listeleniyor mu |
| `pnpm build:form` | `onboarding/form.html`'i profil alanlarından yeniden üretir (önce `pnpm build`) |
| `pnpm lock:npm` | `package-lock.json`'u yeniden üretir (aşağıya bak) |
| `claude plugin validate .` | Plugin ve marketplace dosyalarını doğrular |

## Kod yapısı

```text
src/wardrobe/   Saf (test edilebilir) mantık: profil, ihtiyaç, bayraklar, kişisel skor, zevk
src/tools/      MCP araçları (ince katman: doğrula, store'u çağır, sonucu döndür)
src/trendyol/   Trendyol arayüzünü süren kod (kazıma, aksiyonlar)
skills/         Claude Code skill'leri
test/           Birim testleri
```

Yeni davranışı önce `src/wardrobe/` altında saf bir fonksiyon olarak yaz ve testle. Araç dosyalarını ince tut. Hata düzeltirken hatayı yeniden üreten bir test ekle.

## Sürüm çıkarma (plugin kullanıcılarına ulaşmak için)

Plugin sürümü `plugin.json`'a sabitli olduğundan **sürüm artmadan kullanıcılar değişikliği görmez**. Kod değişince:

1. Sürümü üç yerde aynı değere yükselt: `.claude-plugin/plugin.json`, `package.json`, `src/server.ts`.
2. `pnpm lock:npm` çalıştır. Plugin kurulumu `pnpm-lock.yaml`'ı okumaz, `package-lock.json` ister; komut kilidi temiz bir geçici dizinde yeniden üretir.
3. `pnpm build`. **`dist/` bilerek repoda tutulur**: plugin kurulumunda derleme adımı çalışmaz.
4. `pnpm test`, `claude plugin validate .`
5. Commit ve push. Kullanıcılar `claude plugin marketplace update trendyol-wardrobe-market` ve `claude plugin update trendyol-wardrobe@trendyol-wardrobe-market` ile alır.

## Web sitesi

`web/` klasörü [trendyol-mcp.atanur.dev](https://trendyol-mcp.atanur.dev) adresinin kaynağıdır: Astro + React + Tailwind v4 + shadcn/ui, statik çıktı. Cloudflare'e wrangler ile yayınlanır (`wrangler.jsonc`, `web/dist`):

```bash
cd web && npm install && npm run dev   # yerelde geliştir
cd web && npm run build                # web/dist üretir
npx wrangler deploy                    # yayınla (önce build)
```

Site metinleri `web/src/data/content.ts` içindedir; plugin ve sunucu koduna bağımlı değildir.

## Pull request kontrol listesi

- [ ] `pnpm typecheck` ve `pnpm test` geçiyor
- [ ] Yeni davranış için test eklendi
- [ ] Kod değiştiyse sürüm yükseltildi ve `dist/` güncellendi
- [ ] Kullanıcıya görünen metinler Türkçe ve kısa
- [ ] Kişisel veri, yol veya anahtar commit'e girmedi

## Önemli ilkeler

- **Gizlilik:** kullanıcı verisi yalnızca yerelde kalır; ağa veri gönderen bir özellik ekleme.
- **Güvenlik:** sepet/satın alma akışı her zaman kullanıcının açık onayını ister; ödeme yapılmaz.
- **Deterministik kararlar:** eleme ve uyarı mantığı modele bırakılmaz, sunucuda kurallarla hesaplanır ve test edilir.
