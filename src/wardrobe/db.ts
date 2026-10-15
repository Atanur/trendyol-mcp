import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { shortId } from '../util.js';
import {
  DEFAULT_PROFILE,
  type BrandFit,
  type Coupon,
  type Donation,
  type Item,
  type Kaynak,
  type Need,
  type Purchase,
  type WardrobeData,
  type WardrobeProfile,
  type WearLog,
  type ZevkSinyali,
} from './types.js';
import { FIELDS, applyAnswers, completeness, getPath, migrateProfile, type ApplyResult } from './profile.js';

const FILE = () => path.join(config.dataDir, 'wardrobe.json');

function empty(): WardrobeData {
  return {
    items: [],
    profile: { ...DEFAULT_PROFILE },
    wearLogs: [],
    brandFit: [],
    donations: [],
    purchases: [],
    coupons: [],
    zevk: [],
    needs: [],
  };
}

/** `profile_set` ile dokunulan her alanı "kullanici" kaynağına çeker. */
const LEGACY_TOUCH_KEYS = ['butce', 'sezonSayisi', 'hedef', 'kacinanlar', 'kurallar', 'palet.baz', 'palet.aksan'] as const;

class WardrobeStore {
  private data: WardrobeData | null = null;
  private loading: Promise<WardrobeData> | null = null;
  /** Disk yazımları sırayla yapılır: paralel araç çağrıları aynı tmp dosyasında çakışmasın. */
  private writeQueue: Promise<void> = Promise.resolve();

  /** Eşzamanlı ilk çağrılar aynı okuma işini paylaşır (iki ayrı nesne üretilmez). */
  private load(): Promise<WardrobeData> {
    if (this.data) return Promise.resolve(this.data);
    this.loading ??= this.read();
    return this.loading;
  }

  private async read(): Promise<WardrobeData> {
    let loaded: WardrobeData;
    try {
      const parsed = JSON.parse(await readFile(FILE(), 'utf8')) as Partial<WardrobeData>;
      loaded = { ...empty(), ...parsed };
    } catch {
      loaded = empty();
    }
    // Bellekte v2'ye taşı; diske bir sonraki yazımda gider.
    loaded.profile = migrateProfile(loaded.profile);
    this.data = loaded;
    return loaded;
  }

