import { normalize } from '../util.js';
import { COLOR_HEX } from './color.js';
import { classifyRole } from './logic.js';
import type { Role } from './types.js';

export interface QuickItem {
  ad: string;
  rol: Role;
  renk?: string;
  beden?: string;
  adet: number;
}

export type QuickResult = { ok: true; item: QuickItem } | { ok: false; satir: string; neden: string };

const LETTER_SIZE = /(?<![\p{L}\d])(XXXL|XXL|XL|XS|S|M|L)(?![\p{L}\d])/u;
const WAIST_LENGTH = /(?<!\d)(\d{2})\/(\d{2})(?!\d)/;
const COUNT = /(\d+)\s*adet/i;

/**
 * "lacivert kot pantolon 32/32" gibi serbest bir satırdan envanter kaydı çıkarır.
 * Rol çıkarılamazsa reddeder: tahminle yanlış kayıt oluşturmaz.
 */
export function parseWardrobeLine(line: string): QuickResult {
  const raw = line.trim();
  if (!raw) return { ok: false, satir: line, neden: 'boş satır' };

  const waist = raw.match(WAIST_LENGTH);
  const letter = waist ? undefined : raw.match(LETTER_SIZE);
  const count = raw.match(COUNT);

  const ad = raw
    .replace(COUNT, ' ')
    .replace(WAIST_LENGTH, ' ')
    .replace(letter ? LETTER_SIZE : /$^/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (count?.[1] && Number.parseInt(count[1], 10) < 1) {
    return { ok: false, satir: line, neden: 'adet en az 1 olmalı' };
  }

  const hay = normalize(ad);
  let rol = classifyRole(hay);
  if (!rol && /(?<![\p{L}])kot(?![\p{L}])/u.test(hay)) rol = 'alt';
  if (!rol) return { ok: false, satir: line, neden: 'rol belirlenemedi (pantolon, tişört, mont gibi bir tür yaz)' };

  const renk = Object.keys(COLOR_HEX).find((c) => hay.includes(normalize(c)));
  return {
    ok: true,
    item: {
      ad,
      rol,
      renk,
      beden: waist ? `${waist[1]}/${waist[2]}` : letter?.[1],
      adet: count?.[1] ? Number.parseInt(count[1], 10) : 1,
    },
  };
}
