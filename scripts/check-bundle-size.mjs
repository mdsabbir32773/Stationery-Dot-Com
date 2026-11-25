import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'dist/assets';
const limits = {
  '.js': { raw: 300_000, gzip: 85_000 },
  '.css': { raw: 250_000, gzip: 60_000 }
};
const files = await readdir(root, { withFileTypes: true });
const assets = [];
for (const entry of files) {
  if (!entry.isFile()) continue;
  const extension = entry.name.slice(entry.name.lastIndexOf('.'));
  if (!limits[extension]) continue;
  const path = join(root, entry.name);
  const data = await readFile(path);
  const raw = data.byteLength;
  const compressed = gzipSync(data).byteLength;
  assets.push({ name: entry.name, extension, raw, compressed });
}
if (!assets.length) throw new Error('No production JS/CSS assets found in dist/assets.');
let failed = false;
for (const asset of assets) {
  const limit = limits[asset.extension];
  console.log(`${asset.name}: ${asset.raw} bytes raw / ${asset.compressed} bytes gzip`);
  if (asset.raw > limit.raw || asset.compressed > limit.gzip) {
    failed = true;
    console.error(`Bundle budget exceeded for ${asset.name}: max ${limit.raw} raw / ${limit.gzip} gzip bytes.`);
  }
}
const jsGzipTotal = assets.filter(x => x.extension === '.js').reduce((sum, x) => sum + x.compressed, 0);
console.log(`Total JS gzip: ${jsGzipTotal} bytes (budget 280000)`);
if (jsGzipTotal > 280_000) {
  failed = true;
  console.error('Total compressed JavaScript exceeds the 280 KB budget.');
}
if (failed) process.exit(1);
console.log('Production bundle budgets passed.');
