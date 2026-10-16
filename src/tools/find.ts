import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { CATEGORY_ROLE_HINTS } from '../wardrobe/logic.js';
import { COLOR_HEX } from '../wardrobe/color.js';
import { scrapeProducts, type Product } from '../trendyol/scrape.js';
import {
  applyPriceRange,
  applySort,
  openCategory,
  performSearch,
  resolveCategory,
} from '../trendyol/actions.js';
import { errorResult, jsonResult, normalize, parsePrice } from '../util.js';
import { createProgress } from '../progress.js';
import { buildFindQuery } from '../wardrobe/findquery.js';
import { eliminatedLast } from '../wardrobe/personalize.js';
import type { Role } from '../wardrobe/types.js';
import { annotatePersonalSafe } from './personal.js';

const FIT_TERMS = ['slim fit', 'regular fit', 'oversize', 'super slim', 'relaxed', 'skinny', 'straight', 'rahat kesim', 'dar kesim', 'bol kesim'];
const FABRIC_TERMS = ['pamuk', 'yün', 'keten', 'ipek', 'deri', 'denim', 'kot', 'polyester', 'saten', 'kadife', 'kaşmir', 'triko', 'viskon'];
const FORMALITY_HINTS: Array<{ value: string; terms: string[] }> = [
  { value: 'resmi', terms: ['resmi', 'takım', 'smokin', 'klasik', 'iş', 'ofis', 'düğün', 'nişan'] },
  { value: 'spor', terms: ['spor', 'koşu', 'antrenman', 'gym', 'eşofman', 'outdoor'] },
  { value: 'gunluk', terms: ['günlük', 'basic', 'rahat', 'casual'] },
  { value: 'smart', terms: ['smart', 'şık', 'kokteyl', 'davet'] },
];

export interface ParsedDescription {
  colors: string[];
  garment?: string;
  role?: string;
  fit?: string;
  fabric?: string;
  formality?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  avoidSlim?: boolean;
  avoidOversize?: boolean;
  keywords: string[];
}

export function parseDescription(text: string): ParsedDescription {
  const hay = normalize(text);
  const colors = Object.keys(COLOR_HEX).filter((c) => hay.includes(normalize(c)));
  let garment: string | undefined;
  let role: string | undefined;
  for (const { rol, terms } of CATEGORY_ROLE_HINTS) {
    const hit = terms.find((t) => hay.includes(normalize(t)));
    if (hit) {
      garment = hit;
      role = rol;
      break;
    }
  }
  const fit = FIT_TERMS.find((t) => hay.includes(normalize(t)));
  const fabric = FABRIC_TERMS.find((t) => hay.includes(normalize(t)));
  const formality = FORMALITY_HINTS.find((f) => f.terms.some((t) => hay.includes(normalize(t))))?.value;
  const gender = /kadın|kadin/.test(hay) ? 'Kadın' : /erkek/.test(hay) ? 'Erkek' : undefined;
  const avoidSlim = /(dar olmasın|çok dar|slim olmasın|bol olsun|rahat olsun|rahat kesim olsun|dar gelmesin)/.test(hay);
  const avoidOversize = /(bol olmasın|oversize olmasın|çok bol)/.test(hay);

  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  const range = hay.match(/(\d[\d.]*)\s*(?:-|ila|ile)\s*(\d[\d.]*)\s*(?:tl|lira)?/);
  const under = hay.match(/(\d[\d.]*)\s*(?:tl|lira)?\s*(?:altı|altinda|altında|kadar|max|en fazla|bütçe)/);
  const over = hay.match(/(\d[\d.]*)\s*(?:tl|lira)?\s*(?:üstü|üzeri|üzerinde|min|en az)/);
  if (range) {
    minPrice = Number.parseInt(range[1]!.replace(/\./g, ''), 10);
    maxPrice = Number.parseInt(range[2]!.replace(/\./g, ''), 10);
  } else {
    if (under) maxPrice = Number.parseInt(under[1]!.replace(/\./g, ''), 10);
    if (over) minPrice = Number.parseInt(over[1]!.replace(/\./g, ''), 10);
  }

  return { colors, garment, role, fit, fabric, formality, gender, minPrice, maxPrice, avoidSlim, avoidOversize, keywords: [] };
}

