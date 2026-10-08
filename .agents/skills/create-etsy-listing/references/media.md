# Theme media workflow

## Photo-to-illustration examples

Read `lib/illustration-prompt.ts` for the current model and prompt. Import `renderIllustrationPrompt` or `buildIllustrationPrompt` into a temporary prompt-export step; do not copy a cached prompt from this skill. Preserve production likeness rules. Existing homepage generators process all missing inputs, so keep marketing-only samples out of their shared source folder.

Use the available image-generation skill/tool according to its authorization rules. The owner has authorized using the project’s image API key as needed for listing photos and illustrations, including generating fictional source photos instead of searching for licensed stock. This authorization applies to the requested Etsy listing work; it does not authorize unrelated generation. The built-in tool was unavailable, so the imagegen skill's bundled CLI was used with `gpt-image-2`, exported production prompts, `1024x1536`, high quality, and `--no-augment`.

Keep source photos, outputs, prompts, and a manifest together under `output/imagegen/<theme>/`. Load `.env.local` without printing it; `uv run --env-file .env.local` worked with the CLI. For stock, record photo-page URLs and licenses. For generated sources, record the prompt, model, and fictional-sample provenance. Generate a plausible source photo first, inspect it, then apply the production illustration prompt to that exact image so the comparison is authentic. Inspect stock photos before generation and each illustration afterward. Check faces, costumes, labels, extraneous text, and framing. A generated sample does not prove a previous customer order.

## Actual board/card samples

[render-samples.ts](../scripts/render-samples.ts) calls the shared sample renderer using supported application exports. The Node canvas dependency is installed with the project's development dependencies.

Provide JSON with `title`, `styles`, and at least sixteen distinct `cards`. Each card needs `id`, `label`, `number`, and a local `illustration` path. Prefer `styles: {"presetId": "halloween", "showTitle": true}` for a registered theme. Legacy manifests with `backgroundColor`, `badgeColor`, and `labelColor` remain supported.

```sh
pnpm exec tsx .agents/skills/create-etsy-listing/scripts/render-samples.ts \
  output/etsy/<theme>/manifest.json output/etsy/<theme>/rendered
```

The helper uses licensed local fonts and writes two actual 4×4 boards and individual cards. It is a sample-generation tool; fulfill customer orders through the admin builder. For a new shared preset or matching website page, use [create-themed-landing-page](../../create-themed-landing-page/SKILL.md). Keep website pricing out of Etsy artwork.

## Listing composition

Compose finished renders with readable typography and crop margins. Use a raster compositor for exact counts, labels, and instructions. A 2400×2400 RGB JPEG worked for this listing. Inspect at full size and Etsy-style thumbnail size.

Useful sequence: finished themed set, source-photo comparison, board detail, sample subjects, then reusable offer/how-to slides and real print media. To adapt the Halloween design, read `output/etsy/halloween-2026/compose.py`; it uses a separate `marketingPalette`, drawn cobwebs and bats, and the bundled Creepster/Bebas Neue fonts with their OFL license files. The dark sample frames and gold labels are rendered through existing app style options. Preserve the source illustrations when only the surrounding design needs revision. Keep theme-specific copy in that theme's package.

Validate dimensions, accented labels, quantities, lack of overlaps, and JPEG upload compatibility. Put only upload-ready files in `listing-images/` so the native file chooser can safely select its contents. Supply descriptive alt text and save the intended media order for continuation.
