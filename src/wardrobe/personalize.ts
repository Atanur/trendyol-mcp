import { normalize, parsePrice } from '../util.js';
import { flagProduct } from './flags.js';
import { needConstraints } from './needs.js';
import type { BrandFit, Role, WardrobeProfile } from './types.js';

export interface ProductLike {
  title: string;
  price?: string | null;
  brand?: string | null;
  rating?: number | null;
}

export type Karar = 'uygun' | 'dikkat' | 'eleme';

export interface Personal {
  skor: number;
  karar: Karar;
  uyarilar: string[];
  olumlu: string[];
  butce?: 'icinde' | 'ustunde';
  bedenOnerisi?: string;
}

export interface PersonalizeCtx {
  profile: WardrobeProfile;
  gender?: string;
  rol?: Role;
  butceMax?: number;
  brandFit: BrandFit[];
}

const BASE_SCORE = 70;
const PENALTY_WARNING = 12;
const PENALTY_OVER_BUDGET = 15;
const PENALTY_LOW_RATING = 10;
const LOW_RATING = 3.5;
const BONUS_POSITIVE = 5;
const BONUS_CAP = 15;
const ELIMINATED_CAP = 25;
const OK_THRESHOLD = 65;

function sizeHint(product: ProductLike, ctx: PersonalizeCtx): string | undefined {
  const brand = product.brand ? normalize(product.brand) : undefined;
  const memory = brand ? ctx.brandFit.find((b) => normalize(b.marka) === brand) : undefined;
  if (memory) return `Marka hafızan: ${memory.marka} → ${memory.beden}${memory.not ? ` (${memory.not})` : ''}.`;
  const size = ctx.rol ? needConstraints({ rol: ctx.rol }, ctx.profile).beden : undefined;
  return size ? `Profil bedenin: ${size}.` : undefined;
}

/**
 * Bir ürünü kullanıcının profiline göre değerlendirir. Tamamen deterministik:
 * başlık bayrakları, bütçe, puan ve beden hafızası.
 */
export function personalizeProduct(product: ProductLike, ctx: PersonalizeCtx): Personal {
  const flags = flagProduct(product.title, ctx.profile, { gender: ctx.gender });
  const uyarilar = flags.uyarilar.map((f) => f.aciklama);
  let skor = BASE_SCORE;

  skor -= flags.uyarilar.filter((f) => f.seviye === 'uyari').length * PENALTY_WARNING;
  skor += Math.min(BONUS_CAP, flags.olumlu.length * BONUS_POSITIVE);

  let butce: Personal['butce'];
  const price = parsePrice(product.price ?? undefined);
  if (ctx.butceMax !== undefined && price !== undefined) {
    butce = price <= ctx.butceMax ? 'icinde' : 'ustunde';
    if (butce === 'ustunde') {
      skor -= PENALTY_OVER_BUDGET;
      uyarilar.push(`Bütçe üstü: ${price} TL > ${ctx.butceMax} TL.`);
    }
  }
  if (product.rating != null && product.rating < LOW_RATING) {
    skor -= PENALTY_LOW_RATING;
    uyarilar.push(`Düşük puan: ${product.rating}.`);
  }

  if (flags.elenir) skor = Math.min(skor, ELIMINATED_CAP);
  skor = Math.max(0, Math.min(100, skor));
  const karar: Karar = flags.elenir ? 'eleme' : skor >= OK_THRESHOLD && uyarilar.length === 0 ? 'uygun' : 'dikkat';

  return { skor, karar, uyarilar, olumlu: flags.olumlu, butce, bedenOnerisi: sizeHint(product, ctx) };
}

/**
 * Kararlı bölümleme: elenmeyenler ALAKA SIRASINI koruyarak başta, elenenler (yine kendi sırasıyla) sonda.
 * Kişisel skora göre yeniden sıralamaz: aramanın kendi alaka sıralaması bozulmasın. Girdiyi değiştirmez.
 */
export function eliminatedLast<T extends { kisisel: Personal }>(rows: T[]): T[] {
  const kept = rows.filter((row) => row.kisisel.karar !== 'eleme');
  const dropped = rows.filter((row) => row.kisisel.karar === 'eleme');
  return [...kept, ...dropped];
}
