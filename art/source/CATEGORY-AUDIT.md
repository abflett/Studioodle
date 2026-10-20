# Asset Category Coverage Audit

Snapshot: 2026-10-19. Live membership comes from src/assets/assetLibrary.json and category definitions from src/ui/stickerCatalog.ts. Also reviewed the source manifests for alphabet (26), nursery-rhymes (57), fall (43), horizons (24), and the earlier source folders. Existing source folders often feed already-live assets: do not count those twice. Alphabet costumes represent letters, not standalone examples of the costume subjects.

## Current coverage and this batch

| Category | Live assets | New sources in this batch | Coverage judgment including earlier queued packs |
|---|---:|---:|---|
| shapes | 3 | 0 | Only basic geometry. Low-cost future additions should be authored directly as SVG: oval, rectangle, heart, diamond, hexagon. |
| characters | 14 | 0 | 26 alphabet costume characters plus many nursery characters and fall activity children already queued. More everyday people would improve variety later. |
| animals | 17 | 4 | Safari and garden coverage is established. Nursery and fall add farm birds, sheep and woodland creatures. Sea life was the clearest absent habitat. |
| plants | 11 | 0 | Garden assets plus fall trees, leaves, crops and mushrooms give substantial queued coverage. |
| sky | 6 | 0 | Sun/cloud/rainbow/star already present; nursery adds a star and crescent moon. Future gap: rain clouds, lightning, snow clouds and planets. |
| landscapes | 8 | 0 | 24 new horizon sources plus nursery terrain make this a strong queued category. Preserve horizon overscan on conversion. |
| buildings | 4 | 4 | Only four live items, two being structural parts. Nursery adds barn, schoolhouse, castle and shoe house; everyday town/coastal structures still useful. |
| objects | 7 | 4 | Nursery and fall add numerous props, tools and clothing. Toys/play objects remain a useful breadth addition. Move actual vehicles out when Vehicles is introduced. |
| food | 1 | 4 | Only one live item. Fall adds harvest produce; nursery adds pie, buns and baking/meal subjects. Everyday snacks and celebration food broaden that mix. |
| vehicles (proposed) | 0 | 4 | Bus and rowboat are queued; spaceship is currently in Objects. This batch adds car, tractor, fire engine and airplane. |

There are 71 live assets. The four earlier queued packs contain 150 PNG sources; this batch adds 20 more. These counts describe source candidates, not approved or registered stickers. No category/UI changes were made in this pass.

## Category policy

- Add Vehicles at conversion/registration, and migrate the actual spaceship, bus and rowboat there. Keep letters wearing vehicle-related costumes under Characters.
- Keep marine, farm, woodland and safari animals in Animals. Use habitat/theme tags for future filtering rather than adding many top-level categories.
- Keep Toys, Tools and Clothing as tags within Objects for now. Split only when browsing volume warrants it.
- Keep seasonal and nursery rhyme names as pack/theme tags; they should not replace subject categories.
- Alphabet letters and costume numbers can remain Characters with alphabet/numbers tags. A separate Letters & Numbers category is an option when educational browsing becomes a major use case.
- Preserve the existing Landscapes category for horizons and terrain. Background/horizon metadata should describe placement behavior independently of subject category.

## Next useful gaps, in priority order

1. Pets and additional farm animals: standalone dog, cat, pig, goat, chicken, donkey. Fiddle Cat and alphabet costumes do not replace plain animal stickers.
2. Everyday people: children with varied hairstyles and mobility aids, family members and community helpers, separate from letter/number costumes.
3. Underwater setting pieces: seaweed, coral, rocks and a seabed horizon to support the four new sea animals.
4. Dinosaurs: a few distinct silhouettes before a dedicated themed pack.
5. Weather and space: rain/snow clouds, lightning, planets and a simple rocket.
6. More transport/play: bicycle, train, sailboat, playground equipment and sports items.

This pass deliberately rounds out five gaps with four assets each; it does not attempt to exhaust every possible subject.

## Deliverables

[20-source review gallery](category-expansion/index.html) ? [Exact prompts and review notes](category-expansion/generation.json)

## Follow-up generation completed

Added [24 more source candidates](collection-expansion/index.html): six pets/farm animals, six everyday people, six underwater setting pieces, and six prehistoric animals (including a pterosaur). Exact subject categories and review notes are recorded in their manifest. This brings the queued new PNG packs to 194 source candidates, separate from the 71 live assets. Conversion and app registration remain pending. The earlier prioritized gap list is a snapshot before these additions.

## Conversion update

All 194 queued PNG sources listed above are now converted and registered for review. The live library now contains 265 assets in ten subject categories, including Vehicles. The earlier counts and pending status are historical snapshots.
