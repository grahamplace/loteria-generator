---
name: image-model-eval
description: Use when comparing OpenAI image models (or a prompt change) for card illustrations — speed and visual quality side by side. Triggers on "compare image models", "benchmark gpt-image-…", "is the new image model better/faster", "eval the illustration prompt", "run the image eval".
---

# Image model eval

Runs real photos through the production illustration pipeline on several image models, times each call, and builds one comparison sheet so quality can be judged by eye.

- Script: `scripts/image-eval/run.ts` (sheet builder: `scripts/image-eval/compose.ts`)
- Test photos: `scripts/image-eval/photos/` (credits + what each one stresses: `photos/SOURCES.md`)
- Extra photo sets, local only (gitignored), picked with `--set`:
  - `tricky` → `photos-tricky/`: every prod card where an admin had to add a prompt override. Built by `pnpm eval:pull-tricky` (needs `PROD_DATABASE_URL` from `.env.personal`; read-only). These are **customer photos: never commit them**. The sheet adds the corrected prod card and the override text to each row.
  - `objects` → `photos-objects/`: objects that should land on a solid color (boots, ramen) next to scenes that shouldn't (Golden Gate). Licenses unknown, so not committed.
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

# Prompt change on the hard cases: old vs new prompt, prod model only
PROD_DATABASE_URL=$(grep '^DATABASE_URL' .env.personal | cut -d= -f2-) pnpm eval:pull-tricky
pnpm eval:images --set tricky --models gpt-image-2 \
  --prompt-refs old=main,new=<prompt-branch> --concurrency 4
```

`--prompt-refs` takes `label=ref` pairs and loads `lib/illustration-prompt.ts` from each git ref, so you can compare a prompt branch against `main` without checking it out. Columns are model × prompt.

`--concurrency n` runs n photos at once. A 54-photo tricky run at 4 takes ~20 min; one photo at a time would take over an hour.

Default models live in `DEFAULT_MODELS` in `run.ts`. A full default run (5 photos × 3 models) takes ~1–2 min.

Do a one-photo run (`--photos dog`) first when trying a model for the first time: unsupported parameters show up in seconds instead of after the whole batch.

## LLM judge (`--judge`)

Adds a Claude Opus 5.5 judge on top of a two-column run (baseline vs candidate, e.g. `--prompt-refs old=main,new=<branch>`) and writes `report.pdf`: a summary page, then one page per case, regressions first.

```bash
pnpm eval:images --set tricky --models gpt-image-2 --prompt-refs old=main,new=<branch> --concurrency 4 --judge
pnpm eval:images --judge-only scripts/image-eval/runs/<run>   # re-judge, no image calls
pnpm eval:images --report scripts/image-eval/runs/<run>       # rebuild report.pdf, no API calls
```

- Needs `ANTHROPIC_API_KEY` in `.env.local` (`pnpm secrets:pull`).
- **Case notes**: `<set folder>/cases.json` maps each photo's stem to `{ "why": "…" }`, which says what that photo tests. The judge grades a pass/partial/fail "case check" against it. The tricky set's notes are seeded from the admin overrides; edit them freely (re-pulls keep them).
- **Rubric** (1–5 each): likeness (null without faces), subject fidelity, Lotería style, background rules, clean (no leaked text or frames), plus overall 1–10 and matched/missed detail notes.
- **Bias controls**: each case is judged twice with A/B swapped and the judge never learns which is baseline. A win needs both passes to agree; a split counts as a tie.
- `--baseline` / `--candidate` pick columns; defaults are the first and second.
- Cost: about $0.08 per case (two passes), ~15s per case, 4 at a time.
- The judge is weakest on face likeness. Spot-check its verdicts against your own eye before trusting totals.

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
