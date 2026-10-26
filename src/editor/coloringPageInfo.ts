export const pageCategories = ['characters', 'animals', 'nature', 'things', 'learning'] as const;
export type PageCategory = typeof pageCategories[number];
export type PageDetail = 'simple' | 'medium' | 'detailed';
export type ColoringPageInfo = { categories: PageCategory[]; detail: PageDetail };
export function normalizePageInfo(value: unknown): ColoringPageInfo | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object') throw Error('Invalid coloring-page browsing information.');
  const info = value as ColoringPageInfo;
  if (!Array.isArray(info.categories) || !info.categories.length || info.categories.some(c => !pageCategories.includes(c)) || !['simple', 'medium', 'detailed'].includes(info.detail)) throw Error('Invalid coloring-page categories or detail.');
  return { categories: [...new Set(info.categories)], detail: info.detail };
}
