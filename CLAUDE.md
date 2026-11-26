# Beast Academy practice app: handbook for continuing work

This file is read automatically by Claude Code at the start of every session in this folder. It holds
everything needed to keep evolving the app and to add new chapters the same way earlier ones were added.
Keep it up to date when something important changes.

## 1. What the app is

A kid-friendly practice app for Beast Academy (Levels 4 and 5), used on an iPad (and sometimes a PC).

- **Live:** https://ba.aurafinapp.com, protected by a family PIN.
- **Repo:** `aravindannet/BAplanning` on GitHub.
- **Hosting:** Netlify site `baplanning-uu1i`, site id `2f3a049a-6ea8-49f9-ae8c-0aac33a4ef89`. **Every push to `main` deploys automatically.**
- **Stack:** Vite + React 19 + TypeScript. Netlify Functions (v2) form the API. MongoDB Atlas (free tier, shared with other apps) is the database. Claude Haiku 5.5 writes hints.

What the kid sees:

- **Boxes and tasks:** the chapter plan, from Beast Academy's sequence PDFs, as boxes of tasks (Guide → Online → Practice). Each box fits the screen without scrolling.
- **Problems:** scanned practice problems open in a window, from the coins on a practice task. The window never scrolls; it shrinks to fit.
  - The answer types are typed answers, tap buttons, themed dropdowns, written explanations, and interactive puzzle boards.
  - A wrong answer keeps the kid on the problem. From the 2nd wrong answer, the kid first gets **the book's own printed hint** (for ★ problems), then **AI hints** (questions about the idea, never the step or the answer).
  - Hints already given stay with the problem until it is solved. Reopening the window shows the latest one, older ones sit behind "Earlier hints (n)", and the Rough note has a 💡 Hint button that shows the latest.
  - **Lives row** in the problem header: 2 cartoon hearts (each wrong answer breaks one) and 3 bulbs (each hint lights one). Counts come from the server (`attempts`, `hints`), so they survive reopening; hidden on solved problems. No tooltip (the user asked for none).
  - **Number pad:** typed number answers use an on-screen pad (digits ⌫, plus only the symbol keys the answer needs: `, × ^ ÷ = & / . −`), not the iPad keyboard (`inputMode="none"`; a real keyboard still types). Answers with letters keep the keyboard.
  - **Fraction answers:** when the only pad symbol is `/` (a fraction or mixed number), the answer is three boxes: whole, top, bottom (`isFracPad`, `fracText` in `src/pad.ts`). The kid taps a box and types digits; the pad has no space key, so mixed numbers could not be typed before.
  - **Stacked fractions:** every "3/4" and "2 3/4" in prompts, hints, solutions, answers, choice buttons and boards is drawn the book's way (`MathText` / `Frac` in `src/components/MathText.tsx`). Copying stacked fractions gives plain "2 3/4" (`copyPlainFractions`).
- **Order rules:** a box's problems (and its **Learn** page) open only after every required problem in earlier boxes is solved. Learn must be read first. Then problems open one at a time; dashed (optional) problems never block anything.
- **Stars:** 3, 2, or 1 star per problem, from the number of wrong answers.
- **Solved problems:** opening one shows its history: every try, wrong answers, hints (book or AI), the answer, the solution, the final board, and the rough work.
- **📝 Rough note:** every problem window flips to a grid page for Apple Pencil scratch work. It is auto-saved on the device and to the server, and never deleted.
  - The page scrolls and grows: there is always one blank screen below the lowest writing, up to 4.9 page-widths (about 7 iPad screens).
  - Scrolling: two fingers (before any pencil use, one finger draws); one finger once a pencil has been used (palm rejection); the ▲/▼ buttons; the mouse wheel.
  - The pen starts **thick** (the user asked for it); Thin is one tap away.
