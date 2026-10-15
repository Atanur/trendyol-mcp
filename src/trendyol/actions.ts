import type { Page } from 'playwright';
import { config } from '../config.js';
import {
  SORT_LABELS,
  clickByText,
  dismissConsent,
  firstVisible,
  gotoNextPage,
  settle,
  waitForProducts,
} from '../dom.js';
import { refLocator } from '../snapshot.js';
import { delay } from '../util.js';

export function isWoman(gender?: string): boolean {
  const value = (gender ?? '').toLocaleLowerCase('tr-TR');
  return value.includes('kadın') || value.includes('kadin') || value === 'k' || value === 'kadın giyim';
}

const categoryCache = new Map<string, string>();

/** Discover the men's/women's clothing category URL by driving the UI (no hardcoded category links). */
export async function discoverCategory(page: Page, gender?: string): Promise<string> {
  const woman = isWoman(gender);
  const key = woman ? 'kadin' : 'erkek';
  const cached = categoryCache.get(key);
  if (cached) return cached;

  const pattern = woman ? /kadin-giyim/ : /erkek-giyim/;
  const findHref = (): Promise<string | null> =>
    page.evaluate((src) => {
      const re = new RegExp(src);
      const anchor = Array.from(document.querySelectorAll('a[href]')).find((el) =>
        re.test((el as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
      return anchor ? (anchor as HTMLAnchorElement).href : null;
    }, pattern.source);

  if (!page.url().startsWith(config.baseUrl)) {
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await dismissConsent(page);
  }

  let href = await findHref();
  if (!href) {
    await clickByText(page, woman ? 'Kadın' : 'Erkek', { exact: false });
    await settle(page, 1200);
    href = await findHref();
  }
  if (!href) {
    await clickByText(page, 'Giyim', { exact: true });
    await settle(page, 1200);
    href = pattern.test(page.url()) ? page.url() : await findHref();
  }
  if (!href) {
    throw new Error(`${woman ? 'Kadın' : 'Erkek'} giyim kategorisi keşfedilemedi.`);
  }
  categoryCache.set(key, href);
  return href;
}

export async function resolveCategory(
  page: Page,
  options: { category_url?: string; gender?: string },
): Promise<string> {
  if (options.category_url) return options.category_url;
  return discoverCategory(page, options.gender);
}

export async function openCategory(page: Page, url: string): Promise<void> {  if (!page.url().startsWith(url)) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await settle(page);
  await dismissConsent(page);
  await waitForProducts(page);
}

export async function performSearch(page: Page, query: string): Promise<boolean> {
  const inputSelector =
    'input[type="search"], input[name="search"], #search-input, input[placeholder*="ara" i], input[placeholder*="ürün" i], [role="searchbox"]';
  let box = await firstVisible(page.locator(inputSelector));
  if (!box) {
    const reveal = await firstVisible(page.getByRole('button', { name: /ürün, kategori|marka ara|ara|search/i }));
    if (reveal) {
      await reveal.click().catch(() => undefined);
      await settle(page, 600);
      box = await firstVisible(page.locator(inputSelector));
    }
  }

  if (box) {
    await box.click().catch(() => undefined);
    await box.fill('').catch(() => undefined);
    await box.pressSequentially(query, { delay: 40 }).catch(async () => {
      await box!.fill(query).catch(() => undefined);
    });
    await box.press('Enter');
    await settle(page);
    const url = page.url();
    if (url.includes('/sr') || /[?&](q|query|qt)=/.test(url)) {
      await waitForProducts(page);
      return true;
    }
  }

  // Fallback: the UI search box was not usable, go to the search results URL directly.
  await page.goto(`${config.baseUrl}/sr?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await waitForProducts(page);
  return true;
}

async function expandCollapsedGroups(page: Page): Promise<number> {
  let count = 0;
  for (let round = 0; round < 20; round += 1) {
    const header = await firstVisible(page.locator('.aggregation.collapsed > .aggregation-header'));
    if (!header) break;
    await header.scrollIntoViewIfNeeded().catch(() => undefined);
    await header.click().catch(() => undefined);
    count += 1;
    await delay(200);
  }
  return count;
}

async function expandMoreOptions(page: Page): Promise<number> {
  let count = 0;
  for (let round = 0; round < 12; round += 1) {
    const button = await firstVisible(page.getByText('Daha fazla', { exact: true }));
    if (!button) break;
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click().catch(() => undefined);
    count += 1;
    await delay(200);
  }
  return count;
}

export async function prepareFilters(page: Page): Promise<{ expandedGroups: number; expandedMore: number }> {
  const expandedGroups = await expandCollapsedGroups(page);
  const expandedMore = await expandMoreOptions(page);
  return { expandedGroups, expandedMore };
}

export async function selectFilterOption(page: Page, label: string): Promise<boolean> {
  const scopes = [
    page.locator('.web-aggregations .checkbox-label', { hasText: label }),
    page.locator('.checkbox-label', { hasText: label }),
    page.locator('.web-aggregations label.checkbox-root', { hasText: label }),
    page.locator('.web-aggregations .checkbox-list-item', { hasText: label }),
  ];
  for (const scope of scopes) {
    const target = await firstVisible(scope);
    if (target) {
      await target.scrollIntoViewIfNeeded().catch(() => undefined);
      await target.click({ timeout: config.timeouts.actionMs }).catch(() => undefined);
      await settle(page, 900);
      return true;
    }
  }
  return clickByText(page, label, { exact: false });
}

export async function applyFilters(
  page: Page,
  labels: string[],
): Promise<Array<{ label: string; clicked: boolean }>> {
  const results: Array<{ label: string; clicked: boolean }> = [];
  for (const label of labels) {
    const ok = await selectFilterOption(page, label);
    results.push({ label, clicked: ok });
  }
  return results;
}

export async function applyPriceRange(
  page: Page,
  min?: number,
  max?: number,
): Promise<boolean> {
  if (min === undefined && max === undefined) return false;
  try {
    const priceGroup = page
      .locator('.aggregation')
      .filter({ has: page.locator('.aggregation-header h3', { hasText: /^fiyat$/i }) });
    if ((await priceGroup.count()) === 0) return false;
    const group = priceGroup.first();
    if ((await group.getAttribute('class'))?.includes('collapsed')) {
      await group.locator('.aggregation-header').first().click().catch(() => undefined);
      await delay(300);
    }
    const inputs = group.locator('input[inputmode="numeric"], input[type="text"], input[type="number"], input');
    const inputCount = await inputs.count();
    if (inputCount < 1) return false;
    if (min !== undefined) {
      await inputs.nth(0).fill(String(min)).catch(() => undefined);
    }
    if (max !== undefined && inputCount >= 2) {
      await inputs.nth(1).fill(String(max)).catch(() => undefined);
    }
    await inputs.nth(inputCount - 1).press('Enter').catch(() => undefined);
    const applyButton = await firstVisible(
      group.getByRole('button', { name: /ara|uygula|filtrele/i }),
    );
    if (applyButton) await applyButton.click().catch(() => undefined);
    await settle(page, 1200);
    return true;
  } catch {
    return false;
  }
}

export async function applySort(page: Page, key: string): Promise<boolean> {
  const labels = SORT_LABELS[key];
  if (!labels || labels.length === 0) return false;
  const triggers = [
    page.getByRole('combobox', { name: /sıralama/i }),
    page.getByRole('button', { name: /sıralama/i }),
    page.locator('button.select-box, [class*="select-box" i]'),
    page.getByText(/önerilen sıralama/i),
  ];
  let opened = false;
  for (const trigger of triggers) {
    const el = await firstVisible(trigger);
    if (el) {
      await el.scrollIntoViewIfNeeded().catch(() => undefined);
      await el.click().catch(() => undefined);
      await settle(page, 500);
      opened = true;
      break;
    }
  }
  if (!opened) return false;
  for (const label of labels) {
    const optionScopes = [
      page.locator('.select-option', { hasText: label }),
      page.locator('[class*="select-option" i]', { hasText: label }),
      page.locator('[class*="sort-option" i]', { hasText: label }),
    ];
    for (const scope of optionScopes) {
      const target = await firstVisible(scope);
      if (target) {
        await target.scrollIntoViewIfNeeded().catch(() => undefined);
        await target.click().catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
        await settle(page, 2500);
        return true;
      }
    }
    if (await clickByText(page, label, { exact: false })) return true;
  }
  return false;
}

export async function loadMore(page: Page, rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await page.mouse.wheel(0, 1600);
    await settle(page, 700);
  }
}

export async function collectPages(page: Page, pages: number): Promise<number> {
  let used = 1;
  for (let i = 1; i < pages; i += 1) {
    const ok = await gotoNextPage(page);
    if (!ok) break;
    await loadMore(page, 1);
    used += 1;
  }
  return used;
}

export interface OpenProductInput {
  ref?: string;
  url?: string;
}

export async function openProduct(page: Page, input: OpenProductInput = {}): Promise<void> {
  if (input.ref) {
    const target = await firstVisible(refLocator(page, input.ref));
    if (!target) throw new Error(`ref ${input.ref} bulunamadı; yeni snapshot al.`);
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await target.click().catch(() => undefined);
  } else if (input.url) {
    await page.goto(input.url, { waitUntil: 'domcontentloaded' });
  } else {
    const target = await firstVisible(page.locator('a[href*="-p-"]').first());
    if (!target) throw new Error('Ürün linki bulunamadı; önce bir liste sayfası aç.');
    await target.click();
  }
  await settle(page);
  await page.waitForURL(/-p-\d+/.test(page.url()) ? /-p-\d+/ : /.*/, { timeout: config.timeouts.actionMs }).catch(() => undefined);
  await settle(page);
}
