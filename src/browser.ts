import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { createIdleCloser } from './idle.js';
import { staleTabs } from './tabs.js';
import { isLoginUrl } from './trendyol/guard.js';
import { delay } from './util.js';

type Mode = 'launched' | 'cdp';

let contextPromise: Promise<BrowserContext> | null = null;
let mode: Mode = 'launched';

/**
 * Şu an gizli (arka plan) mı çalışıyoruz? "otomatik" ve "arka-plan" modları gizli başlar.
 * Cloudflare engeli ya da giriş gerektiğinde "otomatik" mod görünür pencereye geçer.
 */
let background = config.mode !== 'gorunur';
let escalateRequested = false;
let cachedUserAgent: string | undefined;

/**
 * Gizli Chrome varsayılan olarak "HeadlessChrome" kullanıcı ajanı bildirir ve Trendyol'da
 * Cloudflare engeline takılır (gerçek gözlem). Aynı Chrome'un normal kullanıcı ajanını türetiriz.
 */
async function normalUserAgent(): Promise<string> {
  if (cachedUserAgent) return cachedUserAgent;
  const browser = await chromium.launch({ channel: config.channel || undefined, headless: true });
  try {
    const page = await browser.newPage();
    const ua = await page.evaluate(() => navigator.userAgent);
    cachedUserAgent = ua.replace('HeadlessChrome', 'Chrome');
  } finally {
    await browser.close().catch(() => undefined);
  }
  return cachedUserAgent!;
}

async function launchPersistent(): Promise<BrowserContext> {
  await mkdir(config.profileDir, { recursive: true });
  const options = {
    channel: config.channel || undefined,
    headless: background,
    viewport: { width: config.viewport.width, height: config.viewport.height },
    chromiumSandbox: true,
    locale: config.locale,
    timezoneId: config.timezoneId,
    acceptDownloads: true,
    args: [
      '--no-default-browser-check',
      '--no-first-run',
      ...(background ? ['--disable-blink-features=AutomationControlled'] : ['--start-maximized']),
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    ...(background ? { userAgent: await normalUserAgent() } : {}),
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const context = await chromium.launchPersistentContext(config.profileDir, options);
      context.setDefaultTimeout(config.timeouts.actionMs);
      context.setDefaultNavigationTimeout(config.timeouts.navigationMs);
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      return context;
    } catch (error) {
      lastError = error;
      // The profile can be briefly locked if another instance is closing its browser.
      await delay(1500);
    }
  }
  throw new Error(
    `Chrome profili açılamadı (${config.profileDir}). Başka bir trendyol-mcp Chrome penceresi açık olabilir; onu kapatıp tekrar dene. Sebep: ${
      (lastError as Error)?.message ?? String(lastError)
    }`,
  );
}

async function connectCdp(): Promise<BrowserContext> {
  const browser = await chromium.connectOverCDP(config.cdpEndpoint);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  context.setDefaultTimeout(config.timeouts.actionMs);
  context.setDefaultNavigationTimeout(config.timeouts.navigationMs);
  return context;
}

async function launch(): Promise<BrowserContext> {
  if (config.cdpEndpoint) {
    mode = 'cdp';
    return connectCdp();
  }
  mode = 'launched';
  return launchPersistent();
}

/** Kullanıcı giriş sayfasında işlem yapıyor olabilir: o sırada boşta-kapatma ertelenir. */
async function userIsOnLoginPage(): Promise<boolean> {
  if (!contextPromise) return false;
  const context = await contextPromise.catch(() => null);
  return Boolean(context?.pages().some((page) => !page.isClosed() && isLoginUrl(page.url())));
}

const idle = createIdleCloser({
  delayMs: config.idleCloseMs,
  close: () => closeBrowser(),
  canClose: async () => !(await userIsOnLoginPage()),
});

export async function getContext(): Promise<BrowserContext> {
  // Engel/giriş nedeniyle görünür pencere istendiyse, mevcut gizli tarayıcıyı kapatıp görünür aç.
  if (escalateRequested && background) {
    escalateRequested = false;
    background = false;
    await closeBrowser();
  }
  if (!contextPromise) {
    contextPromise = launch().catch((error) => {
      contextPromise = null;
      throw error;
    });
  }
  const context = await contextPromise;
  // Kullanıcının kendi Chrome'una (CDP) bağlıyken hiçbir şeyi otomatik kapatmayız.
  if (mode !== 'cdp') idle.touch();
  return context;
}

export async function getPages(): Promise<Page[]> {
  const context = await getContext();
  return context.pages().filter((page) => !page.isClosed());
}

export async function getPage(): Promise<Page> {
  const context = await getContext();
  const pages = context.pages().filter((page) => !page.isClosed());
  if (pages.length === 0) return context.newPage();
  // Ürün bağlantıları yeni sekmede açılabilir; en son sekmeyle çalışırız, eskileri kapatırız.
  if (mode !== 'cdp') {
    for (const stale of staleTabs(pages)) await stale.close().catch(() => undefined);
  }
  return pages[pages.length - 1]!;
}

export async function getPageByIndex(index: number): Promise<Page> {
  const pages = await getPages();
  if (index < 0 || index >= pages.length) {
    throw new Error(`Sekme indexi ${index} geçersiz. ${pages.length} sekme açık.`);
  }
  return pages[index]!;
}

export async function closeBrowser(): Promise<void> {
  idle.cancel();
  if (!contextPromise) return;
  const pending = contextPromise;
  contextPromise = null;
  const context = await pending.catch(() => null);
  if (!context) return;
  // Never close a browser the user is driving themselves over CDP.
  if (mode === 'cdp') return;
  await context.close().catch(() => undefined);
}

export function currentMode(): Mode {
  return mode;
}

/** Şu an gizli (arka plan) çalışıyor mu? */
export function isBackground(): boolean {
  return background && mode === 'launched';
}

/** Bir sonraki tarayıcı kullanımında pencereyi görünür aç ("otomatik" modda engel/giriş durumunda). */
export function requestVisibleBrowser(): void {
  if (config.mode === 'otomatik') escalateRequested = true;
}

/** Tarayıcıyı hemen görünür pencerede yeniden aç (giriş, doğrulama ya da izlemek için). */
export async function showBrowser(): Promise<void> {
  background = false;
  escalateRequested = false;
  await closeBrowser();
  await getContext();
}
