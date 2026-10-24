import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'app-only',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = decodeURIComponent(request.url ?? '').replaceAll('\\', '/');
        if (url.includes('/tools/artwork-review/') || url.split('?')[0] === '/artwork-review.html') {
          response.statusCode = 404;
          response.end('Run npm run review to use the standalone artwork reviewer.');
          return;
        }
        next();
      });
    },
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (id.replaceAll('\\', '/').includes('/tools/artwork-review/')) {
          this.error('Reviewer code must not be included in the app build.');
        }
      }
    },
  }],
  optimizeDeps: { entries: ['index.html'] },
  build: { rollupOptions: { input: 'index.html' } },
});
