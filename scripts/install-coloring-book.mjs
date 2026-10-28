// Install a reviewed workshop export as the next bundled collection.
import fs from 'node:fs';
import { createServer } from 'vite';
const input = process.argv[2];
if (!input) throw new Error('Usage: npm run books:install -- path/to/book.studioodle');
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { parsePageSharingCode } = await server.ssrLoadModule('/src/editor/pageSharing.ts');
  const book = parsePageSharingCode(fs.readFileSync(input, 'utf8'));
  if (!book.pages.length) throw new Error('The bundled collection must contain at least one page.');
  fs.writeFileSync('src/assets/coloringBook.json', JSON.stringify(book, null, 2) + '\n');
  console.log(`Installed ${book.pages.length} pages from ${book.title}. Run npm run check before committing.`);
} finally { await server.close(); }
