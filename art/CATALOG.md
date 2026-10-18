# Asset Catalog

71 reusable coloring assets. Start here when choosing artwork for a new page.

- [Searchable Visual Browser](catalog/index.html): open locally in a browser; no server needed.
- [Machine Index](catalog/index.json): IDs, descriptions, tags, roles, detail levels, facing, dimensions, visible bounds and scene examples.
- [Scene Authoring Guide](SCENE-AUTHORING.md): coordinates, layering, scaling and composition workflow.
- Source of truth: [stickers.json](stickers.json); curated collections: [scene-kits.json](scene-kits.json).

## Browse By Subject

| Category | Assets | Guide |
| --- | ---: | --- |
| Shapes | 3 | [Browse](catalog/shapes.md) |
| Characters | 14 | [Browse](catalog/characters.md) |
| Animals | 17 | [Browse](catalog/animals.md) |
| Plants | 11 | [Browse](catalog/plants.md) |
| Sky | 6 | [Browse](catalog/sky.md) |
| Landscapes | 8 | [Browse](catalog/landscapes.md) |
| Buildings | 4 | [Browse](catalog/buildings.md) |
| Objects | 7 | [Browse](catalog/objects.md) |
| Food | 1 | [Browse](catalog/food.md) |

## Scene Kits

### Safari And Watering Hole

Select a few safari animals, broad-canopy trees, a meadow horizon and a pond. Keep detailed animals large and frame the page with small grass tufts.

`animal-giraffe`, `animal-elephant`, `animal-lion`, `animal-hippo`, `animal-zebra`, `animal-rhino`, `animal-leopard`, `animal-ostrich`, `animal-buffalo`, `animal-meerkat`, `animal-warthog`, `animal-crocodile`, `spring-meadow`, `garden-tree`, `tree`, `garden-bush`, `garden-grass`, `garden-stone`, `garden-sun`, `garden-cloud`, `winter-pond`

[Scene Example](../src/editor/safariScene.ts)

### Garden And Woodland

Combine leafy scenery, small wildlife, cottage and paths.

`garden-house`, `garden-tree`, `garden-bush`, `garden-flower`, `garden-blossom`, `garden-mushroom`, `spring-bunny`, `spring-bird`, `spring-butterfly`, `garden-path`, `garden-stone`, `garden-fence`, `spring-meadow`

[Scene Example](../src/editor/gardenScene.ts)

### Beach And Island

Build a shoreline scene with palm, umbrella, towel and beach toys.

`beach-shore`, `beach-palm`, `beach-umbrella`, `beach-towel`, `beach-ball`, `beach-shell`, `garden-sun`, `garden-cloud`

[Scene Example](../src/editor/beachScene.ts)

### Winter And Christmas

Arrange winter characters, cabin, pine trees, pond and gifts on a snow horizon.

`winter-santa-sleigh`, `winter-reindeer`, `winter-cabin`, `winter-pine`, `winter-skater`, `winter-skater-friend`, `winter-snow`, `winter-pond`, `winter-present`, `counting-star`

[Scene Example](../src/editor/winterScene.ts)

### Space Adventure

Use the crater as ground and the spaceship as a large focal subject, with alien, astronaut and stars.

`space-crater`, `space-spaceship`, `space-alien`, `counting-01`, `counting-star`

### Counting And Celebration

Personified numerals, bunting and stars for a costume parade or counting page.

`counting-01`, `counting-02`, `counting-03`, `counting-04`, `counting-05`, `counting-06`, `counting-07`, `counting-08`, `counting-09`, `counting-10`, `counting-bunting`, `counting-star`

[Scene Example](../src/editor/countingScene.ts)

## Complete Inventory