function score(product: Product, parsed: ParsedDescription): { score: number; reasons: string[] } {
  const hay = normalize(`${product.title} ${product.brand ?? ''}`);
  const reasons: string[] = [];
  let score = 40;

  if (parsed.colors.length) {
    const hit = parsed.colors.find((c) => hay.includes(normalize(c)));
    if (hit) {
      score += 25;
      reasons.push(`renk "${hit}"`);
    }
  }
  if (parsed.garment && hay.includes(normalize(parsed.garment))) {
    score += 25;
    reasons.push(`tür "${parsed.garment}"`);
  }
  if (parsed.fit && hay.includes(normalize(parsed.fit))) {
    score += 15;
    reasons.push(`kalıp "${parsed.fit}"`);
  }
  if (parsed.avoidSlim && /(slim|skinny|dar kesim|dar fit)/.test(hay)) {
    score -= 25;
    reasons.push('slim/dar kalıp (istenmedi)');
  }
  if (parsed.avoidOversize && /(oversize|çok bol|bol kesim)/.test(hay)) {
    score -= 20;
    reasons.push('oversize/bol kalıp (istenmedi)');
  }
  if (parsed.fabric && hay.includes(normalize(parsed.fabric))) {
    score += 15;
    reasons.push(`kumaş "${parsed.fabric}"`);
  }
  if (parsed.formality) {
    const hints = FORMALITY_HINTS.find((f) => f.value === parsed.formality)?.terms ?? [];
    if (hints.some((t) => hay.includes(normalize(t)))) {
      score += 10;
      reasons.push(`tarz "${parsed.formality}"`);
    }
  }
  const price = parsePrice(product.price ?? undefined);
  if (parsed.maxPrice !== undefined && price !== undefined && price <= parsed.maxPrice) {
    score += 10;
    reasons.push('bütçe içinde');
  }
  if ((product.rating ?? 0) >= 4) score += 10;
  if ((product.reviews ?? 0) >= 20) score += 5;

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function registerFindTool(server: McpServer): void {
  server.registerTool(
    'trendyol_find',
    {
      title: 'Find products from a plain-language description',
      description:
        'Describe what you want in plain Turkish ("smart casual lacivert blazer, çok dar olmasın, 1500 TL altı") and it parses color/garment/fit/fabric/formality/budget/gender, searches the real UI and returns ranked matches with reasons. Use this when you do not know the exact brand/model.',
      inputSchema: z.object({
        description: z.string().describe('Doğal dil açıklaması.'),
        gender: z.string().optional().describe('Açıklamada yoksa cinsiyet (Erkek/Kadın).'),
        limit: z.number().int().min(1).max(40).optional().describe('Dönen aday sayısı (varsayılan 12).'),
        sort: z.enum(['relevance', 'best_sellers', 'most_reviewed', 'highest_rating', 'price_asc']).optional(),
      }),
    },
    async ({ description, gender, limit, sort }, ctx) => {
      const step = createProgress(ctx, 3);
      try {
        const parsed = parseDescription(description);
        const resolvedGender = gender ?? parsed.gender ?? 'Erkek';
        await step('Trendyol açılıyor');
        const page = await getPage();
        await openCategory(page, await resolveCategory(page, { gender: resolvedGender }));

        const query = buildFindQuery(parsed, resolvedGender, description);
        await step(`"${query}" aranıyor`);
        const searched = await performSearch(page, query);
        if (parsed.minPrice !== undefined || parsed.maxPrice !== undefined) {
          await applyPriceRange(page, parsed.minPrice, parsed.maxPrice);
        }
        await applySort(page, sort ?? 'relevance');

        await step('Sonuçlar okunuyor ve profiline göre değerlendiriliyor');
        const products = await page.evaluate(scrapeProducts, Math.min(60, (limit ?? 12) * 2));
        const ranked = products
          .map((product) => ({ product, ...score(product, parsed) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit ?? 12);

        const base = ranked.map((row) => ({
          score: row.score,
          reasons: row.reasons,
          title: row.product.title,
          price: row.product.price,
          brand: row.product.brand,
          rating: row.product.rating,
          url: row.product.url,
          image: row.product.image,
        }));
        const personal = await annotatePersonalSafe(base, {
          gender: resolvedGender,
          rol: parsed.role as Role | undefined,
          butceMax: parsed.maxPrice,
        });

        return jsonResult({
          understood: { ...parsed, gender: resolvedGender, query },
          searched,
          count: ranked.length,
          // Profil kurallarına takılanlar (eleme) sona atılır; diğerlerinin alaka sırası korunur.
          candidates: personal.ok ? eliminatedLast(personal.products) : base,
          ...(personal.ok ? { kisiselOzet: personal.summary } : { kisiselHata: personal.hata }),
        });
      } catch (error) {
        return errorResult(`trendyol_find başarısız: ${(error as Error).message}`);
      }
    },
  );
}
