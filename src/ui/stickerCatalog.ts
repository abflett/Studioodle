import { Circle, Square, Triangle, TreePine, Flower2, Shapes, CloudSun, Apple, House } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StickerKind } from '../editor/document';
const previews = import.meta.glob<string>('../assets/stickers/*.svg', { eager: true, query: '?url', import: 'default' });
type StickerItem = { kind: StickerKind; title: string; icon: LucideIcon; preview?: string };
const sourceItem = (kind: StickerKind, title: string, icon: LucideIcon): StickerItem => ({ kind, title, icon, preview: previews[`../assets/stickers/${kind}.svg`] });
export const stickerCategories: { id: string; title: string; icon: LucideIcon; items: StickerItem[] }[] = [
  { id: 'winter', title: 'Christmas winter', icon: TreePine, items: [
    sourceItem('winter-santa-sleigh', 'Santa and sleigh', Shapes), sourceItem('winter-reindeer', 'Reindeer', Shapes),
    sourceItem('winter-cabin', 'Snowy cabin', House), sourceItem('winter-pine', 'Christmas pine', TreePine),
    sourceItem('winter-skater', 'Skater', Shapes), sourceItem('winter-skater-friend', 'Skating friend', Shapes),
    sourceItem('winter-present', 'Present', Square), sourceItem('winter-pond', 'Skating pond', Circle),
    sourceItem('winter-snow', 'Snowy ground', CloudSun),
  ] },
  { id: 'beach', title: 'Beach day', icon: CloudSun, items: [
    sourceItem('beach-palm', 'Palm tree', TreePine), sourceItem('beach-umbrella', 'Umbrella', CloudSun),
    sourceItem('beach-ball', 'Beach ball', Circle), sourceItem('beach-towel', 'Beach towel', Square),
    sourceItem('beach-shell', 'Shell', Shapes), sourceItem('beach-shore', 'Seashore', CloudSun),
  ] },
  { id: 'spring', title: 'Spring garden', icon: Flower2, items: [
    sourceItem('spring-bunny', 'Bunny', Flower2), sourceItem('spring-butterfly', 'Butterfly', Flower2),
    sourceItem('spring-tulip', 'Tulip', Flower2), sourceItem('spring-bird', 'Bird', Flower2),
    sourceItem('spring-watering-can', 'Watering can', Flower2), sourceItem('spring-sun', 'Sun', CloudSun),
    sourceItem('spring-cloud', 'Cloud', CloudSun), sourceItem('spring-meadow', 'Meadow', TreePine),
  ] },
  { id: 'counting', title: 'Costume numbers', icon: Shapes, items: [
    sourceItem('counting-01', '1 · Astronaut', Shapes), sourceItem('counting-02', '2 · Pirate', Shapes),
    sourceItem('counting-03', '3 · Chef', Shapes), sourceItem('counting-04', '4 · Gardener', Shapes),
    sourceItem('counting-05', '5 · Knight', Shapes), sourceItem('counting-06', '6 · Wizard', Shapes),
    sourceItem('counting-07', '7 · Explorer', Shapes), sourceItem('counting-08', '8 · Dancer', Shapes),
    sourceItem('counting-09', '9 · Firefighter', Shapes), sourceItem('counting-10', '10 · Musician', Shapes),
    sourceItem('counting-bunting', 'Bunting', Shapes), sourceItem('counting-star', 'Star', Shapes),
  ] },
  { id: 'shapes', title: 'Shapes', icon: Shapes, items: [
    { kind: 'circle', title: 'Circle', icon: Circle }, { kind: 'square', title: 'Square', icon: Square }, { kind: 'triangle', title: 'Triangle', icon: Triangle },
  ] },
  { id: 'nature', title: 'Nature', icon: TreePine, items: [
    sourceItem('garden-mushroom', 'Mushroom', TreePine),
    sourceItem('garden-butterfly-left', 'Butterfly', Flower2), sourceItem('garden-butterfly-right', 'Flutter', Flower2),
  ] },
  { id: 'plants', title: 'Plants', icon: Flower2, items: [sourceItem('garden-tree', 'Tree', TreePine), sourceItem('garden-bush', 'Bush', TreePine), sourceItem('garden-flower', 'Flower', Flower2), sourceItem('garden-blossom', 'Blossom', Flower2), sourceItem('garden-grass', 'Grass', Flower2)] },
  { id: 'sky', title: 'Sky', icon: CloudSun, items: [sourceItem('garden-sun', 'Sun', CloudSun), sourceItem('garden-cloud', 'Cloud', CloudSun), sourceItem('garden-rainbow', 'Rainbow', CloudSun)] },
  { id: 'fruit', title: 'Fruit', icon: Apple, items: [sourceItem('garden-apple', 'Apple', Apple)] },
  { id: 'cottage', title: 'Cottage', icon: House, items: [sourceItem('garden-house', 'House', House), sourceItem('garden-fence', 'Fence', House), sourceItem('garden-path', 'Path', House), sourceItem('garden-stone', 'Stone', Circle), sourceItem('garden-window', 'Window', House)] },
];
