# From 18 s to sub-15 (and toward sub-12) with CFOP: what works, and in what order for Nathan's repertoire

Research date: 2026-10-15. Tags: **[verified]** means I read the source or computed the figure from its raw data. **[unverified]** means it comes from memory or a secondary snippet. **[est]** marks my own estimate, with the reasoning given.

## 0. Bottom line

1. **Pauses are the main difference between an 18 s solver and a 15 s solver, not algorithms or move count.** In the one public frame-by-frame dataset, about 60% of the 18→15 gain is shorter pauses, about 30% is faster pause-free turning (fewer regrips and rotations), and about 10% is fewer moves. Total move count is essentially flat from 18 s to 12 s (§1).
2. **His last layer has easy wins worth about 1.1 s, and none of them needs full COLL:**
   - A free "hold rule" for the Sune escape, worth about 0.6 s.
   - The 8 missing PLLs plus 3 OCLLs (11 algs), worth about another 0.5 s.
   - Full COLL (18 algs) gives roughly the same gain as those 11 algs, but it sits off the full-OLL path, and full OLL is about 0.6 s better still (§4–5).
3. **His three hypotheses, ranked:**
   - **xcross:** right idea, but do it in the order "plan the full cross → track the first pair → xcross when obvious".
   - **Algorithmic F2L:** only worth it when aimed at removing rotations and regrips, not at cutting moves.
   - **Full COLL:** valid but third.
   - **Together:** about 1.5–3 s on paper. That only materialises if F2L lookahead and pause removal (which none of the three directly trains) carries most of the load, because that is where the data puts the 18→15 gap.

---

## 1. Time breakdown at about 18, 15 and 12 s (real data)

