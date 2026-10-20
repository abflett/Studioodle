import { Shapes, Flower2, CloudSun, Apple, House, UserRound, Bird, Mountain, Gift, Car } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StickerKind } from '../editor/document';
import librarySource from '../assets/assetLibrary.json?raw';
import { vectorStickerUrl } from '../editor/vectorCatalog';
const library = JSON.parse(librarySource) as { id: StickerKind; title: string; category: string; sortOrder: number }[];

type StickerItem = { kind: StickerKind; title: string; icon: LucideIcon; preview?: string };
// Subject categories stay stable; labels and membership come from the authoring
// manifest through scripts/build-asset-catalog.mjs. Scene themes are independent.
export const stickerCategories: { id: string; title: string; icon: LucideIcon; items: StickerItem[] }[] = [
  { id: 'shapes', title: 'Shapes', icon: Shapes },
  { id: 'characters', title: 'Characters', icon: UserRound },
  { id: 'animals', title: 'Animals', icon: Bird },
  { id: 'plants', title: 'Plants', icon: Flower2 },
  { id: 'sky', title: 'Sky', icon: CloudSun },
  { id: 'landscapes', title: 'Landscapes', icon: Mountain },
  { id: 'buildings', title: 'Buildings', icon: House },
  { id: 'objects', title: 'Objects', icon: Gift },
  { id: 'vehicles', title: 'Vehicles', icon: Car },
  { id: 'food', title: 'Food', icon: Apple },
].map(category => ({
  ...category,
  items: library.filter(asset => asset.category === category.id).sort((a, b) => a.sortOrder - b.sortOrder).map(asset => ({
    kind: asset.id, title: asset.title, icon: category.icon, preview: vectorStickerUrl(asset.id),
  })),
}));
