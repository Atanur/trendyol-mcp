---
name: gardirop-kurulumu
description: Kullanıcıyı ilk kez tanırken (profil/onboarding), dolabını envantere alırken, gereksiz ya da giyilmeyen parçaları ayıklarken veya stilini keşfetmek isterken kullan. Profil, zevk ve envanteri sohbet ederek kurar.
---

# Gardırop kurulumu ve ayıklama

Amaç: kullanıcıyı form doldurtmadan, sohbet ederek tanımak; dolabını envantere almak; neyin kalıp neyin çıkacağına karar vermek. Araçlar `trendyol-wardrobe` plugin'indeki MCP sunucusundandır; aşağıda kısa adlarıyla anılır.

## 1. Profil (onboarding)

1. `profile_status` çağır. `onboarded=true` ise bildiklerini kısaca özetle ve neyi güncellemek istediğini sor.
2. Değilse `siradakiSorular`ı en fazla **3'er soru** halinde, doğal cümlelerle sor. Cevabı alan yoluna eşleyip `onboarding_next({ cevaplar })` ile kaydet (ör. `"beden.alt": "32/32"`, `"palet.baz": ["lacivert","gri"]`).
3. Reddedilen alan dönerse nedenini söyleyip yeniden sor.
4. **Hassas alanlar** (boy/kilo) isteğe bağlıdır: sorarken verilerin yalnızca bu makinede kaldığını söyle, atlamasına izin ver.
5. Kullanıcı dışarıda doldurduğu bir form JSON'u getirirse `profile_import` ile aktar. Form şablonu: bu plugin'in `onboarding/form.html` dosyası.

## 2. Zevk keşfi

- Kullanıcıya birkaç ürün/kombin göster, "beğendim / olabilir / olmaz" ve **neden** (kalıp, renk, kumaş, özenli durması...) sor; `taste_signals` ile kaydet.
- `taste_signals(action="summary")` çıktısındaki güçlü sinyaller **çıkarımdır**: kullanıcıya doğrulat ("sweatshirt'leri hep reddettin, sevmiyor muyuz?"), onaylarsa `onboarding_next` ile `kaynak="kullanici"` olarak kaydet.

## 3. Dolap envanteri

- "En çok giydiğin 5-6 parça neler?" diye sor; cevapları `wardrobe_quick_add` ile satır satır kaydet ("lacivert kot pantolon 32/32").
- Fotoğraftan çıkarılan parçalar için `inventory_add` kullan (daha ayrıntılı alanlar).
- Parçaları giydikçe `wear_log` ile işaretle; marka-beden bilgisi için `brand_fit`.

## 4. Ayıklama

- `keep_or_go` ile her parçayı değerlendir; `cost_per_wear` ve `weak_link` destekler.
- Çıkacakları `donation_log` ile kaydet, ardından `inventory_remove`.
- Kullanıcının satma/bağışlama tercihine uy; bütçeye gelir eklemeyi varsayma.
- Sonra `generate_gap_list` ile eksikleri çıkar; alışverişe `kisisel-alisveris` skill'iyle geç.

## Kurallar

- Türkçe, kısa, sohbet havasında. Tek seferde çok soru sorma.
- Çıkarımı kullanıcı onaylamadan profile yazma.
