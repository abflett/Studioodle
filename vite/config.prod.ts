import { defineConfig, mergeConfig } from 'vite';
import shared from './config.shared.ts';

export default mergeConfig(shared, defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
        },
      },
    },
  },
}));
