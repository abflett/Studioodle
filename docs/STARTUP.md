# Startup and navigation

Studioodle borrows Nanite Survivors' separation between loading, React UI, and Phaser presentation, without its gameplay packs, audio-unlock screen, or simulation startup.

1. React immediately renders a system-themed splash with the Studioodle wordmark and an inline sketchbook/pencil icon. The small sparkle respects reduced-motion preferences and needs no external image or font download.
2. `prepareStudio` decodes the three selection illustrations and dynamically imports the editor, including Phaser. Progress counts completed tasks, not bytes.
3. Once those tasks succeed AND the splash has been visible for at least two seconds, React displays picture selection. The minimum duration runs alongside loading, not after it; the progress bar still reflects real work. Timers are cleared on cleanup.
4. Blank page and Coloring page appear side by side. Each opens a modal setup wizard without expanding the selection screen. Blank setup steps through paper shape and color; coloring setup offers an example-picture carousel. The native dialog keeps keyboard focus inside, with visible close/back controls and Escape support. A separate carousel below represents previous pictures, with arrows and an openable preview. It currently uses explicitly labeled examples, not saved user data.
5. Opening a picture mounts the tree preview with the selected paper shape, background, and starting leaf color. Returning to selection destroys Phaser and its subscriptions. Entering again starts a fresh preview. The selected paper color belongs to the picture and does not change with the system theme.

Failures show a retry action. Effect cleanup prevents abandoned startup attempts from changing UI state, including during React Strict Mode's development lifecycle checks.

Selection is a React screen, not a Phaser scene. Phaser is instantiated only when entering the preview. Modules preload at startup; GPU resources initialize when the canvas mounts.

The interface defaults to the system theme: sunny sand, sea-glass teal, and warm cream in light mode; moonlit blue, forest teal, and amber in dark mode. The selection screen has system/sun/moon controls to follow the device or override it. The preference is saved locally and applies to the splash, selection, and editor; paper colors remain unchanged. Layered gradients add depth without scenic background images. Selection and setup are constrained to the viewport, with compact layouts for shorter screens and no page scrolling.

## Growing the asset library

Interface typography uses bundled Nunito Variable via Fontsource, and controls use Lucide React icons. Neither requires an external font or icon service at runtime. Picture choices use artwork with centered labels instead of framed cards; carousel navigation uses borderless round hit areas. Buttons share hover/press feedback and respect reduced-motion preferences. Keep strong outlines for keyboard focus and selected options rather than framing every control.

Preload common navigation artwork and editor code. Load larger scene/sticker packs when chosen, reporting their real loader progress. Do not load every future coloring book into memory at launch. Measure expensive mask preprocessing and move it off the main thread if needed. No sticker masks or document persistence exist yet.

## State ownership

- React: startup status and selected entry path.
- Editor: tool state and future document commands.
- Phaser: canvas lifecycle and presentation.
- Future storage adapter: browser persistence and import/export, independent of native wrappers.

Keep the initial React entry independent of Phaser through dynamic imports. All choices intentionally lead to a preview until their actual flows are implemented. The child-facing UI is picture-led, with short labels for choices and setup options. Accessible names and status messages remain available to assistive technology. Detailed prototype limitations belong in project documentation.
