# Implementation map

- `lib/themes/presets.ts`: lightweight preset IDs, localized names, font/frame choice, shared board-style type. Website palette values live in `app/globals.css`; the canvas resolver and Node adapter read those tokens.
- `lib/themes/content.json`: occasion-specific English and Mexican Spanish content and an explicit published flag. `catalog.ts` validates preset references and provides route helpers.
- `app/[locale]/(marketing)/loteria/`: server-rendered hub and theme pages. English `/loteria/<id>` pairs with Spanish `/es/loteria/<id>`; stable slugs are shared across languages.
- `lib/themes/samples.json`: catalog references to each sample manifest, optimized asset URLs, and the matching Etsy ID. Add the new theme here before rendering.
- `scripts/themes/samples/<id>.json`: title, preset-backed styles, at least sixteen distinct cards, comparison card ID, source package, and Etsy listing reference. Card image paths point to committed assets. The original photo is `public/themes/<id>/photo.webp`.
- `scripts/themes/prepare-assets.ts --theme <id>` renders the preset, selected comparison card, boards, and both localized social images. Run with `pnpm exec tsx`. Its `--import-etsy` option is for the original batch import, not the normal new-theme workflow.
- `scripts/themes/render-samples.ts`: supported sample-rendering entry point shared with Etsy. It calls exported production drawing functions; do not copy or rewrite renderer source.
- `components/board-appearance.tsx`: shared admin/consumer controls and exact canvas preview. Presets and original-photo mode persist on the board.
- `lib/theme-entry.ts`, `components/theme-entry.tsx`, and `/start`: validated theme/mode selection and protection of existing work through authentication.

## New theme sequence

Add the preset and CSS tokens, then the bilingual content record and approved source assets. Create the sample manifest with local public paths and retain source/license or generated-sample provenance under `scripts/themes/provenance/`. Add the corresponding sample registry record in `lib/themes/samples.json`. Render with `--theme <id>`, inspect the output, then verify both page URLs and the CTA flow.

The source-photo comparison must use the exact photo used to make its matching card. Original-photo examples keep the photo as the card face. A marketing theme is not a ready-made deck entitlement.

New fonts must include their distribution license under `public/fonts/themes/` and be added to the local print-font loader. Review glyph coverage before using them in Spanish titles. Do not change the production illustration prompt to create a decorative frame.
