---
name: image-model-eval
description: Use when comparing OpenAI image models (or a prompt change) for card illustrations — speed and visual quality side by side. Triggers on "compare image models", "benchmark gpt-image-…", "is the new image model better/faster", "eval the illustration prompt", "run the image eval".
---

# Image model eval

Runs real photos through the production illustration pipeline on several image models, times each call, and builds one comparison sheet so quality can be judged by eye.

- Script: `scripts/image-eval/run.ts` (sheet builder: `scripts/image-eval/compose.ts`)
- Test photos: `scripts/image-eval/photos/` (credits + what each one stresses: `photos/SOURCES.md`)
- Output (gitignored): `scripts/image-eval/runs/<UTC timestamp>/`

## Prerequisites

- `OPENAI_API_KEY` in `.env.local` (`pnpm secrets:pull`).
- Model names must exist on the key. List them:

  ```bash
  pnpm tsx --env-file=.env.local -e "import OpenAI from 'openai'; (async () => { for await (const m of new OpenAI().models.list()) if (/image/.test(m.id)) console.log(m.id) })()"
  ```

## Run

```bash
pnpm eval:images                                   # default models
pnpm eval:images --models gpt-image-2,gpt-image-2.5-flare
pnpm eval:images --photos dog,hockey               # substring match on filenames
pnpm eval:images --compose scripts/image-eval/runs/<run>   # rebuild sheet only, no API calls
```

Default models live in `DEFAULT_MODELS` in `run.ts`. A full default run (5 photos × 3 models) takes ~1–2 min.

Do a one-photo run (`--photos dog`) first when trying a model for the first time: unsupported parameters show up in seconds instead of after the whole batch.

## What it does (so results are comparable)

- Same pipeline as production: `normalizeImageForOpenAI` → `images.edit` at `1024x1536` with `renderIllustrationPrompt`.
- **Identical prompt per photo across models**: each photo gets a fixed background color (cycled from `BACKGROUND_COLORS`) instead of production's random pick.
- **One generation per model per photo, no repeats**: image calls are slow and costly. Don't add repeat runs for steadier timings.
- Models run concurrently on each photo, so they share network conditions. Photos go one after another.
- Timing = wall-clock seconds of that single `images.edit` call.
- A failed call is recorded and shown in the sheet with its error. It never stops the run.

## Read the results

Open `comparison.pdf` (one page per section) or `comparison.jpg` (everything in one tall image):

1. **Summary**: per model, photos / errors / average / fastest / slowest seconds.
2. **One row per photo**: original + each model's output, captioned with its generation time in seconds.

`results.json` has every call; the PNGs are full resolution for zooming in.

When reporting back, lead with the speed table, then judge each photo on: likeness/subject fidelity, Lotería style, no leaked text (the hockey photo has ad boards), handling of many small faces (family) or objects (Thanksgiving).

## Changing the test set

Add or replace photos in `scripts/image-eval/photos/` with a `NN-name.jpg` filename and a row in `SOURCES.md`. Use real photographs only (converting photos is what the app does), from Pexels or Unsplash (see the `generate-example-image` skill for the license rules and download URL format).

## After choosing a model

Production model is `ILLUSTRATION_MODEL` in `lib/illustration-prompt.ts` (used by both Inngest illustration jobs and the example-image scripts). It is `gpt-image-2`. The `gpt-image-2.5-*` models are eval-only: don't switch prod or dev to them unless the user decides to.