- **Text selection:** off for the app and the iPad long-press menu, so a held finger or resting pencil can't select the page. **On inside the problem window** (question, hints, answer, solution can be selected and copied; the user asked for it), but still off on its buttons, boards, number pad and header, and always off in the Rough note. Inputs and textareas are selectable.
- **Parent passcode:** "Complete whole chapter" / "Undo all" need it, and so does ticking or unticking a **Guide** or **Online practice** task: the kid shows their work and a grown-up enters the passcode (button "👀 Show a grown-up"; the server checks it too, `needsParent()` in `src/types.ts`). Book practice is ticked by the kid once its problems are solved.
- **Sounds and music** (`src/sound.ts`, Web Audio): every kind of action has its own sound and the same action always the same one: click (buttons), a low "thock" (pad keys and board cells), pop / pop-down (windows), flip (Rough note), correct, wrong (also a wrong passcode), hint, done, undo, box and chapter fanfares. Background music is a playlist of 4 CC0 tracks by Juhani Junkala (`public/music/`, credits in `CREDITS.txt`), soft under the effects. It starts on the first tap (iPad rule), stops when the app is hidden or the tab closes, follows the iPad volume and silent mode. The 🎵 button in the chapter banner turns **only the music** off (remembered per device, `localStorage ba.music`); clicks keep playing.
- **Home screen:** the app can be added to the iPad home screen with its own icon (`public/icon.svg`).

## 2. Where things are

```
index.html                    page head: home-screen icon, manifest, iPad web-app meta tags
public/                       icon.svg (master logo), apple-touch-icon.png, icon-192/512.png, manifest.webmanifest
src/
  App.tsx                     routes (#/L4/c7/b3), coverage state, dialogs
  api.ts                      all browser → API calls (PIN header added by call())
  data/level4.json, level5.json   the chapter plan (boxes, tasks, pages, problem numbers, dashed flags)
  components/
    Checklist.tsx, TaskRow.tsx    boxes, coins (medals), stars, locks, Learn button
    ProblemDialog.tsx             the problem window: answers, hints, history, fit-to-screen, flip to Rough note
    RoughNote.tsx                 rough-note canvas (pen, eraser, undo, palm rejection, scrolling page, autosave, hint card) + thumbnail
    LearnDialog.tsx               lesson pictures ("Got it!" marks Learn done)
    puzzles/PuzzleBoard.tsx       boards for Ch 6 types (sudoku family, hive, minesweeper, tents, logic chart)
    puzzles/FactorBoards.tsx      boards for Ch 7 types (blobs, pyramid, times table, sieve)
    puzzles/PathBoards.tsx        boards for Ch 8 types (Fraction-Sum Link, Constellation, Maze Escape)
    MathText.tsx                  stacked fractions / mixed numbers in any text
    puzzles/ChoicePicker.tsx      themed dropdown (no native <select>)
    Tooltip.tsx, icons.tsx        cartoon tooltip; Medal / Star / Heart / Bulb SVGs
    NumberPad.tsx                 on-screen number pad (answers and the times table); typing logic in src/pad.ts
  sound.ts                      all sounds, the music playlist, music on/off
  styles.css                  all styles (cartoon theme: navy outlines, gold, cream)
netlify/functions/
  problems.ts      GET coverage / one problem / review; POST answer check, Learn done
  progress.ts      task / chapter ticks (chapter actions need the parent passcode)
  problem-image.ts question and Learn pictures (solution pictures only once solved)
  scratch.ts       rough-note pages (GET / PUT)
  _mongo.ts        MongoClient + withMongo() wrapper + collection types
  _answer.ts       forgiving answer matching (see §5)
  _puzzle.ts       puzzle layouts, server-side board check, rule-only conflict highlighting, validator
  _gate.ts         order rules (box order, Learn first, one at a time) and stars
  _hint.ts         AI hints + AI judge for written explanations (Claude Haiku 5.5)
  _hintRules.ts    checks an AI hint before it is shown (no operations, no new numbers, no answer)
  _scratch.ts      rough-note stroke validation / thinning
  _plan.ts         bundled plan JSON for the server
scripts/                       tests (*.test.mjs) and tools
  load-problems.mjs            loads a problem-data file into MongoDB
  puzzle-solver.mjs            brute-force solver: proves each puzzle has one answer and computes it
problem-data/   (git-ignored) transcribed chapters + image loaders: ba4-c<N>.mjs, c<N>-*.mjs, load-c<N>-images.mjs
.import-review/ (git-ignored) rendered scan pages, e.g. 4-c7-book/page-12.png
.env            (git-ignored) MONGODB_URI, MONGODB_DB, APP_PIN, CHAPTER_PASSCODE, ANTHROPIC_API_KEY, UNLOCK_ALL
```

