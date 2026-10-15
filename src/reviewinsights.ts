import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { productKey } from './util.js';
import type { AuthenticityResult } from './trendyol/authenticity.js';

export interface ReviewInsight {
  url: string;
  title?: string;
  brand?: string;
  savedAt: string;
  averageRating?: number;
  totalCount?: number;
  qualityScore: number;
  sizing: {
    verdict?: string;
    tight: number;
    loose: number;
    trueToSize: number;
    ratios: Record<string, number>;
  };
  complaints: Array<{ label: string; count: number; ratio: number }>;
  aiSummary?: string[];
  keywords?: Array<{ word: string; count: number }>;
  authenticity?: AuthenticityResult;
}

const FILE = () => path.join(config.dataDir, 'review-insights.json');

async function load(): Promise<ReviewInsight[]> {
  try {
    return JSON.parse(await readFile(FILE(), 'utf8')) as ReviewInsight[];
  } catch {
    return [];
  }
}

async function persist(entries: ReviewInsight[]): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const file = FILE();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
  await rename(tmp, file);
}

class ReviewInsightStore {
  async save(insight: ReviewInsight): Promise<ReviewInsight> {
    const entries = await load();
    const key = productKey(insight.url);
    const index = entries.findIndex((e) => productKey(e.url) === key);
    if (index >= 0) entries[index] = insight;
    else entries.push(insight);
    await persist(entries);
    return insight;
  }

  async get(url: string): Promise<ReviewInsight | undefined> {
    const key = productKey(url);
    return (await load()).find((e) => productKey(e.url) === key);
  }

  async list(): Promise<ReviewInsight[]> {
    return load();
  }

  async remove(url: string): Promise<boolean> {
    const key = productKey(url);
    const entries = await load();
    const next = entries.filter((e) => productKey(e.url) !== key);
    const removed = next.length < entries.length;
    if (removed) await persist(next);
    return removed;
  }
}

let instance: ReviewInsightStore | undefined;

export function getReviewInsights(): ReviewInsightStore {
  instance ??= new ReviewInsightStore();
  return instance;
}
