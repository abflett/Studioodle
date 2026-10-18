import { fullPageScene } from '../editor/fullPageScene';
import { gardenScene } from '../editor/gardenScene';
import { countingScene } from '../editor/countingScene';
import { springScene } from '../editor/springScene';
import { beachScene } from '../editor/beachScene';
import { winterScene } from '../editor/winterScene';
import { safariScene } from '../editor/safariScene';
import type { EditorSetup } from '../editor/setup';

// Ready-made scenes use the same hybrid definitions as the sticker picker.
export const coloringPages: EditorSetup[] = [
  winterScene,
  beachScene,
  springScene,
  countingScene,
  gardenScene,
  safariScene,
].map(fullPageScene);
