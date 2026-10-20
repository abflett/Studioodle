import source from '../assets/coloringBook.json';
import { parseColoringBook } from '../editor/coloringBook';

// The bundled collection uses exactly the same format as workshop exports.
export const coloringPages = parseColoringBook(JSON.stringify(source)).pages;