| ID | Display Name | Category | Detail | Roles |
| --- | --- | --- | --- | --- |
| [circle](catalog/shapes.md#circle) | Circle | shapes | simple | subject, accent |
| [square](catalog/shapes.md#square) | Square | shapes | simple | subject, accent |
| [triangle](catalog/shapes.md#triangle) | Triangle | shapes | simple | subject, accent |
| [counting-01](catalog/characters.md#1---astronaut) | 1 - Astronaut | characters | detailed | subject |
| [counting-02](catalog/characters.md#2---pirate) | 2 - Pirate | characters | detailed | subject |
| [counting-03](catalog/characters.md#3---chef) | 3 - Chef | characters | detailed | subject |
| [counting-04](catalog/characters.md#4---gardener) | 4 - Gardener | characters | detailed | subject |
| [counting-05](catalog/characters.md#5---knight) | 5 - Knight | characters | detailed | subject |
| [counting-06](catalog/characters.md#6---wizard) | 6 - Wizard | characters | detailed | subject |
| [counting-07](catalog/characters.md#7---explorer) | 7 - Explorer | characters | detailed | subject |
| [counting-08](catalog/characters.md#8---dancer) | 8 - Dancer | characters | detailed | subject |
| [counting-09](catalog/characters.md#9---firefighter) | 9 - Firefighter | characters | detailed | subject |
| [counting-10](catalog/characters.md#10---musician) | 10 - Musician | characters | detailed | subject |
| [winter-skater](catalog/characters.md#skater) | Skater | characters | moderate | subject |
| [winter-skater-friend](catalog/characters.md#skating-friend) | Skating Friend | characters | moderate | subject |
| [winter-santa-sleigh](catalog/characters.md#santa-and-sleigh) | Santa And Sleigh | characters | detailed | subject |
| [space-alien](catalog/characters.md#alien-explorer) | Alien Explorer | characters | detailed | subject |
| [spring-bunny](catalog/animals.md#bunny) | Bunny | animals | moderate | subject |
| [spring-bird](catalog/animals.md#bird) | Bird | animals | moderate | accent, subject |
| [winter-reindeer](catalog/animals.md#reindeer) | Reindeer | animals | moderate | subject |
| [spring-butterfly](catalog/animals.md#butterfly) | Butterfly | animals | moderate | accent, subject |
| [garden-butterfly](catalog/animals.md#garden-butterfly) | Garden Butterfly | animals | moderate | accent, subject |
| [animal-giraffe](catalog/animals.md#giraffe) | Giraffe | animals | detailed | subject |
| [animal-elephant](catalog/animals.md#elephant) | Elephant | animals | moderate | subject |
| [animal-lion](catalog/animals.md#lion) | Lion | animals | moderate | subject |
| [animal-hippo](catalog/animals.md#hippo) | Hippo | animals | moderate | subject |
| [animal-zebra](catalog/animals.md#zebra) | Zebra | animals | detailed | subject |
| [animal-rhino](catalog/animals.md#rhino) | Rhino | animals | moderate | subject |
| [animal-leopard](catalog/animals.md#leopard) | Leopard | animals | detailed | subject |
| [animal-ostrich](catalog/animals.md#ostrich) | Ostrich | animals | moderate | subject |
| [animal-buffalo](catalog/animals.md#buffalo) | Buffalo | animals | moderate | subject |
| [animal-meerkat](catalog/animals.md#meerkat) | Meerkat | animals | moderate | subject |
| [animal-warthog](catalog/animals.md#warthog) | Warthog | animals | moderate | subject |
| [animal-crocodile](catalog/animals.md#crocodile) | Crocodile | animals | moderate | subject |
| [garden-tree](catalog/plants.md#apple-tree) | Apple Tree | plants | moderate | background, subject |
| [tree](catalog/plants.md#simple-tree) | Simple Tree | plants | simple | background, subject |
| [beach-palm](catalog/plants.md#palm-tree) | Palm Tree | plants | moderate | background, subject |
| [winter-pine](catalog/plants.md#pine-tree) | Pine Tree | plants | moderate | background, subject |
| [garden-bush](catalog/plants.md#bush) | Bush | plants | simple | background, foreground |
| [garden-grass](catalog/plants.md#grass) | Grass | plants | simple | foreground, accent |
| [garden-flower](catalog/plants.md#flower) | Flower | plants | moderate | foreground, accent |
| [flower](catalog/plants.md#simple-flower) | Simple Flower | plants | simple | accent, foreground |
| [garden-blossom](catalog/plants.md#blossom) | Blossom | plants | simple | accent, foreground |
| [spring-tulip](catalog/plants.md#tulip) | Tulip | plants | moderate | foreground, accent |
| [garden-mushroom](catalog/plants.md#mushroom) | Mushroom | plants | simple | foreground, accent |
| [garden-sun](catalog/sky.md#sun-with-rays) | Sun With Rays | sky | simple | background, accent |
| [spring-sun](catalog/sky.md#round-sun) | Round Sun | sky | simple | background, accent |
| [garden-cloud](catalog/sky.md#cloud) | Cloud | sky | simple | background, accent |
| [spring-cloud](catalog/sky.md#simple-cloud) | Simple Cloud | sky | simple | background, accent |
| [garden-rainbow](catalog/sky.md#rainbow) | Rainbow | sky | simple | background |
| [counting-star](catalog/sky.md#star) | Star | sky | simple | accent, background |
| [spring-meadow](catalog/landscapes.md#meadow-horizon) | Meadow Horizon | landscapes | simple | background |
| [beach-shore](catalog/landscapes.md#seashore-horizon) | Seashore Horizon | landscapes | simple | background |
| [winter-snow](catalog/landscapes.md#snow-horizon) | Snow Horizon | landscapes | simple | background |
| [winter-pond](catalog/landscapes.md#pond) | Pond | landscapes | simple | background |
| [garden-path](catalog/landscapes.md#path) | Path | landscapes | simple | background |
| [garden-stone](catalog/landscapes.md#stone) | Stone | landscapes | simple | foreground, accent |
| [beach-shell](catalog/landscapes.md#shell) | Shell | landscapes | simple | foreground, accent |
| [space-crater](catalog/landscapes.md#moon-crater) | Moon Crater | landscapes | detailed | background, subject |
| [garden-house](catalog/buildings.md#cottage) | Cottage | buildings | moderate | background, subject |
| [winter-cabin](catalog/buildings.md#snowy-cabin) | Snowy Cabin | buildings | detailed | background, subject |
| [garden-window](catalog/buildings.md#window) | Window | buildings | moderate | accent |
| [garden-fence](catalog/buildings.md#fence) | Fence | buildings | moderate | background, foreground |
| [spring-watering-can](catalog/objects.md#watering-can) | Watering Can | objects | moderate | foreground, accent |
| [beach-umbrella](catalog/objects.md#umbrella) | Umbrella | objects | moderate | subject, background |
| [beach-ball](catalog/objects.md#ball) | Ball | objects | simple | foreground, accent |
| [beach-towel](catalog/objects.md#towel) | Towel | objects | simple | foreground, accent |
| [space-spaceship](catalog/objects.md#explorer-spaceship) | Explorer Spaceship | objects | detailed | subject |
| [winter-present](catalog/objects.md#present) | Present | objects | moderate | foreground, accent |
| [counting-bunting](catalog/objects.md#bunting) | Bunting | objects | simple | background, accent |
| [garden-apple](catalog/food.md#apple) | Apple | food | simple | accent, subject |

Regenerate with `node scripts/build-asset-catalog.mjs` after editing assets or scene placements. This command only updates catalog documents and display metadata; it does not rebuild artwork or run app checks.
