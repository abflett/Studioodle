# Picture output

Saved drawings remain editable structured vectors in IndexedDB. Exported files
are sharing/printing formats, not a replacement for the saved drawing library.

## Formats and printing

The saved-picture Export button opens a native HTML dialog with three choices:

| Format | Contents | Resolution |
| --- | --- | --- |
| PNG | Raster image with print-resolution metadata | 150, 300 (default) or 600 DPI at the document size |
| SVG | Self-contained source curves, clipped polygon paint, ink and patterns | Vector; no embedded images or external asset links |
| PDF | One page at the document's physical size, converted from the same SVG | Vector; no screenshot or canvas snapshot |

Printing uses inline SVG in a browser preview or a temporary print-only desktop
surface. The browser print window opens synchronously from the click to respect
popup rules. New normalized pages carry separate `printSizeMm` dimensions; existing drawings
without that metadata retain 96 scene units per inch. SVG physical attributes, PDF
page size, PNG dimensions and the print stylesheet use the same physical size. Browser and printer settings can override
orientation, margins and scaling. No raster-print fallback is retained.

Browser exports download the chosen file. Desktop exports use the corresponding
native Save filter through `save_picture`, with size/signature validation before
writing. Cancellation performs no write. Choosing the format inside the desktop
file dialog itself can be considered separately; the overlay currently supplies
all three choices on both platforms.

## Implementation

`editor/pictureSvg.ts` composes exact authored region/ink curves and numeric paint
without constructing Artwork, hit maps or screen caches. It retains layer order,
rotation, scale, flips, holes, authored ink clips and outline colors. IDs are scoped
per sticker instance. Fill patterns use explicit clipped vector marks in sticker coordinates, avoiding
browser print engines rasterizing SVG pattern tiles. Mixed paint underpainting is clipped to the
combined coverage and region so it cannot enlarge the painted silhouette.

`app/pictureOutput.ts` coordinates naming and formats. PNG still uses
`renderPicture`, releasing its temporary backing afterwards. `app/picturePdf.ts`
lazy-loads jsPDF and svg2pdf.js only for PDF export; those libraries are not loaded
for editing, SVG, PNG or printing. SVG conversion is limited to the app's trusted
bundled asset format and generated paint, not arbitrary imported SVG markup.
See the [converter's supported use](https://github.com/yWorks/svg2pdf.js).

`platform/pictureOutput.ts` owns downloads and browser print preview;
`platform/desktop.ts` owns native file/print calls. Export UI owns busy/error state
and prevents duplicate requests while a file is being prepared.

## Verification

Browser regression uses two differently transformed instances of the Moon
Sorceress, a clipped-ink circle, outline recoloring, stripes/dots/checker fills,
clipped brush shapes and a polygon hole. SVG is rasterized only for comparison
against the editor render. Tests check unique/resolved IDs, unchanged saved data,
150/300 DPI PNG dimensions and matching metadata, PDF signature and absence of raster image objects.

The actual print adapter's preview HTML also passes through Chromium's
`Page.printToPDF`; its PDF is checked for raster images. Both PDFs were separately
inspected for page size and visually rendered. Export dialog choices, close
behavior and blocked print windows have browser coverage. OS print dialogs,
physical printers and the changed native adapter still require the manual checks
in [refinement tasks](REFINEMENT-TASKS.md).

PNG density affects actual pixel dimensions and pHYs metadata together. Options
exceeding the shared 64-million-pixel raster budget are disabled before allocation.
Vector source geometry remains resolution independent; raster buffers and encoding
still require memory proportional to pixel count. SVG and PDF have no DPI setting.
