import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getWardrobe } from '../wardrobe/db.js';
import { colorAffinity, paletteFit } from '../wardrobe/color.js';
import { getReviewInsights } from '../reviewinsights.js';
import {
  capsuleCoverage,
  checkAgainstProfile,
  costPerWear,
  fabricScore,
  generateGaps,
  keepOrGo,
  oneInOneOut,
  outfitCount,
  outfitCountWith,
  travelPack,
  weakLinks,
} from '../wardrobe/logic.js';
import type { Composition, Item, Mekan, Role, Sezon } from '../wardrobe/types.js';
import { profileNote } from '../wardrobe/profile.js';
import { errorResult, jsonResult } from '../util.js';

const ROLE = ['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar'] as const;
const SEZON = ['ilkbahar', 'yaz', 'sonbahar', 'kis'] as const;
const MEKAN = ['is', 'gunluk', 'ozel', 'spor', 'seyahat', 'ev'] as const;

const candidateInput = z.object({
  ad: z.string().default(''),
  kategori: z.string().optional(),
  rol: z.enum(ROLE).optional(),
  renk: z.string().optional(),
  kumas: z.string().optional(),
  kalip: z.string().optional(),
  baski: z.boolean().optional(),
  kompozisyon: z.array(z.object({ material: z.string(), percent: z.number().optional() })).optional(),
  fiyat: z.number().optional(),
  url: z.string().optional().describe('Ürün URL\'si; kayıtlı yorum analizi varsa karara eklenir.'),
});

type Candidate = z.infer<typeof candidateInput>;

function asItemLike(candidate: Candidate) {
  return {
    rol: (candidate.rol ?? 'ust') as Role,
    renk: candidate.renk ?? 'belirtilmemiş',
    kumas: candidate.kumas,
    kalip: candidate.kalip,
    baski: candidate.baski,
    kompozisyon: candidate.kompozisyon as Composition[] | undefined,
    formallik: 'smart' as const,
    kategori: candidate.kategori ?? '',
    ad: candidate.ad,
  };
}

function candidateToItem(candidate: Candidate): Item {
  return {
    id: 'candidate',
    ad: candidate.ad,
    rol: (candidate.rol ?? 'ust') as Role,
    kategori: candidate.kategori ?? 'candidate',
    renk: candidate.renk ?? 'belirtilmemiş',
    kumas: candidate.kumas,
    kompozisyon: candidate.kompozisyon as Composition[] | undefined,
    kalip: candidate.kalip,
    baski: candidate.baski,
    sezon: ['ilkbahar', 'yaz', 'sonbahar', 'kis'],
    formallik: 'smart',
    fiyat: candidate.fiyat,
    durum: 'iyi',
    giyimSayisi: 0,
  };
}

