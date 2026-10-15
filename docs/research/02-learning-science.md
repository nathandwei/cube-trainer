# 02: Learning science for speedcubing trainers

Researched 2026-10-15 for cube.nathanwei.org. Tags: **[V]** means I read the source or its abstract. **[V2]** means a number taken from a secondary source quoting the paper; check it before citing. **[U]** means memory, not checked this session.

## 0. Bottom line

1. **Pauses, not turning speed, are the main lever for 18 → 15 s.**
   - In the only frame-by-frame CFOP study, the share of solve time spent paused correlated r = .72 with solve time.
   - Solvers averaging 20 s paused 46% of the time; 10 s solvers paused 33%. About 6.2 s of the 10 s gap came from fewer pauses.
   - F2L was the largest source of pauses at every level [V, Boyce & Storm 2022].
   - The study is small (16 solvers, 69 non-independent solves, a high-school paper), so it is directional only. Still, recognition and lookahead deserve the most trainer effort.
2. **Schedule within a session by response time as well as accuracy; use FSRS across days.**
   - Kellman's ARTS scheduler beat fixed spacing: 1-week delayed accuracy .42 vs .30–.31 [V, full text].
   - FSRS does not use response time, so "correct but slow" has to live in how you define a rep's grade.
3. **Recognition is perceptual classification.**
   - Train it with many short, varied, timed trials, and retire a case only when it is correct *and* fast.
   - A histopathology module built this way produced pre→post d = 0.8–1.6 in about 12–18 minutes [V, Krasne et al. 2013].
4. **Interleave confusable cases.**
   - Interleaving helps most when categories look alike: overall g = .42, paintings .67, words −.39 [V].
   - COLL cases within one OCLL set (the orientation group that shares a top-face pattern) are the textbook case.
5. **Several popular "desirable difficulty" effects are weaker than their reputation.**
   - Random-order motor practice, reduced feedback frequency, self-controlled feedback and sleep-specific motor consolidation all fall in this group.
   - Don't build features around them.

## 1. Cubing-specific research (thin)

- **Boyce & Storm (2022), "Rubik's cube: What separates the fastest solvers from the rest?", *J. Emerging Investigators*** [V, full text].
  - TPS vs solve time r = −.85; pause fraction r = .72.
  - Regrips r = .75; cube rotations r = .48.
  - Move counts: cross r = .42, LL r = .34, F2L r = .05.
  - F2L takes about 52% of solve time.
  - In a survey of 1,385 solvers, everyone under 10 s knew at least 100 algs. This is correlational.
- **Zarei et al. (2025), "The electrocortical activity of elite Rubik's cube athletes while solving the cube", *Exp. Brain Res.*** [V, abstract]: EEG of 13 cubers, correlational, nothing actionable.
- **Meinz, Hambrick, Leach & Boschulte (2023), "Ability and Nonability Predictors of Real-World Skill Acquisition: The Case of Rubik's Cube Solving", *J. Intelligence*** [V, abstract].
  - 79 novices learned a beginner method.
  - Fluid intelligence predicted skill. Working-memory capacity, grit and personality did not.
- **No eye-tracking study of speedcubers turned up** in explicit searches. Claims about lookahead gaze are coaching lore.

## 2. Findings by component skill

### (a) Algorithm memorization

