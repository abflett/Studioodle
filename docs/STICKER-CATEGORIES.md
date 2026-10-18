# Sticker categories

The sticker browser groups subjects rather than coloring-page themes. Asset IDs retain their source-pack prefixes; those prefixes do not determine where a sticker appears.

| Category | Contents |
| --- | --- |
| Shapes | Basic geometric shapes |
| Characters | People and personified characters, including the costume numbers, skaters, and Santa |
| Animals | Animals, birds, and insects |
| Plants | Trees, flowers, bushes, grass, and mushrooms |
| Sky | Suns, clouds, rainbows, and stars |
| Landscapes | Horizons, ground, ponds, paths, stones, and shells |
| Buildings | Buildings and their parts, including windows and fences |
| Objects | Tools, toys, furnishings, gifts, and decorations |
| Food | Fruit and other food |

Each sticker has one primary category in `src/ui/stickerCatalog.ts`. Prefer an existing subject category when adding artwork, regardless of season or scene. Categories and sticker lists already paginate in groups of six. Coloring pages keep their themed names independently of this browser.
