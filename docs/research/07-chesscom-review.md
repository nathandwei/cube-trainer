# 07: How chess.com Game Review works, and what a cube-solve review should borrow

Researched 2026-10-15 for cube.nathanwei.org. **[verified]** = I read it in the source named (S-numbers, listed in §5). **[unverified]** = search snippet or memory. **[judgement]** = my design reasoning. This builds on 01-path-to-sub15.md (pauses are ~45% of an 18 s solve; move count barely changes from 18 s to 12 s) and 06-elo-and-decay.md (Elo per part). It doesn't repeat them.

## 0. Bottom line

1. **Game Review grades each move by *expected points lost*: a rating-dependent win probability from 0 to 1.** The bands are Best 0, Excellent ≤.02, Good ≤.05, Inaccuracy ≤.10, Mistake ≤.20, Blunder >.20 [verified S1]. **The cube equivalent is *seconds lost against what is expected at your level*.** Nathan's page grades extra moves, and at 18 s moves are the smaller lever (01 §1).
2. **The summary is a report card.** It shows a Coach one-liner, an Accuracy score (most land in 50–95), a single-game "Game Rating", a count of each label, and a grade for each phase [verified S2, S3, S13, S14]. The planned Elo per part (cross, F2L, last layer) maps onto Game Rating plus the phase grades.
3. **The learning loop is: walk the key moments with "Next", "Retry" before seeing the answer, then get an adjusted score** [verified S3, S13]. **On a cube, Retry means re-creating the exact state at that moment and solving the stage again.** It is the biggest thing missing today.
4. **Positive labels and characters carry the motivation.** Brilliant, Great, Skills points and celebrity-voiced coaches all do this work, and Brilliant and Great are deliberately looser for newer players [verified S1, S7, S15].
5. **The complaints are specific:**
   - an inflated per-game rating [verified S18]
   - arbitrary Brilliants, and errors flagged that no human at that level could see [verified S19]
   - labels that change between analyses [verified S6]
   - the paywall [verified S10]

   Each one suggests a guardrail (§2).

## 1. Chess.com Game Review, feature by feature

### 1.1 Flow
- **Game-over pop-up.** A quick analysis runs on your device and gives counts such as Brilliants and Misses. The full review then runs on the server (Stockfish 18, full NNUE) and can relabel moves [verified S6, S11].
- **Highlights screen (report card)** [verified S3, S7, S14]:
  - a "Game Graph" showing who was ahead after each move
  - a one-line Coach summary
  - Accuracy for each player, and counts of each label
  - a performance rating
  - phase grades (opening / middlegame / endgame), shown as label icons; hovering over one shows that phase's accuracy
  - the Skill points on offer, e.g. "+2"
- **Move-by-move walk.**
  - Arrows or swipes step through the game, the Coach comment updates on every move, and "Next" jumps to the next key move [verified S3, S4].
  - "The first key move is usually the last book move." It shows the opening's name, your record with it, and a suggested course [verified S3].
  - Key moves include "both good moves and missed opportunities" [verified S13].
- **Show / Best / Retry.**
  - Show buttons are labelled by what they show: 'Show Fork', 'Show Lost Piece', 'Show Checkmate', 'Show Idea'.
  - 'Best' shows the strongest move, with "your positional score if you had played the suggested move" [verified S3, S4].
  - Retry replays the position. A correct answer shows the score you would have had; a wrong one gets Coach feedback, and the app offers hints [verified S3, S4]. The 2022 launch promised "a new adjusted accuracy score" [verified S13].
- **Visual explanations.** Hovering over highlighted Coach words draws arrows and squares on the board [verified S14].
- **Self Analysis.** A free-form engine board with an eval bar, lines and arrows. Its charts are Score, **Time (per move)**, Best Move Diff and Themes [verified S8].
- **Settings** cover:
  - arrows
  - which side's key moves are highlighted
  - labels shown on the board
  - autoplay speed
  - the Coach avatar
  - Skills
  - "Show Time Spent On Move"

  [verified S3]

### 1.2 Expected points and labels
"Expected Points uses data science to determine a player's winning chances based on their rating and the engine evaluation, where 1.00 is always winning, 0.00 is always losing, and 0.50 is even." Each move is labelled by how many expected points it loses (Classification V2, page dated Feb 9 2026) [verified S1]. Neither the formula nor the data behind it is published [verified absence S1–S5].

