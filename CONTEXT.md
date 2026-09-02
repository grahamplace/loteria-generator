# Lotería Generator

Custom Lotería (Mexican bingo) sets built from a user's own images, printable as PDFs and playable live over the web.

## Language

### Content

**Set**:
A user's collection of up to 54 unique images from which boards and a deck are produced. The unit that is unlocked by payment.
_Avoid_: Board (the code currently names this table `boards`; that is legacy), project, collection

**Card**:
One image plus its label inside a Set.
_Avoid_: Image, tile

**Deck**:
A Set's cards as the source of Calls during play, or printed as calling cards. In a Game the Deck has no order set in advance — the order is the order the cards happen to be Called in, and what remains is whatever has not been Called yet.
_Avoid_: Calling cards, call stack

**Board**:
A 4×4 grid of 16 distinct cards drawn from one Set, held by one Player. Two Boards are the same only if they hold the same 16 cards in the same positions; the same cards in a different arrangement are different Boards.
_Avoid_: Tabla, grid, player card

### Play

**Game**:
One live session of Lotería started from an unlocked Set, reachable by a Game Code. A Game is gathering Players (**lobby**), running (**playing**), or over (**ended**); ended is final. A Set hosts at most one Game that is not ended.
_Avoid_: Room, session, match, round

**Game Code**:
The short public code a Player types to join a Game. It identifies one Game for good — an ended Game keeps its Code rather than returning it for another Game to use.
_Avoid_: Shortcode, room code, PIN

**Caller**:
The person controlling a Game who draws cards from the Deck.
_Avoid_: Host, announcer, cantor

**Player**:
Anyone who joined a Game with a Game Code and holds one Board. Membership lasts the whole Game and does not depend on being connected: a Player who closes the tab is offline, not gone, and keeps their Board.
_Avoid_: Guest, participant, attendee

**Call**:
One card drawn from the Deck during a Game. A card is called at most once per Game.
_Avoid_: Draw, pick

**Mark**:
A Player's tap on a card on their Board asserting it has been Called. The Game records every Mark without judging it — a Player may Mark a card that was never Called, and only a Claim is checked.
_Avoid_: Bean, frijol, chip, check

**Pattern**:
The shape on a Board that wins a Game (full board, a row, four corners, and so on), chosen by the Caller when the Game is created and fixed for that Game. A Pattern has one or more **instances** — "any row" is four of them — and completing any single instance wins.
_Avoid_: Mode, rule, variant

**Claim**:
A Player's "¡Lotería!" assertion that they have won. The server either verifies it into a Win or rejects it; a Claim is not a Win until it is verified.
_Avoid_: Bingo, shout, call (a Call is the Caller's, a Claim is the Player's)

**Win**:
A Claim the server has verified: every card in one instance of the Pattern is both Marked and Called.
_Avoid_: Bingo, claim (a Claim is unverified)

**Claim Window**:
The period after the first Win during which no further Calls happen and later Claims can still be verified. Every Player who wins inside it wins the Game.
_Avoid_: Grace period, overtime, tiebreak (there is no tiebreak — all winners win)
