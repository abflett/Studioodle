import { defineConfig, mergeConfig } from 'vite';
import shared from './config.shared.ts';
import { stickerDevUrls } from './stickerDevUrls.ts';

export default mergeConfig(shared, defineConfig({
  plugins: [stickerDevUrls()],
  clearScreen: false,
  server: {
    watch: {
      ignored: [
        '**/work/**', '**/dist/**', '**/release/**', '**/src-tauri/**',
        '**/tools/artwork-review/**', '**/tools/cell-brush/**',
      ],
    },
  },
}));
