export function createPageFavorites(storage: () => Storage = () => localStorage) {
  const key = 'studioodle.page-favorites.v1';
  return {
    load(): string[] {
      const value: unknown = JSON.parse(storage().getItem(key) ?? '[]');
      if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) throw Error('Could not read favorite pages.');
      return [...new Set(value)];
    },
    save(ids: string[]) { storage().setItem(key, JSON.stringify([...new Set(ids)])); },
  };
}
