import os from 'node:os';
import path from 'node:path';

const env = process.env;

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export type BrowserMode = 'gorunur' | 'arka-plan' | 'otomatik';

/**
 * gorunur: hep görünür pencere. arka-plan: hep gizli (engel olursa hata verir).
 * otomatik (varsayılan): gizli başlar; Cloudflare engeli ya da giriş gerekirse pencereyi görünür açar.
 * Eski TRENDYOL_HEADLESS=true, arka-plan olarak yorumlanır.
 */
function parseMode(value: string | undefined, legacyHeadless: boolean): BrowserMode {
  const v = value?.toLowerCase();
  if (v === 'gorunur' || v === 'arka-plan' || v === 'otomatik') return v;
  return legacyHeadless ? 'arka-plan' : 'otomatik';
}

export const config = {
  baseUrl: env.TRENDYOL_BASE_URL ?? 'https://www.trendyol.com',
  profileDir:
    env.TRENDYOL_PROFILE_DIR ?? path.join(os.homedir(), '.trendyol-mcp', 'chrome-profile'),
  channel: env.TRENDYOL_CHANNEL ?? 'chrome',
  headless: bool(env.TRENDYOL_HEADLESS, false),
  mode: parseMode(env.TRENDYOL_MODE, bool(env.TRENDYOL_HEADLESS, false)),
  /** Son araç çağrısından bu kadar ms sonra tarayıcı kendiliğinden kapanır (0 = kapalı). */
  idleCloseMs: Number(env.TRENDYOL_IDLE_CLOSE_MS ?? 5 * 60 * 1000),
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
