import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Inspection taps only: all stages are captured from the real offline builder. */
export function stickerInspection(directory, asset, { threshold = 50, prefix = '', sharedSource = '' } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const file = name => path.join(directory, prefix + name);
  const magick = (args, input) => execFileSync('magick', args, { input, maxBuffer: 128e6 });
  const copy = (source, name) => fs.copyFileSync(source, file(name));
  const stages = [];
  const settings = { asset: asset.id, source: asset.source, crop: asset.crop, logicalSize: [asset.width, asset.height] };
  const stage = (number, title, image, detail, svg) => stages.push({ number, title, image: image.startsWith('../') ? image : prefix + image, detail, ...(svg ? { svg: prefix + svg } : {}) });
  const rawPng = (name, width, height, data, channels) => magick(['-size', `${width}x${height}`, '-depth', '8', `${channels}:-`, file(name)], data);
  const color = id => [64 + id * 67 % 176, 64 + id * 113 % 176, 64 + id * 151 % 176];
  function labelsPng(name, labels, width, height) {
    const pixels = Buffer.alloc(width * height * 3);
    for (let i = 0; i < labels.length; i++) {
      const rgb = labels[i] > 0 ? color(labels[i]) : labels[i] === -2 ? [20, 20, 20] : [220, 227, 233];
      pixels[i * 3] = rgb[0]; pixels[i * 3 + 1] = rgb[1]; pixels[i * 3 + 2] = rgb[2];
    }
    rawPng(name, width, height, pixels, 'rgb');
  }
  const counts = svg => {
    const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)];
    return { paths: paths.length, closedContours: paths.reduce((sum, p) => sum + (p[1].match(/[zZ]/g)?.length ?? 0), 0) };
  };
  return {
    file,
    source(grayFile) {
      if (!sharedSource) {
        copy(asset.source, '01-original.png');
        magick([asset.source, ...(asset.crop ? ['-crop', asset.crop, '+repage'] : []), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', file('02-cropped.png')]);
        copy(grayFile, '03-grayscale.png');
      }
      stage(1, 'Original source', sharedSource + '01-original.png', 'Untouched source PNG.');
      stage(2, 'Crop', sharedSource + '02-cropped.png', `Crop: ${asset.crop}. No resizing.`);
      stage(3, 'Grayscale', sharedSource + '03-grayscale.png', 'White background, alpha removed, grayscale. The production command performs stages 2 and 3 together.');
    },
    bitmap(grayFile, bitmapFile, stroke) {
      settings.estimatedStrokePixels = stroke;
      settings.inkTrace = { blurSigma: stroke * .04, threshold: `${threshold}%`, alphamax: 1.2, opttolerance: .5 * stroke / 12, turdsize: Math.max(2, Math.round(8 * (stroke / 12) ** 2)), unit: 10 };
      if (!sharedSource) magick([grayFile, '-blur', `0x${stroke * .04}`, file('04-blurred.png')]);
      copy(bitmapFile, '05-threshold.pbm'); magick([bitmapFile, file('05-threshold.png')]);
      stage(4, 'Blur before threshold', sharedSource + '04-blurred.png', `Gaussian blur sigma ${stroke * .04} source pixels.`);
      stage(5, 'Binary bitmap', '05-threshold.png', `${threshold}% threshold. PNG is an exact view of the accompanying PBM passed to Potrace.`);
    },
    ink(svgFile) {
      copy(svgFile, '06-traced-ink.svg');
      magick(['-background', 'white', '-density', '72', svgFile, file('06-traced-ink.png')]);
      settings.ink = counts(fs.readFileSync(svgFile, 'utf8'));
      stage(6, 'First SVG: traced black ink', '06-traced-ink.png', `${settings.ink.paths} black-filled paths, ${settings.ink.closedContours} closed contours. White is transparent; no region paths yet. PNG shown on white.`, '06-traced-ink.svg');
    },
    analysis(svgFile, gray, width, height, scale, lookupScale) {
      copy(svgFile, '07-analysis-render.svg'); rawPng('07-analysis-render.png', width, height, gray, 'gray');
      settings.regionAnalysis = { width, height, scale, lookupScale, threshold: 128, regionTraceAlphamax: 1, regionTraceTolerance: .015 * scale, overlapAnalysisPixels: 1 };
      stage(7, 'Render ink for region discovery', '07-analysis-render.png', `${width} x ${height}; ${scale} samples per logical unit. Exact grayscale pixels used for discovery.`, '07-analysis-render.svg');
    },
    discovered(labels, width, height, count) {
      settings.regionCount = count; labelsPng('08-discovered-regions.png', labels, width, height);
      stage(8, 'Discovered white regions', '08-discovered-regions.png', `${count} regions, shown in diagnostic colors. Black = ink barrier; pale gray = outside. Colors are IDs, not paint.`);
    },
    extended(labels, width, height) {
      labelsPng('09-regions-extended-under-ink.png', labels, width, height);
      stage(9, 'Extend ownership beneath ink', '09-regions-extended-under-ink.png', 'Same categorical region labels after propagation into the ink, approaching its centerline. No ink overlay, so the boundaries are visible.');
    },
    finish(svg) {
      const inkStart = svg.indexOf('<g id="ink"');
      const regionsOnly = svg.slice(0, inkStart) + '</svg>';
      const colored = svg.replace(/(<path id="region-(\d+)" )/g, (_, tag, id) => `${tag}fill="rgb(${color(Number(id)).join(',')})" `);
      settings.final = { regionPaths: settings.regionCount, inkPaths: settings.ink.paths, ...counts(svg) };
      const render = (name, text) => {
        fs.writeFileSync(file(`${name}.svg`), text);
        // Rasterize vectors directly at 8x; never upscale a small PNG preview.
        const sized = text.replace('<svg ', `<svg width="${asset.width * 8}" height="${asset.height * 8}" `);
        magick(['-background', name === '11-final-backing' ? '#839ba9' : 'white', 'svg:-', file(`${name}.png`)], Buffer.from(sized));
      };
      render('10-final', svg);
      render('11-final-backing', regionsOnly);
      render('12-final-colored-regions', colored.slice(0, colored.indexOf('<g id="ink"')) + '</svg>');
      render('13-final-colored-regions-with-ink', colored);
      stage(10, prefix ? 'Threshold result SVG' : 'Current production SVG', '10-final.png', `${settings.regionCount} white region paths plus ${settings.ink.paths} original ink paths. Exact current builder output.`, '10-final.svg');
      stage(11, 'Final vector backing only', '11-final-backing.png', 'Diagnostic view: the final white region paths without ink, on a contrasting background. This is their union, not a separately generated silhouette.', '11-final-backing.svg');
      stage(12, 'Final vector regions only', '12-final-colored-regions.png', 'Diagnostic view: each final SVG region gets the same ID color as stages 8 and 9. Ink hidden to expose gaps/overlaps.', '12-final-colored-regions.svg');
      stage(13, 'Final vector regions with ink', '13-final-colored-regions-with-ink.png', 'Diagnostic view: stage 12 with the original black ink drawn on top.', '13-final-colored-regions-with-ink.svg');
      fs.writeFileSync(file('00-settings.json'), JSON.stringify(settings, null, 2) + '\n');
      fs.writeFileSync(file('README.md'), `# Moon Sorceress: ${threshold}% threshold inspection\n\nOpen [${prefix}index.html](${prefix}index.html) for a visual sequence. Files are numbered in processing order. Click an image for full resolution.\n\nStages 1-10 capture the current pipeline; 11-13 are diagnostic views of the final SVG, not additional production steps. This stops before browser hit maps, painting, Phaser, or resizing. No alternate Potrace options or proposed fixes are included.\n\nReproduce from the repository root:\n\n\`\`\`sh\nnode scripts/build-stickers.mjs ${asset.id} --inspect=${directory.replaceAll('\\', '/')} --inspect-threshold=${threshold} --inspect-prefix=${prefix}${sharedSource ? ` --inspect-shared-source=${sharedSource}` : ''}\n\`\`\`\n\nInspection mode writes here and in ignored work/hybrid intermediates; it does not replace production SVGs, reports, or catalogs. Settings and path counts are in [${prefix}00-settings.json](${prefix}00-settings.json).\n\n${stages.map(s => `${s.number}. **${s.title}** - [PNG](${s.image})${s.svg ? `  |  [SVG](${s.svg})` : ''}. ${s.detail}`).join('\n\n')}\n\nThe colored images show region identity only. Pale gray/white outside the backing is not a fill region. PNGs intentionally preserve their native analysis pixels; preview them at 100% when inspecting raster edges. SVGs remain scalable.\n`);
      fs.writeFileSync(file('index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moon Sorceress Pipeline</title><style>body{font:16px system-ui;background:#edf0f3;color:#203147;margin:24px auto;padding:0 20px;max-width:1160px}h1{margin-bottom:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:white;border:1px solid #b6c4cf;border-radius:14px;padding:16px}img{display:block;width:100%;height:330px;object-fit:contain;background:#f5f5f5}h2{font-size:18px}p{line-height:1.5}a{color:#315e83}</style><h1>Moon Sorceress: ${threshold}% threshold</h1><p>Numbered in processing order. Click a picture for its full-resolution PNG. SVG links open the vector stage. Stages 11-13 are diagnostic views; no runtime painting is included.</p><p><a href="${prefix}00-settings.json">Settings and path counts</a>  |  <a href="${prefix}README.md">Process notes</a></p><div class="grid">${stages.map(s => `<article><h2>${String(s.number).padStart(2, '0')}  |  ${s.title}</h2><a href="${s.image}"><img src="${s.image}" alt="${s.title}" loading="lazy"></a><p>${s.detail}</p>${s.svg ? `<a href="${s.svg}">Open SVG</a>` : ''}${s.number === 5 ? `<a href="${prefix}05-threshold.pbm">Open actual PBM</a>` : ''}</article>`).join('')}</div></html>`);
    },
  };
}
