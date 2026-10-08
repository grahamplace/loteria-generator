import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { installCanvasRuntime } from './canvas-runtime';
import {
  generateLoteriaSetPdf,
  renderBoardToCanvas,
  generatePreviewBoardsPdf,
} from '@/lib/generate-boards';
import { resolveBoardStyle } from '@/lib/themes/render-style';
import type { SampleManifest } from './render-samples';

async function main() {
  await installCanvasRuntime();
  const manifest: SampleManifest = JSON.parse(
    await readFile('scripts/themes/samples/halloween.json', 'utf8')
  );
  const cards = manifest.cards.map((card) => ({
    ...card,
    illustration: resolve(card.illustration),
  }));
  const output = '.scratch/theme-verification';
  await mkdir(output, { recursive: true });
  const pageCount = async (pdf: Blob) =>
    (
      Buffer.from(await pdf.arrayBuffer())
        .toString('latin1')
        .match(/\/Type \/Page\b/g) ?? []
    ).length;
  for (const [count, expected] of [
    [1, 2],
    [4, 2],
    [15, 5],
    [16, 6],
  ]) {
    const pdf = await generateLoteriaSetPdf(
      cards.slice(0, count),
      { presetId: 'halloween' },
      undefined,
      undefined,
      2,
      { boardTitle: 'Halloween de José y María', sampleLabel: 'Muestra' }
    );
    assert.equal(await pageCount(pdf), expected, `${count} cards should produce ${expected} pages`);
    await writeFile(`${output}/${count}-cards.pdf`, Buffer.from(await pdf.arrayBuffer()));
  }
  await assert.rejects(generateLoteriaSetPdf([]), /at least one/);
  const preview = await generatePreviewBoardsPdf(
    cards.slice(0, 4),
    { presetId: 'halloween' },
    undefined,
    { boardTitle: 'Halloween de José y María', sampleLabel: 'Muestra' }
  );
  assert.equal(await pageCount(preview), 1);
  const legacy = resolveBoardStyle({
    backgroundColor: '#abcdef',
    badgeColor: '#123456',
    labelColor: '#654321',
  });
  assert.equal(legacy.backgroundColor, '#abcdef');
  assert.equal(legacy.badgeColor, '#123456');
  assert.equal(legacy.labelColor, '#654321');
  const canvas = await renderBoardToCanvas(
    cards.slice(0, 4),
    { presetId: 'halloween' },
    'Una reunión de cumpleaños muy especial para José, María y toda nuestra familia · Muestra'
  );
  assert.deepEqual([canvas.width, canvas.height], [2550, 3300]);
  const livePreview = await renderBoardToCanvas(
    cards.slice(0, 16),
    { presetId: 'halloween' },
    'Halloween de José y María',
    { scale: 0.25 }
  );
  assert.deepEqual([livePreview.width, livePreview.height], [638, 825]);
  await writeFile(
    `${output}/live-preview.png`,
    Buffer.from(livePreview.toDataURL('image/png').split(',')[1], 'base64')
  );
  await writeFile(
    `${output}/long-title.png`,
    Buffer.from(canvas.toDataURL('image/png').split(',')[1], 'base64')
  );
  console.log(
    'Renderer passed: 1/4/15-card samples, 16-card full PDF, preview, empty-set rejection, and legacy colors.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
