// Isolated high-resolution runtime trial; other stickers keep their current budgets.
export function stickerRasterSettings(kind: string) {
    return kind === 'fantasy-moon-sorceress'
        ? { minimumScale: 1, lookupScale: 4, maximumPixels: 8_000_000, rasterOnly: true, pageAligned: true }
        : undefined;
}