**Never commit book content.** `problem-data/`, `.import-review/`, `source-pdfs/`, and `.env` are git-ignored on purpose. Only code goes to GitHub.

## 3. Databases

One Atlas cluster, two databases:

- `beast_academy`: production (the live site)
- `beast_academy_dev`: local testing (`MONGODB_DB` in `.env`)

| Collection | `_id` | What it holds |
|---|---|---|
| `progress` | `L4` | ticked task ids |
| `problems` | `4-c7-12` | one problem (see below) |
| `problem_images` | `4-c7-69-q1`, `4-c7-learn-24` | JPEG crops (question pictures, Learn pages) |
| `problem_state` | `4-c7-12`, `learn-<taskId>` | the kid's tries, history, hints, stars, solved; Learn done |
| `scratch` | `4-c7-12` | rough-note strokes (never deleted) |

A problem document (`ProblemDoc` in `_mongo.ts`):

```js
{ n, level, chapter, book: '4C', page,
  prompt,                                  // shown to the kid
  kind: 'text' | 'puzzle' | 'explain',     // default 'text'
  parts: [{ label, answer, accepted: [], choices?: [], multi?: true }],  // answers never sent to the browser
  puzzle?: { type, ... },                  // board layout (public), see §4
  puzzleSolution?: { 'r,c': '3', ... },    // never sent to the browser
  bookHint?: '...',                        // the book's printed hint for ★ problems
  solution: '...',                         // method summary; fed to the AI and shown after solving
  images: { question: [], solution: [] } }
```

**Production data is only changed with the user's OK.** Load to dev first, test, then load to prod.

## 4. Answer types and puzzle boards

| Kind | How the kid answers | How it is checked |
|---|---|---|
| typed text | input box + number pad (the GET sends `pad` keys per part from `padKeys()`; `null` = letters, keyboard) | `checkAnswer` (§5) |
| `choices` (≤6 short) | big tap buttons | exact choice |
| `choices` (longer) | themed dropdown (`ChoicePicker`) | exact choice |
| `choices` + `multi` | tap every number that fits ("circle every…") | list, any order |
| `explain` | writes a reason | Haiku judges against the solution; **partly right but reaching the right conclusion passes**; a not-yet answer gets a question-style nudge |
| `puzzle` | interactive board (below) + optional parts | server compares the board (never reveals which squares are wrong) |

Puzzle types (`PuzzleSpec` in `_puzzle.ts`):

| type | Chapter | Board | Checked by |
|---|---|---|---|
| `sudoku` (4×4; `regions` = pentomino 5×5; `ask` = shaded squares only; `fill` = "fill in the 3's") | 6 | number pad | stored solution |
| `sumdoku` (cages with sums) | 6 | number pad | stored solution |
| `timesout` (row/col products, digits 1–6 or 1–8, blanks) | 6 | number pad | stored solution |
| `hive` (hexagons; `flat` for flat-topped) | 6 | number pad | stored solution |
| `minesweeper` | 6 | tap: mine → ✕ → blank | mine positions |
| `tents` | 6 | tap: tent → ✕ → blank | tent positions |
| `logicgrid` (✓/✗ scratch chart) | 6 | tap cells | only the answer parts |
| `blobs` (Factor Blobs) | 7 | tap squares, "Make blob" | **rules** (any valid grouping) |
| `pyramid` (Pyramid Descent; with `divisor` = Division Pyramid) | 7, 5 | tap one per row | **rules** (product = `target`, or each block = the one above ÷ `divisor`; touching) |
| `timestable` (times table puzzles) | 7 | multi-digit pad | stored solution |
| `sieve` (Sieve of Eratosthenes) | 7 | tap: circle → cross | **rules** (primes circled) |
| `sumlink` (Fraction-Sum Link; cells `"A0","A1"…` = path letter + step) | 8 | tap or drag from a number, square by square, to its partner; tap a path to rub it out | **rules** (pairs add to `target`, paths step up/down/left/right, never through a number, every number used) |
| `constellation` (dots at book positions, cells `"i-j"` = a line) | 8 | tap two dots to draw / rub out a line | **rules** (lines only join equal values, each equal group is one path, no crossings, no line through a dot). Only crossings and through-dot lines glow red, never unequal pairs (that is the puzzle) |
| `maze` (Maze Escape; `start`, `exit`, `exitSide`; cells = step numbers) | 8 | tap from the shaded start to the striped exit; tap a path square to back up | **rules** (same skip every move, adjacent squares, start to exit) |