| Label | Expected points lost [verified S1] | Help-centre gloss [verified S3] |
|---|---|---|
| Best ★ | 0.00 | "The chess engine's top choice" |
| Excellent | 0.00–0.02 | "Almost as good as the Best move" |
| Good | 0.02–0.05 | "A decent move, but not the best" |
| Inaccuracy ?! | 0.05–0.10 | "A weak move" |
| Mistake ? | 0.10–0.20 | "A bad move that immediately worsens your position" |
| Blunder ?? | 0.20–1.00 | "A very bad move that also loses material or the game" |

- **Great !** A move "critical to the outcome of the game": it turns a losing position into an equal one, or an equal one into a win, or it is "the only good move". The rule is "more generous … for new players" [verified S1].
- **Brilliant !!** "Always the best or nearly best move" and "a good piece sacrifice". Two more conditions: you are not in a bad position afterwards, and you were not "completely winning even if you hadn't found the move". What counts as a sacrifice is looser for newer players [verified S1].
- **Miss.** You fail "to capitalize on your opponent's mistake" and miss "the opportunity to gain a winning position". The thresholds for winning, equal and losing vary by rating [verified S1].
- **Blunder (2023 rule).** A blunder had to drop the evaluation *and* "lose material or allow checkmate". Other errors became Misses, to "treat … like puzzles from your own games" [verified S14]. The V2 page doesn't say whether this still applies [verified absence S1].
- **Book.** "A conventional opening move". The book database was rebuilt in 2023 to match "well-known opening theory" [verified S3, S14].
- **Forced.** Not in any current official table [verified absence S1, S3, S4]. A "forced" tag appeared in the older analysis around 2017, and users disagreed about what it meant [verified S20].

### 1.3 Accuracy
- **CAPS2.** Accuracy runs on "CAPS2", the successor to CAPS. Moves are still compared to the engine's top choices, "but the math … has changed" [verified S2].
- **Why it changed.** CAPS v1 gave games with about 40% Best moves single digits, and near-perfect games 99.9. That "made some people feel bad … and led to a lot of cheating allegations." CAPS2 aims for "the feeling of being graded on a test in school", with most scores "between 50 and 95" [verified S2]. A score of 100 is "challenging" but possible [verified S13]. The formula is a trade secret [unverified S24; S2 gives no formula].
- **Lichess's formula is public, and a usable template** [verified S16]:
  - Win% = 50 + 50·(2/(1+e^(−0.00368208·cp)) − 1)
  - move accuracy = 103.1668·e^(−0.04354·ΔWin%) − 3.1669
  - game accuracy = the average of a volatility-weighted mean and the *harmonic* mean, tuned to what accuracy "should *feel* like"

  Lichess warns that comparing accuracy to a test grade "is flawed", and that lopsided positions inflate it [verified S16].

### 1.4 Game Rating
"Estimates your performance in a single game based on the quality of your moves." It compares "the quality of your moves to what is expected from a player at your rating level." For example, a 2404-rated player "played at the level of a 2650" [verified S5]. It averages out to your real rating over many games, swings a lot from game to game, and is unreliable when the two players' ratings are far apart [verified S3, S5]. The formula is unpublished [verified absence].

### 1.5 Coach, Skills, tiers, devices
- **Coach.** There are "four unique coaches and twelve celebrity coaches, each with a distinct speaking voice". They send motivational messages and *reminders to … review your games* [verified S12]. The celebrity voices (Hikaru, Levy, Magnus, the Botez sisters, Cramling, Rensch) arrived in a beta in Aug 2025 [verified S15].
- **Skills.** You earn points for habit moves ("developing your pieces early, spotting a fork, or castling at the right time"). Each one plays an animation. Mastering a Skill brings a celebration, Coach praise, and the next Skill [verified S7]. I found no source for a special Brilliant sound [unverified].
- **Tiers.** Free accounts get "1 full game review analysis per day" [verified S10] but always see Accuracy, the move labels, and Self Analysis [verified S3]. Platinum and Diamond get unlimited reviews. Diamond adds Coach explanations on every move, Insights, and deeper engines [verified S10, S6].
- **Devices.** Mobile has swipe navigation, a draggable Coach bubble, a Show / Best / Retry row, and a setting for where the eval bar sits [verified S4]. Different engine strengths on web and app can label the same move differently [verified S6].
- **Insights (Diamond).** Accuracy by phase and by move number, "Game Shapes" (the shape of the review graph), and tactics *found vs missed* [verified S9].

## 2. Why it works, and what people dislike

