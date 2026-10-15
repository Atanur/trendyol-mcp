import os from 'node:os';
import path from 'node:path';

const env = process.env;

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  baseUrl: env.TRENDYOL_BASE_URL ?? 'https://www.trendyol.com',
  profileDir:
    env.TRENDYOL_PROFILE_DIR ?? path.join(os.homedir(), '.trendyol-mcp', 'chrome-profile'),
  channel: env.TRENDYOL_CHANNEL ?? 'chrome',
  headless: bool(env.TRENDYOL_HEADLESS, false),
  cdpEndpoint: env.TRENDYOL_CDP_ENDPOINT ?? '',
  locale: 'tr-TR',
  timezoneId: 'Europe/Istanbul',
  timeouts: {
    navigationMs: Number(env.TRENDYOL_NAV_TIMEOUT_MS ?? 45000),
    actionMs: Number(env.TRENDYOL_ACTION_TIMEOUT_MS ?? 15000),
  },
  settleMs: Number(env.TRENDYOL_SETTLE_MS ?? 1000),
  snapshotMaxItems: Number(env.TRENDYOL_SNAPSHOT_MAX_ITEMS ?? 250),
  viewport: {
    width: Number(env.TRENDYOL_VIEWPORT_WIDTH ?? 1440),
    height: Number(env.TRENDYOL_VIEWPORT_HEIGHT ?? 900),
  },
  dataDir: env.TRENDYOL_DATA_DIR ?? path.join(os.homedir(), '.trendyol-mcp', 'data'),
  enableCart: bool(env.TRENDYOL_ENABLE_CART, true),
  cacheTtlMs: Number(env.TRENDYOL_CACHE_TTL_MS ?? 10 * 60 * 1000),
} as const;

export type Config = typeof config;