  private persist(): Promise<void> {
    const run = this.writeQueue.then(() => this.write());
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  private async write(): Promise<void> {
    if (!this.data) return;
    await mkdir(config.dataDir, { recursive: true });
    const file = FILE();
    const tmp = `${file}.${process.pid}.${shortId()}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await rename(tmp, file);
  }

  async snapshot(): Promise<WardrobeData> {
    return structuredClone(await this.load());
  }

  async listItems(): Promise<Item[]> {
    return (await this.load()).items;
  }

  async getItem(id: string): Promise<Item | undefined> {
    return (await this.load()).items.find((i) => i.id === id);
  }

  async addItem(input: Partial<Item> & { ad: string; rol: Item['rol'] }): Promise<Item> {
    const data = await this.load();
    const item: Item = {
      id: input.id ?? shortId('item_'),
      ad: input.ad,
      rol: input.rol,
      kategori: input.kategori ?? input.rol,
      renk: input.renk ?? 'belirtilmemiş',
      paletYuvasi: input.paletYuvasi,
      kumas: input.kumas,
      kompozisyon: input.kompozisyon,
      kalip: input.kalip,
      baski: input.baski,
      sezon: input.sezon ?? ['ilkbahar', 'sonbahar'],
      formallik: input.formallik ?? 'smart',
      mekan: input.mekan,
      marka: input.marka,
      beden: input.beden,
      fiyat: input.fiyat,
      alimTarihi: input.alimTarihi ?? new Date().toISOString().slice(0, 10),
      durum: input.durum ?? 'iyi',
      giyimSayisi: input.giyimSayisi ?? 0,
      sonGiyim: input.sonGiyim,
      foto: input.foto,
      kaynakUrl: input.kaynakUrl,
    };
    data.items.push(item);
    await this.persist();
    return item;
  }

  async updateItem(id: string, patch: Partial<Item>): Promise<Item | undefined> {
    const data = await this.load();
    const item = data.items.find((i) => i.id === id);
    if (!item) return undefined;
    Object.assign(item, patch, { id });
    await this.persist();
    return item;
  }

  async removeItem(id: string): Promise<boolean> {
    const data = await this.load();
    const before = data.items.length;
    data.items = data.items.filter((i) => i.id !== id);
    const removed = data.items.length < before;
    data.wearLogs = data.wearLogs.filter((w) => w.itemId !== id);
    if (removed) await this.persist();
    return removed;
  }

  async getProfile(): Promise<WardrobeProfile> {
    const data = await this.load();
    return data.profile ?? migrateProfile(null);
  }

  /** Profili birleştirerek günceller; dokunulan alanlar "kullanici" kaynağına geçer. */
  async setProfile(patch: Partial<WardrobeProfile>): Promise<WardrobeProfile> {
    const data = await this.load();
    const current = migrateProfile(data.profile);
    const { meta: _ignored, ...rest } = patch;
    const merged: WardrobeProfile = {
      ...current,
      ...rest,
      palet: { ...current.palet, ...(patch.palet ?? {}) },
      kurallar: { ...current.kurallar, ...(patch.kurallar ?? {}) },
      hedef: { ...current.hedef, ...(patch.hedef ?? {}) },
      amac: { ...current.amac, ...(patch.amac ?? {}) },
      yasam: { ...current.yasam, ...(patch.yasam ?? {}) },
      beden: { ...current.beden, ...(patch.beden ?? {}) },
      kalip: { ...current.kalip, ...(patch.kalip ?? {}) },
      butceDavranisi: { ...current.butceDavranisi, ...(patch.butceDavranisi ?? {}) },
    };
    const kaynaklar = { ...current.meta!.kaynaklar };
    for (const key of [...LEGACY_TOUCH_KEYS, ...FIELDS.map((f) => f.id)]) {
      if (getPath(patch, key) !== undefined) kaynaklar[key] = 'kullanici';
    }
    merged.meta = {
      schemaVersion: current.meta!.schemaVersion,
      kaynaklar,
      onboarded: false,
      guncellendi: new Date().toISOString().slice(0, 10),
    };
    merged.meta.onboarded = completeness(merged).zorunluTamam;
    data.profile = merged;
    await this.persist();
    return data.profile;
  }

  /**
   * Cevapları profile uygular. Okuma-uygulama-yazma tek senkron blokta yapılır (await'ten sonra
   * araya başka güncelleme giremez), bu yüzden eşzamanlı çağrılar birbirini ezmez.
   */
  async applyProfileAnswers(answers: Record<string, unknown>, kaynak: Kaynak = 'kullanici'): Promise<ApplyResult> {
    const data = await this.load();
    const result = applyAnswers(data.profile ?? migrateProfile(null), answers, kaynak);
    if (result.uygulanan.length > 0) {
      data.profile = result.profile;
      await this.persist();
    }
    return result;
  }

  async listNeeds(): Promise<Need[]> {
    return (await this.load()).needs;
  }

  async addNeed(input: Omit<Need, 'id' | 'olusturma' | 'guncelleme'>): Promise<Need> {
    const data = await this.load();
    const now = new Date().toISOString().slice(0, 10);
    const need: Need = { id: shortId('need_'), olusturma: now, guncelleme: now, ...input };
    data.needs.push(need);
    await this.persist();
    return need;
  }

  /** `patch` bir fonksiyonsa mevcut kayıtla çağrılır (atomik okuma-değiştirme-yazma). */
  async updateNeed(
    id: string,
    patch: Partial<Omit<Need, 'id' | 'olusturma'>> | ((current: Need) => Partial<Omit<Need, 'id' | 'olusturma'>>),
  ): Promise<Need | undefined> {
    const data = await this.load();
    const need = data.needs.find((n) => n.id === id);
    if (!need) return undefined;
    const changes = typeof patch === 'function' ? patch(need) : patch;
    Object.assign(need, changes, { id, guncelleme: new Date().toISOString().slice(0, 10) });
    await this.persist();
    return need;
  }

  async listZevk(): Promise<ZevkSinyali[]> {
    return (await this.load()).zevk;
  }

  /** Aynı ürün (url yoksa ad) için son tepki geçerli olur. */
  async addZevk(entries: Array<Omit<ZevkSinyali, 'id' | 'tarih'> & { tarih?: string }>): Promise<ZevkSinyali[]> {
    const data = await this.load();
    const today = new Date().toISOString().slice(0, 10);
    const saved: ZevkSinyali[] = [];
    // Boş/boşluk url "yok" sayılır; yoksa hepsi aynı anahtara düşüp birbirini silerdi.
    const keyOf = (z: { url?: string; ad: string }): string => (z.url?.trim() || z.ad).toLocaleLowerCase('tr-TR');
    for (const entry of entries) {
      const key = keyOf(entry);
      data.zevk = data.zevk.filter((z) => keyOf(z) !== key);
      const full: ZevkSinyali = { id: shortId('zv_'), tarih: entry.tarih ?? today, ...entry };
      data.zevk.push(full);
      saved.push(full);
    }
    await this.persist();
    return saved;
  }

  async addWear(log: Omit<WearLog, 'id'>): Promise<WearLog> {
    const data = await this.load();
    const entry: WearLog = { id: shortId('w_'), ...log };
    data.wearLogs.push(entry);
    const item = data.items.find((i) => i.id === log.itemId);
    if (item) {
      item.giyimSayisi += 1;
      item.sonGiyim = log.tarih;
    }
    await this.persist();
    return entry;
  }

  async listWear(itemId?: string): Promise<WearLog[]> {
    const logs = (await this.load()).wearLogs;
    return itemId ? logs.filter((w) => w.itemId === itemId) : logs;
  }

  async setBrandFit(entry: BrandFit): Promise<BrandFit> {
    const data = await this.load();
    const existing = data.brandFit.find(
      (b) => b.marka.toLocaleLowerCase('tr-TR') === entry.marka.toLocaleLowerCase('tr-TR'),
    );
    if (existing) Object.assign(existing, entry);
    else data.brandFit.push(entry);
    await this.persist();
    return entry;
  }

  async listBrandFit(): Promise<BrandFit[]> {
    return (await this.load()).brandFit;
  }

  async addDonation(entry: Omit<Donation, 'id' | 'tarih'> & { tarih?: string }): Promise<Donation> {
    const data = await this.load();
    const full: Donation = { id: shortId('don_'), tarih: entry.tarih ?? new Date().toISOString().slice(0, 10), ...entry };
    data.donations.push(full);
    await this.persist();
    return full;
  }

  async listDonations(): Promise<Donation[]> {
    return (await this.load()).donations;
  }

  async addPurchase(entry: Omit<Purchase, 'id'>): Promise<Purchase> {
    const data = await this.load();
    const full: Purchase = { id: shortId('pur_'), ...entry };
    data.purchases.push(full);
    await this.persist();
    return full;
  }

  async listPurchases(): Promise<Purchase[]> {
    return (await this.load()).purchases;
  }

  async markReturn(id: string, returned: boolean): Promise<Purchase | undefined> {
    const data = await this.load();
    const purchase = data.purchases.find((p) => p.id === id);
    if (!purchase) return undefined;
    purchase.iadeEdildi = returned;
    await this.persist();
    return purchase;
  }

  async addCoupon(entry: Coupon): Promise<Coupon> {
    const data = await this.load();
    data.coupons.push(entry);
    await this.persist();
    return entry;
  }

  async listCoupons(): Promise<Coupon[]> {
    return (await this.load()).coupons;
  }
}

let instance: WardrobeStore | undefined;

export function getWardrobe(): WardrobeStore {
  instance ??= new WardrobeStore();
  return instance;
}

export function returnDeadline(fromIso: string, days = 14): string {
  const date = new Date(fromIso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
