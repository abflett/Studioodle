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

Each sticker has one primary category in `art/stickers.json`, projected into the picker by `scripts/build-asset-catalog.mjs`. Prefer an existing subject category when adding artwork, regardless of season or scene. Categories and sticker lists already paginate in groups of six. Coloring pages keep their themed names independently of this browser.

Display names use a capital letter at the beginning of every word, including short words such as And and With. Asset IDs and source filenames stay stable so existing pictures keep their sticker references. Coloring-page titles follow the same convention; legacy saved titles are normalized on load, including the former spring page name, now Spring Garden.

See [the searchable asset catalog](../art/CATALOG.md) and [scene authoring guide](../art/SCENE-AUTHORING.md) when assembling new pages. Category guides include thumbnails and placement notes for every asset.
