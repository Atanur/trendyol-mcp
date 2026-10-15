import { getWardrobe } from '../wardrobe/db.js';
import { personalizeProduct, type Karar, type Personal, type ProductLike } from '../wardrobe/personalize.js';
import { profileNote } from '../wardrobe/profile.js';
import type { Role } from '../wardrobe/types.js';

export interface PersonalOptions {
  gender?: string;
  rol?: Role;
  butceMax?: number;
}

export type WithPersonal<T> = T & { kisisel: Personal };

export interface PersonalSummary {
  ozet: Record<Karar, number>;
  profilNotu?: string;
  varsayilanKullanilan?: string[];
}

export type PersonalOutcome<T> =
  | { ok: true; products: Array<WithPersonal<T>>; summary: PersonalSummary }
  | { ok: false; hata: string };

/**
 * `annotatePersonal`'ın hata-güvenli hâli: kişisel işaretleme başarısız olursa (ör. bozuk veri dosyası)
 * kazıma sonuçları kaybolmasın diye hatayı değer olarak döner.
 */
export async function annotatePersonalSafe<T extends ProductLike>(
  products: T[],
  options: PersonalOptions,
): Promise<PersonalOutcome<T>> {
  try {
    return { ok: true, ...(await annotatePersonal(products, options)) };
  } catch (error) {
    return { ok: false, hata: (error as Error).message };
  }
}

/** Ürün listesini kullanıcının profiline göre işaretler; sıralamayı değiştirmez. */
export async function annotatePersonal<T extends ProductLike>(
  products: T[],
  options: PersonalOptions,
): Promise<{ products: Array<WithPersonal<T>>; summary: PersonalSummary }> {
  const store = getWardrobe();
  const [profile, brandFit, zevk] = await Promise.all([store.getProfile(), store.listBrandFit(), store.listZevk()]);
  const annotated = products.map((product) => ({
    ...product,
    kisisel: personalizeProduct(product, { profile, brandFit, zevk, gender: options.gender, rol: options.rol, butceMax: options.butceMax }),
  }));
  const ozet: Record<Karar, number> = { uygun: 0, dikkat: 0, eleme: 0 };
  for (const row of annotated) ozet[row.kisisel.karar] += 1;
  return { products: annotated, summary: { ozet, ...profileNote(profile) } };
}
