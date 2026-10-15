import type { Locator, Page } from 'playwright';
import { config } from './config.js';
import { delay } from './util.js';

export async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

export interface ClickByTextOptions {
  exact?: boolean;
  nth?: number;
  index?: number;
  role?: 'button' | 'link' | 'checkbox' | 'radio' | 'tab' | 'option' | 'menuitem';
}

const TEXT_ROLE_ORDER = ['button', 'link', 'checkbox', 'radio', 'tab', 'option', 'menuitem'] as const;

export async function clickByText(
  page: Page,
  text: string,
  options: ClickByTextOptions = {},
): Promise<boolean> {
  const exact = options.exact ?? false;
  const candidates: Locator[] = [];
  const roles = options.role ? [options.role] : TEXT_ROLE_ORDER;
  for (const role of roles) {
    candidates.push(page.getByRole(role as 'button', { name: text, exact }));
  }
  candidates.push(page.getByText(text, { exact }));

  for (const locator of candidates) {
    const target = await firstVisible(locator.nth(options.index ?? options.nth ?? 0));
    if (target) {
      await target.scrollIntoViewIfNeeded().catch(() => undefined);
      await target.click({ timeout: config.timeouts.actionMs }).catch(() => undefined);
      await settle(page);
      return true;
    }
  }
  return false;
}

export async function settle(page: Page, ms = config.settleMs): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: config.timeouts.navigationMs }).catch(() => undefined);
  await delay(ms);
}

export async function gotoNextPage(page: Page): Promise<boolean> {
  const candidates = [
    page.getByRole('link', { name: /sonraki sayfa/i }),
    page.getByRole('button', { name: /sonraki sayfa/i }),
    page.locator('a[aria-label*="Sonraki" i], a[title*="Sonraki" i]'),
    page.locator('[class*="pagination" i] a, [class*="pagination" i] button').last(),
    page.getByRole('link', { name: /^sonraki$/i }),
    page.getByText(/sonraki sayfa/i),
  ];
  for (const candidate of candidates) {
    const target = await firstVisible(candidate);
    if (!target) continue;
    const href = await target.getAttribute('href').catch(() => null);
    if (href && href !== '#') {
      await target.scrollIntoViewIfNeeded().catch(() => undefined);
      await target.click().catch(() => undefined);
    } else {
      await target.scrollIntoViewIfNeeded().catch(() => undefined);
      await target.click().catch(() => undefined);
    }
    await settle(page, 1500);
    return true;
  }
  return false;
}

export async function waitForProducts(page: Page, timeoutMs = config.timeouts.actionMs): Promise<void> {
  await page
    .waitForSelector('a[href*="-p-"]', { timeout: timeoutMs, state: 'attached' })
    .catch(() => undefined);
}

export function findSearchBox(page: Page): Locator {
  return page
    .locator(
      [
        'input[type="search"]',
        'input[placeholder*="Ara" i]',
        'input[placeholder*="aradığınız" i]',
        'input[placeholder*="marka" i]',
        'input[placeholder*="ürün" i]',
        '[role="searchbox"]',
        'input[name="search"]',
        '[data-testid*="search" i] input',
      ].join(', '),
    )
    .first();
}

export const SORT_LABELS: Record<string, string[]> = {
  best_sellers: ['En Çok Satan', 'En çok satanlar', 'En Çok Satanlar'],
  most_reviewed: ['En Çok Değerlendirilenler', 'En çok değerlendirilenler'],
  highest_rating: ['En Yüksek Puanlılar', 'En Yüksek Puan', 'En yüksek puanlılar'],
  price_asc: ['En Düşük Fiyat', 'En düşük fiyat'],
  price_desc: ['En Yüksek Fiyat', 'En yüksek fiyat'],
  newest: ['En Yeniler', 'En Yeni'],
  relevance: ['Önerilen Sıralama', 'Önerilen'],
};

const CONSENT_TEXTS = [
  'Kabul Et',
  'Kabul et',
  'Tümünü Kabul Et',
  'Çerezleri Kabul Et',
  'Kabul Ediyorum',
  'Onayla',
  'Tamam',
  'Anladım',
];

export async function dismissConsent(page: Page): Promise<string | null> {
  for (const text of CONSENT_TEXTS) {
    const button = await firstVisible(page.getByRole('button', { name: text }));
    if (button) {
      await button.click().catch(() => undefined);
      await settle(page, 400);
      return text;
    }
  }
  return null;
}
