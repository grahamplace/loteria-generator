# Survey of existing digital Lotería and join-by-code bingo games

Ticket: `.scratch/live-game/issues/06-existing-loteria-games-survey.md` (wayfinder map: `.scratch/live-game/map.md`).
Date: 2026-09-01.

Question: what do existing playable digital Lotería / online-bingo products do for the caller screen, the player board on a phone, the marking interaction, win declaration and verification, the joining flow, and late joins — and what is worth copying or avoiding?

Vocabulary follows `CONTEXT.md` (Set, Board, Game, Game Code, Caller, Player, Call, Mark, Pattern, Win). Where a product uses its own words ("room", "host", "dealer", "bean", "Bingo") they are quoted as-is.

Method: two browser products were played end-to-end in Chrome with a host tab and a player tab (direct observation, marked "observed"). Everything else comes from the product's own site, help centre, app-store listing, version history, or user reviews, cited inline. "Not documented" means no primary source stated it.

---

## Summary table

| Product | Kind | Join | Board assignment | Marking | Win check | Late join | Reconnect |
|---|---|---|---|---|---|---|---|
| PlayLoteria.online | Browser, free | 6-digit code + nickname (8 chars) | Player picks a pre-printed tabla; duplicates possible | Tap, bean sprite, honor system | Player taps ¡LOTERIA!, host sees board vs drawn cards, YES/NO | Yes | None — refresh = new player, host role lost |
| loteria.luciovilla.com | Browser, free | 5-digit room ID + name, share link | App-generated; uniqueness not documented; late joiners get an empty board | Tap toggle, bean sprite, honor system | ¡Lotería! is silent on a non-winning board; no host modal | Yes | None — refresh wipes identity and marks |
| Google Lotería Doodle | Browser, free | Invite link or random match (4 players) | App-dealt | Token | Auto-called on a timer with voice; no host role | Not documented | Not documented |
| Lotería Online (ZimbronApps) | iOS/Android, ads + IAP | Room code or link (WhatsApp), password option, login required | Player designs own boards | Tap; custom markers; optional auto-mark | Auto-detected; win must be completed by the most recent card | Not documented | Weak; "once you leave, you lose it" |
| Loteria Virtual (sm development) | iOS/Android, ads + IAP | Public rooms + private room codes | Server-dealt | Not documented | Fully automatic; users asked for a button | Not documented | None; one game per room |
| Lotería Mexicana: Baraja (R. García) | iOS/Android, ads + subs | Public 24/7 rooms; sign-in | Custom tablas | Beans/coins/chips | Winner log, tiebreaker card, pot split | Not documented | Not documented |
| myfreebingocards Virtual Bingo | Browser, free/paid | Short link (`mfbc.us/m/xxxxxxx`), per-player `/N` links | 30 cards free; unique only with per-player links or paid | Tap, honor system, Reset | No button; host types Card ID into a verifier | Trivially (link) | Deterministic per-player link |
| Bingo Maker | Browser SaaS, free tier | Session URL/QR or public directory + password + name | 1–4 cards each | Tap only on called numbers; "Click All" auto-daub | Automatic; winners appear in host's list; host picks ties | Host lock/unlock; late board syncs instantly | Not documented |
| Bingo Baker | Browser, free/paid | URL only | Player generates own card; host can lock creation | Tap, honor system; marks remembered | No button; three-colour verification view | Yes unless locked | Marks persist |
| Jackbox (jackbox.tv) | Phone controller + big screen | 4-letter code + name (12 chars), one PLAY button | n/a | n/a | n/a | After start → Audience | Cookie-based, "Reconnect" button; renaming = lockout |

---

## Browser Lotería products

### 1. PlayLoteria.online

