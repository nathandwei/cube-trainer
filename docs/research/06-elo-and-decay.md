# 06: Elo, decay, and what mathtrainer.ai actually does

Researched 2026-10-15 for cube.nathanwei.org. This builds on 02-learning-science.md §2–5 (ARTS, FSRS, grading by target time) and doesn't repeat them. Tags: **[verified]** means I read the source: code, page, paper or abstract. **[unverified]** means memory or a secondary snippet. **[inferred]** means my reading of code whose meaning isn't documented.

## 0. Bottom line

1. **mathtrainer.ai does not use Elo.** Nothing public mentions Elo: not the current JS bundle, not the archived pages from 2017–2026.
   - Each skill has 100 levels.
   - An item's difficulty is the *median time all users take on that exact question*.
   - You go up a level by finishing a round at a *percentile of speed* against other users' times on the same questions. Percentiles come from a log-logistic fit.
   - Levels "decay exponentially with inactivity", and on return you climb a "warm-up" bar back to your stored level [verified, §1].
   - The core needs a crowd of users, so with one user Nathan can't copy it directly.
2. **The research version of the same idea is Math Garden's Elo with the "Signed Residual Time" (SRT) rule.** That rule is score = (2·correct − 1)·(time limit − RT). It folds speed into one number, penalises fast guessing, and has a closed-form expected score [verified]. Use it as the per-rep score everywhere.
3. **Use Elo for generated items and FSRS for fixed case sets.**
   - Elo only makes sense where items come from a generator and never repeat: cross/xcross scrambles. There it should rate *item classes* such as "optimal length 6", not single scrambles.
   - Fixed case sets (PLL, COLL, F2L) are memory problems: keep FSRS per case, plus a per-case speed tracker.
4. **Breaks should grow uncertainty, not lower the rating.**
   - Speed-based procedural skill loses about 0.06 SD/month of disuse, with a half-life of about 13 months [verified, Tatel & Ackerman 2025]. Three weeks costs about 0.04 SD.
   - So show the stored rating unchanged with a "rusty" flag and larger update steps (Glicko/Math Garden style). Let FSRS's retrievability handle the alg-memory part.
   - Cap and sort the overdue pile instead of dumping it on him.

## 1. How mathtrainer.ai works

**What I read.** The live page (`https://mathtrainer.ai/`: one 1.2 MB inline React bundle, config `version 112`); Wayback captures of mathtrainer.org from 2018–2022; and one anonymous `POST /user {"directive":"sync"}`, the same call a first page load makes. The rating logic runs on the server and isn't public. I found no founder posts, nothing on HN, and Reddit was blocked.

**Mechanism.**
- **Skills and levels.** "There are 100 difficulty levels for addition, subtraction, multiplication, division, and advanced questions. Difficulty is defined as the median time it takes users to solve the problem. You advance levels independently for each skill by answering the given questions at an acceptable speed." [verified, current bundle]
- **Speed standard is a percentile of other users.** "The speed required to advance to higher levels is a specific percentile rank among the times other users took to solve the same problem." [verified, /educators text]
  - 2019-07 about page: "The threshold for Level 1 is the 15th percentile but this steadily increases to the 45th percentile for Level 100." [verified]
  - By 2019-12 this read "30th … 50th" [verified].
  - The current threshold isn't published. Reddit users reported needing "speed 70+" to level up and 90+ near level 90 [unverified; search snippet].
- **Percentiles.** "Percentiles are modeled on a log-logistic distribution." [verified]
  - Each served question carries its crowd median, e.g. `{"id":"5+4","med":1.3,"ans":9,"skill":"+"}` [verified, sync response].
  - A log-logistic's scale parameter *is* its median. So the per-question speed score is probably 1/(1+(t/med)^β) with some shape β [inferred].
