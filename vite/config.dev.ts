import { defineConfig, mergeConfig } from 'vite';
import shared from './config.shared.ts';

export default mergeConfig(shared, defineConfig({ clearScreen: false, server: { watch: { ignored: ['**/src-tauri/**'] } } }));
