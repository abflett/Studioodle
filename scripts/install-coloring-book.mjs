// Install a reviewed coloring-page export as the next bundled collection.
import fs from 'node:fs';
import { createSsrServer } from './lib/ssr-server.mjs';
const input = process.argv[2];
if (!input) throw new Error('Usage: npm run books:install -- path/to/book.studioodle');
const server = await createSsrServer();
try {
  const { parsePageSharingCode } = await server.ssrLoadModule('/src/editor/pageSharing.ts');
  const book = parsePageSharingCode(fs.readFileSync(input, 'utf8'));
  if (!book.pages.length) throw new Error('The bundled collection must contain at least one page.');
  fs.writeFileSync('src/assets/coloringBook.json', JSON.stringify(book, null, 2) + '\n');
  console.log(`Installed ${book.pages.length} pages from ${book.title}. Run npm run check before committing.`);
} finally { await server.close(); }