Fractions on boards are exact: `fracOf("2 3/4")` → `[11, 4]`. The Ch 8 solvers (`solveMaze`, `solveSumLink`, `solveConstellation`, `deriveC8`) prove each board: every maze has one escape path, every constellation one crossing-free drawing, every sum-link one pairing. The scans lost the mazes' shading; each start is the beginning of the only chain that reaches the exit (the book hints for 91 and 92 confirm it).

Squares that break a rule turn red. This uses only the rules, never the answer, so it gives nothing away.

**To add a new puzzle type:**

1. Add it to `PuzzleSpec`.
2. In `_puzzle.ts`, add the board's squares (`editableCells`), the answer check (`checkPuzzle`), the red rule-breaking highlight (`conflicts`), the solution validator (`validateSolution`), and the text description for the AI (`describePuzzle`).
3. Add a solver in `scripts/puzzle-solver.mjs`.
4. Add a board component.
5. Add a case in `PuzzleBoard.tsx`.
6. Add styles.

## 5. Answer matching (`_answer.ts`)

These all count as matches:

- `÷`/`/` and `×`/`x`/`*` are treated the same.
- Thousands commas are ignored.
- Units are stripped: "35 buses" and "55 pairs" match 35 and 55.
- Fractions, mixed numbers, decimals, and remainders ("3 r 2") are normalised.
- Lists match in any order.
- **Prime factorizations** match in any form, but every base must be prime: `2^2×5×7`, `2²×5×7`, `7x5x2x2`.
- **Pair lists** (`1×30, 2×15` or `13 & 31`) match in any order and either way round.

Prompts tell the kid the format (e.g. "Use ^ for exponents").

## 6. Hints and the AI

**Order on wrong answers:**

1. On the 2nd wrong answer, the kid sees `bookHint` if the problem has one.
2. After that, AI hints, at levels 1→2→3. They get a little more specific each time, and level 3 suggests asking a grown-up.

The cap is 3 hints per problem per day.

**The AI:** Claude Haiku 5.5 (`claude-haiku-5-5`), with **thinking disabled** (otherwise it eats the 220-token budget). Prompt rules:

- Follow the official solution's method.
- Ask a question about the idea.
- Never name an operation or use numbers from the worked solution.
- Never give the answer.
- Never mention "the solution".

`_hintRules.ts` rejects any hint that breaks the rules. The AI gets one retry, then a safe generic question is shown. Puzzle hints include the kid's board as text.

- **Hint context:** each AI hint is sent the hints already given (book and AI) and the earlier wrong answers since the last solve (last 5 each; puzzle boards left out), told not to repeat them and to go one small step further without referring to them (`contextText()` in `_hintRules.ts`). Numbers from those are allowed in the new hint.
- **Shown operations may be named:** a hint may name an operation the problem itself shows (÷ / "quotient" → divide, × / "product" → multiply, …, `SHOWN_OPS`). A hidden one stays blocked (the bus problem never says divide). Before this, most Ch 5 division hints fell back to the generic safe hint.

