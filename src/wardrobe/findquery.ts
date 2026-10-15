export interface QueryHints {
  colors: string[];
  garment?: string;
  fabric?: string;
}

const DENIM_TERMS = new Set(['kot', 'jean', 'denim']);

/**
 * `trendyol_find` için arama kutusuna yazılacak sorguyu kurar. Kot/denim kumaşı sorguya eklenir:
 * eklenmezse "lacivert pantolon" aramasında hiç kot pantolon gelmiyordu. Diğer kumaşlar eklenmez
 * (sonuçları gereksiz daraltmasın, onlar skorlamada değerlendirilir).
 */
export function buildFindQuery(parsed: QueryHints, gender: string, description: string): string {
  const garment = parsed.garment;
  const denimAlreadyNamed = garment !== undefined && DENIM_TERMS.has(garment);
  const fabric = parsed.fabric && DENIM_TERMS.has(parsed.fabric) && !denimAlreadyNamed ? parsed.fabric : undefined;
  const query = [parsed.colors[0], fabric, garment, gender].filter(Boolean).join(' ');
  return query || description.split(/\s+/).slice(0, 3).join(' ');
}