- **Rounds ("combos").** A round has N questions (a new user's first goal is `next: 5`). It is labelled Basic (3–9), Super, Hyper or Ultra (≥ 14). The "Speed" dial is the round's mean percentile [verified].
- **No wrong answers.** Input auto-accepts when it matches, so errors cost only time. Esc aborts and shows worked steps; a per-question `timeout` ends the round [verified, code]. The FAQ concedes "guessing can be abused, but less so at higher levels" [verified, 2019].
- **The 2017 rule was simpler.** A round passed if total time < the sum of per-question limits, and the integer level went up by 1 [verified, archived JS]. Levels are now fractional (`Math.floor(level)`, `level.toFixed(1)`) [verified].
- **Question selection.** "The algorithm that selects problems is at the very core of Math Trainer" [verified].
  - Shipped config: `"question_scores":{"target":{"weight":0.6},"quality":{"weight":0.4}}` and `"aggression":0.95` [verified].
  - Their meaning is unpublished. Probably item score = 0.6·closeness to the target difficulty + 0.4·item quality [inferred].
- **Other displayed numbers.**
  - "Mental workload" is the sum of the *median* times of the questions answered, "so as to not penalize the user for fast performance" [verified].
  - Rankings use the mean level across the five skills [verified].

**Decay and warm-up.**
- 2019 changelog: "2 July 2019: Levels decay exponentially with inactivity" [verified].
- The config has carried `"decay_rate":0.6` (2021, v41) and `0.65` (2022 → today, v112) [verified]. The client never reads it, so the formula is server-side and unknown.
- Today each skill card gets `{level, warm_level, warm, last, initial}` [verified]:
  - During a session the big number is `floor(warm_level)`.
  - While `warm_level < level`, a progress bar shows `warm_level/level`, coloured by tenths.
  - Once you pass the session's `initial` level, it shows "↑ (level − last)".
  - My reading: the stored level ("established skill") is kept apart from current form. A returning user sees a warm-up bar climbing back to it, not a permanently lower number [inferred].
- A premium "Warmup Mode" existed in 2019–2022 ("1 May 2019: Warmup mode number of questions per submission decreased to 6") [verified].

**Takeaways.** Copy the UX: one integer level per skill, difficulty in seconds, a warm-up bar instead of a visible drop, and an effort metric that credits hard items. Don't copy the engine: percentile-of-crowd needs thousands of users per item (it had 650,000 questions and 20M response times by 2019) [verified, archived about page].

## 2. The research behind this family

### 2.1 Elo for adaptive learning

All from Pelánek 2016 [verified]:
- **Basic rule.** An answer is a match between student and item: P(correct) = 1/(1+e^−(θ−d)), θ ← θ + K(x − P), d ← d + K(P − x).
- **K and uncertainty.** A constant K is a bias–variance trade-off, so use an uncertainty function. Papoušek et al. use U(n) = a/(1+bn) with a = 1, b = 0.05. Klinkenberg et al. 2011 use "U := U − 1/40 + D/30", where D = days since the previous attempt and U starts at 1. That is Math Garden's built-in "uncertainty grows while you're away".
- **Guidelines.** Start with basic Elo plus U(n) and fit a, b by grid search later. You need "at least 100 students to get good estimates of item difficulty". Give items and students different uncertainty functions.
- **Response time.** Time-only problems use log-time Elo: θ ← θ + K(E[log t] − log t), with E[log t] = d_p − θ. Speed plus accuracy uses Klinkenberg's "high speed, high stakes" rule.
- **Short-term memory boost.** The PFAE variant adds f(t) = w/t (w = 80 s) right after practice. So end-of-session performance overstates durable skill.

### 2.2 Math Garden: SRT scoring

**Scoring rule (Brinkhuis et al. 2018).** S = (2x − 1)(d − t), with d fixed at 20 s [verified].
- On screen it is coins that drain each second: you gain the rest if right, lose them if wrong.
- A "?" button skips for 0. Its use is limited to stop farming easy items [verified].
- The Elo update is θ ← θ + K(S − E(S)) and δ ← δ − K(S − E(S)), with E(S) = d·coth(d(θ−δ)) − 1/(θ−δ) [verified].

**The model behind it (Maris & van der Maas 2012).** The rule *is* the sufficient statistic of an exponential-family model [verified]:
- Accuracy follows a 2PL model.
- "The time limit determines the item discrimination."

**Normalised form (my algebra from the verified formula).** Measure time in units of d and score s = (2x−1)(1 − t/d) ∈ [−1, 1]. Then:
- P(correct) = 1/(1+e^−Δ), where Δ = θ − δ;
- E(s) = coth Δ − 1/Δ (the Langevin function, ≈ Δ/3 near 0);
- at the usual 75% target (Δ = 1.10), E(s) = 0.34.

**Target success rate.**
- Math Garden lets children choose easy, medium or hard: about 90%, 75% or 60% correct [verified].
- Jansen et al. 2013 (n = 207, 6 weeks): "the higher the pre-set success rate, the more problems were attempted, and the larger the improvement in math performance" [verified, abstract].

### 2.3 Uncertainty that grows vs. decay of the rating

- **Glicko** [verified, Glickman's docs]. RD = min(√(RD_old² + c²t), 350); unrated players start at 1500 / RD 350. "a player's rating changes only from game outcomes, but his/her RD changes both from game outcomes and the passage of time". Set c from how long until a typical player is as uncertain as a new one: RD 50 → 350 over 30 periods gives c = 63.2.
- **Glicko-2** [verified]. Adds volatility σ (initial 0.06; τ "between 0.3 and 1.2"). Scale μ = (r − 1500)/173.7178. With no games, only φ grows: φ′ = √(φ² + σ²). Since 350/173.7 ≈ 2.0, "unrated" means ±2 logits.
- **Decaying the rating itself** (mathtrainer; Duolingo's Leitner-era strength meters) lowers the number with time. Half-life regression was built after "student complaints that the Leitner-based skill meters did not adequately reflect what they had learned" [verified, Settles & Meeder]. Decay is only right if the skill is really lost, and for motor/speed skill over weeks it mostly isn't.
- **Skill-decay evidence.** Tatel & Ackerman 2025, 1,344 effect sizes from 457 reports [verified]: losses of 0.08 SD/month for accuracy and 0.06 SD/month for speed. Half the gains were gone after about 6.5 months (accuracy), 13 (speed) and 11 (mixed). Arthur et al. 1998 found speed-based and physical tasks decay less [unverified].
- **Warm-up decrement** is a temporary slowdown in the first trials after rest, recovered within minutes (Adams 1961) [unverified]. It is what mathtrainer's warm-up bar models.

### 2.4 Forgetting models: HLR vs FSRS

- **HLR (Settles & Meeder 2016)** [verified]. p = 2^(−Δ/h), with h = 2^(Θ·x). x holds square-rooted counts of right and wrong answers plus lexeme features. Fitted on 12.9M Duolingo traces, h bounded to [15 min, 9 months]. Leitner is the special case Θ = {right: +1, wrong: −1}. It raised daily engagement 12%.
- **FSRS-6** [verified, awesome-fsrs wiki]. R(t, S) = (1 + factor·t/S)^(−w20), with factor = 0.9^(−1/w20) − 1 and default w20 = 0.1542. This is a power law, so the curve flattens. S is the time for R to fall to 90% (HLR's h is the time to 50%). A successful review at lower R raises stability more: "The smaller the value of R, the larger the SInc value" (v4 text).
- **Neither uses response time.** FSRS's recursive per-card (D, S) state plus `ts-fsrs` makes it the practical choice. HLR's lesson is honesty: a decaying meter has to match what was actually lost.

**After 21 days off, default FSRS-6 gives (my computation):**

| Stability S | R at 21 days |
|---|---|
| 2 d | .69 |
| 7 d | .81 |
| 14 d | .87 |
| 30 d | .92 |
| 90 d | .97 |

### 2.5 Known failure modes

- **Variance inflation and non-convergence.** With adaptive selection *and* simultaneous item updates, "the variance of the ratings across items and students artificially increases over time and as a result the ratings do not converge" [verified, Bolsinova, Gergely & Brinkhuis 2026]. Elo also gives no standard errors [verified, Hofman et al. 2020]. Fixes: two parallel rating chains (selection doesn't use the estimate being updated), Urnings, or frozen item difficulties.
- **Single-user calibration.** One user's learning and item difficulty are confounded: item ratings drift down as he improves, so θ under-reports progress. Fix: anchor or freeze difficulties, rate *classes*, update items with a tiny K.
- **Cold start.** Use a large K while uncertainty is high: U(n), or RD 350.
- **Gaming.** Easy-item farming is why Math Garden limited its skip button. Guessing is why SRT makes fast wrong answers cost most [verified]. mathtrainer has no wrong-answer penalty at all [verified].
- **Decay that punishes breaks.** The number falls though skill barely changed (see the Duolingo complaints above).
- **Session saw-tooth.** The short-term boost inflates the end of a session; warm-up decrement deflates the start of the next.

## 3. Mapping to the cube trainer

| Trainer | Player rating | Item rating | Model | Response time |
|---|---|---|---|---|
| PLL/COLL recognition | Set fluency: share of cases fluent (derived, not fitted) | Per-case: FSRS (D, S) + EWMA of log RT | **FSRS + speed tracker**; no Elo | SRT score s, d = 2 × target; FSRS grade from s; ARTS uses raw RT |
| Alg execution (smart cube) | Per-set fluency + TPS | Per-alg EWMA log exec time; FSRS card | **FSRS + log-time tracker** | Per-alg d = 2 × (moves / target TPS + 0.3 s); wrong move or DNF → x = 0 |
| Cross / xcross planning | θ per skill (cross, xcross) | **Class** δ by optimal length (cross 4–8; xcross by its optimum), prior β·(L − 6), refit monthly | **Elo-SRT with U-uncertainty** | d = 15 s (inspection); x = valid plan within slack of optimum |
| F2L cases (41) | Like algs | Per case | FSRS + tracker (recognition-to-insert time) | Per-case d |
| Whole solves | ao100 ± 95% CI, per-stage splits | none | Descriptive only | Splits from move timestamps |

**Why the split.** Elo earns its keep when items don't repeat and difficulty varies continuously, as with mathtrainer's arithmetic and Nathan's scrambles. For 21–42 fixed cases seen dozens of times each, a per-case tracker *is* the item rating, and what decays is memory, which FSRS models.

**Calibrating difficulty with one user.**
- *Cross/xcross:* rate the ~5 length classes, not scrambles; each class sees hundreds of reps. Start at δ(L) = 0.7·(L − 6) [speculative slope], anchor δ(6) ≡ 0, update δ with K_item = 0.02 or freeze it, and refit β by maximum likelihood monthly. Later features: pieces already solved, rotation needed.
- *Case sets:* priors only set order and targets. Execution target = alg move count ÷ measured TPS; recognition starts flat and data takes over within a few sessions.
- *Once other accounts exist:* pool per-case log-RT minus each user's mean to estimate case and class difficulty. That is mathtrainer's crowd-median idea without the percentile ladder; it gives new users priors and enables a community speed percentile.

**Irregular practice: Nathan returns after 3 weeks.**

| Approach | What he'd see | Verdict |
|---|---|---|
| Rating decay (mathtrainer, Duolingo meters) | Level 72 → 61 though he's about 0.04 SD slower | Reject: inaccurate and demoralising |
| Growing uncertainty (Glicko / Math Garden U) | "72 · rusty", larger steps for the next ~20 reps, so 2–3 sessions re-settle it | **Adopt for ratings** |
| FSRS retrievability | Cases at S ≈ 7 d now R ≈ .81; most of the set due at once | **Adopt for memory, but cap and sort** |

**Avoiding the wall** [Anki manual verified]:
1. Cap reviews per trainer per day.
2. Order the backlog by **ascending retrievability**. The Anki manual calls its overdueness sort "generally recommended if you have a large backlog".
3. Introduce no new cases until the backlog clears: "Continuing to introduce new cards when you're already behind can make the backlog worse."
4. FSRS takes the true elapsed days, so overdue cases he passes get bigger stability gains. Tell him so: "overdue reps you pass count extra".

Recognition reps take about 3 s, so even all 63 PLL+COLL cases is about 4 min and no real wall. Execution reps need a physical setup of about 20 s each, so cap those.

**Warm-up.** The first 5 reps of a trainer after a gap of 2 days or more use *high-R known* cases. They are logged with `warmup = 1` and excluded from θ and FSRS, so warm-up decrement doesn't turn healthy cases into Again.

## 4. v1 recommendation

### Per-rep score (every timed trainer)

- **Score:** s = (2x − 1) · max(0, 1 − t/d).
  - x = 1 means correct: right case or alg, a valid plan within slack, a clean execution.
  - An abort scores 0. A timeout scores 0 with x = 0.
  - Default d = 2T, where T is the set's target. On target therefore scores s = 0.5.
- **FSRS grade from s**, matching 02 §5:

| Condition | Grade |
|---|---|
| x = 0 | Again |
| x = 1 and s < 0.5 (slower than T) | Hard, or Again if ruling 1 = "fluent" |
| 0.5 ≤ s < 0.7 | Good |
| s ≥ 0.7 (t ≤ 0.6T) | Easy |

- Use `ts-fsrs` with defaults and desired retention 0.90. Refit once logs allow.

### Per-case speed tracker (case sets)

- On correct reps: m ← m + 0.3·(ln t − m).
- Fluent means exp(m) ≤ T and the last graded rep was not Again.
- Target T per set = 0.8 × his median at calibration (the first 3 sessions). Tighten it by 5% when ≥ 80% of cases are fluent.

### Generated-item rating (cross, xcross)

- **Expected score:** Δ = θ − δ_L, E = coth Δ − 1/Δ (use Δ/3 when |Δ| < 1e-3).
- **Update:** θ ← θ + K(s − E), with K = 0.08 + 0.42·U.
- **Uncertainty:** U ← clamp(U − 1/40 + days_since_prev/30, 0, 1), U₀ = 1. This is Klinkenberg's rule; 21 days away adds 0.70.
- **Selection:** use the session-start θ, the cheap version of the two-chains fix. Pick L to minimise |θ − δ_L − 1.10| for a 75% target, and move ±1 class 25% of the time for variety.
- **Display:** level ℓ = 6 + (θ − 1.10)/β, read as "plans length-ℓ crosses in ≤ 15 s, 3 times in 4". Shown to one decimal, like mathtrainer's fractional level.

### Store (D1)

- **`reps`** (append-only): ids (user, trainer, item, class, alg_version, session, rep_idx), warmup flag, timestamps and rt/exec ms, x, error_type, plan_len/opt_len, d, T, s, fsrs_grade, R_before, elapsed_days, θ/U/δ before and after, move timestamps blob, AUF/view.
- **`cards`** (user × case × trainer): ts-fsrs fields, m, n, fast-correct streak, alg_version.
- **`skill_ratings`** (user × skill): θ, U, last_practiced_at, session_start_θ, peak_θ, T, d.
- **`item_classes`**: δ, n, prior_δ. **`user_settings`**: retention, caps, new per day.

### UI

- **Per trainer**, one big number:
  - case sets: fluent % (0–100);
  - cross: ℓ.
  - Next to it: "↑ x since last session", and a "rusty" chip when U > 0.5.
  - **Never** lower the number for time away.
- **Per round:** a "Speed" score = 100·mean(max(s, 0)), where 50 = on target.
- **Per case:** a grid coloured by fluency, with a due dot.
- **Effort:** "Drill load" = Σ T of reps done. This is mathtrainer's workload idea and credits harder items.
- **Return screen:** "21 days away. Warm-up: 5 reps. Due today: 25 of 38 (weakest memory first, ~8 min); the rest over the next 2 days. New cases paused until caught up."

### Defer

- Glicko-2 volatility.
- Urnings and two-chain estimation.
- Per-case Elo.
- FSRS parameter refit.
- Pooled cross-user calibration, community percentiles and leaderboards.
- A log-logistic speed percentile.
- An overall cross-trainer rating.
- Whole-solve "rating" (keep ao100 + splits).

## 5. Sources

**mathtrainer.ai**
- Math Trainer live app and bundle (about, FAQ, /educators and /parents text, config v112): https://mathtrainer.ai/ [verified]
- Wayback captures of the mathtrainer.org about page, 2019-07-22, 2019-12-15 and 2022-04-16: https://web.archive.org/web/20190722125620/https://www.mathtrainer.org/about [verified]
- Wayback capture of the 2018 home page with inline JS: https://web.archive.org/web/20180105200627/https://www.mathtrainer.org/ [verified]
- r/mathtrainer, via search snippet: https://redlib.belloworld.it/r/mathtrainer [unverified]

**Elo and Math Garden**
- Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education* 98. https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf [verified]
- Klinkenberg, S., Straatemeier, M., & van der Maas, H. (2011). Computer adaptive practice of Maths ability using a new item response model for on the fly ability and difficulty estimation. *Computers & Education* 57(2), 1813–1824. https://doi.org/10.1016/j.compedu.2011.02.003 [verified via Pelánek and Brinkhuis; full text paywalled]
- Maris, G., & van der Maas, H. (2012). Speed-accuracy response models: Scoring rules based on response time and accuracy. *Psychometrika* 77(4), 615–633. https://doi.org/10.1007/s11336-012-9288-y [verified, abstract]
- Brinkhuis, M., Savi, A., Hofman, A., Coomans, F., van der Maas, H., & Maris, G. (2018). Learning as it happens: A decade of analyzing and shaping a large-scale online learning system. *Journal of Learning Analytics* 5(2). https://learning-analytics.info/index.php/JLA/article/download/5796/6478 [verified]
- Jansen, B., et al. (2013). The influence of experiencing success in math on math anxiety, perceived math competence, and math performance. *Learning and Individual Differences* 24. https://dare.uva.nl/id/789fc422-4935-49ca-bcba-803239522951 [verified, abstract]

**Uncertainty and Elo's limits**
- Glickman, M. The Glicko system: http://www.glicko.net/glicko/glicko.pdf [verified]
- Glickman, M. Example of the Glicko-2 system: http://www.glicko.net/glicko/glicko2.pdf [verified]
- Hofman, A., et al. (2020). Tracking with (un)certainty. *Journal of Intelligence* 8(1). https://doi.org/10.3390/jintelligence8010010 [verified, abstract]
- Bolsinova, M., Gergely, B., & Brinkhuis, M. (2026). Keeping Elo alive. *British Journal of Mathematical and Statistical Psychology*. https://doi.org/10.1111/bmsp.12395 [verified, abstract]

**Forgetting and skill decay**
- Settles, B., & Meeder, B. (2016). A trainable spaced repetition model for language learning. *ACL*. https://aclanthology.org/P16-1174.pdf [verified]
- FSRS, "The Algorithm": https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm [verified]
- Anki Manual, Deck Options: https://docs.ankiweb.net/deck-options.html [verified]
- Tatel, C., & Ackerman, P. (2025). Procedural skill retention and decay: A meta-analytic review. *Psychological Bulletin*. https://doi.org/10.1037/bul0000481 [verified, abstract]
- Arthur, W., Bennett, W., Stanush, P., & McNelly, T. (1998). Factors that influence skill decay and retention. *Human Performance* 11. https://gwern.net/doc/psychology/spaced-repetition/1998-arthur.pdf [unverified]
- Adams, J. (1961). The second facet of forgetting: A review of warmup decrement. *Psychological Bulletin* 58 [unverified]

## For a human (rulings)

1. **One number per trainer, and can it drop?** I recommend a mathtrainer-style level per trainer that never drops for time away. Instead it shows "rusty" and re-settles from your next reps. Do you want that? Or do you want a visible decay as a nudge to practise?
2. **What counts as a correct cross/xcross plan?** Exactly optimal length only, or within 1 move of optimal? This sets how hard the cross level is.
3. **Fast wrong answers.** Under the Math Garden rule, a fast wrong answer scores −0.8 and a slow wrong one about 0. This deliberately punishes guessing. Keep it, or score every wrong answer 0?
4. **Target success rate for generated drills.** 75% (Math Garden "medium"), 90% (easy; in a 6-week study kids practised more and gained more), or 60%?
5. **Daily caps after a break.** Suggested: recognition 60 reps, execution 25, F2L 25 per day, weakest memory first, with new cases paused until caught up. OK? And should the trainer show the total overdue count, or only today's capped number?
6. **Warm-up reps.** Should the first 5 reps after 2+ days off be excluded from scoring, so rustiness can't mark cases as forgotten?
7. **Ruling 1 from 02 still stands.** Correct-but-slow is Hard (you remember it) or Again (it isn't fluent yet). This design supports both through the s < 0.5 band.
8. **Other users' data.** When the site has accounts, may their anonymised reps be pooled to calibrate case and scramble difficulty and show a community speed percentile, as mathtrainer does? That needs a privacy/consent line at signup.
