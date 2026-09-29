# Admin export: optional board title on player boards

## Understanding

**Asked for:** A customer wants a title printed on every board in their PDF. For
now, support this only in the admin export, as a checkbox. The title is the
board's name. The title must match the board's existing fonts, and the cards
must shrink so everything stays inside the printable area.

**Not in scope:** the consumer boards page / `BoardActionBar` export, the
"Generate Preview Boards" admin button, deck (3"×5" caller card) pages, and the
caller sheet. Deck cards are a fixed physical size, so a title there would
change the cut size — "board PDFs" means the player boards.

**Assumptions:**

- Default is unchecked, so the admin export is byte-for-byte the same layout as
  today unless the admin opts in.
- The title is not editable in the export UI — it is `board.name` verbatim
  (trimmed). An admin who wants different text renames the board first.
- "Match the fonts" means the card-label typography: Jost, uppercase, in the
  board's `labelColor`. Jost is already loaded for the render.

**Success:** With the box checked, every player board page shows the board name
centred at the top in Jost; all 16 cards are still fully visible; nothing
comes closer to the paper edge than the current top/bottom margin
(`60 + PRINT_SAFE_MARGIN_PX` px). With the box unchecked, output is unchanged.

## Approaches

1. **Recommended — reserve a title band in the canvas layout.** Pull the 4×4
   grid maths out of `renderBoardToCanvas` into a pure function that takes an
   optional title-band height. With a title, the band comes off the available
   height and the card size is recomputed (cards stay 2:3). Title drawn on the
   same canvas with the same Jost `FontFace` already loaded. Pure → unit-testable.
2. Draw the title as vector text with jsPDF over the page image. Needs Jost
   converted to TTF and embedded in jsPDF (`addFileToVFS`); a second font
   pipeline for one line of text. Rejected.
3. Render the page as today, then scale the whole canvas down to make room.
   Shrinks the margins, gaps and badges too, and wastes resolution. Rejected.

## Design

### Layout (`lib/board-layout.ts`, new, pure)

`computeBoardLayout({ width, height, titleBandHeight })` returns
`{ cardWidth, cardHeight, offsetX, offsetY, cardSpacing, titleBand }` where
`titleBand` is `{ top, height } | null`.

- Constants reuse today's values: `padding = 60 + PRINT_SAFE_MARGIN_PX`,
  `cardSpacing = 20`, 4×4, aspect 2:3.
- `titleBandHeight = 0` reproduces the current numbers exactly
  (card 507.5×761.25, offsetY = padding).
- With a band of height `B`: available height loses `B`. The block
  (band + grid) is centred vertically, band on top, so the band starts at
  `padding` and the grid starts at `padding + B`. Grid stays horizontally
  centred.
- `BOARD_TITLE_BAND_PX = 210` (0.7"): cards go from 507.5×761 to ~472.5×709
  (−7%). Bottom margin is unchanged.

`fitBoardTitle({ text, maxWidth, maxFontPx, minFontPx, measureAtFont })`
returns `{ fontPx, text }`: shrinks the font 1px at a time from max to min
until it fits; if it still doesn't fit at min, truncates with `…` until it
does. Empty/whitespace text → `null` (no band, no title — same as unchecked).
Values: `maxFontPx = 130`, `minFontPx = 60`, `maxWidth` = grid width.

### Rendering (`lib/generate-boards.ts`)

- `renderBoardToCanvas(board, styleOptions, { title })` uses
  `computeBoardLayout`. If a fitted title exists, draws it uppercase,
  `normal <fontPx>px 'Jost', Arial, Helvetica, sans-serif`, `labelColor`,
  centred horizontally, vertically centred in the band (`textBaseline:
  'middle'`). Fonts are loaded before the title is measured (move the two
  `loadGoogleFont` calls above the drawing).
- `generateLoteriaSetPdf` gains a trailing optional arg
  `options: { boardTitle?: string } = {}` and passes the title to every board
  page. Deck pages and caller sheet ignore it. `generatePreviewBoardsPdf` is
  unchanged (passes no title).

### Admin UI (`admin-export-button.tsx`)

A labelled checkbox "Include board title" next to the board-count stepper,
disabled while exporting or when export is not possible. Uses the existing
shadcn `Checkbox` + `<label>` so label and box share one hit target. When
checked, passes `{ boardTitle: boardName }`. Tooltip-free; the label is the
help.

### Error handling

No new failure modes: title fitting is pure and total (always returns a fit or
null). A long name shrinks, then ellipsizes; it never overflows the band.

### Testing

- Unit (`__tests__/lib/board-layout.test.ts`): no-band layout equals today's
  numbers; band layout keeps top margin = padding, grid bottom ≤ height −
  padding, 2:3 aspect, grid centred horizontally; `fitBoardTitle` shrinks,
  ellipsizes, and returns null for blank.
- Component (`__tests__/components/admin-export-button.test.tsx`): checkbox
  unchecked by default; export calls `generateLoteriaSetPdf` with
  `{ boardTitle: boardName }` only when checked (mock `@/lib/generate-boards`).
- Manual: export a board with the box on and off, open the PDF, check title
  font and that no card is clipped.
