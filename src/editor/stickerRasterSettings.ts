// Isolated high-resolution runtime trial; other stickers keep their current budgets.
export function stickerRasterSettings(kind: string) {
    return kind === 'fantasy-moon-sorceress'
        ? { minimumScale: 8, lookupScale: 16, maximumPixels: 32_000_000, rasterOnly: true }
        : undefined;
}
