import { parsePrice } from '../util.js';
import { DEFAULT_PROFILE, type Kaynak, type Mekan, type ProfileMeta, type WardrobeProfile } from './types.js';

export const PROFILE_SCHEMA_VERSION = 2;

export type FieldTip = 'metin' | 'sayi' | 'liste' | 'secim' | 'obje';
export type FieldBolum = 'amac' | 'yasam' | 'beden' | 'stil' | 'butce';

export interface FieldDef {
  /** Profildeki nokta yolu, ör. "beden.alt". */
  id: string;
  bolum: FieldBolum;
  soru: string;
  ipucu?: string;
  ornek?: string;
  zorunlu: boolean;
  tip: FieldTip;
  secenekler?: string[];
  /** Kullanıcı isterse atlayabilir; nerede saklandığı söylenmeli. */
  hassas?: boolean;
}

const MEKANLAR: Mekan[] = ['is', 'gunluk', 'ozel', 'spor', 'seyahat', 'ev'];

/**
 * Onboarding betiği. Sıra = sorulma sırası: önce zorunlular (sohbet akışına uygun),
 * sonra isteğe bağlılar.
 */
export const FIELDS: FieldDef[] = [
  { id: 'amac.neden', bolum: 'amac', zorunlu: true, tip: 'metin', soru: 'Bu asistanı neden kullanıyorsun, neyi çözmek istiyorsun?', ornek: 'kasım indiriminde dolabı yenilemek, giymediklerimden kurtulmak' },
  { id: 'yasam.sehir', bolum: 'yasam', zorunlu: true, tip: 'metin', soru: 'Hangi şehirde yaşıyorsun?', ipucu: 'İklim ve mevsim ihtiyacını belirler.' },
  { id: 'yasam.haftalik', bolum: 'yasam', zorunlu: true, tip: 'obje', soru: 'Tipik bir haftada günlerin nasıl dağılıyor?', ipucu: `Anahtarlar: ${MEKANLAR.join(', ')}. Değer = gün sayısı.`, ornek: '{"is":3,"ev":2,"ozel":2}' },
  { id: 'butce', bolum: 'butce', zorunlu: true, tip: 'sayi', soru: 'Bu dönem giyime toplam ne kadar ayırabilirsin (TL)?', ornek: '30000' },
  { id: 'beden.ust', bolum: 'beden', zorunlu: true, tip: 'metin', soru: 'Üst bedenin ne? (şu an rahat giydiğin)', ornek: 'L' },
  { id: 'beden.alt', bolum: 'beden', zorunlu: true, tip: 'metin', soru: 'Pantolon bedenin / bel-boy ölçün ne?', ornek: '32/32' },
  { id: 'kalip.sevilen', bolum: 'stil', zorunlu: true, tip: 'liste', soru: 'Hangi kalıpları seviyorsun?', ornek: 'regular, relaxed, straight' },
  { id: 'palet.baz', bolum: 'stil', zorunlu: true, tip: 'liste', soru: 'Dolabının ana renkleri hangileri olsun?', ornek: 'lacivert, gri, ekru, siyah' },

  { id: 'amac.yonelim', bolum: 'amac', zorunlu: false, tip: 'liste', soru: 'Hangileri hedefin? (ayıklama, indirim-alışveriş, kapsül, tarz-keşfi, yenileme)' },
  { id: 'amac.pencere', bolum: 'amac', zorunlu: false, tip: 'metin', soru: 'Bir zaman penceren var mı?', ornek: 'kasım indirimi' },
  { id: 'yasam.iklim', bolum: 'yasam', zorunlu: false, tip: 'metin', soru: 'İklim nasıl? (kış kaç ay, yağmur, nem)' },
  { id: 'yasam.isOrtami', bolum: 'yasam', zorunlu: false, tip: 'metin', soru: 'İş/okul ortamı ve dress code nasıl?' },
  { id: 'yasam.spor', bolum: 'yasam', zorunlu: false, tip: 'metin', soru: 'Spor yapıyor musun? Ne tür?' },
  { id: 'yasam.seyahat', bolum: 'yasam', zorunlu: false, tip: 'metin', soru: 'Seyahat sıklığın ve tarzın?' },
  { id: 'yasam.ozelEtkinlikler', bolum: 'yasam', zorunlu: false, tip: 'metin', soru: 'Önümüzdeki 12 ayda özel etkinlik var mı?' },
  { id: 'beden.ayakkabi', bolum: 'beden', zorunlu: false, tip: 'metin', soru: 'Ayakkabı numaran?' },
  { id: 'beden.boy', bolum: 'beden', zorunlu: false, tip: 'sayi', hassas: true, soru: 'Boyun (cm)? İsteğe bağlı; yalnızca bu makinede kalır.' },
  { id: 'beden.kilo', bolum: 'beden', zorunlu: false, tip: 'sayi', hassas: true, soru: 'Kilon (kg)? İsteğe bağlı; yalnızca bu makinede kalır.' },
  { id: 'beden.hedefKilo', bolum: 'beden', zorunlu: false, tip: 'sayi', hassas: true, soru: 'Kilo hedefin var mı? (kg) Bol/dar bedeni seçmeyi etkiler.' },
  { id: 'beden.vucutNotlari', bolum: 'beden', zorunlu: false, tip: 'liste', soru: 'Kalıp seçimini etkileyen vücut notların?', ornek: 'gövde kısa, bacak uzun, kalça geniş' },
  { id: 'kalip.kacinilan', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Kaçındığın kalıplar?', ornek: 'slim, yüksek bel, dar paça' },
  { id: 'kalip.pacaKurali', bolum: 'stil', zorunlu: false, tip: 'metin', soru: 'Pantolon paça/boy kuralın?', ornek: 'ayakkabıda katlanmasın, otururken çorap görünmesin' },
  { id: 'kalip.bel', bolum: 'stil', zorunlu: false, tip: 'secim', secenekler: ['dusuk', 'orta', 'yuksek'], soru: 'Bel yüksekliği tercihin?' },
  { id: 'palet.aksan', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Vurgu renkleri?', ornek: 'bordo, haki' },
  { id: 'kacinanlar', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Hiç giymediğin / kaçındığın renkler?' },
  { id: 'stilKelimeleri', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Tarzını anlatan 3-5 kelime?', ornek: 'sade, rahat, sportif, minimal' },
  { id: 'sevilenKumaslar', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Sevdiğin kumaşlar?' },
  { id: 'sevilmeyenKumaslar', bolum: 'stil', zorunlu: false, tip: 'liste', soru: 'Sevmediğin kumaşlar?' },
  { id: 'butceDavranisi.tekUrunUst', bolum: 'butce', zorunlu: false, tip: 'sayi', soru: 'Tek bir ürüne en fazla ne kadar vermeye razısın (TL)?' },
  { id: 'butceDavranisi.taksit', bolum: 'butce', zorunlu: false, tip: 'secim', secenekler: ['hayir', 'gerekirse', 'serbest'], soru: 'Taksit kullanımı?' },
  { id: 'butceDavranisi.egilim', bolum: 'butce', zorunlu: false, tip: 'secim', secenekler: ['planli', 'durtusel', 'karisik'], soru: 'Alışveriş eğilimin?' },
];

const LEGACY_KEYS = ['butce', 'sezonSayisi', 'hedef', 'palet.baz', 'palet.aksan', 'kacinanlar', 'kurallar'] as const;

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Verilen nesne üzerinde (mutasyonla) iç içe yazar; yalnızca bu modülde klonlanmış nesnede çağrılır. */
function assignPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = obj;
  for (const key of keys.slice(0, -1)) {
    const next = cur[key];
    if (!next || typeof next !== 'object') cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

/** Eski/boş profili v2'ye getirir. Girdiyi değiştirmez. Zaten v2 ise aynen döner. */
export function migrateProfile(raw: WardrobeProfile | null | undefined): WardrobeProfile {
  if (raw?.meta && raw.meta.schemaVersion >= PROFILE_SCHEMA_VERSION) {
    const copy = structuredClone(raw);
    // Elle düzenlenmiş/bozuk dosyada `kaynaklar` eksik olabilir.
    copy.meta = { ...copy.meta!, kaynaklar: copy.meta!.kaynaklar ?? {} };
    return copy;
  }
  const base = structuredClone(raw ?? DEFAULT_PROFILE);
  const kaynaklar: Record<string, Kaynak> = {};
  for (const key of LEGACY_KEYS) {
    const have = getPath(base, key);
    if (!isPresent(have) && key !== 'kacinanlar') continue;
    kaynaklar[key] = raw === null || raw === undefined || same(have, getPath(DEFAULT_PROFILE, key)) ? 'varsayilan' : 'kullanici';
  }
  const meta: ProfileMeta = { schemaVersion: PROFILE_SCHEMA_VERSION, onboarded: false, kaynaklar };
  return { ...base, meta };
}

function kaynakOf(profile: WardrobeProfile, id: string): Kaynak {
  return profile.meta?.kaynaklar?.[id] ?? 'kullanici';
}

/** Alan kullanıcı tarafından doldurulmuş mu? Varsayılan ve çıkarım sayılmaz. */
export function isFilled(profile: WardrobeProfile, id: string): boolean {
  return isPresent(getPath(profile, id)) && kaynakOf(profile, id) === 'kullanici';
}

export interface Completeness {
  yuzde: number;
  zorunluTamam: boolean;
  eksikZorunlu: FieldDef[];
  eksik: FieldDef[];
  doldurulan: string[];
}

export function completeness(profile: WardrobeProfile): Completeness {
  const doldurulan = FIELDS.filter((f) => isFilled(profile, f.id)).map((f) => f.id);
  const eksik = FIELDS.filter((f) => !doldurulan.includes(f.id));
  const eksikZorunlu = eksik.filter((f) => f.zorunlu);
  return {
    yuzde: Math.round((doldurulan.length / FIELDS.length) * 100),
    zorunluTamam: eksikZorunlu.length === 0,
    eksikZorunlu,
    eksik,
    doldurulan,
  };
}

/** Sıradaki en fazla n soru: önce zorunlu eksikler, sonra isteğe bağlılar. */
export function nextQuestions(profile: WardrobeProfile, n = 3): FieldDef[] {
  const { eksikZorunlu, eksik } = completeness(profile);
  const ordered = eksikZorunlu.length > 0 ? eksikZorunlu : eksik;
  return ordered.slice(0, n);
}

/**
 * Hâlâ varsayılan değerle çalışan ZORUNLU alanlar (araçlar bunu "varsayılan kullanıldı" diye bildirir).
 * Onboarding'de karşılığı olmayan eski anahtarlar (hedef, kurallar, sezonSayisi...) bilerek hariçtir:
 * kullanıcı bunları dolduramaz, bildirmek sürekli yanlış alarm olurdu.
 */
export function defaultsInUse(profile: WardrobeProfile): string[] {
  const required = new Set(FIELDS.filter((f) => f.zorunlu).map((f) => f.id));
  return Object.entries(profile.meta?.kaynaklar ?? {})
    .filter(([id, kaynak]) => kaynak === 'varsayilan' && required.has(id))
    .map(([id]) => id);
}

/**
 * Kişisel araçların çıktısına eklenen not: varsayılan değerle çalışıldıysa bunu bildirir.
 * Tamamen hazır profilde boş nesne döner (çıktıyı kirletmez).
 */
export function profileNote(profile: WardrobeProfile): { varsayilanKullanilan?: string[]; profilNotu?: string } {
  const defaults = defaultsInUse(profile);
  if (defaults.length === 0 && profile.meta?.onboarded) return {};
  return {
    ...(defaults.length > 0 ? { varsayilanKullanilan: defaults } : {}),
    profilNotu: 'Profil tamamlanmadı; bu sonuç varsayılan değerlere dayanıyor olabilir (bkz. profile_status).',
  };
}

/** "30.000", "1.500 TL", "30 bin" okur; kalan her şeyi (işaretli, açıklamalı metin) reddeder. */
function parseNumberText(text: string): number | undefined {
  const t = text.trim().toLocaleLowerCase('tr-TR');
  const thousand = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:bin|k)(?:\s*(?:tl|₺|lira))?$/);
  if (thousand?.[1]) return Math.round(Number.parseFloat(thousand[1].replace(',', '.')) * 1000);
  if (/^\d[\d.,]*\s*(?:tl|₺|lira)?$/.test(t)) return parsePrice(t);
  return undefined;
}

type Coerced = { ok: true; value: unknown } | { ok: false; neden: string };

function splitList(value: unknown): string[] | undefined {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : undefined;
  if (!parts) return undefined;
  return parts.map((p) => String(p).trim()).filter(Boolean);
}

function coerce(def: FieldDef, value: unknown): Coerced {
  switch (def.tip) {
    case 'metin': {
      const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
      return text ? { ok: true, value: text } : { ok: false, neden: 'boş metin' };
    }
    case 'sayi': {
      const num = typeof value === 'number' ? value : typeof value === 'string' ? parseNumberText(value) : undefined;
      return num !== undefined && Number.isFinite(num) && num >= 0 ? { ok: true, value: num } : { ok: false, neden: 'sayı bekleniyor' };
    }
    case 'liste': {
      const list = splitList(value);
      return list && list.length > 0 ? { ok: true, value: list } : { ok: false, neden: 'liste bekleniyor' };
    }
    case 'secim': {
      const text = typeof value === 'string' ? value.trim().toLocaleLowerCase('tr-TR') : '';
      return def.secenekler?.includes(text) ? { ok: true, value: text } : { ok: false, neden: `seçenekler: ${def.secenekler?.join(', ')}` };
    }
    case 'obje': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, neden: 'nesne bekleniyor' };
      const out: Record<string, number> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (!MEKANLAR.includes(key as Mekan)) return { ok: false, neden: `geçersiz anahtar "${key}" (${MEKANLAR.join(', ')})` };
        if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 7) return { ok: false, neden: `"${key}" 0-7 arası sayı olmalı` };
        out[key] = val;
      }
      return Object.keys(out).length ? { ok: true, value: out } : { ok: false, neden: 'boş nesne' };
    }
  }
}