export function registerWardrobeIntelTools(server: McpServer): void {
  server.registerTool(
    'generate_gap_list',
    {
      title: 'Generate the prioritized gap list',
      description:
        'Combine profile role targets, capsule coverage (mekan×mevsim) and weak links into a prioritized shopping list ("1. koyu relaxed pantolon ×2, ...").',
      inputSchema: z.object({}),
    },
    async () => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const gaps = generateGaps(profile, items);
      const weak = weakLinks(items).map((w) => ({ id: w.item.id, ad: w.item.ad, partners: w.partners }));
      return jsonResult({
        totalPieces: items.length,
        targetTotal: Object.values(profile.hedef).reduce((a, b) => a + (b ?? 0), 0),
        coverageEmpty: capsuleCoverage(profile, items).emptyCount,
        weakLinks: weak,
        gaps: gaps.map((g, index) => ({ sira: index + 1, ...g })),
        ...profileNote(profile),
      });
    },
  );

  server.registerTool(
    'check_against_profile',
    {
      title: 'Check a product against the profile',
      description: 'Score a product against profile rules (slim, sentetik deri, baskı, polyester, palette) and return uygun / şüpheli / eleme.',
      inputSchema: candidateInput,
    },
    async (candidate) => {
      const profile = await getWardrobe().getProfile();
      const result = checkAgainstProfile(asItemLike(candidate), profile);
      let { verdict, score } = result;
      const reasons = [...result.reasons];
      if (candidate.url) {
        const insight = await getReviewInsights().get(candidate.url);
        if (insight) {
          const sizing = insight.sizing.verdict ?? 'beden bilgisi yok';
          reasons.push(`Kayıtlı yorum analizi: ${sizing} (kalite ${insight.qualityScore}).`);
          if (/dar/i.test(sizing) && verdict === 'uygun') verdict = 'şüpheli';
          if (insight.qualityScore < 40 && verdict !== 'eleme') verdict = 'şüpheli';
        }
      }
      return jsonResult({ verdict, score, reasons, ...profileNote(profile) });
    },
  );

  server.registerTool(
    'gap_match',
    {
      title: 'Match a product to the gap list',
      description: 'Tell whether a product fills a current wardrobe gap.',
      inputSchema: candidateInput,
    },
    async (candidate) => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const role = candidate.rol;
      const gaps = generateGaps(profile, items);
      const matched = gaps.filter((g) => (role ? g.rol === role : true));
      return jsonResult({
        fillsGap: matched.length > 0,
        matched: matched.slice(0, 5),
        note: matched.length ? 'Bu parça ihtiyaç listesine uyuyor.' : 'Doğrudan bir boşluğu karşılamıyor.',
        ...profileNote(profile),
      });
    },
  );

  server.registerTool(
    'color_match',
    {
      title: 'Match a color to palette and wardrobe',
      description: 'Compare a color against the palette and the existing items to show which pieces it pairs with.',
      inputSchema: z.object({ renk: z.string() }),
    },
    async ({ renk }) => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const fit = paletteFit(renk, profile.palet);
      const pairs = items
        .map((i) => ({ id: i.id, ad: i.ad, rol: i.rol, renk: i.renk, affinity: colorAffinity(renk, i.renk) }))
        .sort((a, b) => affinityRank(a.affinity) - affinityRank(b.affinity))
        .slice(0, 12);
      return jsonResult({ renk, palette: fit, pairs });
    },
  );

  server.registerTool(
    'fabric_score',
    {
      title: 'Score fabric quality',
      description: 'Return a fiber-based fabric quality score (independent of price) from the composition.',
      inputSchema: z.object({
        kompozisyon: z.array(z.object({ material: z.string(), percent: z.number().optional() })).optional(),
        kumas: z.string().optional(),
        itemId: z.string().optional(),
      }),
    },
    async ({ kompozisyon, kumas, itemId }) => {
      if (itemId) {
        const item = await getWardrobe().getItem(itemId);
        if (!item) return errorResult(`item bulunamadı: ${itemId}`);
        return jsonResult(fabricScore(item));
      }
      return jsonResult(fabricScore({ kompozisyon, kumas } as never));
    },
  );

  server.registerTool(
    'outfit_count',
    {
      title: 'Count outfits',
      description: 'Count valid outfits from the inventory, optionally showing how many new outfits a candidate item would add.',
      inputSchema: z.object({ candidate: candidateInput.optional() }),
    },
    async ({ candidate }) => {
      const items = await getWardrobe().listItems();
      const current = outfitCount(items);
      if (!candidate) return jsonResult({ current });
      const withItem = outfitCountWith(items, candidateToItem(candidate));
      return jsonResult({ current, withCandidate: withItem, added: withItem - current });
    },
  );

  server.registerTool(
    'capsule_coverage',
    {
      title: 'Capsule coverage matrix',
      description: 'Show which mekan×mevsim cells of the capsule are empty against the profile targets.',
      inputSchema: z.object({}),
    },
    async () => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      return jsonResult({ ...capsuleCoverage(profile, items), ...profileNote(profile) });
    },
  );

  server.registerTool(
    'weak_link',
    {
      title: 'Find weak links',
      description: 'Flag hard-to-pair pieces (few compatible partners).',
      inputSchema: z.object({ threshold: z.number().int().min(0).max(10).optional() }),
    },
    async ({ threshold }) => {
      const items = await getWardrobe().listItems();
      return jsonResult({
        weak: weakLinks(items, threshold ?? 2).map((w) => ({ id: w.item.id, ad: w.item.ad, rol: w.item.rol, partners: w.partners })),
      });
    },
  );

  server.registerTool(
    'travel_pack',
    {
      title: 'Suggest a travel pack',
      description: 'Suggest a suitcase list for a trip (days × season, optional occasion).',
      inputSchema: z.object({
        gun: z.number().int().min(1).max(30),
        sezon: z.enum(SEZON),
        mekan: z.enum(MEKAN).optional(),
      }),
    },
    async ({ gun, sezon, mekan }) => {
      const items = await getWardrobe().listItems();
      const pack = travelPack(items, { gun, sezon: sezon as Sezon, mekan: mekan as Mekan | undefined });
      const byRole: Record<string, string[]> = {};
      for (const item of pack) (byRole[item.rol] ??= []).push(item.ad);
      return jsonResult({ gun, sezon, mekan, pieces: pack.length, byRole, items: pack.map((i) => ({ id: i.id, ad: i.ad, rol: i.rol })) });
    },
  );

  server.registerTool(
    'cost_per_wear',
    {
      title: 'Cost per wear',
      description: 'Compute cost-per-wear for one item or all items.',
      inputSchema: z.object({ itemId: z.string().optional() }),
    },
    async ({ itemId }) => {
      const store = getWardrobe();
      const items = await store.listItems();
      const logs = await store.listWear();
      if (itemId) {
        const item = items.find((i) => i.id === itemId);
        if (!item) return errorResult(`item bulunamadı: ${itemId}`);
        return jsonResult({ ad: item.ad, ...costPerWear(item, logs) });
      }
      const rows = items
        .map((i) => ({ id: i.id, ad: i.ad, ...costPerWear(i, logs) }))
        .sort((a, b) => (b.cpw ?? 0) - (a.cpw ?? 0));
      return jsonResult({ rows });
    },
  );

  server.registerTool(
    'keep_or_go',
    {
      title: 'Keep or let go',
      description: 'Recommend "kalsın / çıksın" per item based on wear frequency, condition and cost-per-wear.',
      inputSchema: z.object({ itemId: z.string().optional() }),
    },
    async ({ itemId }) => {
      const store = getWardrobe();
      const items = await store.listItems();
      const logs = await store.listWear();
      const evaluate = (item: Item) => ({ id: item.id, ad: item.ad, ...keepOrGo(item, logs) });
      if (itemId) {
        const item = items.find((i) => i.id === itemId);
        if (!item) return errorResult(`item bulunamadı: ${itemId}`);
        return jsonResult(evaluate(item));
      }
      const rows = items.map(evaluate).sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === 'çıksın' ? -1 : 1));
      return jsonResult({ rows });
    },
  );

  server.registerTool(
    'one_in_one_out',
    {
      title: 'One in, one out',
      description: 'Given a candidate item, suggest which existing piece(s) to release to keep the target count.',
      inputSchema: candidateInput,
    },
    async (candidate) => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const suggestions = oneInOneOut(candidateToItem(candidate), items, profile);
      return jsonResult({ suggestions: suggestions.map((i) => ({ id: i.id, ad: i.ad, giyimSayisi: i.giyimSayisi, durum: i.durum })) });
    },
  );
}

function affinityRank(affinity: string): number {
  return { aynı: 0, 'nötr-uyumlu': 1, uyumlu: 2, kontrast: 3, çakışık: 4 }[affinity] ?? 5;
}