**Why it's compelling** [judgement, backed by cited design statements]:
- **One number to chase.** chess.com says Accuracy became "one of the most popular features … many members celebrate new records" [verified S13]. Both chess.com and Lichess rescaled theirs *for how it feels* [verified S2, S16].
- **Wins get named.** Great and Brilliant exist because good play "deserve[s] … praise", and both are looser for weaker players [verified S13, S1]. Duolingo's 2026 Chess Game Review cut the labels to three (Good moves, Missed opportunities, Mistakes) and added a retry and XP for reviewing [verified S22].
- **A voice.** The Coach turns engine output into sentences [verified S12, S15].
- **Fix it now.** Retry shows the better score straight away [verified S13].
- **Progress even in a loss.** Game Rating and phase grades let a loss still feel like progress [judgement].

**What users criticise:**
- **Inflated Game Rating.** One player asked "why … is everyone so good?"; a reply called it "built to increase a person's ego" [verified S18].
- **Arbitrary Brilliants.** "For some reason, it got counted as a brilliant move" [verified S19]. Sacrifices "which are merely fine" get called brilliant [unverified, r/chess snippet]. People call a move brilliant when it looks bad on a shallow search but wins on a deep one [verified S21].
- **Inhuman depth.** A 13-move combination is flagged as a "missed win" below 2000 [verified S19].
- **Inconsistency.** The same move gets different labels in the quick and full analysis, and on different devices [verified S6].
- **Paywall.** The free tier allows one review a day [verified S10]. Free clones such as Chessigma and Chessiro advertise "unlimited" reviews [claims unverified].
- **Engine-first learning.** Coaches say to analyse your own game before the engine, because "you can't unsee" its answer [unverified snippets]. Lichess's Retry is built around this [verified S17].

**Guardrails for the cube version** [judgement]:
- Keep luck-adjusted ratings honest.
- Print *why* each special label fired.
- Grade against a reference a human could find.
- Keep the analysis deterministic.
- Hide the better line until after a retry.

## 3. Chess element → cube analogue

The cube's "opponent" is the scramble, and a chess "move" corresponds to a **stage** (cross, a pair, an LL step). Data column: **T** = per-move timestamps (smart cube or virtual), **G** = gyro, **—** = cube state only.

