/**
 * Trendyol ürün bağlantıları yeni sekmede açılabilir ve araçlar her zaman en son sekmeyle çalışır;
 * eskileri boşuna açık kalır. Kural: en son (aktif) sekme kalır, öncekiler kapatılır.
 * Girdiyi değiştirmez.
 */
export function staleTabs<T>(tabs: readonly T[]): T[] {
  return tabs.slice(0, -1);
}
