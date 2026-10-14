# CustomLoteria shop reference

Observed in the signed-in Etsy editor on October 7, 2026. Recheck live settings before relying on this snapshot.

| Fact           | Source listing                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shop           | [CustomLoteria](https://www.etsy.com/shop/CustomLoteria)                                                            |
| Base listing   | [4503479801](https://www.etsy.com/your/shops/me/listing-editor/edit/4503479801#media)                               |
| Price          | USD 35.00; separate from the app's self-service price                                                               |
| Offer          | 54 illustrated cards, 50 unique tabla boards, print-ready PDFs                                                      |
| Intake         | A handful up to 54 photos; seller sends instructions after checkout; Google Drive/email; optional Photos link field |
| Delivery       | Digital, made to order; no physical shipping                                                                        |
| Turnaround     | Owner confirmed **within 24 hours after receiving photos**; saved in both shop buyer messages                       |
| AI setting     | With an AI generator                                                                                                |
| Base category  | Digital artwork/print category, rather than Bingo                                                                   |
| Base renewal   | Automatic; displayed renewal fee USD 0.20                                                                           |
| Base inventory | 981 at inspection; inherited into the first Halloween draft                                                         |

## Buyer messages and turnaround

Both shop buyer messages initially promised 3–5 business days, conflicting with the base description's 24 hours. The owner explicitly requested the correction. Both were updated and saved on October 7, 2026 to promise **within 24 hours after I receive your photos**. The digital note was also rewritten to remove escaped-apostrophe wording and avoid claiming the seller had already sent a message.

Edit these in **Shop Manager → Settings → Info & Appearance** ([settings page](https://www.etsy.com/your/shops/me)). **Message to Buyers** appears on receipt pages and purchase emails; **Message to Buyers for Digital Items** appears on digital-order Downloads pages and applies to all digital listings. The listing editor only exposes a read-only disclosure. Save with **Save Changes** and verify Etsy's success confirmation.

Saved digital-buyer note:

> Thanks for your order! Your custom Lotería set is made to order, so there is no instant download. Please check Etsy Messages for instructions to share your photos. You will receive your finished, print-ready PDF files within 24 hours after I receive your photos. Questions? Send me an Etsy message anytime.

## Original media order

Eight images and one video were copied:

1. Generic cover: source photos above four illustrated cards.
2. Full example tabla on a dark background.
3. “What you get” information slide.
4. “How it works” information slide.
5. “Every card, custom illustrated” card gallery.
6. Birthday child card close-up.
7. Wedding couple card close-up.
8. Real photo of printed boards.

The video shows printed boards. Information slides and the real print photo are useful reuse candidates; inspect claims at readable size before keeping them.

## Browser observations

- The in-app browser was signed out. Native Chrome had the authenticated Etsy shop open.
- The Chrome browser connector failed in this session; native accessibility controls worked. This is a fallback observation, not a permanent tool restriction.
- **Copy** opened an unsaved form in a new tab; **Save as draft** creates the durable record.
- The initial Draft count remained stale after a success notice. Wait until navigation reaches the listings page before refreshing; refreshing the copy editor too early can reload the source form even though the save completed. Refresh the listings page and locate the existing draft before making another copy.
- Tags accepted a comma-separated batch through **Add tag** and **Add**. Verify all thirteen individual tags afterward.
- The category picker exposed Bingo. A first keyboard selection left the input blank; choosing it again completed it. Verify the field, not just the “Category changed” announcement.
- Changing category reset Digital to Physical and cleared the AI radio. Both needed explicit restoration. The made-to-order checkbox remained checked afterward.
- Accessibility snapshots sometimes lagged visible state. Use a screenshot or full refreshed tree if a field is missing or contradictory.
- Another Chrome window becoming active interrupts native control. Re-identify Etsy through Chrome's Window menu; do not act on stale indices or an unrelated page.
- The native file picker uploaded the four selected JPEGs in reverse filename order. Check actual thumbnails and explicitly reorder afterward.
- Clicking a photo opens its media detail dialog, where **Alt text** is available. The small pencil opens brightness/crop editing instead. Apply alt text, then use **Done** to return.
- Native dragging did not reorder reliably in this run. Keyboard sorting worked: return from the photo's detail dialog, Shift+Tab from its focused image button to the outer sortable, Space to pick up, arrow keys to move, Space to drop. Observe state after pickup and each move. A video occupies the second gallery position; dropping a photo over the video did nothing, so move past it to a photo slot. Verify the resulting thumbnails.
- **Adjust thumbnails** previews square, portrait, and landscape crops. Save the draft after changing media, then reopen and check the order persisted.

## Current guidance

Primary sources to recheck rules, not guarantees of ranking:

- [Etsy title guidance](https://www.etsy.com/seller-handbook/article/1399426136697): clear, scannable titles; essential traits first; avoid repetition.
- [Keywords 101](https://www.etsy.com/seller-handbook/article/382774281517): thirteen varied phrase tags, twenty characters maximum each; descriptions, attributes, and category also contribute.
- [Image requirements](https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop): resolution, image quality, and thumbnail cropping.
- [Creativity standards](https://www.etsy.com/legal/creativity/): AI disclosure and finished customized examples.
- [Pexels license](https://www.pexels.com/license/): marketing use and modification allowed subject to restrictions, including no implied endorsement.

## Worked example

The October 2026 Halloween package is `output/etsy/halloween-2026/` from the repository root. Sources and prompts are in `output/imagegen/etsy-halloween/`. These local outputs are separate from the discoverable skill and may not be committed. Read `listing.md` in the package for state, files, copy, and remaining work.

[Halloween draft 4590829386](https://www.etsy.com/your/shops/me/listing-editor/edit/4590829386#media) was saved and reopened successfully. It includes four new images with alt text, the original eight photos and video, thirteen tags, Bingo category, Halloween attribute, the $35 offer, and the confirmed 24-hour promise. It was initially saved as a draft; it was observed active during the later ten-variant batch. Recheck live status. Both shop buyer messages were subsequently corrected and saved at the owner's request.

The owner asked for the surrounding product-image design to carry the theme too. The Halloween revision uses dark purple backgrounds, cobweb borders, orange/cream display type, and dark game frames with gold labels. The four earlier cream seasonal images were replaced; their local copies are archived. Use the worked example's current `compose.py` and `manifest.json` for the revised design, rather than its historical screenshots.

## Ten-variant batch

The ordered October 2026 batch is `output/etsy/variants-2026/`: Christmas, Birthday, Family Reunion, Quinceañera, Wedding, Baby Shower, Bridal Shower, Bachelorette, Friendsgiving, and Graduation. All ten were saved, reopened, and observed together under **Draft 10**. `index.md` has the verified links; each theme folder has final copy, tags, source manifest, media and alt text, four upload images, crop reviews, and an Etsy screenshot.

The first draft was copied from the original listing. Later drafts reused its verified Bingo/digital/made-to-order settings, with all four themed images, title, description, tags, holiday, and occasion replaced. Do not accidentally carry Christmas into another season. Reuse the existing licensed sample library when it fits; record any new generation separately.

## Generated samples and original-photo orders

The owner subsequently authorized using the project image API key as needed for these listing projects, including generated fictional source photos. The second batch lives in `output/etsy/variants-2-2026/`; source photos, production-prompt illustrations, prompts, and provenance are in `output/imagegen/etsy-variants-2/`. All ten additional drafts were saved and reopened: Classroom, Wedding Anniversary, Soccer Team, New Year’s, 50th Birthday, Destination Wedding, Cinco de Mayo, Original Photos, Hanukkah, and Easter. `index.md` records their verified links. Recheck live status before revising them.

The earlier Bachelorette, Friendsgiving, and Graduation drafts were also refreshed with generated occasion-specific samples and reopened successfully. Their original IDs remain unchanged. `output/etsy/variants-2026/generated-example-refresh.json` records the refresh state. The final Etsy listing screen showed **Draft 20**.

For original-photo orders, the admin-only `skipIllustration` option returns the original uploaded image as the card face; `skipLabeling` preserves a provided label. The sample renderer can use the source photo path directly. Use separate photo-only marketing images and remove inherited illustrated photos/video and promises. Generated sample-photo provenance belongs in the description and local records, while the creation setting describes the finished customer product.

## Twelve additional occasions

The third batch is `output/etsy/variants-3-2026/`: Office Party, Retirement, First Birthday, Baptism, Class Reunion, Love Story, Mother’s Day, Father’s Day, Pets, Día de Muertos, Galentine’s, and Family Vacation. All twelve were saved and reopened as drafts; the final listings screen showed **Draft 32** with all twelve new IDs present. `index.md` has verified links, `covers-overview.jpg` previews the designs, and each theme folder includes its saved Etsy screenshot. Source photos, illustrations, exact prompts, and provenance are in `output/imagegen/etsy-variants-3/`.

In the observed Bingo category, Holiday lacked Mother’s Day, Father’s Day, and Día de Muertos; Occasion also lacked Mother’s Day and Father’s Day. Leave unsupported attributes blank and use accurate titles, descriptions, and tags. Recheck the available options in future sessions.

For examples spanning a person’s life, reference-image edits can preserve identity across ages. Inspect whether the apparent age supports the label; use a broader truthful label when it does not. Export current production illustration prompts for new samples instead of silently reusing an older batch’s prompt snapshot.