- **The retry is a fresh single question** (the original content plus a note naming the broken rule). An earlier version sent the rejected draft back as an assistant turn plus "that breaks a rule", and the model answered conversationally ("You're right, that hint named an operation…"), which the kid saw. Do not go back to that.
- **Self-talk is rejected:** hints that mention "that/this/my/last hint", "I shouldn't…", or open with "You're right" / "Sorry" fail the rules (`META` in `_hintRules.ts`).
- **"Multiply" is allowed** in `timestable`, `blobs` and `pyramid` puzzles (`MULTIPLY_PUZZLES`), where multiplying is the whole puzzle. Other operation words are still blocked there, and "multiply" is blocked everywhere else. Before this, times-table hints usually fell back to the generic safe hint.
- **Persisted hints:** the problem GET returns `hints` (from `problem_state.history`) only while the problem is unsolved. These are hints the kid has already seen, so nothing new leaks.

**Cost:** fractions of a cent per hint. The Anthropic key is in Netlify env and `.env`.

## 7. Adding a chapter: the full workflow

The user scans the practice pages, the solution pages, and the "Hints to Selected Problems" page(s) into one or more PDFs in the iCloud `Kiara` folder, and gives the path.

1. **Render the pages**, into the scratchpad, not the repo:
   `node scripts/import-problems.mjs "<pdf>" 4 <ch> --render-only`
   This writes `.import-review/4-c<ch>/page-N.png`, at 1190×1684 for portrait pages.
   Make 2×2 contact sheets to skim them, and zoom crops (3–5×) to read grids and small numbers.
2. **Check completeness before starting.** Compare the plan (`src/data/level4.json` → the chapter's boxes, pages, and problem numbers) with the scans. Report missing pages, smudges, or upside-down pages to the user, and **ask for any missing pages**. Examples from earlier chapters: Ch 6 solution pages 128–129 were missing; the Ch 7 hints page 106 had to be requested.
3. **Transcribe into `problem-data/`.** Use several smaller files (`c<N>-text-a.mjs`, `c<N>-text-b.mjs`, `c<N>-puzzles.mjs`) plus an assembler `ba4-c<N>.mjs` that merges them, adds puzzle prompts and `bookHint`s, and computes `puzzleSolution` with the solver.
   - **Write solutions as method summaries in your own words.** Do not copy the book's solution text verbatim. Very long verbatim reproduction triggered an "Output blocked by content filtering" error once.
   - Keep `bookHint` text faithful; it is short.
   - **Every prompt must be answerable on its own:** the app shows the prompt text, not the scanned page. Put the numbers, expressions and word-problem facts in the prompt ("Find the sum: 3/8 + 4/8"), never just "Find the sum." Only a figure that can't be written out gets a question picture (`qimg: true` + `q-<n>.jpg`, linked by the chapter's image loader). Ch 8 was first transcribed without numbers and had to be redone.
   - Mark `kind: 'explain'` for pencil-icon "explain why" problems.
   - "Circle every…" problems become `choices` + `multi`.
4. **Prove the puzzles.** Every puzzle must solve to **exactly one** answer with the solver, apart from rule-checked types. If it doesn't, the transcription is wrong. Cross-check against the solution pages' final grids. A wall misread in a pentomino or cage is the usual cause; zoom in again.
5. **Pictures:** write `problem-data/load-c<N>-images.mjs` with:
   - Learn crops (the example area above "PRACTICE" on lesson pages, as `<level>-c<ch>-learn-<bookPage>`)
   - question pictures where needed (card rows, factor trees…), linked via `images.question`
   - added `bookHint`s for earlier chapters' ★ problems, if the hints page covers them
   Copy the rendered pages to `.import-review/4-c<N>-book/` (git-ignored) for the loader.
6. **Load to dev:**
   ```
   node --env-file=.env scripts/load-problems.mjs problem-data/ba4-c<N>.mjs 4 <N> --book 4C --db beast_academy_dev
   node --env-file=.env problem-data/load-c<N>-images.mjs beast_academy_dev
   ```
   `load-problems` keeps existing images on reload. A problem with `hideScan: true` (a board that replaces the scanned question picture, e.g. the Ch 5 Division Pyramids) has its question picture cleared.
   - Make the book's puzzles interactive, never "type what you would circle": "circle all…" → `choices` + `multi`; "circle the one…" / "circle one" → `choices`; pyramids, grids → a puzzle board.
