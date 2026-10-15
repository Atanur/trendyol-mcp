import type { CallToolResult } from '@modelcontextprotocol/server';

export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

export function jsonResult(data: unknown, caption?: string): CallToolResult {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const text = caption ? `${caption}\n\n${body}` : body;
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string, extra?: unknown): CallToolResult {
  const suffix = extra === undefined ? '' : `\n\n${JSON.stringify(extra, null, 2)}`;
  return { isError: true, content: [{ type: 'text', text: `${message}${suffix}` }] };
}

export function imageResult(base64: string, mimeType: string, caption?: string): CallToolResult {
  const content: CallToolResult['content'] = [{ type: 'image', data: base64, mimeType }];
  if (caption) content.push({ type: 'text', text: caption });
  return { content };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
}

export function slugify(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** "1.469,97 TL" -> 1469.97 ; returns undefined when no number is present. */
export function parsePrice(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:TL|₺)?/i);
  if (!match?.[1]) return undefined;
  const raw = match[1];
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/\.(?=\d{3}\b)/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function shortId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${random}`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Stable key for a product URL: the `-p-<id>` segment when present, else the URL without query. */
export function productKey(url: string): string {
  const match = url.match(/-p-(\d+)/);
  return match?.[1] ?? url.split('?')[0]!;
}
