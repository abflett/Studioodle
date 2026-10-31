import { createSsrServer } from './lib/ssr-server.mjs';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

// Model CPU timings, not browser rendering or pointer-to-display latency.
// One warmup and three measured repetitions; report their median.
const server = await createSsrServer();
try {
  const { CellField } = await server.ssrLoadModule('/tools/cell-brush/src/model.ts');
  const { performanceStrokes } = await server.ssrLoadModule('/tools/cell-brush/src/fixtures.ts');
  const median = values => values.sort((a, b) => a - b)[1];
  const results = [];
  for (const [name, points] of Object.entries(performanceStrokes)) for (const background of ['empty', 'painted']) {
    const runs = []; let scratch = 0, checksum;
    for (let repeat = 0; repeat < 4; repeat++) {
      const field = new CellField('straight', false, 1520, 850);
      if (background === 'painted') { field.profile.fill(1); field.front.fill(2); }
      const times = []; let previous = points[0];
      const start = performance.now();
      for (const point of points) {
        const eventStart = performance.now(); field.paint(previous, point, 4, 1);
        times.push(performance.now() - eventStart); previous = point;
      }
      scratch = field.scratchBytes; field.endStroke();
      const totalMs = performance.now() - start;
      checksum = createHash('sha256').update(field.profile).update(field.front).update(field.back).digest('hex');
      if (repeat) runs.push({ totalMs, maxEventMs: Math.max(...times) });
    }
    results.push({ name, background, totalMs: median(runs.map(r => r.totalMs)),
      maxEventMs: median(runs.map(r => r.maxEventMs)), scratchBytes: scratch, checksum });
  }
  console.log(JSON.stringify({ runtime: process.version, grid: [1520, 850], radius: 4, results }, null, 2));
  if (process.argv[2]) await fs.writeFile(process.argv[2], JSON.stringify(results, null, 2));
} finally { await server.close(); }
