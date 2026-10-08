---
name: create-etsy-listing
description: Create themed Etsy listings for this project's CustomLoteria shop by adapting the custom-photo offer, reusing media, producing seasonal examples, and saving a verified draft. Use for new occasion or seasonal listings and revisions to those drafts.
---

# Create a themed Etsy listing

Turn a theme into a complete, reviewable listing while preserving the custom-photo service. The shop is **CustomLoteria**. The usual source is [listing 4503479801](https://www.etsy.com/your/shops/me/listing-editor/edit/4503479801#media). Read [the shop reference](references/shop.md) for observed settings and known inconsistencies; verify mutable facts in the live editor.

## Establish the offer

Inspect the source through the user's authenticated browser. Record its price, deliverables, turnaround, digital/made-to-order setting, personalization, category, tags, media, AI disclosure, and renewal setting. Resolve contradictions before making a new promise. The Etsy service price comes from Etsy, independently of the website's self-service unlock price.

Choose one buyer intent appropriate to the theme. Write a concise title, natural opening description, and thirteen varied tags of at most twenty characters each. Use the narrowest relevant category and truthful attributes. Check [Etsy's current guidance](references/shop.md#current-guidance) when rules or UI limits matter; distinguish keyword hypotheses from measured search demand.

Treat the owner's examples of possible buyers as context, not required customer-facing positioning. Keep themed copy and tags broadly relevant unless the owner asks to target a specific audience. For Halloween, the classroom example did not mean adding “classroom orders” language or school-specific tags.

Keep the product explicit: customers send photos after purchase and receive finished printable files. A seasonal example does not establish a ready-made deck, instant download, physical shipment, new fulfillment service, or additional entitlement. Describe AI-assisted illustration accurately. Use the agreed turnaround consistently across copy, images, and any applicable buyer note.

For a photo-only offer, verify original-photo support, keep source photos as card faces, and describe cropping/layout rather than illustration. Replace inherited illustrated samples and claims. Set the AI field to match the finished product; disclose generated marketing examples in the description when used.

Completion: a concrete offer with no invented specifications or concealed delivery contradictions.

## Build the media

Inspect inherited media at readable size. Reuse information slides and authentic print photos whose claims remain correct. Make the first image clearly show a finished themed example and the item being sold. Support it with a source-photo comparison and a readable board or card close-up.

Every primary listing image must prominently say **CUSTOM LOTERÍA** and make clear that the game uses the buyer's own photos. Keep “CUSTOM” in the main headline, readable at Etsy search-thumbnail size and within the thumbnail crops; a small subtitle, listing title, or personalization badge is insufficient. Check this in Etsy's thumbnail preview before saving.

Carry the theme through the surrounding image design: background, borders, typography, and text colors as well as the sample subjects. Use a supplied reference to guide the atmosphere. Keep depicted game styling within what the renderer can deliver; decorative marketing artwork belongs outside the product sample. Inspect the composition as a thumbnail so the theme and custom-photo offer both remain clear.

Keep visible image copy focused on the product, personalization, and ordering information that helps buyers. Do not add production or licensing footers such as “AI-assisted illustration” or “licensed sample photo shown.” Keep source and license records in the local package, and place applicable AI disclosures in the listing description and Etsy settings.

For new illustrations, read [the media workflow](references/media.md). Keep generation, sample rendering, and marketing assets separate from production app changes. Record source licenses, generation prompts/model, and final files. Customer photos and eval sets are not a marketing asset library; use licensed samples, generated fictional source photos, or photos the user has authorized for public marketing.

Completion: inspect every final image at full and thumbnail sizes. Verify labels, quantities, no text collisions, crop safety, and that the sample represents a deliverable the software can produce.

## Populate Etsy

Use **Copy** on the source listing, then work only in the new copy/draft. If continuing earlier work, locate the existing draft before copying again. Update the title, description, tags, attributes, and media. Preserve the commercial offer unless the user requested a change.

Changing category can reset item type and AI disclosure. Explicitly verify **Digital**, **This digital item is made to order**, and the appropriate creation setting afterward: **With an AI generator** for illustrated orders, **Created by me** for original-photo layouts made without AI-generated card art. Confirm shipping fields are absent and personalization still fits the photo intake workflow.

A copied buyer note may be shop-wide. Inspect its editing scope before changing it. If its text conflicts with the offer and a shop-wide change is outside the request, report the exact conflict and prepare corrected text; do not claim the note has been fixed.

Save as draft when the request is to prepare a listing or develop this process. Publishing is a separate final action when the user requests it and any displayed fee is authorized. Do preparation and preview first. Avoid altering the source listing, messaging customers, or changing shop-wide policies as incidental cleanup.

Completion: Etsy visibly shows the saved draft with its own listing ID. Reopen it and verify title, tags, price, delivery type, AI setting, main image, media order, and thumbnail. A filled form or success toast alone is insufficient if the saved record cannot be located.

## Pair with a website theme

When matching website work is requested, use [create-themed-landing-page](../create-themed-landing-page/SKILL.md). Share the stable preset ID and sample manifest so the advertised frame can be rendered in both the consumer and admin builders. Use supported renderer exports through this skill's sample helper. Keep website pricing and card-limit rules separate from Etsy's made-to-order service; neither workflow implicitly publishes the other.

## Leave reusable results

Save a theme package under `output/etsy/<theme>/`: final copy and tags, source/draft URLs, media order and alt text, source manifest, final images, preview, and remaining decisions. Link useful worked examples from the shop reference. Save a screenshot showing the actual Etsy state and display it with the result.

Report whether the result is **local only**, **saved draft**, or **published**. Include the skill path, listing link, preview, and concrete limitations. Do not promise SEO gains. Update this skill only with decisions or pitfalls demonstrated by the work.