**What it is.** Free browser app, no account, no ads, aimed at "video calls, classrooms, and workplaces". "Up to 99 people can join the same game at the same time" ([about](https://playloteria.online/about.html)). A Spanish teacher describes classroom use: students "enter your Room Code to join and they'll be prompted to pick their unique, digital lotería board" ([senorachase.com](https://senorachase.com/2025/05/07/loteria/)).

**Caller screen** (observed at `https://playloteria.online/<room>`).
- Three-step setup: deck (Classic "The original 54 Don Clemente cards" / School-friendly, which "Removes El Negrito, El Apache, and El Borracho" / Custom), then a "WHAT'S THE RULE?" pattern picker with ten visual thumbnails: Rows, Columns, Diagonals, Corners, Inside, Outside, Z, N, 2x2, Black Out.
- Room number is a large 6-digit code top-right with a share icon; the empty player tray shows "Invite players to get started…".
- Main panel: face-down deck on the left, one large current card on the right (real Don Clemente scan with its number, e.g. "38 EL APACHE"). START becomes DRAW. REVIEW opens a modal grid of every drawn card.
- The chosen pattern is pinned at the top and animates through its variants (Rows cycles which row is highlighted).
- Manual draw only. No auto-advance timer, no sound or voice, no verses.
- Player tray along the bottom: one mini 4x4 thumbnail per player with nickname, mirroring that player's marks live. Clicking a player's name kicks them ([about](https://playloteria.online/about.html)).

**Player board.** Nickname (observed cap: 8 characters, longer input truncated), then "CHOOSE YOUR BOARD": a long scrolling sheet of numbered pre-printed tablas in three columns. The player picks, so two players can hold the same board. After choosing: full 4x4 grid of large card scans with names, a left column with the current called card and the pattern indicator, and a big green "¡LOTERIA!" button under the grid. Late joiners see the current called card while still choosing a board.

**Marking.** Tap a cell: a pink bean sprite lands and the card dims. Honor system — a card that had not been called was accepted as a mark (observed).

**Win declaration and verification.** Player taps ¡LOTERIA!: the board goes grayscale with a sunburst, shows "Waiting on host…" and a "[Nevermind]" link to withdraw. The host clicks the player's icon to open "DO WE HAVE A WINNER?", which shows the claimant's board with its beans side by side with "Drawn Cards", plus YES / NO. After a win "either keep playing or restart the game from fresh" ([about](https://playloteria.online/about.html)). On NO the player returns to a normal board with no message and no penalty. No visible alert or badge appears on the host screen when a claim comes in; the host has to notice or hear the player.

**Joining.** Six numeric digits (placeholder `######`) on the home page, nickname required, no account. QR not observed.

**Late joins and reconnects.** Late join works mid-game. Reconnect is broken: when the host tab navigated away and returned to the same room URL it was treated as a new player (nickname prompt), the host role was lost, and the claiming player stayed stuck at "Waiting on host…" (observed). Nothing on the site documents reconnection.

**Feels good.** Distinct host and player screens; card names on every tile; ten-pattern picker with thumbnails; review-drawn-cards modal; verification modal with board and drawn cards side by side; "[Nevermind]" escape hatch; live mini boards double as presence list; zero-friction join.

**Feels bad.** Board picking allows duplicates and is a long scroll on a phone; no claim alert on the host; no sound; no reconnect; honor-system marks push verification onto the host's eyes.

### 2. Lotería by Lucio Villa (loteria.luciovilla.com)

**What it is.** Free browser app, donation link, no account. "Each player has a tabla(board) with a 4x4 grid. Play with up to 5 players. The dealer shuffles 54 cards and calls them out one by one… press the ¡Lotería! button and win the game" ([home](https://loteria.luciovilla.com/)). Built in about a week on Next.js, Liveblocks, Tailwind and shadcn on Vercel, with AI-generated card art ([build notes](https://www.luciovilla.com/notas/2024-building-online-multiplayer-loteria-game)). Closest stack to this project.

**Caller ("dealer") screen** (observed at `/room/<id>`). "HOST A NEW GAME" dialog: name + game type (Full Card / 4 Corners / Diagonal — three patterns). The dealer is also a player with their own board and ¡Lotería! button. Left column: card name as text ("LA ESCALERA"), current card image, Draw button. Right column: "vs N player(s)" with a mini 4x4 grid per player mirroring marks live. Options: Clear beans, Review cards (bottom drawer "DRAWN CARDS (n)"), New Game, Pass Dealer. Manual draw; no timer, voice, or verses. Glitch: the card name updates before the image loads, so the name briefly says "EL MELON" over the previous card's picture.

**Player board.** Name prompt, then a 4x4 board of AI-generated images with **no card names on the tiles**, current card at left, ¡Lotería! button below, Clear beans / Review cards. Boards are app-generated (random); uniqueness not documented. A late joiner received an **empty 4x4 board** until the dealer's next draw — dealing only happens at start (observed).

**Marking.** Tap toggles a pinto-bean sprite over a blurred, desaturated card. Honor system (an uncalled card could be marked). Marks broadcast to every mini grid in real time.

**Win declaration.** ¡Lotería! on a non-winning board did nothing visible — no error, no host alert (observed). No false-claim flow, no verification modal.

**Joining.** Five numeric digits in the URL (`/room/59622`); "Share Link" in the header; home page has a "Room ID" field + JOIN; name required, no account.

**Late joins and reconnects.** Late join allowed. Refreshing the player's tab re-prompted for a name, and the host roster replaced them with a fresh anonymous "PLAYER" holding an empty grid — identity and marks lost (observed).

**Feels good.** Dark, elegant UI; Share Link in the header; Pass Dealer; live mini boards; review drawer; a real-time stack (Liveblocks on Vercel) that works.

**Feels bad.** Five-player cap; nameless tiles are hard for non-Spanish speakers and for verification; empty board on late join; silent ¡Lotería!; refresh wipes you; dealer-is-a-player conflates roles.

### 3. Google "Celebrating Lotería!" Doodle

Free, in-browser, still hosted ([doodles.google](https://doodles.google/doodle/celebrating-loteria/)). "Play the game with friends in a private match, or match with users around the globe at random"; announcer voiced by Luisito Comunica ([Google blog](https://blog.google/company-news/inside-google/doodles/loteria/)). Choosing "play with friends" yields "a link to use to invite your friends to a private game"; random match groups "four strangers"; 16 cards "in four rows of four", marked with a token, shout "Lotería!" on a row/column/corners pattern ([Newsweek](https://www.newsweek.com/popular-google-doodle-games-loteria-mexican-card-game-multiplayer-1501949)). Caller-less: cards are auto-called on a timer with voice. Wrong-claim handling and reconnect not documented; the embedded game did not launch past its splash in testing, so no first-hand UI notes.

Takeaway: the most-played digital Lotería in existence has voice calling and auto-advance as the baseline experience; the two indie browser apps above have neither, and users notice.

---

## Mobile app-store Lotería products

### 4. Lotería Online (ZimbronApps) — feature-maximal

**Identity.** App Store "Online Mexican Lottery" ([US](https://apps.apple.com/us/app/loter%C3%ADa-online/id1500065032), [MX](https://apps.apple.com/mx/app/loter%C3%ADa-online/id1500065032)), Google Play `com.zimbronapps.loteria_online`, 1M+ downloads per [Aptoide mirror](https://loteria-online.es.aptoide.com/app). Free with ads and IAP (Remove Ads $9.99; subscriptions $0.99/wk–$24.99/yr). Site: [loteria-online.app](https://loteria-online.app/en); dev page: [zimbronapps.com](https://zimbronapps.com/aplicaciones/loteria-online/).

**Caller screen.** Online, only the room creator ("admin") deals. Review: "Only the person who created the Mesa can give out the cards, so if you join a table and the admin isn't there…you waste time finding a table" (Maribravo2, [reviews](https://apps.apple.com/us/app/loter%C3%ADa-online/id1500065032?see-all=reviews&platform=iphone)). Offline caller mode: "the app shuffles and announces cards automatically" ([site](https://loteria-online.app/en)). Downloadable voices (v8.18.0), "Doña Mari and Narrator voices" (v8.5.0), record your own voice for custom decks (v8.0.1) ([version history](https://apps.apple.com/us/app/loter%C3%ADa-online/id1500065032?see-all=version-history)). Called-cards history toggleable ([dev page](https://zimbronapps.com/aplicaciones/loteria-online/)). Adjustable auto-advance and verses: not documented.

**Player board.** 4x4 classic, 5x5 (v8.13.0) and 3x3. Players design their own boards ("Design your own boards by choosing any figures you like… Generate new combinations instantly"). Uniqueness enforcement: not documented.

**Marking.** Custom markers: beans, coins, or your own photos. "Auto-play for your tables" (v8.3.0) marks automatically. Validation is server-side: v8.20.0 "Improved the victory detection system, validating wins only with the most recent card" — a win must be completed by the last called card.

**Win.** Auto-detected. 17+ patterns: Normal, Pozo (centre four), 4 Esquinas, Tabla llena, ¡7 loco!, Jaras, Moño, Bigote, Papalote, L Loca, Rieles, Cruz, Diamante, Cuadro Chico, Laterales, ¡U Loca!, Crucita, Escalera ([dev page](https://zimbronapps.com/aplicaciones/loteria-online/)).

**Joining.** "Create a new room and share the code or link with your friends via WhatsApp or any app" ([site](https://loteria-online.app/en)); password-protected or open rooms; up to 100 players. Login required (review "no te deja iniciar sesión"). Join-flow failure is the #1 complaint: "The link that is sent does not take them directly to the room and trying to find the room is almost impossible" (efractu); "I could not get the invite link to work" (Brewgirle).

**Late joins and reconnects.** "Once you create a Mesa and leave, you lose it" (Maribravo2). "If someone gets disconnected…they won't be able to click on the past cards" (MissMission Prelim). A connected-player list was added in v8.4.2 after users asked to "see the people that are still connected and that it tells you when someone exited" (Latin24).

**Feels good.** "esta muy bien sincronizada" (PinkyLix, MX); deep customisation; chat and stickers; room-level blocking (v8.19.0).
**Feels bad.** Spanish-only UI ("Help my non Spanish speaking fam out"); admin dependency; broken invite links; "Server is bogged down keeps kicking us out" (Bworthwhile).

### 5. Loteria Virtual (sm development)

**Identity.** [App Store US](https://apps.apple.com/us/app/loteria-virtual/id1444253041) 4.3★ (336), [MX](https://apps.apple.com/mx/app/loteria-virtual/id1444253041); Google Play `com.smdev.loteria` 500K+ downloads, 4.0★ (764) per [APKCombo](https://apkcombo.com/loteria-virtual-play-online/com.smdev.loteria/). Free with ads and IAP. Spanish-only.

**Caller screen.** None — "automatic shuffling"; the server deals to everyone in the room. Voice, timer, history: not documented.

**Player board.** 54-card deck, rooms up to 30 players, "you can see your opponent's card"; themed decks. Assignment and uniqueness: not documented.

**Win.** Fully automatic. A user asked for the opposite: "Maybe you click a button to show you have won instead of the system doing it!" (CortesPau, [reviews](https://apps.apple.com/us/app/loteria-virtual/id1444253041?see-all=reviews&platform=iphone)). Patterns: full board, line, corners; per-room pattern choice was a user request ("allow to choose between full card, 4 center aka posito and straight line" — EddieU40).

**Joining.** Public rooms plus "Private room codes for friends". Format: not documented.

**Late joins and reconnects.** Weak. "after you created a room, it allowed you to play more than one game… before making you exit to create a new room and play again. My senior/tech limited parents have a hard time finding their way back in" (No more nicknames left). Requested "improved private room reconnection without re-entering codes" (Fl@is, MX). Dev's reply to a crash report: "don't close app while play.." — no resume on restart.

**Feels good.** "Love that you can create a private room"; chat; leaderboard.
**Feels bad.** One game per room, no re-entry, un-mutable lobby music, too many ads, stale (last iOS update 2024).

### 6. Lotería Mexicana: Baraja, Tabla, Online (Ricardo García González) — best-rated, caller-first

**Identity.** [App Store US](https://apps.apple.com/us/app/loteria-baraja-tabla-online/id1622830954) 4.7★ (4.2K), [MX](https://apps.apple.com/mx/app/loteria-baraja-tabla-online/id1622830954) 4.8★ (2.1K), "Destacada por Apple"; Google Play `garcia.ricardo.Loteria2022`; site [barajamexicana.com](https://barajamexicana.com/). Free with ads; subscriptions and chip packs; Apple TV version exists.

**Caller screen (its core strength).** "Canta la baraja en modo automático con velocidad ajustable o en modo manual a tu ritmo"; customisable voices; "easy to review past cards" (Gina4Jayonce). Caller pain points from [reviews](https://apps.apple.com/us/app/loteria-baraja-tabla-online/id1622830954?see-all=reviews&platform=iphone): screen sleep ("First it will dim then phone goes to sleep mode… The other Loteria App doesn't do this" — Ivan92219, dev says fixed Aug 2026); repeat-call request ("Call the card and maybe five seconds, say the name again" — satx78205, playing with a group aged 68–93); perceived shuffle bias ("needs a more honest shuffle" — Edi33).

**Player board.** Saved custom tablas usable in multiplayer; printable boards (subscription). Complaint: "No es fácil cambiar de tabla ni cambiar la forma del juego de una línea a tabla completa" (MX).

**Marking.** Beans, coins, or chips. Tap vs drag: not documented.

**Win.** Winner log, pot calculation and split; tiebreaker: "una carta final decide al ganador cuando hay empate" ([site](https://barajamexicana.com/)). Complaint: the game stops after one line win; users want play to continue to corners/centre/full (ilovetrimp).

**Joining.** "Partidas 24/7" public rooms and in-game chat (v4.3–4.4, [version history](https://apps.apple.com/us/app/loteria-baraja-tabla-online/id1622830954?see-all=version-history)); Apple/Google sign-in. Empty-room problem: "no hay personas jugando solo hay salas con 1 persona" (MX review).

**Feels good.** Pronunciation, simplicity for elders, used as a physical-table caller far more than online.
**Feels bad.** Subscription and restore-purchase issues; ads after paying; sparse online population.

### Secondary Lotería apps (one convention each)

- **Lotería Mexicana Game (Luis Maldonado)** ([App Store](https://apps.apple.com/us/app/loter%C3%ADa-mexicana-game/id1665246635), 4.5★): marking by "click sobre carta o arrastrando la ficha" (tap or drag chip); adjustable deal speed, pause, reactions; invite links. Tie rule from the dev: "gana la suerte quien marque primero la carta" — first to *mark* the winning card wins; a 1★ review complains ties always go to the other player.
- **La Loteria! (Jade Lyfe)** ([App Store](https://apps.apple.com/us/app/la-loteria/id1456692257), 2.8★): host can kick with notification, password parties, ready/standby status, "Players that join in the middle of a game will be able to play", board highlighted by closeness to winning, gloat message on win, adjustable next-card speed. Review: "I still don't know when a game will start… A timer would be nice" (Gabi344).
- **La Loteria – Mexican Bingo (Bryan Arambula)** ([App Store](https://apps.apple.com/us/app/la-loteria-mexican-bingo/id6759211287), 5.0★, 16): caller speeds Lento/Normal/Rápido, voice, "Traditional riddles displayed with every card", "Full card history"; player 4x4 tabla, "tap to mark", "hit the ¡Lotería! button to win"; patterns row/column/diagonal/full; Online Party "Create a room and share an invite code or link… Everyone hears the cards called on their own device"; Local Party uses QR.
- **Lotería Mexicana Cantada** ([App Store](https://apps.apple.com/us/app/loter%C3%ADa-mexicana-cantada/id6749649428)): caller-only, offline, interval 3.5–8 s, pause/resume — a shipped range for the auto-advance timer.

---

## Join-by-code online bingo (host screen + phone cards)

### 7. myfreebingocards.com — Virtual Bingo

**What / pricing.** Card generator with a virtual-play mode. "Totally free to run a game for up to 30 players"; paid tiers 100/250/500 cards give "31 days of access to our virtual bingo system" ([virtual-bingo](https://myfreebingocards.com/virtual-bingo)).

**Host screen.** Paid only: "Our bingo caller is not yet available for free games" ([game manager](https://myfreebingocards.com/bingo-card-generator/free/c56ttma)). "The caller picks out the next call for you to read out, and can also be used to check if a player has won." Free games get three pre-shuffled call sequences. Auto-call timer, sound, undo: not documented.

**Player card.** 5x5, "Bingo Card ID" shown at the top (e.g. "Bingo Card ID 007"). "You have been allocated a random bingo card from a set of 30 different cards… Play your bingo card online by tapping the numbers/words as they are called" ([live card](https://mfbc.us/m/c56ttma)). With the shared link "It's possible that two players will get the same bingo card"; per-player links `mfbc.us/m/<gameId>/1…/30` guarantee distinct cards.

**Marking.** Tap; honor system — the card has no knowledge of calls; player can Reset.

**Win / verification.** No Bingo button. "ask the player for their Bingo Card ID and enter it into our card verifier… you will see what that player's card **should** look like at the current call." "The system works with any winning pattern" (host eyeballs it).

**Joining.** Short link `mfbc.us/m/<7-char lowercase alphanumeric>`; no nickname, no account; paid tier emails per-player links.

**Late joins and reconnects.** Anyone with the link can join; late joiners see no prior calls. Per-player link is deterministic so re-opening yields the same card; whether marks survive a refresh is not documented.

**Feels good.** Zero-friction link; a 3-digit Card ID that can be read aloud for verification; "what the card should look like at the current call" is the right verification view.
**Feels bad.** Caller gated behind payment; honor-system marking; no Bingo button; duplicate cards on the free tier; late joiners blind to history.

### 8. Bingo Maker (bingomaker.com / app.bingomaker.com)

**What / pricing.** SaaS with a real-time "Interactive Session". Free: "one interactive session for one hour with up to 25 virtual attendees, available every 23 hours"; paid credits for "25 to 3,000 participants" ([interactive session](https://www.bingomaker.com/bingo-generator/interactive-session/)).

**Host screen.** "The current and previously generated numbers are prominently displayed at the top of the interface and automatically synchronize across the network." Auto-call: "define the precise interval in seconds between generation intervals and click 'Enable'"; manual "Generate Number"; pause. Text-to-speech with "four professional voice actors" in English/Spanish/French/Hindi, toggleable. "Open the board" pops a window to "drag… onto your secondary display, television monitor, or presentation projector" ([number generator](https://www.bingomaker.com/bingo-generator/random-number-generator/)). Undo: not documented.

**Player card.** "each receives from 1 to 4 virtual grids"; "Swipe left and right to move between boards" ([how to play](https://www.bingomaker.com/how-to-play-bingo/)).

**Marking.** "Click on the generated numbers or use the 'Click All' button to synchronize all valid squares." Only called numbers can be marked; "Click All" auto-daubs everything called so far.

**Win / verification.** No claim button: "Participants don't press a claim button… the platform validates the completed patterns automatically." Winners land in the host's Results/Validation list; host sets the number of winners and picks by board number for ties. Patterns: single line, four corners, X/T/L/frame, blackout, plus custom pattern catalogue.

**Joining.** "Share with your attendees the Page URL link or the QR Code", or find the session in the public directory and "enter the secure password along with an attendee name." "No login process for guests." Join screen shows "Game c41a (4 cards / player)" and a "Cards: 4 / 25" capacity counter ([app.bingomaker.com/play](https://app.bingomaker.com/play)).

**Late joins and reconnects.** Host can "lock/unlock network access to your live session"; the docs warn that "allowing a participant to join late after data has already been sequenced can skew the results, as their board instantly synchronizes with generated numbers and can reach completion prematurely" ([number generator](https://www.bingomaker.com/bingo-generator/random-number-generator/)). Refresh persistence: not documented.

**Feels good.** Validated marks kill false-bingo drama; interval + TTS auto-caller; projectable board window; capacity counter on the join screen; lock-joins control.
**Feels bad.** Enterprise jargon; directory + password + name is three steps instead of one code; 25-player/1-hour free cap; the late-join "instant win" hazard is pushed onto the host.

### 9. Bingo Baker (bingobaker.com)

**What / pricing.** Free card generator with "Play Online"; $24.95 lifetime membership unlocks "View Cards", lock, and name prompt ([instructions](https://bingobaker.com/instructions)).

**Host screen.** Minimal call list with Full Screen and Print ([example](https://bingobaker.com/view/8972588)); members mark items as called, which drives verification colouring. Timer, sound, undo: not documented.

**Player card.** Players open the play URL and hit "Generate Card" to "generate their own unique bingo card"; duplicate odds "1 in 15,511,210,043,330,985,984,000"; centre free-space option; multiple tabs give multiple cards ([about](https://bingobaker.com/about)).

**Marking.** Tap, honor system, but "Bingo Baker will remember which items they marked on their card" across leave/return.

**Win / verification.** No button; player "send[s] you their card URL" or the host uses "View Cards" in real time. Three-state colouring: "A solid yellow mark indicates the player correctly marked the square. A solid gray X means the player improperly marked the square (i.e. you have not called the item in that square yet). A yellow outline… indicates the square should have been marked, but was not." Pattern is free text — no picker.

**Joining.** URL only; no account. Members can require an identifier before card generation and "lock the creation of new cards" to stop players regenerating for a better card.

**Late joins and reconnects.** Unrestricted unless locked; late joiners see no history; marks persist.

**Feels good.** Persistent marks; three-state verification colours; lock-new-cards guard.
**Feels bad.** No live call feed to players; no claim button; real-time view paid; manual verification.

### 10. Bingo Blitz (mobile social bingo, secondary)

Tap-to-daub in timed rounds. "Daub Alert" "highlights the numbers on your cards that are called during the round… and will alert you that the card has a valid BINGO… but it won't actually call BINGO for you!" ([Daub Alert](https://www.bingoblitz.com/support/daub-alert/)). "The Bingo Button has been removed… click on the Green Line" through a completed line ([New Bingo Round](https://www.bingoblitz.com/support/new-bingo-round/)). Reviews complain rounds end the instant the last number is called with no daub grace, and the countdown "goes from 30 to zero within five seconds" ([PissedConsumer](https://bingo-blitz.pissedconsumer.com/review.html), [ComplaintsBoard](https://www.complaintsboard.com/bingo-blitz-b157501)). Lesson: hint, don't auto-claim; claim by tapping the completed shape; leave a grace window after the last call.

---

## Join-by-code party games

### 11. Jackbox Games (jackbox.tv)

**Room code.** Four letters; the jackbox.tv field placeholder reads "ENTER 4-LETTER CODE" ([How do I join a game](https://support.jackboxgames.com/hc/en-us/articles/15794759479959-How-do-I-join-a-game)). Codes are "just 4 randomly generated letters"; observed codes such as IOBE and HIBD show ambiguous letters are **not** excluded ([jackbox_scanner](https://github.com/kklash/jackbox_scanner)). Jackbox filters offensive words out of generated codes after bad ones appeared in 2014 ([blog](https://www.jackboxgames.com/blog/room-censored-codes)). Case-insensitive entry per community threads. Code shown in the lobby on the big screen; since Party Pack 7 the game can read it aloud; since Pack 9 the lobby shows a QR that opens jackbox.tv with the code pre-filled ([accessibility](https://support.jackboxgames.com/hc/en-us/articles/15794801592855-What-accessibility-features-are-available-in-your-games), [PP9 blog](https://www.jackboxgames.com/blog/the-ability-to-kick-players-and-other-new-features-coming-to-party-pack-9)). A public `GET ecast.jackboxgames.com/api/v2/rooms/{CODE}` endpoint validates the code before the websocket opens; it is rate-limited because scanners brute-forced it ([room finder](https://github.com/nelsonfigueroa/jackboxtv-room-finder)). The client bundle carries error strings `room not found`, `room has already ended`, `room is full`, `room is locked`, `password required`.

**Join screen** (observed 2026-09-01). "ROOM CODE" input, "NAME" input with a live remaining-character counter (12), one PLAY button, a Terms line. No account: "You will be asked for a display name on jackbox.tv when you enter your room code… your Past Games are stored via cookies" ([accounts](https://support.jackboxgames.com/hc/en-us/articles/15794759347735-Do-games-require-an-account-or-subscription-to-play)). One user per browser per device; the host needs a second device to play.

**Audience.** Same code, same form; the server decides who becomes audience: once player slots are full or the game has left the lobby, new joiners become audience (up to 10,000), voting rather than holding a seat ([PP5 streamer guide](https://www.jackboxgames.com/blog/the-jackbox-party-pack-5-streamers-guide), [player counts](https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game)).

**Phone as controller.** "Each player's phone acts as a controller, with shared information displayed on a screen everyone can see." Phone inputs are limited to three primitives (draw, pick from buttons, type text); private info goes only to the phone. Design principles: one task at a time, always know what to do next, make it obvious when the game is waiting on you ([Built In Chicago](https://www.builtinchicago.org/articles/jackbox-games-design-party-pack)). The first joiner is the VIP whose phone holds the Start button; the host can override with "Start Game From Controller Only".

**Rejoin / reconnect.** Official fix: refresh, then tap "Reconnect" when it appears. "Don't change anything about your name or try to re-enter the game. This will lead to permanent disconnection" ([survey response blog](https://www.jackboxgames.com/blog/responding-to-your-questions-from-the-jackbox-customer-survey)). Identity is cookie/localStorage-based, not name-based; the client sends `user-id` and `device-id` on connect and scopes localStorage keys per room code ([connection troubleshooting](https://support.jackboxgames.com/hc/en-us/articles/15794785923223-I-m-having-trouble-connecting-my-device-to-the-game)). If the host drops, the room pauses five minutes before being destroyed (Pack 9+).

**Late joins and caps.** Player slots lock when the VIP starts; anyone after that or over the cap "will join right into the audience" and waits for the next game. Caps are per game (mostly 3–8) and "a requirement rather than a suggestion"; host can lower them ([getting started](https://support.jackboxgames.com/hc/en-us/articles/15794771245975-How-do-I-get-started-playing-Jackbox-Games)).

**Host controls** live in the big-screen Settings menu, not on a phone: family-friendly, profanity filter, moderation (mod.jackbox.tv, per-player KICK), audience on/off, passworded game, require Twitch, start-from-controller-only, allow room-code hiding, player limits, extended/no timers, read code aloud ([streaming guide](https://www.jackboxgames.com/blog/so-you-want-to-stream-jackbox), [moderation](https://support.jackboxgames.com/hc/en-us/articles/15794773430295-How-does-Moderation-work)).

**Feels good.** Four letters is short enough to shout across a room; one form, one button, no account; QR and read-aloud fallbacks; one code for players and audience so nobody is turned away; visible Reconnect button; documented host safety checklist.
**Feels bad.** Codes unreadable from across a room; no ambiguous-letter exclusion; public room-lookup endpoint got brute-forced; "invalid code for only one user" and "can't rejoin after refresh" threads recur ([Steam thread](https://steamcommunity.com/app/331670/discussions/0/3829691612489048779/)); renaming on rejoin means lockout; seat 9 silently becomes audience; "room not found" offers no next step.

### 12. Kahoot, Wayground (Quizizz), Blooket — join-by-PIN comparison

- **Kahoot**: numeric game PIN generated when the host starts; PIN + QR + direct link; nickname or host-forced generator; optional "2-Step Join" (tap a 4-tile pattern that refreshes about every 10 s so only people who can see the host screen get in); late join allowed by default while the PIN stays on screen; host can "Lock game joining"; latecomers "may miss questions that were completed before you joined"; a rejoin prompt resumes the previous player; PIN valid up to 8 h ([join](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game), [find PIN](https://support.kahoot.com/hc/en-us/articles/360000109048-How-to-find-Kahoot-PIN), [2-step join](https://support.kahoot.com/hc/en-us/articles/35342050693789-How-to-use-the-2-step-Join-option-to-secure-your-game), [live settings](https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings)).
- **Wayground/Quizizz**: "a unique numerical code generated whenever you start a session"; expires when the session ends; late joins allowed while active ([join code](https://help.wayground.com/support/solutions/articles/158000404920-create-and-share-a-join-code)).
- **Blooket**: 7-digit Game ID + QR + link; explicit host checkbox "Allow Late Joining", on by default ([join](https://help.blooket.com/hc/en-us/articles/15985153979415-How-to-Join-a-Blooket-Game), [late joining](https://help.blooket.com/hc/en-us/articles/16179035670167-How-to-Allow-Disable-Late-Joining-for-a-Blooket-Game)).

---

## Conventions to copy

Grouped by the ticket's six areas. Each item names the product that demonstrates it. Items marked **(settled)** already match a decision in `.scratch/live-game/map.md`; the survey confirms them.

### Joining flow

1. **Two fields, one button.** Game Code + nickname with a visible character limit, one JOIN button, no account (Jackbox, PlayLoteria, Kahoot). Every app that requires login (ZimbronApps) or a directory + password (Bingo Maker) collects complaints. **(settled)**
2. **Short code, unambiguous alphabet, profanity denylist.** 4–6 characters. Letters are easier to shout across a room (Jackbox); digits are easier on a keypad (Kahoot, PlayLoteria's 6 digits). Whichever alphabet, drop I/L/O/Q/0/1 and run a denylist — Jackbox added the denylist after offensive codes shipped, and still does not exclude ambiguous glyphs. Feeds ticket 05.
3. **Show the code three ways on the Caller screen**: large text, a QR that pre-fills the code (Jackbox Pack 9, Kahoot, Bingo Maker), and a copyable deep link that lands *inside* the Game (ZimbronApps' broken links are its top 1★ theme; Lucio Villa's "Share Link" is the good version).
4. **Specific join errors with a next step.** Jackbox has `room not found` / `room is full` / `room has already ended` as raw strings; surface them as copy ("Ask the caller for the code on their screen").
5. **Capacity counter on the join and lobby screens** ("Cards: 4 / 25", Bingo Maker) — matches the settled decision to surface the true cap for small Sets. **(settled)**

### Player board on a phone

6. **4x4 grid of card images with the card name on every tile** (PlayLoteria). Lucio Villa's nameless AI tiles are noticeably harder for verification and for non-Spanish speakers. Names matter more for custom Sets, where the images are unfamiliar.
7. **Current called card pinned next to or above the grid, plus the Pattern indicator** (PlayLoteria's left column). Late or distracted players catch up without a history scroll. Matches the settled live feed. **(settled)**
8. **Server-assigned unique Boards dealt at join, including for late joiners.** Player-picked boards allow duplicates (PlayLoteria); free-tier shared links duplicate (myfreebingocards); regenerate-until-lucky needs a lock (Bingo Baker); Lucio Villa hands late joiners an empty grid. **(settled)**
9. **Device-token identity that survives refresh and restores Board, Marks, and role.** Jackbox keys the seat to a stored `user-id`, never the name, and shows a "Reconnect" button; Bingo Baker remembers marks. Both indie Lotería sites lose everything on refresh. **(settled)**
10. **Presence: who is in the Game and when someone leaves.** ZimbronApps shipped a connected-player list only after complaints; PlayLoteria's mini-board tray doubles as presence.

### Marking interaction

11. **Tap to Mark, tap again to unmark, with a physical bean sprite and a dimmed card** (PlayLoteria, Lucio Villa). Drag-a-chip is a flourish some apps offer (Luis Maldonado) but tap should be the default on a phone.
12. **Honor-system Marks with server-side counting at verification** is the pattern the settled decision picked; the survey shows both ends. Bingo Maker validates every tap (no false claims, but a late board "instantly synchronizes" and can win on arrival); Bingo Blitz's Daub Alert highlights called cells without claiming. A middle path worth considering: highlight called-and-unmarked cells on the phone as a hint, still count only called Marks. **(settled, with a hint-state option)**
13. **A "mark all called" catch-up action** (Bingo Maker "Click All") solves late-join and reconnect catch-up in one tap; pair with the Board-dealt-at-join rule so a late Board cannot be complete on arrival.

### Win declaration and verification

14. **Explicit ¡Lotería! button, then freeze the Board with "Waiting…" and a "Nevermind" escape** (PlayLoteria). Auto-detection without a button drew a direct request for a button (Loteria Virtual) and "the tie always goes to the other person" complaints (Luis Maldonado). **(settled)**
15. **Server verification, all simultaneous winners win** (settled) — but also copy ZimbronApps v8.20's rule that a Win must be completed by the most recent Call, so a player cannot sit on a finished Board and claim later. **(settled, plus recency rule)**
16. **Caller sees the claimant's Board next to the Call history with three cell states**: correctly marked, marked-but-not-called, called-but-not-marked (Bingo Baker's colours; myfreebingocards' "what the card should look like at the current call"; PlayLoteria's side-by-side modal). Even with server verification this is the screen the Caller wants to announce from.
17. **Loud claim arrival on the Caller screen**: sound plus a badge on the player's tile. PlayLoteria has no alert at all; the host must notice.
18. **Pattern picker with visual thumbnails at Game creation** (PlayLoteria's ten: Rows, Columns, Diagonals, Corners, Inside, Outside, Z, N, 2x2, Black Out). Feeds ticket 07. "Not easy to change from line to full board" is a recurring app complaint, and users want play to continue past a partial win (García) — worth a "keep playing" option after a Win.

### Caller screen

19. **Current card large, deck, one DRAW button, and a review grid of every Call** (PlayLoteria, Lucio Villa). Swap image and name atomically — Lucio Villa's name-before-image flicker is visible. **(settled)**
20. **Manual next by default, optional auto-advance with an adjustable interval and pause** (García "velocidad ajustable", Lotería Mexicana Cantada 3.5–8 s, Bingo Maker interval in seconds + Enable/Disable). **(settled)**
21. **Voice reading the card, optional verse text, and a repeat-call button.** Google's Doodle and every top-rated app call with a voice; an elderly group asked for the name to repeat after about five seconds (García reviews). Neither indie browser app has sound and both feel flat.
22. **Keep the screen awake** on the Caller device — a 1★ theme for García's app.
23. **Player tray of live mini Boards** (PlayLoteria, Lucio Villa): presence, one-away-from-winning, and a cheat glance in one strip. Matches the settled "players one away from winning" feed. **(settled)**
24. **Host controls stay on the Caller screen**: kick, lock joins, code hide, pace (Jackbox settings menu; Bingo Maker lock/unlock; Blooket "Allow Late Joining").

### Late joins

25. **Join anytime by default with a Caller "lock joins" toggle** (Kahoot, Blooket, Bingo Maker, Jade Lyfe). Late joiners get a fresh unique Board and the current Call plus history, never an empty grid or a spectator dead end. **(settled)**
26. **Room survives past one round and past a host disconnect.** "Play again" without re-entering codes was the top request for Loteria Virtual; Jackbox pauses a room five minutes when the host drops.

---

## Pitfalls to avoid

1. **Refresh = new player.** Both indie Lotería sites and most apps lose identity, Board, Marks, and even the host role on reload (PlayLoteria observed; Lucio Villa observed; Loteria Virtual "don't close app while play"). The per-device player token must restore all three.
2. **Nickname as identity.** Jackbox's documented failure: rename on rejoin and you are locked out permanently.
3. **Empty or duplicate Boards.** Late joiners with a blank grid (Lucio Villa), player-picked boards that collide (PlayLoteria), free-tier duplicates (myfreebingocards), regenerate-for-luck (Bingo Baker).
4. **Late board that wins on arrival.** Bingo Maker validates marks against history, so a late board can complete instantly; it pushes the fix onto the host. Deal fresh Boards at join and require the winning Call to be the latest one.
5. **Silent or unalerted claims.** Lucio Villa's ¡Lotería! does nothing on a non-winning Board; PlayLoteria shows the host nothing when a claim arrives. Always answer the player ("Not yet — 2 cards to go") and always interrupt the Caller.
6. **Invite links that do not land in the Game.** ZimbronApps' most common 1★ review.
7. **Host-only progress with no host grace.** ZimbronApps stalls the room when the admin leaves; Jackbox pauses five minutes instead.
8. **Ending after a partial win, and no way to switch Pattern.** García reviews.
9. **No grace window after the last Call** and countdowns that jump (Bingo Blitz).
10. **Ambiguous code glyphs, a public "is this code live?" endpoint without rate limiting, and codes without a profanity denylist** (Jackbox's three self-inflicted wounds).
11. **Screen sleep on the Caller device**, un-mutable lobby music, ads after paying, Spanish-only UI when the US family half speaks English — recurring app-store complaints. The en/es locale setup already covers the last one.
12. **Name and image updating out of step on a Call** (Lucio Villa).

---

## Open threads for other tickets

- Ticket 05 (Game Code format): letters vs digits trade-off in convention 2; Jackbox's 26^4 keyspace, PlayLoteria's 6 digits, Blooket's 7 digits.
- Ticket 07 (win patterns and verification): PlayLoteria's ten patterns and ZimbronApps' seventeen as candidate lists; the recency rule from ZimbronApps v8.20; the three-state verification view.
- Ticket 08 (player board prototype): conventions 6–14.
- Ticket 09 (caller view prototype): conventions 16–24.
- Not yet on the map: voice calling (TTS or pre-recorded per card) and a repeat-call control; a "keep playing after a Win" option.