- **Testing beats restudy.**
  - g ≈ .50 (Rowland 2014, *Psych. Bull.*) [V2]; recall tests beat recognition tests (Rowland's abstract) [V].
  - g ≈ .61 (Adesope, Trevisan & Sundararajan 2017, *Rev. Educ. Res.*) [V2].
  - So the trainer should make you produce the alg before showing it, not pick it from a list.
- **Spacing.**
  - The best gap is about 20–40% of the retention interval for a 1-week test, falling to 5–10% for a 1-year test (Cepeda, Vul, Rohrer, Wixted & Pashler 2008, *Psych. Sci.*) [V].
  - Donovan & Radosevich 1999 (*J. Appl. Psych.*, full text) [V]: spaced beats massed by d = .46 overall. The gain is d = .97 for simple motor tasks but only .11/.07 for complex ones. Low-rigor studies showed bigger effects.
- **Learning criterion and relearning.**
  - Retrievals that are hard but succeed help more, with diminishing returns as the criterion rises (Pyc & Rawson 2009, "Testing the retrieval effort hypothesis", *J. Mem. Lang.*) [V2].
  - Successive relearning: one correct recall in each of 3 spaced sessions gave 68% one-week retention, vs 26% for 3 recalls in a single session (Rawson et al. 2018, via Rawson & Dunlosky 2022, *Curr. Dir. Psych. Sci.*) [V2].
- **Motor chunks.**
  - Practiced key sequences split into chunks that merge with practice. Chunk boundaries show up as longer gaps between presses (Verwey's discrete-sequence-production work; Acuña et al. 2014, *J. Neurophysiol.*) [V].
  - So show algs split into triggers. With a smart cube, long gaps between moves locate hesitations.
- **Consistent mapping.** Automaticity comes from always pairing a given stimulus with the same response (Schneider & Shiffrin 1977) [U]. Lock one alg per case, and version it.

### (b) Case recognition

- **Perceptual learning modules (PLMs).** Kellman, Massey & Son 2010, "Perceptual learning modules in mathematics" (*Topics Cog. Sci.*) [V].
  - Many short classification trials over varied examples, with feedback.
  - They target finding the features that matter ("discovery") and speed ("fluency").
- **Krasne, Hillman, Kellman & Drake 2013, histopathology PLM** (*J. Pathol. Inform.*, full text) [V].
  - A category was retired after 3 consecutive correct answers within a target response time (RT). The target was 12 s, set as 2 × (expert mean − 2 s) + 2 s.
  - "Score" counted only correct answers within the target. It rose by d = 0.8–1.6.
  - Median completion time was 11–18 minutes.
  - Score stayed well above pre-test at 6–7 weeks, but only 33–45% of students took the delayed test.
  - Many pre-test "correct" answers were slow analysis rather than recognition. Accuracy alone hides this.
- **ARTS.** Mettler, Massey & Kellman 2016, "A comparison of adaptive and fixed schedules of practice" (*JEP: General* 145:897; full text) [V].
  - Priority formula: P = a(N − D)·[b(1−α)·log(RT/r) + α·W].
    - N is the number of trials since the item was last shown.
    - D = 1 is an enforced delay.
    - α = 1 on an error; W = 20, so an error brings the item back after about one trial.
    - On a correct answer, slower RT means higher priority, so slow items return sooner.
    - Other parameters: a = .1, b = 1.1, r = 3.0.
  - New items enter when the priority of items in play drops below a default.
  - Adaptive beat both fixed schedules at immediate and 1-week tests. Expanding and equal spacing did not differ.
  - Yoked controls (fixed schedules copied from adaptive learners) showed the gain comes from adapting to each item and learner.
- **Interleaving.** Brunmair & Richter 2019, "Similarity matters: A meta-analysis of interleaved learning and its moderators" (*Psych. Bull.*, 59 studies) [V].
  - Overall g = .42.
  - It helps more when categories look alike and their members vary less, and for complex material.
  - Blocking won for word lists.
  - So interleave COLL cases within one OCLL set, and PLL pairs such as Ga/Gc.
- **Expert perception.**
  - Chess experts recall structured positions as chunks (Chase & Simon 1973) [U], and show far larger visual spans for structured positions only, with fewer fixations, often between pieces (Reingold, Charness, Pomplun & Stampe 2001, "Visual span in expert chess players", *Psych. Sci.*) [V].
  - Across domains, experts make shorter fixations, look more at task-relevant areas and take in more peripherally (Gegenfurtner, Lehtinen & Säljö 2011 meta-analysis, *Educ. Psych. Rev.*) [V].
  - So recognition should come to rely on a few diagnostic stickers; brief or partial views test this.
- **Match training to test conditions.**
  - Show cases from the real solving angle (U+F+R visible), with random AUF (pre-turn of the top layer) and, if relevant, random colour scheme.
  - Transfer to new examples is the explicit goal of PLMs [V]. The specificity-of-practice idea (Proteau) supports matching conditions [U].

### (c) Execution and TPS

- **Skill shifts the speed–accuracy curve.** Shmuelof, Krakauer & Mazzoni 2012, "How is a motor skill learned?" (*J. Neurophysiol.*) [V].
  - Skill is defined as a shift of the speed–accuracy trade-off function. Learning came mainly from less trial-to-trial variability and smoother movement.
  - So log time *and* execution errors (lockups, mis-turns). Progress means faster at the same error rate.
- **Contextual interference (random vs blocked order).**
  - Random order beat blocked for retention in Shea & Morgan 1979 [U]. Later meta-analyses shrink it:
    - Brady 2004: lab d = .57, applied .19. Ammar et al. 2023: SMD .24, not significant [both V, via Czyż].
    - Czyż, Wójcik & Solarská 2024, "The effect of contextual interference on transfer in motor learning" (*Front. Psych.*) [V]: transfer SMD .55; lab .75; applied .37 (n.s.); children .12; nearly all studies weak quality.
  - Said to shrink or reverse for novices and complex skills (Guadagnoli & Lee 2004; Wulf & Shea 2002) [U].
  - So block a new alg's first reps, then randomize. Moderate evidence at best.
- **Micro-offline gains.** Early sequence-skill gains occur during ~10 s rests between practice bouts (Bönstrup et al. 2019, "A rapid form of offline consolidation in skill learning", *Curr. Biol.*; replicated with n = 951) [V]. So drill in short sets with breaks.

### (d) Lookahead

- **Dual-task vs skill-focus.** Beilock, Carr, MacMahon & Starkes 2002, "When paying attention becomes counterproductive" (*JEP: Applied*) [V].
  - Experts did better under a dual task than when attending to their own mechanics.
  - Novices, and experts using their weak foot, did better with skill focus.
  - Implication: tracking the next pair is affordable only once execution of the current pair is automatic. Algorithmic F2L recognition and execution come before lookahead drills.
- **Slow-turning and no-pause drills** have not been tested in any paper. They fit the dual-task account [speculative].
- **Expert gaze** in other domains shows fewer, shorter, relevance-targeted fixations plus wide peripheral pickup (Gegenfurtner; Reingold) [V]. This has not been measured in cubers.

### (e) Inspection planning

- **Mental practice.**
  - Small but positive: r = .131, moderated by duration, task type and imagery type (Toth et al. 2020, "Does mental practice still enhance performance? A 24 year follow-up…", *Psych. Sport Exerc.*) [V].
  - Driskell, Copper & Moran 1994 reported d ≈ .53, larger for cognitive tasks and fading over weeks [U].
- **Planning is a skill in its own right** and needs practice with outcome feedback.
  - The drill: plan, commit, execute, compare with the optimum.
  - Every cross is solvable in ≤ 8 moves [U], so a breadth-first search in the browser can give the optimal answer.
- **Working memory may not be the bottleneck.** In Meinz 2023, working-memory capacity didn't predict skill [V]. That was a different population and task, so the evidence is weak.

### (f) Whole-solve integration

- **Part vs whole.**
  - Naylor & Briggs (1963): part practice suits complex tasks whose parts are loosely coupled; whole practice suits tightly coupled tasks [U].
  - Fontana et al. 2009, "Whole and part practice: A meta-analysis" (*Percept. Mot. Skills*): broadly supportive but few studies [V2].
  - CFOP stages are sequential segments, so drilling them separately is fine. The tight couplings are the transitions (cross → first pair, last pair → LL recognition), and these need whole or chained practice.
- **Deliberate practice.**
  - Explains 26% of performance variance in games, 21% in music, 18% in sports and under 1% in professions (Macnamara, Hambrick & Oswald 2014, *Psych. Sci.*, 88 studies) [V].
  - Sports: 18% overall but only 1% among elites (Macnamara, Moreau & Hambrick 2016) [V].
  - What survives: targeted practice on the weakest component, with immediate feedback. At 18 s, Nathan is far from the elite ceiling, so practice volume still matters.

## 3. Cross-cutting findings

- **Feedback frequency.**
  - Reduced vs 100% feedback: delayed g = .21, immediate g = .06, and the difference was not significant (McKay et al. 2021, pre-registered, 37 studies, N = 1,145) [V, abstract]. This fails to support the guidance hypothesis's prediction.
  - Self-controlled feedback: naive g = .44, but indistinguishable from zero after bias correction (McKay, Yantha, Hussien, Carter & Ste-Marie 2022, "…Underpowered, biased, and lacking evidential value", *Meta-Psychology*) [V].
  - So give knowledge of results (time, right/wrong) every rep. The dependency risk is with *concurrent* aids (showing the alg while executing, highlighting the next pair), and those should fade [U].
- **Learning vs performance.** Practice-time performance overstates learning. Use delayed tests without feedback (Soderstrom & Bjork 2015) [U].
- **Sleep.**
  - Much of the apparent sleep-specific motor gain may be artefact (Pan & Rickard 2015, "Sleep and motor learning: Is there room for consolidation?", *Psych. Bull.*) [V citation; U detail].
  - Named confounds include time of day and fatigue from massed training; publication bias appears severe (Rickard et al. 2008; 2022) [V].
  - So schedule daily spaced sessions, and build nothing that relies on sleep.
- **FSRS** (open-spaced-repetition wiki "ABC of FSRS" and "The Algorithm"; ts-fsrs README) [V].
  - It tracks three quantities per card: Difficulty, Stability (days for recall probability to fall from 100% to 90%) and Retrievability.
  - FSRS-6 has 21 parameters, a power-law forgetting curve with a trainable decay, and uses same-day reviews.
  - Desired retention of .70–.97 is considered reasonable.
  - Default parameters come from about 10k users; you re-fit on your own logs with `@open-spaced-repetition/binding`.
  - Per review it needs: card state, timestamp, and a rating (Again/Hard/Good/Easy = 1–4). Response time is **not** an input.
  - Per a developer on the Anki forum, the loss treats Again as 0 and everything else as 1. Hard means *passed*, and using it for failures corrupts the fitted parameters [V2].
  - TypeScript implementation: `pnpm add ts-fsrs`; `fsrs().next(card, now, Rating.Good)` [V].
  - The defaults reflect flashcard (declarative) forgetting, not motor skill, so re-fit once you have enough logs [U for the minimum count].
- **Leitner / SM-2** are simpler fixed-rule schedulers [U]. Fine for an MVP; they ignore speed just as FSRS does.

## 4. Trainer design rules

| # | Rule → feature | Evidence | Log |
|---|---|---|---|
| 1 | **Recall before reveal**: the user executes or types the alg before seeing it; no multiple choice for alg memory | Strong | case, alg version, answer, correct, latency |
| 2 | **Recognition-only drill**: case rendered from the solving angle (U+F+R), random AUF, optional colour shuffle, slight camera jitter; answer by keypress or from 4–6 options drawn from the case's past confusions; timed | Moderate–strong | AUF, colours, view, options, choice, RT |
| 3 | **Retire a case only at 3 consecutive correct answers within the target RT**, spaced within the session | Moderate | streak, target RT |
| 4 | **ARTS-style ordering within a session**: errors return after 1–2 trials; slow-correct items return sooner than fast ones; new cases enter when queue priority drops | Moderate (one lab, several studies) | trials since last shown, RT, accuracy, priority |
| 5 | **FSRS across days**, with "success" defined explicitly (§5) | Moderate on flashcards; speculative for motor skills | revlog: card, timestamp, rating, elapsed days, FSRS state before/after |
| 6 | **Interleave confusable cases**; oversample pairs from the confusion matrix | Moderate | confusion matrix |
| 7 | **New alg**: ~5–10 blocked reps until it runs from memory, then random order | Weak–moderate | phase per rep |
| 8 | **Execution drill**: time + errors, plotted as a speed–accuracy curve per alg; with a smart cube, flag gaps between moves > 2× the median as hesitations | Moderate | per-move timestamps, errors, TPS |
| 9 | **Short sets** (5–10 reps) with rest prompts; end the session when RT or errors drift upward | Moderate | rep index, wall time |
| 10 | **Lock the alg per case**; changing it resets the case's scheduling state | Moderate | alg version history |
| 11 | **Cross/xcross planner**: scramble → 15 s inspection → enter planned moves → validity check → optimal solution shown only after committing; optional blind execution | Moderate (feedback); weak (mental practice) | scramble, plan, plan length vs optimal, valid, plan time, cross time |
| 12 | **Lookahead drills, only once execution is automatic**: (a) tap the next pair's pieces on a mid-F2L image, timed; (b) predict where a tracked piece ends up after an insertion; (c) metronome solves scored on pauses (needs a smart cube) | Speculative, built on moderate evidence | RT, accuracy, pause durations |
| 13 | **Chained drills** (last slot + LL; cross + first pair) plus regular whole solves with splits | Moderate | drill type, splits |
| 14 | **No feedback-fading or self-control toggles for results**; do fade concurrent hints | Moderate | hint shown |
| 15 | **Weekly no-feedback retention test** of every known case, excluded from scheduling | Moderate | test flag, results |

## 5. Scheduling and grading

**Mix of new and review cases.** FSRS-due reviews come first. Introduce new cases only while the due backlog is under a cap (e.g. ≤ 20). Add at most 2–4 new cases a day, taken from the same confusion family so interleaving has contrast. The numbers are speculative; the mechanism comes from ARTS. A new case must meet the 3-fast-correct criterion the same day before it enters FSRS.

**Grading** is automatic; there is no self-report:

| Outcome | Rating |
|---|---|
| Wrong case, wrong alg, execution error or DNF | **Again** |
| Correct but RT > target | **Hard** if success = correct; **Again** if success = fluent (ruling 1) |
| Correct within target | **Good** |
| Correct < 0.6 × target | **Easy** (or drop Easy) |

- Keep the raw RT whatever the rating; ARTS uses it within the session.
- Set the initial target at the median RT of his mastered cases, or 2 × an expert reference (Krasne's rule), and tighten it over time [speculative].
- The choice in ruling 1 decides what FSRS models. Slow → Hard models "remembers the case". Slow → Again models "recognizes it fast", which matches the pause-reduction goal but costs more reviews.

## 6. Measuring progress honestly

- **Headline time.**
  - Use a rolling ao100, or a session mean ± 95% CI. ao5/ao12 are too noisy.
  - Report median and spread as well.
  - Expect a decelerating, power- or exponential-like curve [U].
- **Splits.**
  - Track cross, F2L (per pair if possible), and LL recognition vs execution.
  - If the 52% F2L share holds at 15 s, F2L will be about 7.8 s [V share; extrapolation].
  - A rough sub-15 profile: about 2 s cross, 7.5–8 s F2L, about 5 s LL [speculative].
- **Per case.** Track median recognition RT over the last 5 reps, execution time, error rate, and the share correct within target (Krasne's "Score").
- **Transfer.**
  - Do drill gains show up in solves? Compare LL time on solves where the COLL case came up vs other LL cases.
  - Compare F2L pause fraction before and after lookahead blocks.
  - Drill times alone overstate progress.
- **Retention.** Use the weekly no-feedback test (rule 15).

## 7. How much a smart cube helps

| Skill | Gain | Why |
|---|---|---|
| (a) Alg memorization | Some | Verifies the executed alg automatically; typed recall works without a cube |
| (b) Recognition | Some (drills) / Large (in solves) | Screen drills need no cube; measuring the pre-OLL/PLL pause inside real solves needs move timestamps |
| (c) Execution | Large | Per-move timing, TPS, hesitations, mis-turns; without one, only spacebar totals |
| (d) Lookahead | Large | Pause fraction, the strongest correlate in Boyce & Storm, needs move streams or frame-by-frame video |
| (e) Inspection | Some | Checks the executed cross against the plan; records cross time and moves |
| (f) Whole solve | Large | Automatic splits and reconstructions for every solve |

Web Bluetooth (needed for smart cubes in the browser) works in Chromium browsers but not Safari/iOS [U]. Check that Brave exposes it [U].

## 8. Sources

- Boyce & Storm 2022 — https://emerginginvestigators.org/articles/21-189
- Zarei et al. 2025 — https://link.springer.com/article/10.1007/s00221-025-07104-w
- Meinz et al. 2023 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9866889/
- FSRS: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS ; https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm ; https://github.com/open-spaced-repetition/ts-fsrs ; https://forums.ankiweb.net/t/how-to-prevent-users-from-misusing-hard-ideas-are-welcome/49092?page=10
- Mettler, Massey & Kellman 2016 — https://doi.org/10.1037/xge0000170 ; Kellman lab — https://kellmanlab.psych.ucla.edu/research/adaptive-learning-and-learning-technology/
- Krasne et al. 2013 — https://pmc.ncbi.nlm.nih.gov/articles/PMC3908489
- Kellman, Massey & Son 2010 — https://pmc.ncbi.nlm.nih.gov/articles/PMC6124488
- Brunmair & Richter 2019 — https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf
- Czyż et al. 2024 — https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1377122/full
- Rowland 2014 — https://doi.org/10.1037/a0037559 ; Adesope et al. 2017 — https://education.wsu.edu/documents/2018/01/rethinking-use-tests.pdf/
- Cepeda et al. 2008 — https://pubmed.ncbi.nlm.nih.gov/19076480/ ; Donovan & Radosevich 1999 — https://www.gwern.net/docs/spaced-repetition/1999-donovan.pdf
- Rawson & Dunlosky 2022 — https://journals.sagepub.com/doi/full/10.1177/09637214221100484 ; Pyc & Rawson 2009, J Mem Lang 60:437 (URL not fetched)
- Macnamara et al. 2014 — https://www.psychologicalscience.org/news/releases/becoming-an-expert-takes-more-than-practice.html ; 2016 — https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/macnamara-et-al-2016-the-relationship-between-deliberate-practice-and-performance-in-sports-a-meta-analysis.pdf
- McKay et al. 2021 — https://www.scapps.org/jems/index.php/1/article/view/2529 ; McKay et al. 2022 — https://conferences.lnu.se/index.php/metapsychology/article/view/2803
- Toth et al. 2020 — https://pure.ul.ie/en/publications/does-mental-practice-still-enhance-performance-a-24-year-follow-u/
- Pan & Rickard 2015 — https://doi.org/10.1037/bul0000009 ; Rickard et al. 2008 — https://researchconnect.suny.edu/en/publications/sleep-does-not-enhance-motor-sequence-learning/
- Bönstrup et al. 2019 — https://pmc.ncbi.nlm.nih.gov/articles/PMC6482074
- Acuña et al. 2014 — https://labs.psych.ucsb.edu/grafton/scott/Papers/Acuna%202014%20J%20Neurophysiol.pdf
- Shmuelof et al. 2012 — https://pmc.ncbi.nlm.nih.gov/articles/PMC3404800
- Beilock et al. 2002 — https://doi.org/10.1037/1076-898x.8.1.6
- Gegenfurtner et al. 2011 — https://nschwartz.yourweb.csuchico.edu/Gegenfurtner%20Lehtinen%20Saljo.pdf ; Reingold et al. 2001 — https://www.cs.umb.edu/~marc/pubs/reingold_et_al_psysci2001.pdf
- Fontana et al. 2009 — https://scholarworks.uni.edu/facpub/2208

## For a human (rulings)

1. **What counts as "knowing" a case?** Correct only, where slow counts as Hard (fewer reviews)? Or correct *and* under a target time, where slow counts as Again (many more reviews, aimed straight at pauses)? The research leans toward the second for your goal.
2. **Target times.** Do you set recognition targets per set yourself (e.g. PLL 0.8 s, COLL 1.2 s), or does the trainer derive them from your data and tighten them automatically?
3. **Smart cube: buy one?** It makes execution, lookahead and whole-solve tracking measurable. Without one, lookahead progress is visible only through video or manual timing.
4. **Alg lock-in.** Will you freeze your alg choice per case before drilling? Changing an alg resets that case's progress.
5. **Colour neutrality.** Should recognition drills shuffle colour schemes? Only worth it if you are, or plan to be, colour-neutral.
6. **Daily time split.** How should practice divide between case drills, inspection drills and whole solves? The suggested ~40/15/45 is untested.
7. **What to learn next.** Finish COLL first, or start algorithmic F2L first, since F2L holds the biggest share of pauses?
8. **Which progress number you trust.** Rolling ao100 plus splits, or something else? PB ao5/ao12 are noisy.
9. **How complex v1 is.** ARTS within sessions plus FSRS across days, or a simple Leitner box system first?
