---
name: generate-example-image
description: Use when the user wants to add, replace, or refresh one of the homepage example illustrations (e.g. "swap the rings card for X", "replace las velitas with a christmas tree", "regenerate the cat photo"). Walks through fetching a copyright-free source photo, running it through the production AI pipeline, converting the output to webp, and wiring it into the hero card data.
---

# Generate a homepage example illustration

End-to-end runbook for the cards that show up in the marquee, hero fan, occasion stage, and final-CTA fan.

The pipeline maps **one source JPG → one Lotería-style illustration**. Source photos live in `scripts/example-images/source-photos/NN-name.jpg`. The deployed webps live in `lib/hero-cards-illustrations/NN-name.webp` and are surfaced through `lib/hero-cards.ts`.

## When to use this skill

- User asks to add, replace, or refresh a homepage example illustration.
- User describes a new subject and wants it to appear on the marquee/fan/board stack.
- Existing illustration is off-brand or low quality and needs regeneration.

## Prerequisites (one-time)

- `OPENAI_API_KEY` in `.env.local` — `pnpm secrets:pull` populates it from Vercel.
- `cwebp` available on PATH (`brew install webp`). Used for PNG→WebP. ImageMagick (`magick`) and macOS `sips` also work.

## Workflow

### 1. Identify the slot

Check `lib/hero-cards.ts` to see the existing cards and their numeric IDs. Each card has:

- `id` (kebab-case Spanish, e.g. `la-pelota`)
- `number` (zero-padded display number, e.g. `'16'`)
- `label` (Spanish label rendered on the card)
- `image` (static import from `lib/hero-cards-illustrations/`)

**Replacing**: keep the existing slot number/filename so consumers don't need to change. **Adding**: pick the next available number and a kebab-case id.

### 2. Find a copyright-free source photo

**Allowed sources** (matches existing MANIFEST):

- [Unsplash](https://unsplash.com) ([Unsplash License](https://unsplash.com/license))
- [Pexels](https://www.pexels.com) ([Pexels License](https://www.pexels.com/license/))

Both allow commercial use without attribution. Search there first; do not pull from sites with ambiguous licenses.

**What makes a good source photo**:

- Single hero subject, simple/clean background
- No visible text, watermarks, brand logos, or barcodes
- Real photograph (not vector art, not 3D render, not AI-generated)
- 1200px+ on the long edge (the AI re-renders at 1024×1536, so quality matters)
- Subject is well-lit and clearly readable from a distance

Each photo is independently audited before commit — see "Reviewer notes" in `scripts/example-images/MANIFEST.md` for the kind of issue to call out (e.g. B&W input, modern panel design, multi-object compositions).

### 3. Download into `source-photos/`

Use the photo's direct CDN URL. For Pexels: `https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1600`. For Unsplash: `https://images.unsplash.com/photo-<id>?w=1600&auto=format&fit=crop&q=80`.

```bash
curl -sSL -A "Mozilla/5.0" \
  -o scripts/example-images/source-photos/16-la-pelota.jpg \
  'https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1600'
```

Then add the same `filename|url` line to `scripts/example-images/download-source-photos.sh` and a row to `scripts/example-images/MANIFEST.md` so the photo can be re-fetched and is properly attributed.

### 4. Generate the illustration

The script is **idempotent** — it skips any source that already has a matching PNG output. To regenerate a single card, **delete its PNG first**:

```bash
rm -f scripts/example-images/illustrations/16-la-pelota.png
pnpm generate:examples
```

This calls OpenAI's `gpt-image-1.5` with the production `ILLUSTRATION_PROMPT` (from `lib/illustration-prompt.ts`) and writes:

- `scripts/example-images/illustrations/16-la-pelota.png` (1024×1536)
- updates `scripts/example-images/illustrations/manifest.json` with the auto-generated Spanish label

Inspect the PNG before continuing. If it's off (wrong palette, leaked text, bad framing), delete and regenerate. The model is non-deterministic; sometimes a second pass yields a cleaner result.

### 5. Convert PNG → WebP at 600×900

The deployed assets are 600×900 webps so the marquee stays fast. Use `cwebp` with explicit resize:

```bash
cwebp -q 85 -resize 600 900 \
  scripts/example-images/illustrations/16-la-pelota.png \
  -o lib/hero-cards-illustrations/16-la-pelota.webp
```

Alternative using ImageMagick:

```bash
magick scripts/example-images/illustrations/16-la-pelota.png \
  -resize 600x900 -quality 85 \
  lib/hero-cards-illustrations/16-la-pelota.webp
```

Verify the output: `file lib/hero-cards-illustrations/16-la-pelota.webp` should report `600x900`.

### 6. Wire into `lib/hero-cards.ts`

For a **replacement**, the static import already points at the right filename (since you reused the slot) — no code change needed. Verify the `label` field still matches the new subject; update if the AI label differs (manifest.json shows what the model picked).

For a **new card**, add an import + an entry:

```ts
import laPelota from './hero-cards-illustrations/16-la-pelota.webp';

// inside heroCards array:
{ id: 'la-pelota', number: '16', label: 'La Pelota', image: laPelota },
```

If the new card replaces one referenced elsewhere (occasions, hero fan, final-CTA fan, step 01 photo fan), update those references too. Common touch points:

- `components/landing-hero.tsx` — `fannedCardIds`, `fannedPhotos`, source-photo imports
- `app/page.tsx` — `occasions` (front/back), `finalCtaCards`, `stepOnePhotos`, source-photo imports

### 7. Verify

```bash
pnpm typecheck
pnpm test
pnpm dev:next
```

Open the homepage and visually confirm the marquee, hero fan, board stack, and any occasion the new card touches all render the new illustration.

### 8. Commit

Group everything in one commit so source, output, and wiring stay in sync:

```bash
git add scripts/example-images/source-photos/16-la-pelota.jpg \
        scripts/example-images/download-source-photos.sh \
        scripts/example-images/MANIFEST.md \
        scripts/example-images/illustrations/16-la-pelota.png \
        scripts/example-images/illustrations/manifest.json \
        lib/hero-cards-illustrations/16-la-pelota.webp \
        lib/hero-cards.ts
git commit -m "Replace La Pelota example with child juggling a soccer ball"
```

## Common pitfalls

- **PNG didn't update** — the script is idempotent. Delete the existing PNG before re-running.
- **WebP looks pixelated** — make sure you're resizing from the 1024×1536 source, not chaining downscales. Quality below 80 visibly degrades the line work.
- **Spanish label changed unexpectedly** — `manifest.json` records what the model picked. The deployed `label` in `hero-cards.ts` is hand-chosen; you do **not** have to follow the AI label, especially when replacing a card whose label users may already recognize.
- **Source photo has watermark/logo creeping into the illustration** — re-source. The AI faithfully preserves visible text more often than not.
- **OpenAI rate limits** — generation runs sequentially in `generate-illustrations.ts`. Don't parallelize without raising image-edit rate limits first.

## Reference files

- `scripts/example-images/generate-illustrations.ts` — the pipeline itself
- `scripts/example-images/download-source-photos.sh` — canonical curl invocations
- `scripts/example-images/MANIFEST.md` — attribution + reviewer notes
- `lib/illustration-prompt.ts` — the production restyle prompt
- `lib/hero-cards.ts` — what the marketing page actually renders
