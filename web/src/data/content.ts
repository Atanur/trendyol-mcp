export const REPO = 'https://github.com/Atanur/trendyol-mcp';
export const MARKETPLACE_CMD = 'claude plugin marketplace add Atanur/trendyol-mcp';
export const INSTALL_CMD = 'claude plugin install trendyol-wardrobe@trendyol-wardrobe-market';

export const NAV = [
  { href: '#nasil', label: 'Nasıl çalışır' },
  { href: '#ozellikler', label: 'Özellikler' },
  { href: '#gizlilik', label: 'Gizlilik' },
  { href: '#kurulum', label: 'Kurulum' },
] as const;

export const STEPS = [
  { title: 'Seni tanır', text: 'Şehir, beden, kalıp ve renk tercihlerin, bütçen. Birkaç soruyla ya da hazır bir formla.' },
  { title: 'İhtiyacı anlar', text: '"İş ve akşam için rahat kot" der demez nerede, neyle giyeceğini ve dolabında ne olduğunu sorar.' },
  { title: 'Sana göre süzer', text: "Trendyol'u senin Chrome'unda gezer; sonuçları profilinle eler, uyarır, bedenini önerir." },
  { title: 'Almadan önce kontrol eder', text: 'Yorumlar, sahte yorum sinyalleri, beden yanlılığı, satıcı riski, gerçek indirim. Sepet yalnızca onayınla.' },
] as const;

export interface FeatureGroup {
  readonly title: string;
  readonly items: readonly string[];
  readonly wide?: boolean;
}

export const FEATURES: readonly FeatureGroup[] = [
  {
    title: 'Seni tanır',
    items: [
      'Sohbet ederek adım adım tanıma (onboarding), istersen hazır form',
      'Beden, kalıp, renk paleti, kumaş ve bütçe tercihleri',
      'Beğendim / olabilir / olmaz sinyalleriyle zevk öğrenimi',
      'Doldurmadığın alanlar "dolu" sayılmaz, sahte kişiselleştirme yok',
      'Çıkarımlar sen onaylamadan profiline yazılmaz',
      'Boy ve kilo gibi alanlar isteğe bağlı',
    ],
  },
  {
    title: 'İhtiyacı anlar',
    items: [
      'Cümleden rol, vesile, kumaş, kalıp, renk ve bütçeyi çıkarır',
      '"Çok sportif olmasın" gibi olumsuz ifadeleri anlar',
      'Eksikse en fazla 2 soru sorar, seni sorguya çekmez',
      'Dolabında o parçadan ne olduğunu gösterir',
      '"Elinde ne var?" sorusuyla dolabı sohbet içinde öğrenir',
      '"lacivert kot 32/32" gibi serbest satırlardan envanter kurar',
    ],
  },
  {
    title: 'Aramayı sana göre süzer',
    items: [
      'Doğal dille arama: "lacivert rahat kot, çok dar olmasın, 1500 ₺ altı"',
      'Her ürüne uygun / dikkat / eleme kararı ve gerekçesi',
      'Slim, dar paça, kısa paça (bilek boy, crop), yüksek bel',
      'Başlıkta "kadın" yazmayan boyfriend ve mom modelleri',
      'Baskı, suni deri, kaçınılan renk, palet dışı renk, sevilmeyen kumaş',
      'Daha önce iki kez reddettiğin türler (ör. jogger)',
      'Bütçe üstü ve düşük puanlı ürünler',
      'Sevdiğin kalıp ve kumaşı öne çıkarır ("rahat kesim" relaxed sayılır)',
      'Marka-beden hafızana göre beden önerisi',
    ],
  },
  {
    title: 'Almadan önce kontrol eder',
    items: [
      'Tek çağrıda değerlendirme: detay, yorum, satıcı, indirim, benzerler',
      'Sahte yorum sinyalleri ve Trendyol AI özeti',
      'Beden yanlılığı: "bir beden küçük al", "tam kalıp"',
      'Şikâyet analizi: koku, renk farkı, kumaş, dikiş',
      'İndirim gerçek mi: son 10 günün en düşüğü, önce zam sonra indirim',
      'Fiyat geçmişi ve trendi, ürünleri yan yana karşılaştırma',
      'Dürtüsel alım freni: dolabında benzeri var mı, bütçe yeter mi',
    ],
  },
  {
    title: 'Dolabını ve bütçeni yönetir',
    items: [
      'Envanter: ekle, güncelle, kaldır, giyim kaydı',
      'Eksik parça listesi ve kapsül dolap kapsaması',
      'Yeni parça kaç kombin ekler, hangi parça zayıf halka',
      'Giyim başına maliyet, "kalsın mı çıksın mı", bir gir bir çık',
      'Seyahat için bavul listesi, bağış kaydı',
      'Bütçe sepeti, alış sırası, kupon ve iade takibi',
    ],
  },
  {
    title: 'Takip eder, hatırlar',
    items: [
      'Nerede kaldığını hatırlar: açık ihtiyaçlar ve kısa liste oturumlar arası saklanır',
      'Yeni oturumda "geçen sefer kot pantolonda kalmıştık" diyerek devam eder',
      'Bakılan adayları (url, fiyat, not) kısa listede tutar',
      "İş bitince ya da boşta kalınca Chrome'u kapatır, sekmeler birikmez, oturum profilde kalır",
      'Uzun işlemlerde "şu an ne yapıyorum" bilgisini verir',
      'Fiyat izleme ve hedef fiyat uyarısı',
      'Beden stoğa girince ya da tükenince uyarı',
    ],
  },
  {
    title: 'Güvenli, yerel, açık',
    wide: true,
    items: [
      'Verilerin yalnızca bilgisayarında, hesap yok',
      'Ödeme yapmaz; sepet yalnızca açık onayınla, istersen tamamen kapalı',
      'Arka planda çalışır; doğrulama ya da giriş gerekirse pencereyi açıp seni çağırır, istersen hep izleyebilirsin',
      "Claude Code plugin'i ve skill'leri; standart MCP olduğundan başka istemcilere de bağlanır",
      'MIT lisanslı, kararları test edilmiş açık kaynak kural',
    ],
  },
];

