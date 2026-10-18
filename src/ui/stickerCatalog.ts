import { Circle, Square, Triangle, TreePine, Flower2, Shapes, CloudSun, Apple, House, UserRound, Bird, Mountain, Gift } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StickerKind } from '../editor/document';
const previews = import.meta.glob<string>('../assets/vector/*.svg', { eager: true, query: '?url', import: 'default' });

type StickerItem = { kind: StickerKind; title: string; icon: LucideIcon; preview?: string };
const sourceItem = (kind: StickerKind, title: string, icon: LucideIcon): StickerItem => ({ kind, title, icon, preview: previews[`../assets/vector/${kind}.svg`] });
// Categories describe the subject, independently of its source pack or season.
// Give each sticker one home; scene themes remain in the coloring-page picker.
export const stickerCategories: { id: string; title: string; icon: LucideIcon; items: StickerItem[] }[] = [
  { id: 'shapes', title: 'Shapes', icon: Shapes, items: [
    sourceItem('circle', 'Circle', Circle), sourceItem('square', 'Square', Square), sourceItem('triangle', 'Triangle', Triangle),
  ] },
  { id: 'characters', title: 'Characters', icon: UserRound, items: [
    sourceItem('counting-01', '1 - Astronaut', UserRound), sourceItem('counting-02', '2 - Pirate', UserRound),
    sourceItem('counting-03', '3 - Chef', UserRound), sourceItem('counting-04', '4 - Gardener', UserRound),
    sourceItem('counting-05', '5 - Knight', UserRound), sourceItem('counting-06', '6 - Wizard', UserRound),
    sourceItem('counting-07', '7 - Explorer', UserRound), sourceItem('counting-08', '8 - Dancer', UserRound),
    sourceItem('counting-09', '9 - Firefighter', UserRound), sourceItem('counting-10', '10 - Musician', UserRound),
    sourceItem('winter-skater', 'Skater', UserRound), sourceItem('winter-skater-friend', 'Skating friend', UserRound),
    sourceItem('winter-santa-sleigh', 'Santa and sleigh', UserRound),
    sourceItem('space-alien', 'Alien explorer', UserRound),
  ] },
  { id: 'animals', title: 'Animals', icon: Bird, items: [
    sourceItem('spring-bunny', 'Bunny', Bird), sourceItem('spring-bird', 'Bird', Bird),
    sourceItem('winter-reindeer', 'Reindeer', Bird), sourceItem('spring-butterfly', 'Butterfly', Bird),
    sourceItem('garden-butterfly', 'Garden butterfly', Bird),
    sourceItem('animal-giraffe', 'Giraffe', Bird),
    sourceItem('animal-elephant', 'Elephant', Bird),
    sourceItem('animal-lion', 'Lion', Bird),
    sourceItem('animal-hippo', 'Hippo', Bird),
    sourceItem('animal-zebra', 'Zebra', Bird),
    sourceItem('animal-rhino', 'Rhino', Bird),
    sourceItem('animal-leopard', 'Leopard', Bird),
    sourceItem('animal-ostrich', 'Ostrich', Bird),
    sourceItem('animal-buffalo', 'Buffalo', Bird),
    sourceItem('animal-meerkat', 'Meerkat', Bird),
    sourceItem('animal-warthog', 'Warthog', Bird),
    sourceItem('animal-crocodile', 'Crocodile', Bird),
  ] },
  { id: 'plants', title: 'Plants', icon: Flower2, items: [
    sourceItem('garden-tree', 'Apple tree', TreePine), sourceItem('tree', 'Simple tree', TreePine),
    sourceItem('beach-palm', 'Palm tree', TreePine), sourceItem('winter-pine', 'Pine tree', TreePine),
    sourceItem('garden-bush', 'Bush', TreePine), sourceItem('garden-grass', 'Grass', Flower2),
    sourceItem('garden-flower', 'Flower', Flower2), sourceItem('flower', 'Simple flower', Flower2),
    sourceItem('garden-blossom', 'Blossom', Flower2), sourceItem('spring-tulip', 'Tulip', Flower2),
    sourceItem('garden-mushroom', 'Mushroom', Flower2),
  ] },
  { id: 'sky', title: 'Sky', icon: CloudSun, items: [
    sourceItem('garden-sun', 'Sun with rays', CloudSun), sourceItem('spring-sun', 'Round sun', CloudSun),
    sourceItem('garden-cloud', 'Cloud', CloudSun), sourceItem('spring-cloud', 'Simple cloud', CloudSun),
    sourceItem('garden-rainbow', 'Rainbow', CloudSun), sourceItem('counting-star', 'Star', Shapes),
  ] },
  { id: 'landscapes', title: 'Landscapes', icon: Mountain, items: [
    sourceItem('spring-meadow', 'Meadow horizon', Mountain), sourceItem('beach-shore', 'Seashore horizon', Mountain),
    sourceItem('winter-snow', 'Snow horizon', Mountain), sourceItem('winter-pond', 'Pond', Circle),
    sourceItem('garden-path', 'Path', Mountain), sourceItem('garden-stone', 'Stone', Circle),
    sourceItem('beach-shell', 'Shell', Mountain),
    sourceItem('space-crater', 'Moon crater', Mountain),
  ] },
  { id: 'buildings', title: 'Buildings', icon: House, items: [
    sourceItem('garden-house', 'Cottage', House), sourceItem('winter-cabin', 'Snowy cabin', House),
    sourceItem('garden-window', 'Window', House), sourceItem('garden-fence', 'Fence', House),
  ] },
  { id: 'objects', title: 'Objects', icon: Gift, items: [
    sourceItem('spring-watering-can', 'Watering can', Gift), sourceItem('beach-umbrella', 'Umbrella', Gift),
    sourceItem('beach-ball', 'Ball', Circle), sourceItem('beach-towel', 'Towel', Square),
    sourceItem('space-spaceship', 'Explorer spaceship', Gift),
    sourceItem('winter-present', 'Present', Gift), sourceItem('counting-bunting', 'Bunting', Gift),
  ] },
  { id: 'food', title: 'Food', icon: Apple, items: [sourceItem('garden-apple', 'Apple', Apple)] },
];
