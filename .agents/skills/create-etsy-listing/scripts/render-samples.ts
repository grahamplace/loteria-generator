/** Render Etsy samples using supported, shared application renderer exports. */
import { readFile } from 'node:fs/promises';
import { renderSamples } from '../../../../scripts/themes/render-samples';
const [manifestPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !outputPath) throw new Error('Pass a manifest and output directory.');
readFile(manifestPath, 'utf8')
  .then((data) => renderSamples(JSON.parse(data), outputPath))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