**Primary dataset.** Boyce & Storm, "Rubik's cube: What separates the fastest solvers from the rest?", *Journal of Emerging Investigators* 2022 (https://emerginginvestigators.org/articles/21-189).
- They analysed 69 YouTube solves from 16 solvers, frame by frame at 30 fps. Pause data covers 43 solves from 11 solvers.
- Their raw TSV is public (https://github.com/KeplerBoyce/speedcubing-analysis). I re-ran it: linear fit over 67 solves of 30 s or less, evaluated at each time. **[verified, small n]**
- How moves are counted: STM plus AUFs, and a move that is interrupted by a pause counts twice. Rotations are counted separately. So these counts are higher than reconstruction STM.

| Metric (trend value) | @18 s | @15 s | @12 s | r with time |
|---|---|---|---|---|
| Cross / F2L / LL (s) | 2.43 / 9.38 / 6.19 | 2.02 / 7.82 / 5.16 | 1.61 / 6.26 / 4.14 | .65 / .94 / .88 |
| Total pause time (s) | 8.1 (≈45%) | 6.3 (≈42%) | 4.4 (≈37%) | .91 |
| Cross pause / pre-F2L pause (s) | 1.26 / 1.15 | 0.83 / 0.93 | 0.40 / 0.72 | .73 / .49 |
| F2L pauses incl. transition (s) | 4.8 | 3.7 | 2.7 | .84 |
| LL pauses (s) | 2.06 | 1.72 | 1.37 | .74 |
| Moves cross / F2L / LL | 7.1 / 33.6 / 30.0 | 6.9 / 33.1 / 28.2 | 6.8 / 32.6 / 26.4 | .13 / .13 / .32 |
| Pause-free TPS | 7.1 | 8.0 | 8.8 | −.64 |
| Regrips / rotations per solve | 21.8 / 5.7 | 17.8 / 4.7 | 13.8 / 3.7 | .74 / .49 |

**Raw band means** (same data, less smoothing):

| Band | Splits (cross / F2L / LL, s) | Rotations | Regrips | Overall TPS | Pause-free TPS |
|---|---|---|---|---|---|
| 16.5–20 s (8 solves, 4 solvers) | 2.6 / 9.7 / 5.6 | 8.4 | 27.6 | 4.0 | 7.2 |
| 13.5–16.5 s (20 solves) | 2.3 / 7.6 / 5.2 | 4.9 | 18.1 | 4.8 | 7.6 |
| 11–13.5 s (12 solves) | 1.5 / 6.7 / 4.2 | 3.3 | 13.5 | 5.4 | 8.7 |

**[verified]**

**Paper findings worth keeping** **[verified]**:
- F2L takes about 52% of solve time at every level.
- Pause fraction correlates with time at r=0.72.
- Regrips correlate at r=0.75 and rotations at r=0.48.
- **F2L move count does not correlate with time (r=0.05).**
- Cross pauses shrink partly because of "the sizable number of solvers faster than 15 seconds who were able to plan all of their moves for the cross before beginning the solve".
- The authors estimate that about 6.2 s of a 20→10 s improvement is pause reduction alone.

**Decomposition of 18→15** (time = pauses + moves ÷ pause-free TPS):
- 8.1 + 70.6/7.1 ≈ 18.0 becomes 6.3 + 68.2/8.0 ≈ 14.8.
- So: about −1.85 s pauses, about −0.85 s faster pause-free turning, about −0.3 s fewer moves (mostly last layer). **[verified arithmetic on the data]**

**Caveats:**
- Only 16 solvers, and "pause" means any frame where no layer moves, so it includes micro-gaps.
- Use the shape of these numbers, not the decimals.

**Other split references:** CubeSkills' "CFOP Solve Splits Tool" (Feliks Zemdegs, https://www.cubeskills.com/blog/cfop-solve-splits-tool) gives only illustrative cases: two 20 s solvers can split 4-11-2-3 (full OLL/PLL, inefficient F2L) or 2-9-4-5 (efficient F2L, 4-look LL). **[verified]**

**Smart-cube aggregate data:** I found **none public** from Cubeast, Acubemy or Sub-X. Sub-X computes per-phase time, moves and TPS but publishes no aggregates (https://www.speedsolving.com/threads/smart-cube-solves-now-get-auto-reconstructed-and-analyzed-phase-splits-bottleneck-detection-on-sub-x.97079/). **[verified]**

**Move-count anchors** (Speedsolving Wiki, all **[verified]**):
- CFOP averages 57.5 moves (https://www.speedsolving.com/wiki/index.php/CFOP_method).
- Optimal cross is 5.81 HTM fixed colour, 5.39 dual colour, 4.81 colour neutral, and always 8 moves or fewer (https://www.speedsolving.com/wiki/index.php/Cross).
- OLL is 9.7 HTM with speed algs (https://www.speedsolving.com/wiki/index.php/OLL).
- PLL is about 13 STM with speed algs (https://www.speedsolving.com/wiki/index.php/PLL).
- COLL is 9.78 HTM optimal, 42 cases (https://www.speedsolving.com/wiki/index.php/COLL).

## 2. What coaches say, and where folklore disagrees with the data

**Feliks Zemdegs / CubeSkills:**
- "How To Get Faster?" (https://www.cubeskills.com/blog/how-to-get-faster) says:
  - F2L is where most improvement comes from.
  - Learn PLL before OLL.
  - Slow untimed solves "help enormously to boost your lookahead and efficiency".
  - Most cubers finish OLL+PLL "around the 15-second mark".
  - COLL appears only in the *advanced* (sub-15) section. **[verified]**
- In blog comments he tells intermediates to "finish learning PLL" and make "F2L pair solutions very efficient" first. **[unverified: search excerpt of comments, page not opened]**
- "Lookahead Progression Framework" (https://www.cubeskills.com/blog/lookahead-progression-framework) gives a three-stage model: spotting, then tracking, then knowing.
  - Moving from spotting to tracking depends on "confidence in your solving techniques and algorithms".
  - Drills: plan pair 1 and find pair 2 *before moving*; slow the last 3 moves of each pair; metronome at one turn per beat; blindfolded pairs. **[verified]**
- "Cubing Practice Tips" (https://www.cubeskills.com/blog/cubing-practice-tips): at least 50% of practice should be timed or "subconscious", and plateaus lasting months are normal. **[verified]**

**J Perm** (https://jperm.net/3x3/cfop/f2l) ties techniques to levels:
- Lookahead from **sub-20** ("will rapidly become the most important concept").
- **F2L optimization** (avoid rotations and extra moves) and **predicting the first pair in inspection** at **sub-15**.
- Multiple options per case and "where to look in bad cases" at **sub-12**.
- Compare your solutions against an F2L algorithm document, but don't learn from it until you understand your own solutions. **[verified]**
- His CFOP page lists COLL under "Beyond CFOP" (https://jperm.net/3x3/cfop). **[verified]**

I could not get text-readable material from Tymon Kolasiński, Kian Mansour or Brody: YouTube is not readable here, and Reddit is blocked. I don't cite them.

**Folklore vs data:**
- *"Learn F2L algorithms to cut moves."* The data says F2L moves are flat from 18 to 12 s (r≈0.1). What separates the levels is pauses, regrips and rotations.
- *"COLL is the next step."* Only 3–6% of 14–18 s respondents in the 2020 r/Cubers Mega Survey (n=1,385, data in the same repo; I computed this) knew full COLL, versus 95–97% with full PLL and 56–76% with full OLL. Among 10–12 s respondents: 14% full COLL, 82% full OLL. **[verified; self-reported, correlational]**
- *"Turn faster."* Pause-free TPS rises only about 0.9 per 3 s of improvement. Pauses fall about twice as much.

## 3. His three hypotheses, quantified

**(a) Full COLL (+18 algs: the U, T and L sets)**
- **Saves:** about 0.6 s/solve against a correctly held Sune escape, or about 1.2 s if he currently Sunes at a random AUF (model in §4).
- **Cost:** about 6–9 h to learn and drill to fluency **[est: ~20–30 min/alg spread over days]**.
- **Risk:** COLL recognition is the hardest he would face. Once he moves to full OLL, COLL is only usable on the 1/8 of solves where edges come pre-oriented, so its marginal value drops to about 0.08 s.
- **Verdict:** valid, but not first.

**(b) Algorithmic F2L**
- **Rote 41-case learning:** low ROI, because move count isn't what separates levels.
- **Targeted version (recommended):** a case audit of the 10–15 cases where he rotates, regrips, or uses more than 10 moves. Learn rotationless or back-slot solutions for those. The data gap from 18 to 15 s is about −1 to −3.5 rotations and −4 to −9 regrips per solve.
- **Saves:** 0.3–0.8 s **[est: ~0.15–0.25 s per avoided rotation including the re-look, plus regrips]**. A further benefit is that pre-solved cases free attention for tracking (Feliks's "confidence" mechanism).
- **Cost:** 4–6 h.
- **Prerequisite:** the case audit, done from video.

**(c) Cross planning, cross+1, xcross**
- **Full cross planning:**
  - Data: cross pause is 1.26 s at 18 s versus 0.40 s at 12 s, and pre-F2L pause is 1.15 s versus 0.72 s.
  - Planning the whole cross (8 moves or fewer, executed without looking) plus tracking the first pair is worth **0.6–1.0 s** **[est from those deltas]**.
- **True xcross:**
  - Optimal any-slot fixed-colour xcross averages **7.35 FTM**, and 98.5% are 8 moves or fewer. A fixed slot averages 7.98. That's only about 1.5 moves more than a cross (Lars Vandenbergh, "XCross study", https://cubezone.be/xcrossstudy.html). **[verified]**
  - It replaces an F2L pair of about 8.3 moves plus the transition pause. So each executed xcross saves about **1.5–2 s** at his level.
  - If he finds one on 20–30% of scrambles, that is about **0.3–0.5 s/solve** **[est]**.
- **Prerequisite:** 90% or better blind-cross success.
- **Risk:** long inspections, and +2 s penalties in competition.

## 4. ROI of his cheap repertoire gaps (probability arithmetic)

I enumerated all 62,208 last-layer states with a cubie-level simulator (Kociemba move tables, checked against a hand trace of Sune). **[verified by computation]**

**Edge orientation (EO) cases:** skip 1/8, L-shape 4/8, line 2/8, dot 1/8.

**Corner-orientation shapes after EO** (27 states, uniform): Sune, Antisune, Pi, U, T, L 4/27 each; H 2/27; skip 1/27.
- **Known** (Sune, Antisune, Pi, H): 14/27 = **51.9%**.
- **Unknown** (U, T, L): 12/27 = **44.4%**.
- **Skip:** 3.7%.

**How often he Sune-spams: 44.4% of solves.**
- The simulation shows that from U, T or L, **exactly 2 of the 4 AUFs** reach a known shape after one Sune. At a random AUF, success is p=½ per attempt, so he averages **2 Sunes** and P(3 or more) = 25%.
- **Hold rule (0 algs):** *AUF so the front-left corner's yellow sticker is NOT on top, then do R U R' U R U2 R'.* This always lands on Antisune, Pi or H:
  - U goes to Antisune or Pi.
  - T goes to Pi or Antisune.
  - L goes to Antisune or H.
  - All 6 qualifying AUFs succeed, and all 6 others fail. **[verified by computation]**

**PLL probabilities** (when corners are not solved by COLL): Aa, Ab, F, Ga, Gb, Gc, Gd, Ja, Jb, Ra, Rb, T, Ua, Ub, V, Y 1/18 each; E, Z 1/36; H, Na, Nb, skip 1/72.
- His missing PLLs (E, Na, Nb, V, Ga–Gd) cover 24/72 = **1/3** of PLL states. The G perms alone are 16/72.
- **Interplay:** in his current flow, after COLL only EPLL remains:
  - Skip 1/12, Ua 1/3, Ub 1/3, Z 1/6, H 1/12. All known.
  - A corner-permuting PLL appears only when the corners come pre-oriented (1/27).
  - So he two-looks a PLL in **1/27 × 1/3 = 1/81 ≈ 1.2%** of solves, costing about 0.02 s/solve. **The 8 missing PLLs are nearly worthless in his current flow.**
  - They start to matter the moment he uses OCLL then PLL. With the 3 U/T/L OCLLs he would two-look in 13/81 ≈ **16%** of solves; with any full-OLL system, in **33%**.

**Time-cost assumptions** **[est]**:
- Alg execution at 7.5 TPS. The data gives 7.4 pause-free LL TPS at 16.5–20 s.
- 0.75 STM of AUF per alg.
- Recognition: EO 0.35 s, OCLL shape 0.35, COLL case (total) 0.85, EPLL 0.45, PLL 0.7, full OLL 0.6.
- These sum to LL pauses of about 1.3–2.0 s, which matches the data's 2.06 s at 18 s.
- **One extra Sune ≈ 1.4 s** (7.75 STM ≈ 1.03 s, plus 0.35 s re-look).
- **Two-look PLL penalty ≈ 1.5 s** (one extra EPLL of about 7.4 STM ≈ 1 s, plus a look and an AUF).

## 5. Last-layer systems compared (expected values)

Average STM of speed algs: EO 6.0 (incl. skip), OCLL 8.2, COLL 10.5 (wiki optimal 9.78 HTM + speed-alg overhead **[est]**), EPLL 7.36 (M-slice U perms / H / Z), PLL 13, OLL 9.7.

| Flow | New algs | Looks | STM (incl. AUF) | LL time (base) | Δ vs today | Range across sensitivity runs |
|---|---|---|---|---|---|---|
| A* today: EO → COLL or Sune-spam (random AUF) → EPLL | 0 | 3.9 | 32.8 | 6.34 | — | — |
| A: today + hold rule | 0 | 3.4 | 29.3 | 5.73 | −0.61 | −0.56…−0.69 |
| B: + U/T/L OCLL → PLL (13 PLLs) | 3 | 3.2 | ~28.8 | 5.46 | −0.88 | — |
| B′: + 3 OCLL + 8 PLL (COLL kept on known shapes) | 11 | 3 | 27.7 | 5.22 | −1.12 | −1.02…−1.30 |
| C: EO + full COLL + EPLL | 18 | 3 | 25.9 | 5.11 | −1.23 | −1.12…−1.37 |
| D0: 2-look OLL + full PLL (drop COLL) | 11 | 3 | 29.6 | 5.35 | −0.99 | — |
| D: full OLL + full PLL | ~61 (≈50 after B′) | 2 | 24.7 | 4.59 | −1.75 | −1.72…−1.99 |
| E: D + COLL when edges come oriented (1/8) | D + 18 | 2 | — | 4.51 | −1.83 | — |

**Reading the table:**
- **Full OLL is the big structural win.** Its gain comes from deleting the EO look and alg on 7/8 of solves.
- **B′ and C are within about 0.1 s of each other.** B′ uses 7 fewer algs and is a prerequisite for D, whereas C's 18 algs are worth only about 0.08 s once he reaches D.
- **COLL path vs OCLL→PLL on his known shapes:** after full PLL, COLL then EPLL is still about 0.25 s faster per occurrence, so he should keep using it there.
- **ZBLL** extends both C and E, but only pays with EO done during F2L, or on OCLL cases. That is out of scope before sub-12.

## 6. Non-algorithm levers, ranked for 18 s

1. **F2L lookahead and pause removal (largest).**
   - F2L pauses drop about 1.1 s from 18 to 15 s.
   - Drills: slow no-pause solves; metronome; the tracking drill; blindfolded pairs (CubeSkills framework).
2. **Fully planned cross plus first-pair tracking** (0.6–1.0 s, see §3c).
   - Keep the cross to 8 moves or fewer. Human crosses stay about 7 moves at every level, so the gain comes from removing pauses, not moves.
3. **Rotations and regrips** (r=0.75 for regrips), via the F2L case audit (§3b).
4. **Fingertricks and TPS.** Pause-free TPS goes from 7.1 to 8.0 between 18 and 15 s; this lever matters more for 15→12.
   - Feliks: pick fingertrickable algs, learn multiple grips, drill regrip-into-alg using last-slot+LL scrambles ("Improving Turning Speed", https://www.cubeskills.com/blog/improving-turning-speed). **[verified]**
5. **Colour neutrality (smallest at 18 s).**
   - Optimal cross length: CN 4.81 vs fixed 5.81 HTM. Optimal xcross: CN 6.45 vs dual 6.99 vs fixed 7.35 FTM.
   - Feliks calls it "a marginal advantage", says dual colour gets "approximately 50% of the benefits", and that switching takes "months" (https://www.cubeskills.com/blog/colour-neutrality). **[verified]**
6. **Cube setup.** A magnetic flagship you feel confident turning fast on. Feliks: lockups on basic triggers usually point to turning style rather than the cube ("Improving Turning Speed"). **[verified]** Specific tension and magnet advice is **[unverified folklore]**.

## 7. 10-week plan (45 min/day; gates over dates)

**Measurement without a smart cube:**
- csTimer "multi-phase" timing: tap any key at each split. **[unverified, from csTimer UI strings via search]** Expect about 0.1–0.2 s of tap overhead per split **[est]**, so compare like with like.
- Film at 60 fps on a phone to count rotations, regrips and pauses (the paper's method).
- His own app can show the optimal cross length per scramble.

**What only a smart cube (or frame-by-frame video) measures:** per-step recognition vs execution, per-pair F2L splits and pauses, pause-free TPS, and per-phase move counts.
- TypeScript library: `smartcube-web-bluetooth` (MIT, fork of afedotov/gan-web-bluetooth). It supports GAN Gen1–4, MoYu AI 2023, QiYi/XMD Tornado V4 and Giiker, and emits MOVE, FACELETS and GYRO events, with cube and host move timestamps (https://github.com/poliva/smartcube-web-bluetooth). **[verified]**
- Web Bluetooth is off by default in Brave and missing in Safari/iOS. **[unverified]**

**Day 0 baseline:** 100 solves with a 3-phase split (ao100, mean cross / F2L / LL); 12 filmed solves (rotations, regrips); 25 written cross plans (moves vs optimal). Learn the hold rule (10 min; ≈0.6 s if he was using a random AUF).

**Phase 1, weeks 1–3: last-layer cleanup and cross planning**

Daily (45 min):
- **10 min algs:**
  - Week 1: Ga, Gb, Gc, Gd (2/3 of the missing-PLL frequency).
  - Week 2: V, E, Na, Nb.
  - Weeks 2–3: U, T and L OCLL. Switch U/T/L to OCLL → PLL once all 21 PLLs are at 2.5 s or less.
- **10 min cross:** 15 reps of inspect → plan → execute with eyes closed. From week 2, also name the first pair's location before starting.
- **10 min slow solves:** 4–5 solves at about half speed with zero stops, plus F2L to a 60 bpm metronome.
- **15 min timed solves** with splits.

**Gate to phase 2** (all timer-measurable): blind cross ≥90% success at ≤8 moves; LL split ≤5.3 s; every PLL ≤2.5 s (recognition + execution, random AUF); ao100 ≤16.8.

**Phase 2, weeks 4–7: F2L**

Daily (45 min):
- **15 min F2L:**
  - Audit from video, then learn rotationless or back-slot fixes for about 3 cases a week (≈12 total).
  - The CubeSkills tracking drill: find pair 2 before moving on pair 1.
- **10 min metronome:** add 5 bpm after 3 clean solves.
- **5 min cross+1:** take an xcross only when it's obvious.
- **15 min timed solves.**
- Optional: start full OLL at 3 per week, or COLL (see rulings).

**Gate to phase 3:** F2L split ≤8.0 s; cross split ≤2.0 s; ≤4 rotations per solve (video); ao100 ≤15.8.

**Phase 3, weeks 8–10 (stretch to 12): consolidation**

Daily (45 min):
- **≥50% timed solves,** plus one ao100 per week.
- **OLL learning** at 4 per week.
- **Alg drilling** to 9–10 TPS on PLLs.
- **xcross attempts** on easy scrambles.

**Sub-15 gate:** cross ≤1.9 s; F2L ≤7.6 s; LL ≤4.9 s; ao100 <15.0.

**Sub-12 horizon** (from the data's 12 s trend): splits 1.6 / 6.3 / 4.1, total pauses ≈4.4 s, pause-free TPS ≈8.8, full OLL done. Realistically 6–18 months **[est]**. Survey medians are 24–36 months of speedcubing for 12–16 s respondents. **[verified, self-reported]**

Is 3 s in 10–12 weeks realistic? It's ambitious but plausible, because about 1.1 s of it is low-effort LL cleanup **[est]**. J Perm reportedly took "just under a year" for sub-20 to sub-15. **[unverified, AMA snippet]**

## For a human (rulings)

1. **Last-layer system.** Do you commit to **full OLL + full PLL** (about 61 algs from today; best LL, about −1.75 s vs now), or to **EO + full COLL + EPLL** (18 algs, about −1.2 s; COLL keeps its value only if you later go ZBLL)? I recommend: hold rule now, then 8 PLLs + 3 OCLLs, then full OLL. Decide before week 4.
2. **After you learn full PLL**, do you switch U/T/L shapes to OCLL→PLL (recommended), or keep Sune + COLL?
3. **Colour neutrality.** Stay fixed-colour, go dual (white/yellow; about half the benefit per Feliks; temporary slowdown), or go full CN? I recommend deferring until you're sub-15.
4. **The cube you're about to buy.** A smart cube (automatic splits, recognition vs execution, pause detection, and your TS app can read it via `smartcube-web-bluetooth`; needs a Web-Bluetooth browser), or a non-smart flagship plus timer and video?
5. **Daily practice budget.** The plan assumes 45 min/day. At 30 min, stretch every phase by about 50%.
6. **Algorithmic F2L scope.** Targeted (10–15 problem cases, recommended), or rote full set?
7. **What counts as "sub-15"?** Home ao100, ao12, or a WCA competition average? Competition inspection and nerves usually add time.

## Sources

- Boyce & Storm, "Rubik's cube: What separates the fastest solvers from the rest?", JEI 2022 — https://emerginginvestigators.org/articles/21-189 ; data: https://github.com/KeplerBoyce/speedcubing-analysis (includes r/Cubers Mega Survey 4, 2020)
- CubeSkills: "How To Get Faster?" https://www.cubeskills.com/blog/how-to-get-faster ; "Lookahead Progression Framework" https://www.cubeskills.com/blog/lookahead-progression-framework ; "Colour Neutrality" https://www.cubeskills.com/blog/colour-neutrality ; "CFOP Solve Splits Tool" https://www.cubeskills.com/blog/cfop-solve-splits-tool ; "Improving Turning Speed" https://www.cubeskills.com/blog/improving-turning-speed ; "Cubing Practice Tips" https://www.cubeskills.com/blog/cubing-practice-tips
- J Perm: "Advanced F2L" https://jperm.net/3x3/cfop/f2l ; "CFOP" https://jperm.net/3x3/cfop
- Speedsolving Wiki: CFOP, Cross, OLL, PLL, COLL, XCross — https://www.speedsolving.com/wiki/index.php/CFOP_method (and /Cross, /OLL, /PLL, /COLL, /XCross)
- Lars Vandenbergh, "XCross study" — https://cubezone.be/xcrossstudy.html
- SpeedSolving thread "Any tips for sub-15 3x3?" (2023) — https://www.speedsolving.com/threads/any-tips-for-sub-15-3x3.90604/
- Sub-X smart-cube analysis thread — https://www.speedsolving.com/threads/smart-cube-solves-now-get-auto-reconstructed-and-analyzed-phase-splits-bottleneck-detection-on-sub-x.97079/
- poliva/smartcube-web-bluetooth — https://github.com/poliva/smartcube-web-bluetooth
- My scripts (reproducible): docs/research/scripts/ll.py, llflows.py, reg.py, survey.py