7. **Test** (§8), then let the user try it locally with `UNLOCK_ALL=1`.
8. **Go live only when the user says so:** load the same two commands with `beast_academy`, then commit and push (auto-deploy). Verify read-only on the live site with the `x-app-pin` header.
9. Add the chapter file name to `CHAPTERS` in `scripts/chapter-content.test.mjs`.

## 8. Testing

- `npm test` (`node --test scripts/*.test.mjs`) covers:
  - answer matching, order rules, hint rules, puzzle engine (against the book's worked examples), and rough-note strokes
  - `chapter-content.test.mjs`, which loads each chapter file and checks that every right answer is accepted, wrong choices and wrong boards are rejected, and every puzzle solution obeys its rules
- **Local server:** `npx netlify dev --port 8888`, using the dev DB. `UNLOCK_ALL=1` in `.env` opens every problem and Learn page in any order; it is never set on Netlify.
- **API end-to-end:** script every problem in book order. Post a wrong answer (expect `correct:false`), then the right one (expect `correct:true`). Run it with `npx esbuild --bundle --platform=node --external:mongodb`, because function files use extension-less imports. Only a few `explain` problems go to the AI.
- **Browser (iPad):** Playwright WebKit with the `iPad Pro 11` profile, kept in the session scratchpad, not the repo (`npm i playwright@1.49.1`, `npx playwright install webkit`). Tests:
  - tap-solve one problem of each type
  - check `.dialog.problem` `scrollHeight <= clientHeight` (no scroll) in 1194×834 and 834×1194
  - rough note: draw/erase/undo, reload, close-at-once, offline (block `PUT /api/scratch`)
  - rough note scrolling: draw near the bottom (page grows), ▼, two-finger drag (synthetic `touch` PointerEvents with two ids), pen stroke then one-finger drag scrolls, a stroke dragged off the left edge still saves
  - hints: two wrong tries on a ★ problem (hints start on the 2nd), close and reopen, the hint is still there; a third try shows "Earlier hints (1)"
  - number pad: solve by tapping pad keys only (plain number, list, factor pairs, prime factorization, equation, multi-part); word answers still get a text box
  - sounds: open pages with **`?mute`** (localhost only: silent engine, so tests never play through the Mac's speakers). `window.__sounds` logs every sound name; `window.__audio()` gives `{state, musicOn, playing, track}`; `window.__audioEnd()` jumps to the end of a track
- **Afterwards**, clear test progress and notes from the dev DB, stop the dev server, and check that no MongoDB sockets are left open:
  `lsof -i -nP | grep ':27017' | grep -c ESTABLISHED`

## 9. Gotchas learned the hard way

- **MongoDB connections:** the free cluster caps connections for all apps on it. `netlify dev` runs each request in a fresh worker, so a module-level client leaked about 3 sockets per request until Atlas refused connections (TLS "alert 80"). Fix: every function is wrapped in `withMongo()` (closes the client after the request in dev), and `serverMonitoringMode: 'poll'`, `maxPoolSize: 1`. **Wrap any new function in `withMongo`.**
- **Netlify secrets scan:** a deploy fails if any file in the repo contains the value of a secret env var. Even a test number that merely contained the PIN digits was flagged. Never put PIN- or passcode-like digits in test data or docs.
- **CSS class names clash globally:** `.picker` (level page) and `.loading` (full-screen gold argyle) caused visual bugs. Prefix new classes (e.g. `rough-`, `pz-`, `rs-`).
- **Board cell values:** the server trims each cell value; it is currently 5 characters, for 3-digit products.
- **keepalive fetch** bodies over 64 KB are refused. Rough notes fall back to the local copy for big pages.
- **Rough-note canvas size:** the canvas covers only the visible part of the page (`position: sticky`) and is redrawn with a `-scrollTop` offset on scroll; a spacer div gives the scroll height. A canvas as tall as the whole page would pass iPad Safari's canvas memory limit.
- **Don't use `touch-action: pan-y` on the drawing canvas:** in Safari it applies to the Apple Pencil too, so the pencil would scroll instead of drawing. Finger scrolling is done by hand in the pointer handlers.
- **Clamp stroke points:** with pointer capture, a stroke dragged off the page gives x < 0. `sanitize` refuses the **whole** page if any point is out of range (x −0.05…, y …5), which left notes stuck on "Saved on this device". `pos()` clamps x to 0–1 and y to 0–4.9.
- **iPad long-press selection:** CSS `user-select: none` is not enough on the canvas. It also needs a non-passive `touchstart`/`touchmove` listener that calls `preventDefault()` (React's touch listeners are passive), plus `selectstart` blocked while the note is open.
- **Test browsers play sound:** headless Playwright WebKit plays through the Mac's speakers, and a test's first tap starts the music. Always open pages with `?mute` (or stub `window.AudioContext` with `addInitScript`).
- **iPad audio:** iOS keeps a page that plays audio alive in the background, so music must be stopped on `visibilitychange` (hidden) and the engine closed on `pagehide`. Web Audio and the music `<audio>` element (routed through `createMediaElementSource`) only start after a tap. In development, Vite hot reload kept an old copy of `sound.ts` playing; `import.meta.hot.dispose` stops it.
- **StrictMode runs effects twice in development:** window pop/pop-down sounds are deferred one tick so a mount-unmount-mount pair cancels out; one-shot sounds (fanfares) use a ref guard.
- **The problem window must not scroll:** it measures itself and steps `--ps` from 1 down to 0.55. Re-fit is triggered by content changes and by image `onLoad`. New UI inside it should size with `calc(… * var(--ps))`.
- **Home-screen web apps:** iPad home-screen icons must be PNG (`apple-touch-icon.png`), rendered from `public/icon.svg` with `@napi-rs/canvas`. A home-screen app has separate storage from Safari, so it asks for the PIN once.
- **The dev server sometimes dies** when the shell resets. Restart it with `(nohup npx netlify dev --port 8888 > /tmp/ba-dev.log 2>&1 &)`.
- **Netlify secrets can't be read back:** `netlify env:get` prints "No value set" for secret variables (APP_PIN, CHAPTER_PASSCODE, ANTHROPIC_API_KEY), though the live site has them. Without `ANTHROPIC_API_KEY` in `.env`, local hints are the fixed `FALLBACK_HINT` ("…Check the Guide page…"), not AI hints. The user adds secrets to `.env` by hand.
- **Windows:** the project also runs on a Windows PC (Git Bash). `import()` of a plain `D:\…` path fails, so scripts import `pathToFileURL(…).href`. Don't commit the `package-lock.json` churn from a Windows `npm install` (it drops the `libc` fields).

## 10. Current status

Level 4 problems loaded (dev and prod):

| Chapter | Book | Problems in the app | Notes |
|---|---|---|---|
| 4 Counting | 4B | 91–106 | the rest not scanned yet |
| 5 Division | 4B | 144 of 147 | 97, 122, 123 not loaded (no auto-checkable answer). Interactive since Nov 2026: Division Pyramids #98–105 (boards, scans hidden), closest estimates #53–64 (tap one), circle-the-numbers #106, 107, 125, 128, 130–132, 134 (tap) |
| 6 Logic | 4B | 1–120 | 14–18 answers derived (solution pages 128–129 were missing) |
| 7 Factors | 4C | 1–147 | complete, with hints for 140–147 from page 106 |
| 8 Fractions (+ & −) | 4C | 1–192 | complete. Boards: mazes 87–94, constellations 125–130, sum-link 171–176. Question pictures: number lines 1–6, 19–22, hexagon 184. Book hints for every ★ problem (page 106) |

Problems that aren't loaded behave normally (no locks, ticked by hand).

## 11. Working conventions

- **Order of work:** plan → build → test locally → the user tries it → go live only when the user says so.
- **Commits:** end commit messages with the attribution line given by the session.
- **Data safety:** never touch the kid's progress in prod. Clear only dev data after tests.
