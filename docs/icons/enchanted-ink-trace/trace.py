"""Reproduce the book conversion from the actual Enchanted Ink reference PNG.

Requires Pillow and Potrace (POTRACE_PATH or the repository's tools/bin copy).
Only this book proof is generated; no application assets are replaced.
"""
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / 'docs/icons/directions/01-enchanted-ink.png'
SCRATCH = ROOT / 'work/enchanted-ink-trace'
CROP = (288, 352, 424, 480)
SCALE = 4


def main():
    SCRATCH.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as source:
        original = source.convert('RGB').crop(CROP)
    original.save(HERE / 'book-reference.png')
    width, height = original.size
    # Interpolate the existing antialiased edge before masking, giving Potrace
    # subpixel contours without inventing replacement geometry.
    image = original.resize((width * SCALE, height * SCALE), Image.Resampling.LANCZOS)
    masks = {name: Image.new('1', image.size, 1) for name in ('ink', 'gold')}
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue = image.getpixel((x, y))
            gold = blue < green * .84 and red > green * 1.04
            if red >= (124 if gold else 132) and green >= 90:
                masks['ink'].putpixel((x, y), 0)
                if gold:
                    masks['gold'].putpixel((x, y), 0)
    potrace = os.environ.get('POTRACE_PATH', str(ROOT / 'tools/bin/potrace/potrace-1.16.win64/potrace.exe'))
    layers = []
    for name, mask in masks.items():
        bitmap = SCRATCH / f'{name}.pbm'
        vector = SCRATCH / f'{name}.svg'
        mask.save(bitmap)
        subprocess.run([potrace, str(bitmap), '-s', '-a', '1', '-O', '.35', '-t', '2', '-o', str(vector)], check=True, cwd=ROOT)
        group = ET.parse(vector).getroot().find('{http://www.w3.org/2000/svg}g')
        if group is None:
            raise ValueError(f'No traced geometry for {name}')
        group.set('fill', 'currentColor' if name == 'ink' else '#dfbd79')
        layers.append(ET.tostring(group, encoding='unicode').replace('ns0:', '').replace(':ns0', ''))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {image.width} {image.height}" color="#f4ead8">' + ''.join(layers) + '</svg>\n'
    svg = '\n'.join(line.rstrip() for line in svg.splitlines()) + '\n'
    (HERE / 'book-traced.svg').write_text(svg, encoding='utf-8')
    print(f'Book SVG: {len(svg.encode("utf-8"))} bytes; source rectangle: {CROP}')


if __name__ == '__main__':
    main()
