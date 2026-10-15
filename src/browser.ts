import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { delay } from './util.js';

type Mode = 'launched' | 'cdp';

let contextPromise: Promise<BrowserContext> | null = null;
let mode: Mode = 'launched';

async function launchPersistent(): Promise<BrowserContext> {
  await mkdir(config.profileDir, { recursive: true });
  const options = {
    channel: config.channel || undefined,
    headless: config.headless,
    viewport: { width: config.viewport.width, height: config.viewport.height },
    chromiumSandbox: true,
    locale: config.locale,
    timezoneId: config.timezoneId,
    acceptDownloads: true,
    args: ['--start-maximized', '--no-default-browser-check', '--no-first-run'],
    ignoreDefaultArgs: ['--enable-automation'],
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

export function getContext(): Promise<BrowserContext> {
  if (!contextPromise) {
    contextPromise = launch().catch((error) => {
      contextPromise = null;
      throw error;
    });
  }
  return contextPromise;
}

export async function getPages(): Promise<Page[]> {
  const context = await getContext();
  return context.pages().filter((page) => !page.isClosed());
}

export async function getPage(): Promise<Page> {
  const context = await getContext();
  const pages = context.pages().filter((page) => !page.isClosed());
  if (pages.length === 0) return context.newPage();
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
