# trendyol-mcp

**Trendyol'da ihtiyacına göre alışveriş yapan, seni ve dolabını tanıyan bir Claude asistanı.**

[Claude Code](https://code.claude.com) için bir plugin ve [MCP](https://modelcontextprotocol.io) sunucusu. Ürün listesine atlamadan önce neye ihtiyacın olduğunu, bedenini, tarzını ve dolabında ne olduğunu öğrenir; sonra senin adına Trendyol'da arar ve **sana göre** değerlendirir.

🌐 [trendyol-mcp.atanur.dev](https://trendyol-mcp.atanur.dev) · MIT lisanslı · verilerin yalnızca senin bilgisayarında

---

## Ne yapar?

- **Önce ihtiyacını anlar.** "İş ve akşam için rahat bir kot pantolon" dediğinde nerede giyeceğini, neyle giyeceğini sorar; dolabındakilere bakar.
- **Aramayı sana göre süzer.** Slim sevmiyorsan slim'leri eler, kadın modellerini yakalar, paletin dışındaki renkleri ve daha önce reddettiğin türleri (ör. jogger) uyarır, bedenini önerir.
- **Almadan önce kontrol eder.** Yorumları ve sahte yorum sinyallerini, beden yanlılığını ("bir beden küçük al"), satıcı riskini ve indirimin gerçek olup olmadığını inceler.
- **Dolabını ve bütçeni bilir.** Eksik parçaları çıkarır, bütçeni korur, dürtüsel alımı engeller. Sepete ekleme için her zaman senin onayını ister, ödeme yapmaz.
- **Nerede kaldığını hatırlar.** Bakılan adayları kısa listede tutar; yeni oturumda "geçen sefer kot pantolonda kalmıştık" diyerek devam eder. İş bitince (aldın ya da vazgeçtin) Chrome'u kendisi kapatır, sekmeler birikmez.

```text
Sen       Hem iş yerinde hem akşam arkadaşlarımla giyebileceğim rahat bir pantolon arıyorum, kot olabilir.

Asistan   Profilini biliyorum (32/32, regular/relaxed seviyorsun, slim ve kısa paçadan kaçınıyorsun).
          12 kot pantolon buldum. 5'i slim/dar paça olduğu için elendi, palet dışı renkler uyarıyla işaretli.
          En uygunu: AC&Co Lacivert Pamuklu Comfort Fit (1.147 TL), ama bedeni 1 küçük al diyorlar
          ve boy seçeneği yok. HLT Siyah Regular'da 32/32 seçebilirsin ve 2.769 yorumu var. Hangisini
          derinlemesine inceleyeyim?
```

## Kurulum

Gereksinimler: [Claude Code](https://code.claude.com), Google Chrome ve Node.js 20+.

```bash
claude plugin marketplace add Atanur/trendyol-mcp
claude plugin install trendyol-wardrobe@trendyol-wardrobe-market
```

Claude Code'u yeniden başlat. Kontrol için `claude mcp list` çıktısında `plugin:trendyol-wardrobe:trendyol` görünmeli.

> Daha önce MCP'yi elle eklediysen önce onu kaldır, aksi halde iki sunucu çakışır: `claude mcp remove trendyol -s user`. Plugin'siz (elle) kurulum için [docs/MANUAL-SETUP.md](docs/MANUAL-SETUP.md).

Güncellemek için:

```bash
claude plugin marketplace update trendyol-wardrobe-market && claude plugin update trendyol-wardrobe@trendyol-wardrobe-market
```

## İlk kullanım

Sadece ne aradığını yaz: **"Trendyol'da ceket bakıyorum."** Asistan kendiliğinden seni tanımak için en fazla birkaç soru sorar (şehir, beden, kalıp tercihin, bütçe...), cevapları kaydeder ve aramaya geçer. Soruları atlayabilirsin, ama kişiselleştirme o kadar sınırlı olur.

İstersen formu önceden doldur: [`onboarding/form.html`](onboarding/form.html) dosyasını tarayıcıda aç, doldur, **JSON olarak indir** ve içeriğini asistana "bunu `profile_import` ile aktar" diyerek ver.

## Nasıl çalışır?

```text
profil kontrolü → ihtiyaç analizi → ara → sana göre değerlendir → derin inceleme → karar
                        │                                                │
                dolap sorusu ("elinde ne var?")                 sepet yalnızca onayınla
```

Trendyol'u senin Chrome'unda, **görünür bir pencerede** gezer; ne yaptığını izleyebilir, gerekirse müdahale edebilirsin. Karar mantığı (eleme, uyarılar, skor) modele bırakılmaz, deterministik kurallarla sunucuda hesaplanır. Ayrıntılar: [docs/TOOLS.md](docs/TOOLS.md).

## Gizlilik ve güvenlik

- Profil, envanter, ihtiyaç ve beğeni verilerin **yalnızca bilgisayarında** `~/.trendyol-mcp/data/` altında tutulur; hiçbir yere gönderilmez. Boy ve kilo gibi alanlar isteğe bağlıdır.
- Ödeme yapmaz. Sepete ekleme yalnızca senin açık onayınla yapılır ve `TRENDYOL_ENABLE_CART=false` ile tamamen kapatılabilir.
- Çıkarımlar ("sweatshirt sevmiyorsun gibi") sen onaylamadan profiline yazılmaz.
- Veriyi silmek için `~/.trendyol-mcp/` klasörünü sil. Plugin'i kaldırmak verilerini silmez.

## Sorun giderme

| Sorun | Çözüm |
| --- | --- |
| Chrome bulunamadı | `TRENDYOL_CHANNEL` ile `msedge`, `chromium` gibi başka bir kanal seç ([yapılandırma](docs/MANUAL-SETUP.md#yapılandırma)) |
| Araçlar görünmüyor | Claude Code'u yeniden başlat; `claude plugin list` ile kurulu mu kontrol et |
| Güncelleme gelmiyor | `claude plugin marketplace update trendyol-wardrobe-market` çalıştır, sonra yeniden başlat |
| Trendyol sayfası beklenmedik davranıyor | Trendyol arayüzü değişmiş olabilir; [issue aç](https://github.com/Atanur/trendyol-mcp/issues) |

## Daha fazlası

- [docs/TOOLS.md](docs/TOOLS.md): tüm araçlar, prompt'lar ve örnek akışlar
- [docs/MANUAL-SETUP.md](docs/MANUAL-SETUP.md): plugin'siz kurulum ve ortam değişkenleri
- [CONTRIBUTING.md](CONTRIBUTING.md): geliştirme, test ve sürüm çıkarma

## Lisans ve uyarı

[MIT](LICENSE). Bu proje **Trendyol ile bağlantılı değildir**, resmi bir ürün değildir. Trendyol'un genel arayüzünü senin adına senin tarayıcında sürer; Trendyol'un kullanım koşullarına ve hız sınırlarına uymak senin sorumluluğundadır. Ürün verisi sayfadan çıkarıldığı için arayüz değişince bozulabilir.
