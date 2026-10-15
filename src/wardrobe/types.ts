export type Role = 'ust' | 'alt' | 'tekParca' | 'katman' | 'dis' | 'ayakkabi' | 'aksesuar';
export type Sezon = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';
export type Formallik = 'resmi' | 'smart' | 'gunluk' | 'spor';
export type Mekan = 'is' | 'gunluk' | 'ozel' | 'spor' | 'seyahat' | 'ev';
export type Durum = 'iyi' | 'orta' | 'yipranmis';

export interface Composition {
  material: string;
  percent?: number;
}

export interface Item {
  id: string;
  ad: string;
  rol: Role;
  kategori: string;
  renk: string;
  paletYuvasi?: 'baz' | 'aksan';
  kumas?: string;
  kompozisyon?: Composition[];
  kalip?: string;
  baski?: boolean;
  sezon: Sezon[];
  formallik: Formallik;
  mekan?: Mekan[];
  marka?: string;
  beden?: string;
  fiyat?: number;
  alimTarihi?: string;
  durum: Durum;
  giyimSayisi: number;
  sonGiyim?: string;
  foto?: string;
  kaynakUrl?: string;
}

export interface ProfileRules {
  slimYok?: boolean;
  sentetikDeriYok?: boolean;
  baskiYok?: boolean;
  maxPolyester?: number;
  minDogram?: number;
}

/** Bir profil bilgisinin nereden geldiği: kullanıcı söyledi / çıkarıldı (onay bekler) / eski varsayılan. */
export type Kaynak = 'kullanici' | 'cikarim' | 'varsayilan';

export interface ProfileMeta {
  schemaVersion: number;
  onboarded: boolean;
  /** Alan yolu (ör. "beden.alt", "butce") → kaynağı. */
  kaynaklar: Record<string, Kaynak>;
  guncellendi?: string;
}

export interface Amac {
  /** Kullanıcının bu asistanı neden kullandığı (serbest metin). */
  neden?: string;
  /** ayiklama | indirim-alisveris | kapsul | tarz-kesfi | yenileme ... */
  yonelim?: string[];
  /** Zaman penceresi, ör. "kasım indirimi". */
  pencere?: string;
}

export interface Yasam {
  sehir?: string;
  iklim?: string;
  isOrtami?: string;
  /** Haftada kaç gün hangi mekân. */
  haftalik?: Partial<Record<Mekan, number>>;
  spor?: string;
  seyahat?: string;
  ozelEtkinlikler?: string;
}

export interface Beden {
  boy?: number;
  kilo?: number;
  hedefKilo?: number;
  ust?: string;
  /** Pantolon, ör. "32/32". */
  alt?: string;
  ayakkabi?: string;
  /** Vücut/oran notları, ör. "gövde kısa, bacak uzun". */
  vucutNotlari?: string[];
}

export interface KalipTercihi {
  /** Sevilen kalıplar: regular, relaxed, straight... */
  sevilen?: string[];
  /** Kaçınılanlar: slim, yüksek bel, dar paça... */
  kacinilan?: string[];
  pacaKurali?: string;
  bel?: 'dusuk' | 'orta' | 'yuksek';
}

export interface ButceDavranisi {
  tekUrunUst?: number;
  taksit?: 'hayir' | 'gerekirse' | 'serbest';
  egilim?: 'planli' | 'durtusel' | 'karisik';
  kategoriPayi?: Partial<Record<Role, number>>;
}

export interface WardrobeProfile {
  yas?: string;
  vucutTipi?: string;
  bedenIfadesi?: string;
  hedef: Partial<Record<Role, number>>;
  palet: { baz: string[]; aksan: string[] };
  kacinanlar: string[];
  kurallar: ProfileRules;
  butce?: number;
  sezonSayisi?: 2 | 4;
  mekanMevsim?: Partial<Record<Mekan, Partial<Record<Sezon, number>>>>;
  formallikMerkezi?: number;
  // --- v2 (hepsi opsiyonel; eski profiller bozulmaz) ---
  amac?: Amac;
  yasam?: Yasam;
  beden?: Beden;
  kalip?: KalipTercihi;
  butceDavranisi?: ButceDavranisi;
  stilKelimeleri?: string[];
  sevilenKumaslar?: string[];
  sevilmeyenKumaslar?: string[];
  meta?: ProfileMeta;
}

export type Tepki = 'begendim' | 'olabilir' | 'olmaz';

/** Zevk testinden / sohbetten gelen "bunu beğendim/beğenmedim" sinyali. */
export interface ZevkSinyali {
  id: string;
  ad: string;
  marka?: string;
  url?: string;
  kategori?: string;
  tepki: Tepki;
  etiketler: string[];
  tarih: string;
}

export type NeedDurum = 'acik' | 'arastiriliyor' | 'karar' | 'alindi' | 'vazgecildi';

/** Kullanıcının asıl ihtiyacı: arama bunun için yapılıyor. */
export interface Need {
  id: string;
  istek: string;
  rol?: Role;
  vesile?: Mekan[];
  formallik?: Formallik;
  renk?: string;
  kalip?: string;
  kumas?: string;
  butceMax?: number;
  /** "Bununla ne giyeceğim / ne zaman giyeceğim" notları. */
  kombin: string[];
  sorular: string[];
  durum: NeedDurum;
  gapId?: string;
  purchaseId?: string;
  olusturma: string;
  guncelleme: string;
}

export interface WearLog {
  id: string;
  itemId: string;
  tarih: string;
  baglam?: string;
  memnuniyet?: number;
}

export interface Gap {
  id: string;
  rol: Role;
  baslik: string;
  adet: number;
  oncelik: 'yuksek' | 'orta' | 'dusuk';
  gerekce?: string;
}

export interface BrandFit {
  marka: string;
  beden: string;
  not?: string;
  tarih: string;
}

export interface Donation {
  id: string;
  ad: string;
  itemId?: string;
  tarih: string;
  not?: string;
}

export interface Purchase {
  id: string;
  ad: string;
  url?: string;
  fiyat?: number;
  marka?: string;
  beden?: string;
  kategori?: string;
  rol?: Role;
  alimTarihi: string;
  iadeSonTarih: string;
  iadeEdildi?: boolean;
  itemId?: string;
}

export interface Coupon {
  ad: string;
  kod?: string;
  indirim?: string;
  kosul?: string;
  kaynak?: string;
}

export interface WardrobeData {
  items: Item[];
  profile: WardrobeProfile | null;
  wearLogs: WearLog[];
  brandFit: BrandFit[];
  donations: Donation[];
  purchases: Purchase[];
  coupons: Coupon[];
  zevk: ZevkSinyali[];
  needs: Need[];
}

export const DEFAULT_PROFILE: WardrobeProfile = {
  hedef: { ust: 12, alt: 8, tekParca: 4, katman: 7, dis: 4, ayakkabi: 6, aksesuar: 5 },
  palet: { baz: ['siyah', 'beyaz', 'gri', 'lacivert', 'bej'], aksan: ['bordo', 'haki', 'mavi'] },
  kacinanlar: [],
  kurallar: { maxPolyester: 60 },
  butce: 30000,
  sezonSayisi: 4,
};
