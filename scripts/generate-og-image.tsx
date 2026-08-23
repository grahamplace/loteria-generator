/*
 * Generates the site's Open Graph share image at `public/og-image.png`.
 *
 * NOTE: the committed `public/og-image.png` is a PLACEHOLDER. It exists so the
 * social-share metadata has a real 1200x630 asset to point at instead of a 404.
 * Replace it with a proper designed asset whenever one is available — the
 * metadata plumbing (`app/[locale]/layout.tsx`) references the fixed path
 * `/og-image.png`, so dropping a new file at that path is all that is required;
 * no code changes needed.
 *
 * Regenerate with:  pnpm generate:og
 *
 * Rendering path: `next/og` (satori + resvg) run standalone under tsx. No env
 * vars, no network, no DB access.
 */

import { ImageResponse } from 'next/og';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const WIDTH = 1200;
const HEIGHT = 630;

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'og-image.png');

// Loteria brand palette (mirrors the CSS variables in app/globals.css).
const CREAM = '#f5f0e1';
const VERMILLION = '#c8362e';
const MARIGOLD = '#e4b441';
const VERDE = '#1e7572';
const BROWN = '#3d2b1f';

const TAGS = ['Weddings', 'Quinceañeras', 'Parties'];

function OgImage() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: CREAM,
        padding: 56,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          right: 24,
          bottom: 24,
          border: `6px solid ${VERMILLION}`,
          borderRadius: 24,
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 36,
          right: 36,
          bottom: 36,
          border: `2px solid ${MARIGOLD}`,
          borderRadius: 18,
          display: 'flex',
        }}
      />
      <div
        style={{
          fontSize: 40,
          color: VERDE,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 12,
          display: 'flex',
        }}
      >
        Custom Mexican Lotería
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: VERMILLION,
          lineHeight: 1,
          marginBottom: 8,
          display: 'flex',
        }}
      >
        Lotería Generator
      </div>
      <div
        style={{
          fontSize: 44,
          color: BROWN,
          fontWeight: 500,
          marginTop: 24,
          textAlign: 'center',
          maxWidth: 900,
          lineHeight: 1.2,
          display: 'flex',
        }}
      >
        Turn your photos into a custom Lotería set
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 48,
          fontSize: 28,
          color: BROWN,
        }}
      >
        {TAGS.map((tag) => (
          <div
            key={tag}
            style={{
              padding: '10px 22px',
              background: MARIGOLD,
              borderRadius: 999,
              fontWeight: 700,
              display: 'flex',
            }}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
}

async function main() {
  const response = new ImageResponse(<OgImage />, { width: WIDTH, height: HEIGHT });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(OUTPUT_PATH, buffer);
  console.log(
    `Wrote ${OUTPUT_PATH} (${WIDTH}x${HEIGHT}, ${(buffer.byteLength / 1024).toFixed(1)} KB)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
