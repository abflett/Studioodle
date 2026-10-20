# Interior PNG Sources

48 individual sources generated with the built-in image_gen tool: two backgrounds and four props for each of eight settings. Exact final prompts, dimensions and filenames are in [generation.json](generation.json). Browse [the gallery](index.html) by setting or type. These sources are converted to SVG and registered in the app.

| Setting | Backgrounds | Props |
| --- | --- | --- |
| Caves | Cave Chamber, Cave Side Passage | Cave Stalagmites, Hanging Stalactites, Cave Stone Arch, Small Campfire |
| Taverns | Tavern Room, Tavern Corner | Tavern Table, Tavern Stool, Wooden Barrel, Tavern Tankard |
| Palaces | Palace Chamber, Palace Gallery | Royal Throne, Palace Column, Palace Vase, Royal Cabinet |
| Halls | Great Hall, Arched Hallway | Hall Bench, Wall Banner, Wall Torch, Arched Window |
| Cottages | Cottage Kitchen, Cottage Attic | Stone Fireplace, Cooking Pot, Cottage Cupboard, Empty Woven Basket |
| Living Rooms | Home Living Room, Home Room Corner | Home Sofa, Home Armchair, Coffee Table, Floor Lamp |
| Offices | Office Room, Office Corner | Office Desk, Office Chair, Filing Cabinet, Desktop Computer |
| Bedrooms | Bedroom Room, Bedroom Corner | Single Bed, Bedside Table, Bedroom Wardrobe, Bedroom Dresser |

## Conversion and placement

- Preserve each background's full square canvas, intended for 1200 � 1200 logical placement with overscan and flexible portrait/landscape cropping. Placement metadata is a proposal, not an engine change.
- Interiors need a full paintable backing for walls, ceiling and floor. Do not apply outdoor horizon logic that discards top-connected white as sky. Use hidden canvas-edge closures during analysis, without adding visible borders.
- Props are isolated sources; discard exterior white while preserving enclosed white regions. Inspect handles, chair arms, arches and gaps between legs for correct transparency.
- Keep furniture tops and shelves empty for later compositions. The fireplace can take the separate campfire. Props can be reused across settings.

## Review notes

The images have been visually reviewed as PNG sources. Region topology and final SVG quality still need conversion-time review. Some tavern wood grain and stonework are finer than the intended simple style; simplify redundant detail if tracing creates noise. Background perspective and wall-to-floor heights vary, so check crops with characters and furniture before creating final scenes.

## Conversion status

All 48 sources are converted and registered under the `interiors-` ID prefix. The source gallery remains useful for comparison; browse the final SVGs in [the asset catalog](../../catalog/index.html). Earlier generation-time pending notes above are superseded by this status.