export const PRIVACY = [
  { title: 'Yerel', text: 'Profil, envanter ve beğenilerin ~/.trendyol-mcp altında tutulur. Hiçbir sunucuya gönderilmez, hesap açman gerekmez.' },
  { title: 'Ödeme yok', text: 'Asistan ödeme yapmaz. Sepete ekleme yalnızca açık onayınla yapılır ve tamamen kapatılabilir.' },
  { title: 'Açık kaynak', text: 'MIT lisanslı. Ne yaptığını kodundan okuyabilir, kendi ihtiyacına göre değiştirebilirsin.' },
] as const;

export const FAQ = [
  { q: 'Ücretli mi?', a: 'Hayır, MIT lisanslı ve ücretsiz. Claude Code kullanımın kendi planına bağlıdır.' },
  { q: 'Trendyol hesabıma erişiyor mu?', a: "Şifreni görmez ve saklamaz. Trendyol'u senin Chrome'unda gezer; giriş yapman gerekirse aynı pencerede sen yaparsın. Oturumun, normal bir tarayıcıdaki gibi yalnızca bilgisayarındaki Chrome profilinde kalır." },
  { q: 'Ekranımda bir Chrome penceresi hareket edecek mi?', a: 'Varsayılan olarak hayır: tarayıcı arka planda çalışır. Trendyol bir doğrulama isterse ya da giriş gerekirse pencere görünür açılır ve asistan senden tamamlamanı ister. Her şeyi izlemek istersen TRENDYOL_MODE=gorunur ayarla.' },
  { q: 'Sekmeler açık kalıyor mu?', a: 'Hayır. Ürün sayfaları yeni sekmede açılsa da eskileri kapatılır. İhtiyaç "alındı" ya da "vazgeçildi" olunca, ya da 5 dakika boşta kalınca Chrome kendiliğinden kapanır. Yarıda bırakırsan bakılan adaylar kaydedilir; bir sonraki oturumda nerede kaldığını hatırlar.' },
  { q: 'Hangi istemcilerde çalışır?', a: "En iyi deneyim Claude Code plugin'iyle gelir. Sunucu standart bir MCP olduğu için opencode gibi diğer istemcilere elle de bağlanabilir (docs/MANUAL-SETUP.md)." },
  { q: 'Trendyol resmi olarak destekliyor mu?', a: 'Hayır. Bu proje Trendyol ile bağlantılı değildir; arayüz değişirse bozulabilir. Kullanım koşullarına uymak senin sorumluluğundadır.' },
] as const;