export interface ApplyResult {
  profile: WardrobeProfile;
  uygulanan: string[];
  reddedilen: Array<{ alan: string; neden: string }>;
}

/**
 * Cevapları profile uygular (girdiyi değiştirmez). `kaynak="cikarim"` ile yazılan değerler
 * kullanıcı onaylayana kadar "dolu" sayılmaz.
 */
export function applyAnswers(
  profile: WardrobeProfile,
  answers: Record<string, unknown>,
  kaynak: Kaynak = 'kullanici',
  today: string = new Date().toISOString().slice(0, 10),
): ApplyResult {
  const next = migrateProfile(profile) as WardrobeProfile & Record<string, unknown>;
  const uygulanan: string[] = [];
  const reddedilen: ApplyResult['reddedilen'] = [];

  for (const [id, raw] of Object.entries(answers)) {
    const def = FIELDS.find((f) => f.id === id);
    if (!def) {
      reddedilen.push({ alan: id, neden: 'bilinmeyen alan' });
      continue;
    }
    const result = coerce(def, raw);
    if (!result.ok) {
      reddedilen.push({ alan: id, neden: result.neden });
      continue;
    }
    // Çıkarım, kullanıcının onayladığı değeri asla ezmez.
    if (kaynak === 'cikarim' && isFilled(next, id)) {
      reddedilen.push({ alan: id, neden: 'kullanıcı değeri korunuyor' });
      continue;
    }
    assignPath(next, id, result.value);
    next.meta!.kaynaklar[id] = kaynak;
    uygulanan.push(id);
  }

  next.meta!.guncellendi = today;
  next.meta!.onboarded = completeness(next).zorunluTamam;
  return { profile: next, uygulanan, reddedilen };
}
