---
name: create-themed-landing-page
description: Add or revise an occasion-themed Lotería landing page in English and Mexican Spanish, its working builder preset, and renderer-backed sample assets. Use alongside create-etsy-listing for matching website pages or independently for website themes.
---

# Create a themed Lotería landing page

Connect a distinct occasion to a real, selectable builder preset and a useful bilingual page. Read [the implementation reference](references/implementation.md) before editing; read the relevant installed Next.js docs before Next.js work.

## Establish the theme

Locate the existing Etsy package when present. Inspect its sample manifest, reviewed source/illustration pair, and source provenance. Reuse its stable theme ID if registered. Keep related terms on the same page: Halloween and spooky describe one theme; destination wedding cities are examples within that page.

The website sells self-service creation. Its unlock price comes from `lib/constants.ts`, independently of Etsy's service price. Every theme, photo mode, repeated export, and additional set is included for free. Unlocking only raises that set's card limit. Sets below sixteen completed cards export a partial sample board and calling cards; a complete 4×4 game needs sixteen different cards. Etsy's delivery promise does not apply to the website.

Completion: one distinct page intent and an offer supported by the builder.

## Make the preset and examples deliverable

Register or reuse a lightweight preset and the associated CSS palette. Decorations stay outside the grid and within print margins. Review light/dark contrast, long titles, Spanish accents, card labels, number badges, and calling-card cut guides. Theme changes style existing images; they do not regenerate them.

Use the shared renderer for board and card examples. Keep approved source photos and illustrations in the public sample library, with their provenance in the local sample manifest. Customer photos and evaluation datasets are not a public asset library. For new generated artwork, use the imagegen skill within the user's authorization and inspect the source/illustration pairing.

Make the custom-photo offer prominent in the page and social image. Theme the surrounding page design too. Keep visible image copy about the product; record production and license information in the source package rather than adding licensing footers to product images.

Completion: the exact preset can be selected and exported in the app, and the page's examples are renders of that preset.

## Write and connect the page

Write English and Mexican Spanish content with specific photo suggestions and a practical activity for this occasion. Avoid copying the homepage and swapping its headline. Preserve clear original-photo positioning for that mode.

The catalog generates public routes, metadata, language alternates, and sitemap entries. Add relevant links from other themes and the hub. Keep the existing shared template unless the content needs a different presentation. The primary CTA opens signup with the selected theme, mode, and locale preserved. Do not automatically overwrite a returning user's existing design.

Completion: both localized URLs render useful content, correct metadata, working images, and a theme-preserving CTA.

## Verify and hand back

Run the catalog/validation checks, render the changed theme, and inspect its page at mobile and desktop sizes. Follow the CTA into the builder and verify the selected preset and mode. Export a small sample and a complete set when renderer behavior changed. Check canonical and language links, sitemap, unknown-theme handling, and keyboard access.

Save review screenshots and report the page URLs, preset ID, source manifest, checks, and deployment status. A local page or build is not a deployed page; deployment and Etsy publication are separate actions. Do not promise rankings.

Completion: the page, preset, assets, and user journey work together; remaining limitations are explicit.
