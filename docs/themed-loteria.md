# Themed Lotería

The marketing hub is at `/loteria` and `/es/loteria`. Each published catalog entry generates a page in both languages, for example `/loteria/halloween` and `/es/loteria/halloween`.

## Product rules

Unlocking raises one set from 4 to 54 cards. Both tiers include all presets, illustrated or original photos, repeat exports, and additional sets. Stripe and displayed prices still use the existing constants.

A set with 1–15 completed cards exports one labeled, partial 4×4 sample and calling cards. At least 16 completed cards produces randomized boards. The existing board-count bounds and Inngest operational throttles remain. Lifetime illustration counts are retained for reporting, without an entitlement cap.

All card insertion paths use `lib/boards/add-cards.ts`: a parent-row lock and insert-select in one Neon HTTP batch transaction. The second statement checks a fresh snapshot after acquiring the lock, so concurrent photo and classic uploads share the same limit.

## Theme data and rendering

- `lib/themes/presets.ts`: small builder catalog and shared style/photo-mode types.
- `app/globals.css`: website and print palette variables, with licensed local display fonts.
- `lib/themes/content.json`: bilingual occasion content, publication flag, meaningful modification date.
- `lib/themes/samples.json`: sample/asset/Etsy references.
- `scripts/themes/samples/`: render manifests.
- `scripts/themes/provenance/`: source and generation provenance, separate from product images.

The consumer and admin appearance controls share `BoardAppearance`. The “Include board title” toggle stays visible beside the print preview, shows the current set name, and saves the choice for both previews and PDF exports. The same canvas functions render print previews, PDF pages, and marketing samples. Legacy boards retain their saved colors unless a preset is selected. Changing photo mode affects future uploads; existing cards keep their original preservation setting.

Original photos use the authenticated image/crop pipeline. Labels start with the filename, are editable, and require no AI event. Crop controls operate on natural image coordinates.

## Acquisition

Theme CTAs carry a validated theme ID, mode and URL locale through both auth pages and `/start`. New or untouched starter boards are configured automatically. Existing work requires an explicit new-set or apply-theme action. Public marketing pages do not redirect signed-in visitors or override their URL language.

Events include `theme_page_viewed`, `theme_cta_clicked`, `theme_set_started`, uploads, card-limit prompts, checkout/purchase and exports. Theme and locale are attached; Stripe metadata carries attribution through the webhook.

## Workflow

Use [create-themed-landing-page](../.agents/skills/create-themed-landing-page/SKILL.md). The [Etsy companion](../.agents/skills/create-etsy-listing/SKILL.md) shares preset IDs and manifests but keeps its service pricing and 24-hour delivery promise separate.

Render a theme:

```sh
pnpm exec tsx scripts/themes/prepare-assets.ts --theme halloween
pnpm exec tsx scripts/themes/verify-renderer.ts
```

Focused browser verification provisions and deletes an isolated Neon branch:

```sh
pnpm test:e2e e2e/themed-loteria.spec.ts
```

## Migration and release

Migration 0012 adds `photo_mode` with a non-null `illustrated` default, preserving existing boards' behavior. It was applied to the owner-confirmed dev database and tested repeatedly on isolated E2E branches. Production deployment has not been performed.

After deployment, verify the live canonical/language pairs, sitemap, assets, auth callbacks, samples and full exports. Submit or inspect the sitemap in Search Console, then compare occasion queries/clicks with themed funnel conversions. Search rankings and indexing are outcomes to measure, not promises.

## Local verification (2026-10-07)

- 749 unit/API/component tests passed after integration with the latest image-format upload support; 19 existing tests skipped.
- The full 28-test browser suite passed. After expanding coverage, the focused theme suite passed all 7 tests, including mixed concurrent uploads, keyboard preset selection, crop persistence, repeated free exports, protected existing work and Spanish email signup. Each run used a disposable database branch, and all branches were deleted.
- Google signup/sign-in callback tests cover theme, mode, locale and unsafe redirect rejection. An actual Google account login was not performed.
- All 42 routes were checked against a production server for server-rendered content, self-canonicals, reciprocal language alternates and breadcrumbs. Unknown themes returned 404. Mobile (390px), desktop (1440px) and wide (2560px) layouts had no horizontal overflow; the keyboard skip link worked.
- The final consumer title checks passed in English and Spanish, including visibility, persistence after refresh, and actual PDF downloads with titles enabled and disabled. The final focused browser run passed all 4 tests, including mixed concurrent uploads and original-photo preservation.
- Actual canvas/PDF checks passed for 1, 4, 15 and 16 cards, legacy colors, preview output, accented titles and print margins. All 21 sample boards and comparison pairs were visually inspected. The Etsy helper rendered Halloween successfully through the shared module.
- Changed-file lint has no errors. App type checking and production build pass with two pre-existing untracked experiments (`play-a-game.tmp.ts`, `scripts/pricing-experiment.ts`) excluded temporarily and restored unchanged. Normal repository-wide type checking still reports those experiments' existing errors. Local production checks supplied a process-only auth secret because `.env.local` does not define one.
- Both skill packages pass the skill validator.

Review screenshots and PDFs are in `.scratch/theme-work/` and `.scratch/theme-verification/`. Deployment and Search Console checks remain pending.