| Chess.com | Cube analogue | Computation | Data |
|---|---|---|---|
| Expected points | **Expected stage time at level L** | E = recog(L) + refMoves × msPerMove(L). refMoves = the stage optimum, or a human-reachable reference (ruling 1) | T |
| EP lost | **Seconds lost** | loss = max(0, stage.totalMs − E). Split into move waste, (moves − ref) × msPerMove(L), and the remainder, which is pause/recognition | T |
| Bands .02/.05/.10/.20 | **% of target time T** | With 1 EP ≈ T/2: Excellent ≤1%, Good ≤2.5%, Inaccuracy ≤5%, Mistake ≤10%, Blunder >10%. At T = 18 s that is 0.18 / 0.45 / 0.9 / 1.8 s | T |
| Blunder needs material loss | **Blunder needs a concrete error** | Progress undone (a solved piece broken), a redo, or one gap ≥1.5 s. Otherwise cap at Mistake | T |
| Accuracy | **Solve accuracy, hard to max out** | Stage: 103.17·e^(−0.04354x) − 3.17 with x = 200·loss/T, giving 91 / 64 / 40 at 0.18 / 0.9 / 1.8 s. Solve: average of the time-weighted mean and the harmonic mean | T |
| Game Rating | **Solve rating** on Nathan's Elo | The R whose expected stage times, *for this scramble's optimal counts*, sum to the actual time. It rates quality, so a PLL skip doesn't inflate it | T |
| Phase grades | **Cross / F2L / LL icons + accuracy** | Hovering an icon shows that part's accuracy. These feed the top-right Elo ↑/↓ | T |
| Eval bar / graph | **Projected finish** | elapsed + expected time for the remaining stages. A flat stretch is a pause; a drop is a skip or a free pair | T |
| Best ★ | At the reference | moves ≤ ref and loss ≤ 0 | T |
| Great ! | **The only good choice** | Chosen slot beat the next-best slot by ≥3 moves, or a cross with optimum ≥7 solved optimally | — |
| Brilliant !! | **A sacrifice that pays** | Stage *i* went ≥2 moves over its optimum, but *i* + *i+1* ≤ (opt *i* + best next pair after optimal *i*) − 2. Examples: an xcross or keyhole. Must be rare, and must print its reason | — |
| Miss | **The scramble's gift, unused** | An xcross was available at ≤ cross opt + 2 but a plain cross was done; a ≤3-move pair was skipped for one ≥3 moves longer (today's "slot" moment); a solved pair was broken | — |
| Book 📖 | **A known algorithm** | Moves match his alg sheet, ignoring AUF. Graded on recognition and TPS against *his* per-case average | T |
| Forced | Mostly drop | Only for ≤1-move stages. EPLL is still a choice of algorithm | — |
| Next / key moves | Chronological walk | First moment is the inspection / cross plan (the cube's "last book move"). Good moments included | — |
| Show Fork/Idea | **Labelled shows** | "Show xcross / free pair / better slot / no-rotation line" | —/G |
| Retry | **Re-solve from the exact state** | Set up the stage's start state, hide the line, time the retry, then show "this would be 16.8 s, acc 84" | T |
| Coach line | **Template** | From the largest loss: "Clean cross; 1.4 s stall before p3 cost the most." | T |
| Skills | **Habit points** | Lookahead pair, rotationless pair, predicted AUF, xcross used, no F2L gap >1 s | T, G |
| Insights | Trends across solves | xcross taken vs missed, free pairs missed, LL recognition per case | T |
| Quick analysis | **Timer chip** | "acc 81 · 1 miss · cross ★" right after the solve | T |

## 4. Top 8 changes to the review page, in priority order

1. **Grade stages on seconds lost, not extra moves.**
   - *Show:* the badge plus "−0.6 s (0.4 moves, 0.2 pause)".
   - *Compute:* E and loss as in §3, with bands at 1 / 2.5 / 5 / 10% of T. Blunder only with a concrete error. The move count stays as the explanation.
   - *Data:* timestamps, the existing optimal counts, and per-stage msPerMove and recognition baselines.
   - *Why first:* at 18 s, pauses are about 45% of the time and move count barely changes between 18 s and 12 s (01 §1), so `verdictForExtraMoves` grades the smaller lever.
2. **Report-card header.**
   - *Show:* a Coach line; **Accuracy**; a luck-adjusted **Solve rating**; Cross / F2L / LL grade icons with accuracy; and Elo ↑/↓ at top right. Efficiency and flow become sub-stats.
   - *Data:* timestamps, plus the rating ↔ time map from 06.
3. **Miss, Great, Brilliant and Book labels, plus a counts row** ("1 great · 1 miss · 2 book").
   - *Show:* each special label prints its trigger, e.g. "+2 on cross saved 5 on p1".
   - *Data:* cube state; solver calls from hypothetical states; the alg sheet for Book. No gyro needed.
4. **Retry before reveal.**
   - *Show:* "Retry" on each key moment. The cube jumps to the stage's start state with the line hidden. After he solves it, show the adjusted time and accuracy, then "Show".
   - *Compute:* state = scramble + moves[0..startMove]. On the physical cube, give a two-phase setup scramble, confirm the state the cube reports, and time from his first turn.
   - *Data:* smart cube or virtual cube.
5. **Key-moment walk.** "Next" steps through moments **in solve order** and includes good ones. The top-3-by-cost list stays in the summary. Show buttons are named for what they show: xcross, free pair, better slot.
   - *Data:* cube state; timestamps for pauses.
6. **Projected-finish bar and graph.**
   - *Show:* "on pace for 17.2 (ao12 18.1)" beside the cube, and the projection line over the pace chart.
   - *Compute:* elapsed + Σ expected remaining stage times. Use optimal counts from the current state for cross and pairs, and his per-case average for LL.
   - *Data:* timestamps, the existing solvers.
7. **Habit points (Skills)** for what speeds up an 18 s solver:
   - lookahead pair (next recognition < 300 ms)
   - no F2L gap > 1 s
   - predicted AUF (no gap > 400 ms before an LL alg)
   - xcross taken
   - rotationless pair

   *Data:* timestamps. The **gyro** (RotationEvent) is needed for rotationless pairs.
8. **Timer chip plus stored labels.**
   - *Show:* "acc 81 · 1 miss · F2L ↑" under the time, linking to the review.
   - *Compute:* persist labels and losses on the SolveRecord, so a later Insights view can trend xcross taken vs missed and free pairs missed.
   - *Data:* timestamps; the gyro for rotation trends.

## 5. Sources

- S1 "How are moves classified? What is a 'blunder' or 'brilliant,' etc.?", Chess.com Help Center, Feb 9 2026: https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-and-etc
- S2 "How is accuracy in Analysis determined?", Help Center, Jun 21 2025: https://support.chess.com/en/articles/8708970-how-is-accuracy-in-analysis-determined
- S3 "How does Game Review work?", Help Center (updated ~Oct 2026): https://support.chess.com/en/articles/8584089-how-does-game-review-work
- S4 "How do I use Game Review on the app?": https://support.chess.com/en/articles/10328363-how-do-i-use-game-review-on-the-app
- S5 "How is Game Rating calculated in Game Review?": https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review
- S6 "Why did my move classification change in Game Review?": https://support.chess.com/en/articles/11845102-why-did-my-move-classification-change-in-game-review
- S7 "What are Skills on Chess.com?": https://support.chess.com/en/articles/16243840-what-are-skills-on-chess-com
- S8 "How do I use Game Analysis?": https://support.chess.com/en/articles/8583757-how-do-i-use-game-analysis
- S9 "What is Insights on Chess.com?": https://support.chess.com/en/articles/8708925-what-is-insights-on-chess-com
- S10 "Premium plans on Chess.com" / "What does each level of premium membership get me?": https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me
- S11 "How do the chess engines on Chess.com work?": https://support.chess.com/en/articles/9462780-how-do-the-chess-engines-on-chess-com-work
- S12 "How do I manage the Coach?": https://support.chess.com/en/articles/10812255-how-do-i-manage-the-coach
- S13 "Game Review Now Available For All Chess.com Members", Chess.com News (CHESScom), updated Nov 9 2022: https://www.chess.com/news/view/chesscom-releases-new-game-review
- S14 "Announcing New Game Review Features: Visual Explanations, New Move Classifications, And More!", Chess.com News, Mar 17 2023: https://www.chess.com/news/view/chesscom-launches-game-review-v2
- S15 "NEW: Choose Your Coach Adds Six Chess Stars", Chess.com Beta announcement (NM SamCopeland), Aug 19 2025: https://www.chess.com/announcements/view/new-choose-your-coach-adds-five-chess-stars
- S16 "Lichess Accuracy metric": https://lichess.org/page/accuracy
- S17 "Learn from your mistakes", Lichess blog, Dec 22 2016: https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes
- S18 "Why, according to game review, are many of my opponents playing 1000+ level games at 500 rapid?", Chess.com forum, Oct 2025: https://www.chess.com/forum/view/for-beginners/why-according-to-game-review-are-many-of-my-opponents-playing-1000-level-games-at-500-rapid
- S19 "Why the Game Review is Not Very Helpful", Chess.com blog (SotiraqSenjo), Jun 29 2023: https://chess.com/blog/DSTirana1/why-the-game-review-is-not-very-helpful
- S20 "forced", Chess.com forum, 2017–18: https://www.chess.com/forum/view/game-analysis/forced
- S21 Ben Balas, "Science of Chess: What makes a move seem 'Brilliant?'", Mar 23 2025: https://benbalas.substack.com/p/science-of-chess-what-makes-a-move ; Zaidi & Guerzhoy, "Predicting User Perception of Move Brilliance in Chess": https://arxiv.org/abs/2406.11895
- S22 "Introducing Chess Game Review: Learn from every match", Duolingo Blog, Aug 11 2026: https://blog.duolingo.com/chess-game-review/
- S23 "ALL TYPES OF MOVES IN GAME REVIEW", Chess.com blog (tf0ch), Aug 12 2025: https://www.chess.com/blog/tf0ch/all-types-of-moves-in-game-review
- S24 "What Chess Players Need to Know About Chess.com's Accuracy Score", SayChess Substack (snippet only): https://saychess.substack.com/p/what-chess-players-need-to-know-about

## For a human (rulings)

1. **Grading reference:** the true optimum, which risks the "no human sees that" complaint, or a human-reachable reference? A human-reachable reference could be the optimum in an RUF-style move set, or expected moves at your level.
2. **What T is:** T is the target time that sets the label thresholds and the Accuracy scale. It could be your current ao12, which gives a 50–95 "school grade" feel; your goal time, e.g. 15 s, which makes it harder to max out; or a per-Elo-level time.
3. **Headline number:** Accuracy, Solve rating, or both? Should Accuracy feel like a test grade (chess.com) or be strict (Lichess)?
4. **Rating ↔ time mapping** for the per-part Elo: how many points is 1 s, or 10% faster, worth? Shared with 06.
5. **Luck:** should Solve rating correct for scramble luck (skips, easy crosses)?
6. **Brilliant:** keep it at all? How rare (about 1 in 20 solves)? Is "a sacrifice that pays off next stage" the right rule?
7. **Blunder:** must it involve a concrete error (progress undone, a redo, a gap of at least 1.5 s), or can lost time alone make one?
8. **Coach:** templated factual lines or Claude-written ones? A persona? Audio?
9. **Retry:** on the physical smart cube (setup scramble plus a state check) or on screen? Do retries count toward stats or ratings?
10. **Skills:** do you want habit badges? Which first? Suggested: lookahead, then no-pause F2L, then rotationless, then predicted AUF.
