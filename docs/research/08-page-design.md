# 08: Page design for cube.nathanwei.org (stats, drills, cross, review, settings, connect, empty states)

Checked 2026-10-15. **[verified]** means I read the primary source (product source code, help page, official post). **[unverified]** means a secondary source, a snippet, or memory. Source code was read for monkeytype, Lichess, csTimer and CubeDesk because their sites render in JavaScript.

## 0. Bottom line

- **Home works because it is typographic:** numbers in type on oat, one tinted band, colour only for meaning, no boxes. Both rejected stats pages (round 6 #09, round 7 #06–07) became a card dashboard: equal tiles, metric-name titles, charts that lead nowhere.
- **Rule for every page:** one question and one hero; every chart carries a reference (usual range, PB, previous period); every mark drills down to a solve or case; every page ends in a drill.
- **Stats:** I recommend direction B, "where the time goes" (§3), the only one built on data no other timer has, with a monkeytype-style "history" tab behind it.

## 1. Patterns worth stealing

**monkeytype**
- **Account page** [verified, `AccountPage.tsx`, `HistoryChart.tsx`, `TestStats.tsx`]
  - Order: profile → filters → history chart → histogram + daily activity → stat grid → results table ("load more", CSV).
  - The history chart plots **every result as a dot**, with toggles "Speed / Accuracy / Avg of 10 / Avg of 100" and a **faint stepped PB line**.
  - One line under the chart: "Speed change per hour spent typing: +x".
  - **Clicking a dot scrolls the table to that row.**
  - Labels are plain and lowercase ("tests started", "average (last 10 tests)").
- **Profile:** a "last 12 months" calendar [verified]. **Settings:** one scroll, "search settings", quick-nav anchors [verified, `QuickNav.tsx`].

**chess.com**
- **Insights** [verified, support.chess.com]: "Past Performance" compares the period with **the previous equal period**; "Game Phases" shows accuracy per phase; tactics "found vs missed" open the real positions to retry in Game Review.
- **Game Review report card** [verified, chess.com news 2023]: summary → performance rating for that game → opening, middlegame and endgame grades as icons (hover shows accuracy).

**Lichess**
- **Puzzle dashboard** [verified, `PuzzleDashboard.scala`]
  - Periods run from 1 to 90 days.
  - Per theme: first-try %, fixed %, and a performance rating.
  - "Improvement areas" and "Strengths" are the 8 weakest and 8 strongest themes with enough data.
  - A verdict counts as **"clear" only with ≥6 tries, ≥2 wins and ≥2 failures**.
  - Failed puzzles go to "Replay".
- **Insights presets are questions** [verified, `presets.ts`], e.g. "Do I gain more rating points against weaker or stronger opponents?"
- **Puzzle Storm end screen** [verified, `storm/view/end.ts`, `puz/view/history.ts`]: the score with "previous highscore was X", a small table (moves, accuracy, combo, time per move), and a "Puzzles played" grid of mini boards filterable to "Failed puzzles" / "Slow puzzles".
- **"Learn from your mistakes"** [verified, `retroView.ts`]: "X was played" → "You can do better" → try → "Best was X" / "View the solution" / "Do it again" / "Next".

**Strava** [verified support pages]: Fitness & Freshness has one line, a **7-day delta** beside the score, click-to-focus a date, and **contributing activities listed below the chart**. Splits put a bar per lap above a table. Training Log draws one circle per activity (size encoding [unverified]).

**Oura Readiness** [verified, ouraring.com]: a 0–100 score with a word band (Optimal ≥85, Good 70–84, Pay attention <70); contributors are thin bars and **only a flagged one turns red**; "100s are designed to be rare."

**Apple**
- **Fitness Trends** [verified snippet]: last 90 days vs last 365, with arrows.
- **HIG, "Charts"** [verified]: "Summarize the main message of your chart"; dynamic y range where zero hides differences; fewer gridlines on interactive charts.

**Linear** [verified]: "Behind the latest design refresh" dims the sidebar ("Don't compete for attention you haven't earned"), removes separators ("Structure should be felt not seen") and warms the grays without making them muddy. Part II of "How we redesigned the Linear UI" adds Inter Display for headings.

**csTimer** [verified, `distribution.js`, `trainstat.js`, `trend.js`]
- Distribution rows read "15+ ▇ 12 <16 ▇ 47/100": a histogram **plus a cumulative sub-X count**.
- Per-case table: case, image, N, best, mean, an inline bar, successes n/N.
- Trend: raw times, ao5 and ao12.

**CubeDesk** [verified, `CubeStats.tsx`]: "Personal overview", "Averages", "Solve times", "The details", "Solving activity". The baseline cubers expect, and the generic look to avoid.

**Acubemy and Cubeast** [verified, home pages]: Acubemy turns a goal time into the recognition and execution splits it needs; Cubeast shows "% of solves with XCross" and "average PLL recognition time".

**Feliks Zemdegs, "Example Solve Critique"** (CubeSkills PDF) [verified]: stage-by-stage notes with bracketed better lines ("[yellow top, green front] U L F' U' D' R2' F"), closing with "Strengths" and "Main tips for improvement".

**Anki and Duolingo** [verified]: Anki shows the question alone, Space reveals, Again/Hard/Good/Easy on keys 1–4. Duolingo's Practice Hub puts a daily targeted session on top, "Mistakes" below.

**Data-viz and empty-state guidance**
- **Tufte, "Sparkline theory and practice"** [verified]: a gray normal-range band, the latest value accented, no frames, small multiples "adjacent in space rather than stacked in time". **Datawrapper Annotate docs** [verified]: the title states the takeaway; label lines directly.
- **NN/g, "Designing Empty States in Complex Applications"** [verified]: never totally empty; explain how content gets there; link straight to the task; never "no data" while loading.

## 2. Shell rules (every page)

- **Type on ground, not tiles.**
  - Cards only for things you pick (alg options) and modal sheets.
  - Grouping by spacing and alignment.
- **One hero per page**, at home's scale: 96–120 px for a time, 40–56 px for a rating. Secondary type at about 40% of that.
- **Colour has jobs:**
  - terracotta `#c2593b` = current / interactive;
  - green `#3f7a4f` and red `#b4533f` tints = vs your usual;
  - chart ink = espresso `#3a2e28` at 20–100%;
  - **usual range = a pale oat band.**
- **Every chart has a reference:** usual band, stepped PB, or previous-period ghost. Every mark drills down (dot → solve popover, case → drill, stage → Review).
- **Never:** donuts, gauges, flames or streaks, badges, XP, gradients, shadowed tiles, legend boxes.

## 3. Stats: diagnosis and three directions

### Why the rejected pages felt dead
1. **Wrong language.** Five equal rounded tiles, where home is type on oat. Equal weight means no hierarchy.
2. **No verdict.** Titles were metric names ("ao100", "splits", "COLL"); the HIG and Datawrapper both say to lead with the message.
3. **Decorative chart choices.**
   - A split donut answers nothing he can act on.
   - Stacked daily bars bury the one stage that moved.
   - The COLL gradient grid has no labels.
4. **Fake-smooth data.** No individual solves. monkeytype's dot cloud is alive because it is true.
5. **No anchors.** No PB, usual band or previous period.
6. **Dead ends.** Nothing leads to a solve, case or drill.

### Direction A: "History" (monkeytype account page)
*Am I getting faster, and what are my bests?*
- **Top:** five PBs set in type ("single", "ao5", "ao12", "ao100", "ao1000"), with tiny dates; the newest PB is in terracotta.
- **Full-width chart:**
  - every solve as a 20%-espresso dot;
  - x = solve number, y = seconds on a dynamic range;
  - a terracotta ao100 line and a faint stepped PB line;
  - text toggles "ao12 ao100 pb cross f2l ll". The split toggles replot the dots as that split.
- **One computed line under the chart:** "ao100 −0.61 in 30 days · 412 solves".
- **Below:**
  - left: a csTimer-style distribution (1-second rows plus a cumulative "sub-16 47%");
  - right: the solves table with "load more".
- **Interactions:** click a dot → table row plus popover; drag to zoom, and the PBs recompute for the range.

### Direction B: "Where the time goes" (recommended)
*Which part of my solve costs me, and is practice fixing it?*

**Three columns under "cross", "f2l", "last layer"** (Oura's contributor list turned sideways). Each column has:
- the rating large, with "↑12 · 30 days";
- the mean split, with a small "was 2.10";
- a 90-day sparkline over the usual band;
- 2–3 **cost rows** with inline bars:
  - cross: "moves over optimal +1.8", "xcross 14%";
  - f2l: "pauses per solve 3.1", "slowest pair p2";
  - last layer: the three slowest cases with tiny diagrams.

**Below the columns, a time-budget bar:**
- today's average solve as one horizontal bar split into cross | p1–p4 | oll | pll;
- a second bar for the target average on the same scale;
- the biggest gaps in terracotta. This is Acubemy's goal-split idea, drawn.

**Bottom: "strengths" and "focus"** (Feliks's headings). Each item is one line plus a link into the matching drill.

**Interactions:**
- A "30 d / 90 d / all" switch, with deltas against the previous equal period (chess.com).
- Click a cost row → the solves where it happened (Strava's contributing list).

### Direction C: "Calendar" (training log)
*Am I practising consistently, and is it paying off?*
- **Top: a 53-week heatmap** ("last 12 months"). Shade = minutes practised; a terracotta dot marks a PB day.
- **Below: the last 8 weeks as rows (Strava Training Log):**
  - each day is a circle sized by solves and tinted by that day's ao12 vs usual;
  - the row ends with the week's ao12, solves and drill minutes.
- **Click a day →** a side panel of its sessions.
- **No streak counters.**

**Recommendation:** B as "stats", A as a "history" tab. C's heatmap only as a thin strip in A, if wanted.

## 4. Page specs

**Drills hub**
- **Question:** what should I drill now, and how fluent is each set?
- **Top (Duolingo/Anki):** "due 14 · new 3 · ~9 min" and a terracotta "start" that runs the scheduler mix.
- **Set rows** (COLL, PLL, OLL, F2L, lookahead):
  - name and count ("22/40");
  - a strip of tiny cells, one per case: filled = fluent, tint = learning, outline = new, dot = due;
  - median recognition and execution.
- **Set page:** a csTimer-style table (diagram, case, n, recog, exec, inline bar, last seen), sortable, with "drill weakest 10".
  - Verdicts follow the Lichess sample rule.
- **Empty:** all cells outlined, with "start PLL" leading to the pick-your-alg screen.
- **Not:** XP, rings, percentages without counts.

**Recognition drill**
- **Question:** can I name this case instantly?
- **Screen:**
  - one case at a time (Anki);
  - a matte cube at his solving angle with the last layer coloured, or a flat top-face diagram (ruling);
  - a small timer;
  - answer keys with key caps ("T1"…"T6" on "1"…"6");
  - a "12 / 30" counter; no lives.
- **Answers:** correct → a green flash, then the next case after about 400 ms. Wrong → the correct name, the locked alg in mono, and a re-queue.
- **End (Storm):**
  - the hero is the median recognition time, with "previous 0.92";
  - a small table;
  - a grid of mini diagrams with times, filtered by "missed" / "slow";
  - "again" and "drill missed".
- **With the smart cube:** execution is timed too.

**New case: pick your alg**
- **Question:** which alg do I commit to?
- **Screen:**
  - a large diagram and its name;
  - 3–4 cards, each with the alg in mono, a move count, play on a mini cube, and "try on cube" (median of 3 timed executions);
  - "choose" locks it; it can be changed from the set page.
- **Not:** comments or video.

**Cross trainer**
- **Question:** did I find a good cross, and is planning improving?
- **Flow:**
  1. The scramble band.
  2. A 15 s ring countdown.
  3. He solves on the cube; the smart cube detects the cross.
- **Result:**
  - "yours 7 moves 2.31" vs "best 5 moves";
  - up to 3 optimal lines in mono;
  - "replay yours", "retry", and "next" (Space).
- **Header right:** the rating hero with "≈ 1.9 s", marked provisional ("1688?") until 10 attempts (Lichess).
- **Controls:** a "cross / xcross" switch and a neutral toggle.
- **Bottom:** the last 20 attempts as dots by moves over optimal.
- **Borrows:** cubetrainer.cc (moves/optimal, first-move hint, ladder) [verified in 03].

**Review (refine the built page)**
- **Question:** where did this solve lose time, and what was better?
- **The current build** (`shots-real/v3-review.png`) strays from the approved language: a 2×2 grid of number tiles, full-saturation stickers, a boxed pace chart, a "??" badge.
- **Proposed:**
  - **Header:** time, scramble, ←/→ to adjacent solves.
  - **A chess.com-style report line:** stage grades with times vs usual, and "efficiency" and "flow" as plain text.
  - **Left:** the replay cube with matte stickers.
  - **Under it, a full-width stage timeline:** segments proportional to time (cross, p1–p4, oll, pll), pauses as hatched gaps. It doubles as the scrubber.
  - **Right:** a stage list (verdict, time, moves vs optimal, pause).
  - **Key moments run as Lichess's loop:** "show better line" / "try on cube" / "next".

**Solve popover (from the sidebar)**
- About 360 px, anchored to the row: time, scramble in mono, the three split chips vs usual, a mini stage bar, OLL and PLL names with tiny diagrams, "cross 7 / best 5".
- Actions "+2", "DNF", "delete" (with undo), "review →". ↑/↓ walk the list; Esc closes.

**Smart-cube connect** (a centred sheet over the dimmed timer)
1. **Browser check.** Brave ships Web Bluetooth **off**, and he browses in Brave [verified in 04]: show "brave://flags/#brave-web-bluetooth-api" with copy and "relaunch". Safari and Firefox get "use Chrome".
2. **Chrome's device chooser**, then the **GAN MAC once** (a field plus a copyable `system_profiler SPBluetoothDataType` hint).
3. **Connected:** name, battery, a small net of the reported state with "mark solved", and "reset orientation" (the gyro drifts). On the timer, a lost connection turns the pill gray ("reconnect").

**Settings and account**
- One scroll with anchors "cube timer drills data account" (monkeytype).
- Rows: label left, segmented control right.
- **Sections:**
  - cube: forget cube, MAC, orientation;
  - timer: inspection, hide time;
  - drills: new cases per day, recognition view;
  - data: export, import csTimer;
  - account: email, sign out, delete account.

**Empty states (NN/g)**
- **New account:** the timer works at once in keyboard or virtual mode. The sidebar shows muted "no solves", averages and ratings show "—".
- **Stats:** the real layout with empty axes, plus "stats after 12 solves · 0/12" and a "timer" pill.
- Never a blank panel, never "no data" while loading.

## 5. Mockup brief (render in this order)

**Base for every prompt:**
- References: refs/r5-01-oat.png plus round-7 03-home-chips.
- Palette: oat `#efe8de`, sidebar `#e5dccf`, espresso `#3a2e28`, terracotta `#c2593b`, soft green and red tints. Inter.
- No boxes around content unless stated; no shadows; no donuts.
- The approved sidebar: tabs 'timer' 'drills' 'cross' 'stats', recent solves, ao5/ao12/ao100, avatar 'Nathan'.
- Only the quoted words appear.

1. **stats-B**
   - Active 'stats'. Three borderless columns 'cross', 'f2l', 'last layer', each with a large rating ('1688' '↑12', '1534' '↑8', '1602' '↓4'), a split ('1.92', '7.41', '5.54') and a thin terracotta sparkline over a pale band.
   - Under them, rows with tiny inline bars ('moves over optimal +1.8', 'pauses per solve 3.1') and three tiny top-face diagrams ('T3 2.38', 'U4 2.11', 'Ua 1.84').
   - Full width: two stacked bars on one scale, labeled '16.42' and '15.00', with the two biggest gaps in terracotta. Bottom: 'strengths', 'focus', and links 'cross trainer →' 'COLL T3 →'.
2. **stats-A**
   - Five figures in a row: 'single 11.94', 'ao5 13.88', 'ao12 14.71', 'ao100 16.08', 'ao1000 17.02'.
   - A wide chart of hundreds of faint espresso dots trending down, a terracotta ao100 line, a faint stepped PB line, and text toggles 'ao12' 'ao100' 'pb' 'cross' 'f2l' 'll'.
   - Below: a horizontal histogram (rows '13+' to '20+', cumulative counts at the right) and a table headed 'time' 'cross' 'f2l' 'll'.
3. **stats-C**
   - A 53-column heatmap of small rounded cells (oat to espresso), a few with terracotta dots.
   - Eight week rows of seven circles of varying size, tinted soft green or red, each row ending in '15.84' and '212'.
   - A narrow right panel: '15.21', 'ao5 14.96', 'ao12 15.40' and a strip of dots.
4. **drills hub**
   - Active 'drills'. 'due 14 · new 3 · ~9 min' and a terracotta pill 'start'.
   - Rows 'COLL 22/40', 'PLL 13/21', 'OLL 0/57', 'F2L 0/41', 'lookahead 72 bpm'. Each has a long strip of tiny cells (solid terracotta, light terracotta, outlined; some dotted) and medians '0.84' '1.62' at the right.
5. **COLL set**
   - 'COLL' and a pill 'drill weakest 10'.
   - A borderless table 'case' 'n' 'recog' 'exec' 'last seen'. Each row starts with a tiny top-face diagram and a name like 'T3' and carries a short inline bar; the three slowest rows are faintly red.
6. **recognition: question**
   - 'COLL' and '12 / 30' at top.
   - A matte cube from above-front-right, last layer coloured and the lower layers muted, '0.84' beneath.
   - Six keys 'T1'…'T6' with tiny key caps '1'…'6'.
7. **recognition: wrong**
   - The same screen with 'T4' outlined soft red and 'T2' filled soft green.
   - Under the cube: 'T2' large, a mono line 'R U R' U R U2 R'', a tag 'again', and '1.92' muted.
8. **recognition: finished**
   - Hero '0.88' with 'previous 0.92' and a green '↓0.04'; 'cases 30', 'accuracy 93%', 'slowest 2.10'.
   - A 6×5 grid of tiny diagrams with times, two outlined red; filters 'missed' 'slow'; pills 'again' 'drill missed'.
9. **pick your alg**
   - A large top-face diagram 'COLL U4'.
   - Three cards: 'R2 D' R U2 R' D R U2 R' '9', 'R' U2 R' D' R U2 R' D R2' '9', 'F R U R' U' R U R' U' F'' '10', each with a play icon and 'try on cube'. The first has a terracotta border, '1.21' and a pill 'choose'.
10. **cross: planning**
    - Active 'cross'. The scramble band; top right '1688' with green '↑14' and '≈ 1.9 s'.
    - Centre: a thin terracotta ring around '11'. A switch 'cross' 'xcross' at top left.
11. **cross: result**
    - 'yours 7 moves 2.31' beside 'best 5 moves'.
    - Three mono solution lines, the first on a pale terracotta band. Pills 'retry' 'next'.
    - A bottom strip of 20 dots, green, neutral and red.
12. **review**
    - '14.87' with the scramble band and arrows '←' '→'.
    - A report line: 'cross 1.92 ↑' (green tint), 'f2l 7.41 ↓' (red tint), 'last layer 5.54', 'efficiency 81%', 'flow 74%'.
    - Left: a matte cube over a full-width segmented timeline 'cross' 'p1' 'p2' 'p3' 'p4' 'oll' 'pll' with hatched gaps and a terracotta playhead.
    - Right: a stage list and the moment 'p2 11 moves · best 7' with pills 'show better line' 'try on cube'.
13. **solve popover**
    - Sidebar row '14.87' highlighted, with a light oat panel beside it.
    - In the panel: '14.87', a two-line mono scramble, chips 'cross 1.92' 'f2l 7.41' 'last layer 5.54', a thin stage bar, 'OLL 27 · PLL Ua', 'cross 7 / best 5'.
    - Pills '+2' 'DNF' 'delete' and a link 'review →'.
14. **connect: blocked**
    - A dimmed timer behind a centred light-oat sheet with a small cube outline.
    - The mono line 'brave://flags/#brave-web-bluetooth-api' with a copy icon, and a pill 'relaunch'.
15. **connect: connected**
    - The sheet shows 'GAN 16 ui', battery '87%', and a small cube net in muted sticker colours.
    - Pills 'mark solved' and 'reset orientation', and a terracotta 'done'.
16. **settings**
    - Anchors 'cube' 'timer' 'drills' 'data' 'account'.
    - Label-left rows with segmented controls: 'inspection' ('off' '15 s'), 'hide time while solving' ('on' 'off'), 'recognition view' ('3d' 'top'), 'new cases per day' ('3').
    - Pills 'export' and 'import csTimer'; a muted 'delete account' at the bottom.
17. **empty timer**
    - The approved home with muted 'no solves', 'ao5 —' 'ao12 —' 'ao100 —', and ratings 'cross —' 'f2l —' 'll —'.
    - The scramble band and a pale '0.00'.
18. **empty stats**
    - Direction B's columns with empty axes and '—'.
    - A centred muted line 'stats after 12 solves · 0/12' and a terracotta pill 'timer'.

## Sources

- monkeytype source (account, profile, settings): https://github.com/monkeytypegame/monkeytype/tree/master/frontend/src/ts/components/pages
- chess.com, "What is Insights on Chess.com?": https://support.chess.com/en/articles/8708925-what-is-insights-on-chess-com ; "New: Insights": https://www.chess.com/news/view/new-insights
- chess.com, "Announcing New Game Review Features" (2023), read from a local copy (`scratchpad/chesscom/grv2.txt`); the URL below is assumed, not re-checked: https://www.chess.com/news/view/game-review-new-features
- Lichess source (`PuzzleDashboard.scala`, `presets.ts`, `storm/config.ts`, `storm/view/end.ts`, `puz/view/history.ts`, `retroView.ts`): https://github.com/lichess-org/lila
- Strava, "Fitness & Freshness": https://support.strava.com/hc/en-us/articles/216918477-Fitness-Freshness ; "Pace/Speed": https://support.strava.com/hc/en-us/articles/115001136770 ; "Training Log": https://support.strava.com/hc/en-us/articles/206535704
- Oura, "Readiness Score": https://ouraring.com/blog/readiness-score/
- Apple Support, "See your activity summary in Fitness on iPhone": https://support.apple.com/guide/iphone/see-your-activity-history-trends-and-awards-iph4c34a8a95/ios
- Apple HIG, "Charts": https://developer.apple.com/design/human-interface-guidelines/charts
- Linear, "Behind the latest design refresh": https://linear.app/now/behind-the-latest-design-refresh ; "How we redesigned the Linear UI (part II)": https://linear.app/now/how-we-redesigned-the-linear-ui
- csTimer source: https://github.com/cs0x7f/cstimer/tree/master/src/js/stats
- CubeDesk source: https://github.com/kash/cubedesk
- Cubeast: https://www.cubeast.com/ ; Acubemy: https://acubemy.com/
- Feliks Zemdegs, "Example Solve Critique": https://www.cubeskills.com/uploads/pdf/solve-critiques/example-solve-critique.pdf
- Anki Manual, "Studying": https://docs.ankiweb.net/studying.html
- Duolingo, "Guide to Duolingo Practice Hub": https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- Edward Tufte, "Sparkline theory and practice": https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
- Datawrapper, "Annotating your visualization": https://www.datawrapper.de/docs/annotate-tab
- NN/g, "Designing Empty States in Complex Applications": https://www.nngroup.com/articles/empty-state-interface-design/
- Project research: `03-trainer-landscape.md`, `04-smart-cube-payoff.md`, `06-elo-and-decay.md`

## For a human (rulings)

1. **Stats direction.** A "history" (every solve as a dot, PBs, table), B "where the time goes" (cross / f2l / last layer columns, time-budget bar, strengths and focus), or C "calendar" (year heatmap plus week rows)? I'd make B "stats" and A a "history" tab.
2. **One-line summaries.** Is "ao100 −0.61 in 30 days · 412 solves" under a chart a functional label you accept, or numbers only?
3. **Time axis.** By solve number (even spacing) or by date (gaps show days off)?
4. **Target time.** The time-budget bar needs one: a goal you set (e.g. 15.00), the next round number, or none?
5. **Calendar.** Any heatmap at all? Even without streaks, it can feel like streak pressure.
6. **Recognition view.** A 3D cube at your solving angle, a flat top-face diagram, or a setting?
7. **Recognition answers.** Number keys for the subset (T1–T6), typing the name, or a full case grid?
8. **Cross planning.** Strict 15 s inspection, or untimed planning first?
9. **Review scores.** Keep "efficiency %" and "flow %", or switch to concrete numbers (moves over optimal, pause seconds)?
10. **Sidebar elsewhere.** Keep recent solves on drills, cross and stats, or show that page's own list?
11. **Dark mode.** Oat only, or also a dark version of the palette?
12. **Alg picker.** Only move counts and your timed tries, or also community popularity? I haven't verified that a usable source exists.
