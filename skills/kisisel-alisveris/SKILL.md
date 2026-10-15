---
name: kisisel-alisveris
description: Trendyol'da giyim ararken, bir şey almak/yenilemek istendiğinde, indirim dönemi alışverişi planlanırken veya "bana ne uyar / hangisini alayım" sorulduğunda kullan. Önce kullanıcının asıl ihtiyacını ve dolabını öğrenir, sonra profil kurallarına göre arar ve değerlendirir.
---

# Kişisel alışveriş akışı

Kullanıcı Trendyol'da bir şey ararken aslında bir **ihtiyacı** vardır. Ürün listesine atlamadan önce ihtiyacı anla, kullanıcıyı ve dolabını tanı, sonra ara. Araçlar `trendyol-wardrobe` plugin'indeki MCP sunucusundandır (tam ad biçimi: `mcp__plugin_trendyol-wardrobe_trendyol__<araç>`); aşağıda kısa adlarıyla anılır.

## Akış

1. **Tanı ve nerede kaldığını bul.** `profile_status`, ardından `session_resume` çağır.
   - `onboarded=false` ise önce `gardirop-kurulumu` skill'indeki onboarding'i yap (en fazla 3 soru).
   - Kullanıcı atlamak isterse atlayabilir; kişiselleştirmenin sınırlı olacağını söyle.
   - `session_resume` açık bir ihtiyaç döndürürse "geçen sefer X'te kalmıştık, devam edelim mi?" diye sor ve `sonrakiAdim`'dan devam et. 14 günden eskiyse önce hâlâ geçerli mi diye sor. Kullanıcı yeni bir şey isterse `need_start`'a geç.
2. **İhtiyacı anla.** Kullanıcının cümlesiyle `need_start` çağır.
   - Dönen `sorular`ı (en fazla 2) sor. Cevapları `need_update` ile kaydet.
   - `dolapSorusu` varsa kullanıcıdan elindeki parçaları öğren ve `wardrobe_quick_add` ile kaydet (`ihtiyac_id` ver). Böylece dolap, alışveriş sohbetinin doğal yan ürünü olarak öğrenilir.
3. **Ara.** `trendyol_find` (doğal dil) veya `trendyol_search_products` (filtreli). `need_start`'ın `kisitlar` çıktısındaki beden, kalıp, bütçe ve paleti arama kriteri yap.
4. **Değerlendir.** Sonuçlardaki her ürünün `kisisel` alanını oku:
   - `karar`: `uygun` / `dikkat` / `eleme`. **Elenenleri önerme**; neden elendiğini (uyarılar) kısaca söyle.
   - `bedenOnerisi`: marka-beden hafızası varsa onu, yoksa profil bedenini kullan.
   - `kisiselOzet.varsayilanKullanilan` doluysa varsayılan değerle çalışıldığını belirt.
5. **Karar öncesi.** En iyi 1-3 aday için `trendyol_evaluate_product` ve `impulse_guard`/`check_against_profile` çalıştır. Gerçek indirim mi diye `trendyol_fake_discount_check` kullan.
6. **Kısa listeyi kaydet.** Bakılan her adayı `need_update(aday_ekle)` ile kaydet (ad, url, fiyat, kısa not); seçileni `durum=secildi` yap. Oturum kapansa da kaldığın yer bilinir.
7. **Sonuç.** Net bir öneri ver: ürün, fiyat, neden uygun, beden önerisi, riskler. Kısa tut.
8. **Satın alma.** Sepete ekleme **yalnızca kullanıcının açık onayıyla**. Alındıysa `need_update(durum=alindi)` ve `post_purchase_update`.
9. **İşi bitir, sekmeyi kapat.** `need_update(durum=alindi veya vazgecildi)` Chrome'u kendiliğinden kapatır. Kullanıcı kararsız bırakıp ayrılıyorsa önce adayları kaydet, sonra `browser_close` çağır.

## Kurallar

- Türkçe ve kısa yaz. Dürtüsel alımı teşvik etme; ihtiyaç ve dolap boşluğu önce gelir.
- Çıkarımları (ör. "sweatshirt sevmiyor gibi") profile yazmadan önce kullanıcıya doğrulat.
- Kullanıcı verisi yerelde kalır; hassas bilgileri (boy/kilo) sorarken bunu söyle.
- İndirim döneminde: önce `generate_gap_list`, sonra `budget_basket` ile toplamı kontrol et.
