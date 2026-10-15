import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { closeBrowser, currentMode, getPage, getPageByIndex, getPages } from '../browser.js';
import { config } from '../config.js';
import { buildSnapshot, formatSnapshot, refLocator } from '../snapshot.js';
import { clickByText, firstVisible, settle } from '../dom.js';
import { errorResult, imageResult, textResult } from '../util.js';

async function activePage() {
  return getPage();
}

export function registerSessionTools(server: McpServer): void {
  server.registerTool(
    'browser_navigate',
    {
      title: 'Navigate to a URL',
      description:
        'Go to a URL in the visible browser. Waits for the page to settle. Use this to open Trendyol home, a category, or a product page.',
      inputSchema: z.object({
        url: z.string().describe('Absolute http(s) URL to open.'),
        waitMs: z.number().int().min(0).max(20000).optional().describe('Extra time to wait after load.'),
      }),
    },
    async ({ url, waitMs }) => {
      try {
        const target = new URL(url);
        if (!['http:', 'https:'].includes(target.protocol)) {
          return errorResult('Sadece http/https URL destekleniyor.');
        }
        const page = await activePage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await settle(page);
        if (waitMs) await page.waitForTimeout(waitMs);
        return textResult(`Açıldı: ${page.url()}\nBaşlık: ${await page.title()}`);
      } catch (error) {
        return errorResult(`navigate başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_snapshot',
    {
      title: 'Snapshot interactive elements',
      description:
        'Return the interactive UI elements of the current page with stable refs (e1, e2, ...). ALWAYS take a snapshot before clicking or typing. Refs reset on every snapshot, so re-snapshot after any navigation or DOM change. Prefer this over guessing links.',
      inputSchema: z.object({
        maxItems: z.number().int().min(10).max(600).optional(),
        includeText: z
          .boolean()
          .optional()
          .describe('Also include a trimmed dump of the visible page text.'),
      }),
    },
    async ({ maxItems, includeText }) => {
      try {
        const page = await activePage();
        const items = await buildSnapshot(page, { maxItems });
        const pageInfo = { url: page.url(), title: await page.title() };
        let text = formatSnapshot(items, pageInfo);
        if (includeText) {
          const bodyText = await page
            .evaluate(() => (document.body?.innerText ?? '').replace(/\n{2,}/g, '\n').trim())
            .catch(() => '');
          text += `\n\nVISIBLE TEXT:\n${bodyText.slice(0, 6000)}`;
        }
        return textResult(text);
      } catch (error) {
        return errorResult(`snapshot başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_click',
    {
      title: 'Click an element',
      description:
        'Click an element either by a snapshot ref (preferred) or by its visible text. After clicking, take a fresh snapshot to continue.',
      inputSchema: z.object({
        ref: z.string().optional().describe('Ref from the latest snapshot, e.g. e12.'),
        text: z.string().optional().describe('Visible text of the element to click.'),
        exact: z.boolean().optional().describe('Require an exact text match (default false).'),
        nth: z.number().int().min(0).optional().describe('Which match to click when several exist.'),
      }),
    },
    async ({ ref, text, exact, nth }) => {
      try {
        const page = await activePage();
        if (ref) {
          const locator = refLocator(page, ref);
          const target = await firstVisible(locator);
          if (!target) {
            return errorResult(`ref ${ref} bulunamadı/görünür değil. Yeni bir snapshot al.`);
          }
          await target.scrollIntoViewIfNeeded().catch(() => undefined);
          await target.click({ timeout: config.timeouts.actionMs });
          await settle(page);
          return textResult(`Tıklandı: ${ref} (url: ${page.url()})`);
        }
        if (text) {
          const ok = await clickByText(page, text, { exact: exact ?? false, nth: nth ?? 0 });
          if (!ok) return errorResult(`"${text}" metnine sahip tıklanabilir öğe bulunamadı.`);
          return textResult(`Tıklandı: "${text}" (url: ${page.url()})`);
        }
        return errorResult('ref veya text vermelisin.');
      } catch (error) {
        return errorResult(`click başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_type',
    {
      title: 'Type into a field',
      description:
        'Type text into an input (by ref or by placeholder/text). Set submit=true to press Enter afterwards (e.g. search boxes).',
      inputSchema: z.object({
        ref: z.string().optional(),
        text: z.string().describe('Text to type.'),
        target: z
          .string()
          .optional()
          .describe('Alternative: placeholder or label text to locate the field.'),
        clear: z.boolean().optional().describe('Clear existing value first (default true).'),
        submit: z.boolean().optional().describe('Press Enter after typing.'),
      }),
    },
    async ({ ref, text, target, clear, submit }) => {
      try {
        const page = await activePage();
        let field = ref ? await firstVisible(refLocator(page, ref)) : null;
        if (!field && target) {
          const strategies = [
            page.getByPlaceholder(target),
            page.getByLabel(target),
            page.getByRole('textbox', { name: target }),
            page.getByRole('searchbox', { name: target }),
          ];
          for (const strategy of strategies) {
            field = await firstVisible(strategy);
            if (field) break;
          }
        }
        if (!field) return errorResult('Girdi alanı bulunamadı (ref/target kontrol et).');

        await field.scrollIntoViewIfNeeded().catch(() => undefined);
        await field.click({ timeout: config.timeouts.actionMs }).catch(() => undefined);
        if (clear ?? true) {
          await field.fill('').catch(() => undefined);
        }
        await field.pressSequentially(text, { delay: 40 }).catch(async () => {
          await field!.fill(text).catch(() => undefined);
        });
        if (submit) {
          await field.press('Enter');
          await settle(page);
        }
        return textResult(`Yazıldı: "${text}"${submit ? ' + Enter' : ''} (url: ${page.url()})`);
      } catch (error) {
        return errorResult(`type başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_press',
    {
      title: 'Press a keyboard key',
      description: 'Press a single key or shortcut on the page, e.g. "Enter", "Escape", "PageDown", "Control+A".',
      inputSchema: z.object({ key: z.string() }),
    },
    async ({ key }) => {
      try {
        const page = await activePage();
        await page.keyboard.press(key);
        await settle(page, 400);
        return textResult(`Basıldı: ${key}`);
      } catch (error) {
        return errorResult(`press başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_select_option',
    {
      title: 'Select an option in a native <select>',
      description: 'Choose an option by visible label or value in a native HTML select element.',
      inputSchema: z.object({
        ref: z.string(),
        label: z.string().optional(),
        value: z.string().optional(),
      }),
    },
    async ({ ref, label, value }) => {
      try {
        const page = await activePage();
        const locator = refLocator(page, ref);
        if ((await locator.count()) === 0) return errorResult(`ref ${ref} bulunamadı.`);
        if (label) await locator.selectOption({ label });
        else if (value) await locator.selectOption({ value });
        else return errorResult('label veya value vermelisin.');
        await settle(page);
        return textResult(`Seçildi: ${ref} -> ${label ?? value}`);
      } catch (error) {
        return errorResult(`select_option başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_scroll',
    {
      title: 'Scroll the page',
      description: 'Scroll down/up (lazy loading), jump to top/bottom, or scroll a specific element into view by ref.',
      inputSchema: z.object({
        direction: z.enum(['down', 'up', 'top', 'bottom']).optional(),
        amount: z.number().int().min(50).max(20000).optional().describe('Pixels for down/up (default 900).'),
        ref: z.string().optional().describe('Scroll this element into view instead.'),
      }),
    },
    async ({ direction, amount, ref }) => {
      try {
        const page = await activePage();
        if (ref) {
          const target = await firstVisible(refLocator(page, ref));
          if (!target) return errorResult(`ref ${ref} bulunamadı.`);
          await target.scrollIntoViewIfNeeded();
          return textResult(`Elemana kaydırıldı: ${ref}`);
        }
        const px = amount ?? 900;
        if (direction === 'top') await page.evaluate(() => window.scrollTo({ top: 0 }));
        else if (direction === 'bottom') await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
        else if (direction === 'up') await page.mouse.wheel(0, -px);
        else await page.mouse.wheel(0, px);
        await settle(page, 600);
        return textResult(`Kaydırıldı: ${direction ?? 'down'} ${ref ? '' : px}`);
      } catch (error) {
        return errorResult(`scroll başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_screenshot',
    {
      title: 'Screenshot',
      description: 'Capture a JPEG screenshot of the current page so you can visually verify the UI.',
      inputSchema: z.object({
        fullPage: z.boolean().optional(),
      }),
    },
    async ({ fullPage }) => {
      try {
        const page = await activePage();
        const buffer = await page.screenshot({ type: 'jpeg', quality: 55, fullPage: fullPage ?? false });
        return imageResult(buffer.toString('base64'), 'image/jpeg', `Screenshot: ${page.url()}`);
      } catch (error) {
        return errorResult(`screenshot başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_wait',
    {
      title: 'Wait for a condition',
      description: 'Wait for a fixed time, for text to appear, for a selector, or until the URL contains a value.',
      inputSchema: z.object({
        ms: z.number().int().min(0).max(60000).optional(),
        text: z.string().optional(),
        selector: z.string().optional(),
        urlContains: z.string().optional(),
      }),
    },
    async ({ ms, text, selector, urlContains }) => {
      try {
        const page = await activePage();
        const timeout = config.timeouts.navigationMs;
        if (ms) await page.waitForTimeout(ms);
        if (text) await page.getByText(text).first().waitFor({ timeout }).catch(() => undefined);
        if (selector) await page.waitForSelector(selector, { timeout }).catch(() => undefined);
        if (urlContains) await page.waitForURL((url) => url.toString().includes(urlContains), { timeout }).catch(() => undefined);
        return textResult(`Bekleme tamam (url: ${page.url()})`);
      } catch (error) {
        return errorResult(`wait başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_history',
    {
      title: 'Browser history navigation',
      description: 'Go back, forward or reload the current page.',
      inputSchema: z.object({ action: z.enum(['back', 'forward', 'reload']) }),
    },
    async ({ action }) => {
      try {
        const page = await activePage();
        if (action === 'back') await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        else if (action === 'forward') await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        else await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await settle(page);
        return textResult(`${action} yapıldı (url: ${page.url()})`);
      } catch (error) {
        return errorResult(`history başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_list_tabs',
    {
      title: 'List open tabs',
      description: 'List the open browser tabs with their index, URL and title.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const pages = await getPages();
        const rows = await Promise.all(
          pages.map(async (page, index) => ({
            index,
            url: page.url(),
            title: await page.title().catch(() => ''),
          })),
        );
        return textResult(JSON.stringify(rows, null, 2));
      } catch (error) {
        return errorResult(`list_tabs başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_switch_tab',
    {
      title: 'Switch active tab',
      description: 'Make the tab at the given index the active one (see browser_list_tabs).',
      inputSchema: z.object({ index: z.number().int().min(0) }),
    },
    async ({ index }) => {
      try {
        const page = await getPageByIndex(index);
        await page.bringToFront();
        return textResult(`Aktif sekme: ${index} (${page.url()})`);
      } catch (error) {
        return errorResult(`switch_tab başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'browser_close',
    {
      title: 'Close the browser when done',
      description:
        'İŞ BİTİNCE ÇAĞIR. Trendyol Chrome penceresini ve tüm sekmelerini kapatır; açık sekme birikmesin. Oturum/çerez Chrome profilinde kalır, sonraki araç çağrısı tarayıcıyı yeniden açar. Kullanıcının kendi Chrome\'una bağlıyken (CDP modu) hiçbir şey kapatmaz. Not: need_update(durum=alindi|vazgecildi) bunu kendiliğinden yapar.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const ownBrowser = currentMode() === 'cdp';
        await closeBrowser();
        return textResult(
          ownBrowser
            ? 'CDP modu: kullanıcının kendi tarayıcısına dokunulmadı.'
            : 'Tarayıcı kapatıldı. Oturum profilde duruyor; sonraki işlemde yeniden açılır.',
        );
      } catch (error) {
        return errorResult(`browser_close başarısız: ${(error as Error).message}`);
      }
    },
  );
}
