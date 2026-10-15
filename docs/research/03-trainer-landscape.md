# 03 — Speedcubing trainer landscape, October 2026 (for cube.nathanwei.org)

Checked 2026-10-15. Licence, star and activity data come from the GitHub REST API. "Live" means the site returned HTTP 200 that day.

Tags: **[verified]** means I read the primary source (site, repo, README, code, or store listing). **[unverified]** means memory, a search snippet, or a secondary source.

---

## 1. Tool by tool

### A. Timers with training modes

**csTimer** (cstimer.net; github.com/cs0x7f/cstimer)
- Alive and maintained. GPL-3.0, 782 stars, last push 2026-09-07; Bluetooth work landed in Aug 2026 [verified].
- **What it trains.** 3x3 subset scramblers: `coll`, `cll`, `cmll`, `oll`, `pll`, `zbll`, `zzll`, `ttll`, `ell`, `ll`, `lsll2`, `zbls`, `eols`, `wvls`, `vls`, `f2l`, `easyc` (easy cross), `easyxc` (easy xcross), `eoline`, `eocross`, 2-gen/3-gen subsets, and Mehta/Roux steps [verified: `scramble_333_edit.js`]. Most LL sets let you filter cases and set case probabilities [verified].
- **How it generates cases.** Random state: it fixes the case's pieces, randomizes the rest, solves with two-phase search, and adds random pre/post AUF [verified: `getAnyScramble`, `aufsuff`].
  - COLL scrambles randomize the last-layer edge permutation, so every case shows up with every EPLL [verified: mask `0xba987654ffff`].
  - A colour-neutrality parameter exists [verified].
  - The result is a real scramble you apply to your own cube, so you see the case at the real solving angle.
- **Built-in tools.**
  - A cross solver gives the optimal cross for all 6 colours; clicking a colour cycles through optimal xcross, xxcross and xxxcross [verified: `tools/cross.js`].
  - Also EOLine, Roux step 1, a generic solver, a metronome, a BLD helper, and a Thistlethwaite solver [verified: file names].
- **Stats.** Session stats, trends, daily stats, distribution, smart-cube reconstructions, and a per-case train table (N/best/mean per PLL/OLL case) [verified: `stats/*.js`, `trainstat.js`].
- **Smart cubes.** GAN (GAN/MG/AiCube prefixes), Giiker/Mi/Hi-, GoCube/Rubik's Connected, MoYu (MHC, WRM `WCU_MY3`), QiYi and XMD Tornado V4; also GAN and QiYi timers [verified: `hardware/*.js`].
- **Platforms and price.** Web PWA; free [verified].
- **Weaknesses.**
  - The timer covers recognition and execution together; I saw no recognition split without a smart cube [verified].
  - No spaced repetition, no learned-case scheduling, and settings that are hard to find [verified: speedcubing.com page].

**CubeDesk** (cubedesk.io; github.com/kash/cubedesk)
- Alive. GPL-3.0, last commit 2026-10-12 [verified].
- The README now calls it a free, open-source app (timer, stats, alg trainer, 1v1). A July 2026 migration dropped `is_pro` and `stripe_customer_id`, so the old Pro tier is gone [verified].
- The trainer picks cases uniformly at random and supports custom/public trainers [verified: `Trainer.tsx`].
- Smart cubes: GAN, Giiker, MoYu, MoYu MHC, Particula, QiYi [verified: `bluetooth/*.ts`].
- Stack: TS, Postgres, Redis [verified].
- No spaced repetition found [unverified].

**Twisty Timer** (Android; github.com/aricneto/TwistyTimer)
- GPL-3.0, uses TNoodle [verified].
- Effectively dormant: last commits Jan–Apr 2023 [verified].
- Still on the Play Store, with OLL/PLL reference and cross hints [unverified].

### B. Alg and recognition trainers (web, no smart cube needed)

**jperm.net trainers**
- OLL, PLL and 2x2 CLL trainers. COLL and WV are reference pages only [verified].
- PLL trainer:
  - Case statuses (Unlearned/Learning/Finished) and a Trash option.
  - "Balanced" or "Realistic" (real-solve frequency) case selection, plus a "Slowest" filter.
  - Space-bar timer; stored in the browser [verified].
- No spaced repetition, and no random AUF mentioned [verified].
- Renders with sr-visualizer [verified: page source]. © J Perm, no licence [verified].

**bestsiteever (Roman Strakhov)**
- Domains: bestsiteever.net is current; the .ru certificate had expired on 2026-10-15 [verified].
- **ZBLL trainer** (Vue; github.com/Roman-/zbll; push 2025-10).
  - Select whole COLL groups; this works as a COLL trainer with random EP.
  - Pre-generated scrambles per case (`zbll_map_next.json`) with a random y-rotation applied, plus 3D SVG case images [verified].
  - One timer covers recognition and execution together [verified].
- **OLL trainer** (github.com/Roman-/oll_trainer) and a **PLL trainer** [verified].
- **PLL Recognition Trainer** (github.com/Roman-/pll_recognition_trainer; push 2026-04). The best recognition-trainer design I found [verified]:
  - 3D two-sided pictures, 73 patterns, each case in up to 16 variants (4 AUF × 4 colour shifts).
  - You answer by pressing the case letter.
  - Per-case average recognition time and accuracy.
  - An adaptive queue repeats the worst 15% of cases 4×.
  - On a miss it shows the matching row of Mark Rivers' two-sided recognition guide, and your personal notes resurface.
- **Licence: none on any of these repos**, so all rights are reserved [verified].

**Tao Yu Alg-Trainer** (tao-yu.github.io/Alg-Trainer)
- MIT, 48 stars, last push 2024-06 [verified].
- Covers every algdb.net set as of 2018 [verified: Rouxles fork README].
- Features [verified]:
  - Real scrambles rather than the inverse alg.
  - Random AUF, colour-neutral pre-orientation, M/S mirroring.
  - A virtual cube; smart-cube support for Giiker i3S only.
- No spaced repetition [verified].

**Cubedex** (cubedex.app; github.com/poliva/cubedex)
- MIT, React/TS, built on cubing.js and smartcube-web-bluetooth. Last commit 2026-04-30 [verified].
- Features [verified: `HelpView.tsx`]:
  - Works with a smart cube or a normal cube.
  - Learning/Learned states (can update automatically) and random AUF.
  - Two-sided recognition mode (gyroscope and mirror stickers off).
  - Slow-cases-first and prioritize-failed options.
  - **"Smart Order — Anki-style spaced repetition"**, time attack, and JSON import/export of algs.
- Alg data (`defaultAlgs.json`) covers PLL, OLL, F2L, COLL, OLLCP, ZBLL, ZBLS, WVLS, VHLS, CMLL, L6E [verified].
- Cases are set up by inverse alg, so EP is not randomized within a case [unverified].

**SpeedCubeDB** (speedcubedb.com)
- Alg database with several algs per case, community votes, move counts, and per-slot F2L [verified].
- Google login tracks learned algs and personal sheets [verified].
- Trainer pages: an alg trainer (`/t`, many sets), 2-sided PLL recognition, a cross trainer (1–7 move crosses, any colour, "suggested" solutions), and a new scramble analyzer [verified].
- No API, licence or terms published. Renders with cubing.js `twisty-player` [verified].

**cubingapp.com** (Spencer Chubb; github.com/spencerchubb/cubingapp)
- This is likely the "TheCubingApp" you meant.
- MIT, last push 2026-06 [verified].
- Alg pages and drills for F2L, OLL, PLL, COLL, OLLCP, ZBLL, WV, CMLL and more, plus WCA rankings [verified].
- Case JSON includes generators:
  - COLL "before" = a random EPLL; "after" = a random AUF.
  - So EP and AUF vary, but every case is a setup by inverse alg [verified: `COLL.json`].

**SpeedCube Trainer / rubikstrainer.com** (moving to speedcubetrainer.web.app; iOS and Android apps)
- Recognition trainers for OLL, PLL and **COLL** [verified].
- COLL recognition [verified: page JS]:
  - Shows one of 4 pre-rendered isometric 3-face images per case.
  - You pick from a curated set of look-alike cases; correct/wrong counts are kept.
- Recognition timer only after free registration. Ads; ad-free is €4.99/yr [verified].
- No EP randomization, because the images are fixed [verified].

**LL-trainer** (ll-trainer.web.app, melvynp)
- Live [verified].
- PLL/OLL/COLL with Classical, Random and **Reflex** modes. In Reflex mode the case appears after the timer starts, so recognition counts toward the time [verified: SpeedSolving thread, 2022, "beta"].
- Cross and F2L tabs, custom groups [verified].

### C. Cross / xcross / F2L / lookahead

**or18 RubiksSolverDemo** (or18.github.io/RubiksSolverDemo)
- GPL-3.0, last push 2026-09-29 [verified].
- Trainers [verified]: Cross, XCross, XXCross, XXXCross, free pair, XCross+free pair, pseudo-XCross/pair, F2LEO cross/xcross/xxcross, EOCross/XEO/XXEO.
- How it works [verified]:
  - Scrambles have a guaranteed optimal depth (1–10 HTM).
  - You choose the slot.
  - A "Solve" button lists up to N optimal solutions, with pair analysis.
- XXCross tables take 10–60 s to build and about 321–402 MB of heap [verified: SpeedSolving thread, 2026-01-05].
- No timer, no inspection countdown, no way to enter your plan, no history [verified: page source].

**Christian Vaughn "Cross to F2L"** (christianvaughn.net/C2F2L)
- Eight levels by cross length; scramble only [verified].
- No solutions, no timing [verified].

**F2L Trainer** (f2l-trainer.top; github.com/Dave2ooo/F2LTrainer)
- SvelteKit/TS on cubing.js, with smart-cube support via smartcube-web-bluetooth. Last push 2026-08 [verified].
- Case groups: Basic (41), Basic Backslot, Advanced, Expert, each trained as a right or left slot [verified].
- Cross and front colour can be set; random AUF [verified].
- Per-case alg choice and mirroring [verified].
- "Smart frequency" weights cases toward fewer solves and slower times. This is weighting, not true spaced repetition [verified: `trainCases.ts`].
- Stats and drill mode [verified].
- **No LICENSE file** (the README badge says MIT; GitHub detects none) [verified].

**Lookahead**
- **f2l-radar** (github.com/david-westerhoff/f2l-radar, German, Sep 2026, no licence) [verified: UI text]:
  - Watch moves at a chosen 1–4 TPS for 8–30 s.
  - Then "check" where the pair is.
  - Stats and history.
- **r/Cubers "This thing will help your Lookahead!"** (interacty.me): you are shown a state and moves, then click where a piece ends up [unverified: search snippet].
- **CubeSkills "Lookahead Progression Framework"** article: spotting → tracking → knowing [unverified: snippet].
- Nothing measures lookahead without a smart cube or video.

### D. Smart-cube platforms and "AI coaches"

**(ANOTHER) Cube trainer — cubetrainer.cc** (github.com/wodzik/cube)
- **The closest existing thing to your plan.** Created 2026-07, last push 2026-10-06, GPL-3.0, 3 stars. Browser only, no backend, localStorage [verified: README].
- **Solve page** [verified]:
  - Random-state scrambles with live tracking.
  - CFOP/Roux stage detection with per-stage recognition/execution split.
  - The case each stage started from.
  - **Your cross against the optimal one**, one click from drilling that exact cross.
- **Step trainers** with known-optimal scrambles [verified]:
  - Cross 1–8, XCross 2–10, XXCross 3–10, Pair 1–9.
  - Also F2L slots, OLL/PLL with random AUF, Roux and ZZ steps.
  - "Scramble" mode or "Recognize" mode (case on screen, time to first turn measured).
  - Reports `your moves / optimal`; hint = first optimal move.
  - Colour neutral; **Ladder** (80% optimal over the last 10 → +1 move).
- Alg sets with learning status, per-case stats, and time attack [verified].
- A retry queue for non-optimal attempts is described as "spaced repetition-lite" in the plan doc [verified: `plan-trainer.md`].
- Needs Web Bluetooth (Chrome, Edge or Opera; **not Safari or iOS**).
- Cubes: GAN, MoYu, QiYi, GoCube, Giiker [verified].
- Engine: `@wodzik/cubecore`, MPL-2.0 [verified].

**Cubeast** (cubeast.com, app.cubeast.com)
- Web [verified].
- Per-phase recognition/execution, inspection, pickup and put-down times [verified].
- "% of solves with XCross" and "average PLL recognition time" stats [verified].
- An **Academy** with exercises for new algs, recognition, and XCross [verified].
- Claims every 3x3 Bluetooth cube [verified].
- Some training tools are paywalled [verified: speedcubing.com], about $5/month [unverified: Reddit comment].

**Acubemy** (acubemy.com)
- iOS, Android and web; free tier plus Premium; price not published [verified].
- An "algorithm coach" with targeted drills and **spaced repetition**, and "smart flashcards" [verified].
- Recognition/execution splits benchmarked against 3M solves; detects weak OLL/PLL/F2L cases [verified].
- Supports GAN, MoYu, QiYi, GoCube, Rubik's [verified].

**CuberPal** (iOS only)
- Video **or** smart-cube CFOP phase analysis ("no smart cube needed", v3.1) [verified: App Store].
- "Cubey" chatbot and spaced-repetition drills for OLL/PLL/COLL/ZBLL/F2L [verified].
- Alg catalogs from J Perm or SpeedCubeDB [verified].
- Premium $6.99–9.99/mo, $49.99/yr; 4.6★ from 17 ratings; shipping several releases a week (v3.3.2) [verified].

**GAN CubeStation** (iOS/Android)
- Academy, phase training, camera sync, arena; GAN cubes only [verified].
- 2.9★ from 319 ratings [verified].
- Review complaints: alg trainers removed, no custom algs, orientation bugs [verified].

**Brief Cubing** (briefcubing.com)
- MIT, push 2026-07 [verified].
- Smart-cube alg drills in any orientation; any correct solution counts [verified].

**Other 2026 iOS apps (thin, unverified)**
- Hongyi CFOP Cube Solver (AI coaching, GAN/MoYu; May 2026), WeCubit (on-device "AI Coach"), Lookahead+ (a timer, not a lookahead trainer [verified]), SpeedCube App, Cube Coach (Jul 2026) [unverified].
- Avoid GitHub repos with SEO names like "Best Speedcube Trainer App 2026" (e.g. CubeFlow-Arena); they follow the usual pattern of malware lures [unverified].

### E. Libraries and viewers

**cubing.js / Twizzle** (github.com/cubing/cubing.js; alpha.twizzle.net live)
- Dual GPL-3.0/MPL-2.0; library use can be treated as MPL. Pushed 2026-10-15 [verified].
- Modules [verified]:
  - `alg`, `twisty` (TwistyPlayer).
  - Stickering masks: COLL, OLL, PLL, F2L, Cross, LS, ZBLL, EOcross, etc.
  - `scramble` (3x3 by cs0x7f), `search` (`random333Pattern`, `experimentalSolve3x3x3IgnoringCenters`).
  - `bluetooth` (GAN, Giiker, GoCube, QiYi, Heykube, GAN timer and robot).

### F. Anki
- I found no maintained shared deck [unverified: AnkiWeb is client-rendered, and searches returned none].
- An Anki card can only check that you recall the alg text. It cannot time recognition or execution. Its scheduler, FSRS, is reusable: ts-fsrs is MIT, 819 stars, pushed today [verified].

### G. CubeSkills
- $6.95/mo [verified].
- Video tutorials and PDFs [verified].
- The only interactive tool is a PLL Recognition Trainer; results and analytics are premium [verified].

---

## 2. Feature matrix

Key: **RS** = random-state scramble, **Inv** = inverse-alg setup, **Pre** = pre-generated per-case scrambles or images. **Y** = yes, **–** = no, **~** = partial. Rec-split = recognition timed separately from execution. SR = spaced repetition. All rows [verified] except where §1 says otherwise.

| Tool | Scope | Case gen | Rand AUF / angle | Rec-split | Accuracy | SR / adaptive | Smart cube | Platform · price | Licence |
|---|---|---|---|---|---|---|---|---|---|
| csTimer | all LL/LS/F2L, easy cross/xcross | RS | Y / CN | – (~ with smart cube) | – | – | 5 brands | web · free | GPL-3.0 |
| CubeDesk | timer + alg trainer | ? | ? | – | – | – (uniform random) | GAN/Giiker/MoYu/Particula/QiYi | web · free | GPL-3.0 |
| jperm.net | OLL, PLL, CLL | ? | ? | – | – | status + "slowest" | – | web · free/ads | none |
| bestsiteever ZBLL | ZBLL; COLL via groups | Pre | y-rot | – | – | – | – | web · free | none |
| bestsiteever PLL-recog | PLL recognition | Pre 3D | 4 AUF × 4 colour | Y | Y | adaptive queue | – | web · free | none |
| Tao Yu | ~all algdb sets | real | Y / CN, mirror | – | – | – | Giiker only | web · free | MIT |
| Cubedex | 14 sets | Inv | Y / 2-sided | ~ (smart) | ~ | **Y (Anki-style)** | 5 brands + dumb | web PWA · free | MIT |
| SpeedCubeDB | many sets, 2-sided PLL, cross 1–7 | ? | ? | ~ (PLL-recog) | ? | – | – | web · free | none |
| cubingapp | F2L…ZBLL | Inv + random EPLL/AUF | Y | – | – | – | – | web · free | MIT |
| rubikstrainer | OLL/PLL/COLL recog | Pre 3D | 4 angles | ~ (registered) | Y | – | – | web+apps · ads/€4.99 | none |
| or18 | cross→xxxcross, pairs, EO | exact-depth RS | slot choice | – | – | – | – | web · free | GPL-3.0 |
| f2l-trainer.top | F2L 4 groups, L/R | Pre pool | Y / colours | – | ~ | weighted | 5 brands | web · free | **unclear** |
| cubetrainer.cc | solves, cross→xxcross, F2L, LL, Roux, ZZ | exact-depth RS | Y / CN | **Y (smart)** | **vs optimal** | ladder + retry | 5 brands | Chrome/Android · free | GPL-3.0 |
| Cubeast | solve analysis, Academy | RS | – | **Y** | ~ | ? | "all" | web · freemium | closed |
| Acubemy | analysis + alg coach | RS | ? | **Y** | ~ | **Y** | 5 brands | iOS/Android/web · freemium | closed |
| CuberPal | video/smart analysis, LL+F2L drills | ? | ? | ~ (video) | ? | **Y** | Y | iOS · $7–10/mo | closed |
| Twisty Timer | timer | TNoodle | – | – | – | – | – | Android · free | GPL-3.0 (dormant) |

---

## 3. The gaps (for a ~18 s CFOP solver with no smart cube)

**(a) COLL recognition from the real solving angle**
- No tool combines all of these:
  1. A 3D view at your hold angle (top plus front and right).
  2. **All 4 AUFs × random EPLL × colour shift.**
  3. Name-the-case input with **recognition latency timed apart from execution**.
  4. Drilling of confusable pairs.
  5. Spaced repetition.
- Closest tools:
  - rubikstrainer: isometric images, look-alike multiple choice, but fixed EP and 4 static images.
  - bestsiteever ZBLL in COLL-group mode: random EP and 3D, but one combined timer.
  - csTimer COLL scrambles: random-state on your own cube, so the true angle, but about 15 s of setup per case and no recognition split.
- **The bestsiteever PLL-recognition design applied to COLL does not exist.** Build this.

**(b) Cross/xcross planning with feedback against optimal**
- Exact-depth scrambles and optimal-solution lists exist: or18, csTimer `easyxc` plus the cross tool, SpeedCubeDB.
- Grading against optimal exists only with a smart cube (cubetrainer.cc).
- **Missing without a smart cube:**
  - A 15 s inspection countdown.
  - **Type or tap your planned cross/xcross.**
  - Validate it with a solver: does it solve? is it an xcross?
  - Score: your length − optimal; did you see the xcross or cross+1 that existed?
  - Then optionally execute it blind and self-verify against a rendered target state.
  - A difficulty ladder and a history of plan quality.

**(c) F2L with algorithmic, multi-angle solutions**
- f2l-trainer.top covers single-pair cases well: 41 cases × right/left × backslot, with Advanced and Expert groups.
- SpeedCubeDB and @moishy/algsets give per-slot algs for FR/FL/BR/BL.
- Missing:
  - Choosing **which slot and angle** to take with several free slots (random-state last 2–3 slots).
  - Ergonomic cost comparison of alternatives.
  - Folding F2L cases into a shared review schedule.
- Fill the gap mostly by integration, not invention.

**(d) Lookahead measurement and training**
- With no smart cube or video there is **no objective measurement anywhere** (pause time between pairs needs move timestamps).
- The only drills are toys: f2l-radar's track-the-pair at fixed TPS, and the interacty piece-tracking tool.
- Smart-cube apps (Cubeast, Acubemy, cubetrainer.cc) measure recognition pauses per stage. CuberPal tries video.
- Open space:
  - Metronome-paced F2L drills with self-report.
  - Piece-tracking quizzes generated from real F2L states, such as "after `U R U' R'`, where is the BL edge?".

**(e) One scheduler deciding today's practice across skills**
- **None exists.**
- Cubedex and Acubemy schedule algs only. CuberPal adds chat advice. cubetrainer.cc has per-trainer ladders.
- Nobody allocates a daily time budget across COLL recognition, OLL/PLL leftovers, F2L cases, cross planning and full solves from the evidence: each item's memory state plus which component is costing the most seconds.

**(f) Honest progress tracking**
- Timers report session means and PBs. csTimer has per-case train stats.
- No tool reports:
  - Noise-aware trends (confidence intervals on ao100s).
  - **Fixed benchmark sets** (the same scrambles re-tested) to separate skill from scramble luck.
  - A link from drill gains to full-solve splits.
  - "Learned" judged by retention over time rather than one fast execution.

---

## 4. Use as-is; don't rebuild

- **csTimer**: full-solve timing and stats, random-state COLL/OLL/PLL/F2L scrambles at the true angle, and optimal cross/xcross lookups.
- **f2l-trainer.top**: algorithmic F2L across slots and backslots.
- **or18 trainers**: exact-depth xcross/xxcross scrambles plus solution lists, until your plan-grading mode exists.
- **bestsiteever PLL Recognition Trainer**: PLL recognition, already excellent.
- **bestsiteever ZBLL trainer in COLL-group mode**: COLL execution reps with random EP.
- **If you buy a smart cube:** cubetrainer.cc (free, open; cross-vs-optimal, recognition split, ladders) plus Cubeast or Acubemy for solve analysis. That removes most of (b) and (d) from your build list. **cubetrainer.cc does not run on iOS/Safari.**

---

## 5. Open, reusable assets

**Alg databases**

| Asset | Contents | Terms | Reuse in a private-source public site |
|---|---|---|---|
| `@moishy/algsets` (jsr.io; github.com/moishy-r/moishy-cubing) | ZBLL 472, F2L 41×4 slots, adv-F2L 136, OLL 57, PLL 21, COLL+EPLL 40, WV/SV 27, ZBLS 301; several algs per case; recognition derived from alg | MIT; F2L sourced from SpeedCubeDB [verified] | **Yes** |
| cubingapp JSON (`tanstack/src/routes/algorithms/algs/*.json`) | F2L, OLL, PLL, COLL, OLLCP, ZBLL, WV, CMLL… with setup generators | MIT [verified] | **Yes** |
| Cubedex `defaultAlgs.json` | PLL, OLL, F2L, COLL, OLLCP, ZBLL, ZBLS, WVLS, VHLS, CMLL, L6E | MIT [verified] | **Yes** |
| Tao Yu Alg-Trainer sets | algdb.net 2018 snapshot | MIT [verified] | Yes (dated) |
| csTimer case tables (names, probabilities, masks) | all LL subsets | GPL-3.0 [verified] | Only if your app is GPL |
| bestsiteever `zbll_map_next.json` + 3D SVGs | ZBLL/COLL scrambles and images | no licence [verified] | Ask Roman first |
| SpeedCubeDB, jperm.net, CubeSkills PDFs | votes, sheets | no licence; © | Link out; don't scrape |

Bare move sequences are probably uncopyrightable facts; curated compilations, images and text are not. That is a lay reading, not legal advice [unverified].

**Renderers**
- cubing.js TwistyPlayer (MPL as a library): COLL/OLL/PLL/F2L stickerings, camera angle control [verified].
- sr-visualizer, github.com/tdecker91/visualcube (LGPL-3.0): SVG port of VisualCube, used by jperm.net [verified].
- puzzle-gen, github.com/tdecker91/puzzle-gen (Apache-2.0): 3D pictures; Roman forked it for his PLL trainer [verified].
- VisualCube PHP at cube.rider.biz: live [verified]; licence [unverified].
- `@wodzik/cubecore` (MPL-2.0): state, case recognition, solvers, 3D cube, smart-cube sessions [verified].

**Scramblers and solvers**
- cubing.js `random333Pattern` + `experimentalSolve3x3x3IgnoringCenters`: random-state for arbitrary partial states (MPL) [verified].
- cubejs, github.com/ldez/cubejs (MIT): Kociemba two-phase in JS [verified].
- min2phase, Java (**dual GPLv3/MIT**) [verified]; min2phase.js is GPL-3.0 [verified].
- TNoodle (AGPL-3.0) [verified]; cubing/twips (GPL-3.0) [verified].
- or18 RubiksSolverDemo exact-depth cross→xxxcross engines (GPL-3.0; heavy memory) [verified].
- csTimer cross/xcross solver (GPL-3.0) [verified].

**Smart cube and scheduling**
- smartcube-web-bluetooth (MIT): GAN Gen1–4, Giiker, GoCube, MoYu (AI 2023/MHC/WRM), QiYi/XMD [verified].
- ts-fsrs (MIT) [verified].

**Licence consequence.** A public website sends its JavaScript to every visitor. Under GPL-3.0 that counts as distribution, so copying code from csTimer, or18, cubetrainer.cc, CubeDesk or Twisty Timer obliges you to publish your source under GPL [unverified: standard reading]. With a private repo, stick to MIT, MPL or Apache code and write your own optimal cross/xcross solver. An IDA* search with pattern-database pruning on cross edges plus one pair is small.

---

## For a human (rulings)

1. **Smart cube or not?** With one (GAN or MoYu, Web Bluetooth, Chrome or Android only), cubetrainer.cc and Cubeast already cover cross-vs-optimal, recognition splits and lookahead pauses. Your build shrinks to COLL recognition, the scheduler and honest tracking. Without one, you need typed or tapped plan input and self-report, and lookahead stays unmeasured.
2. **Open-source the trainer under GPL-3.0, or keep the repo private?** GPL lets you lift csTimer's subset scramblers and or18's exact-depth engines. Private means MIT/MPL only, and you write your own solvers.
3. **Which device do you train on?** iPhone Safari has no Web Bluetooth, which rules out every web smart-cube tool on iOS.
4. **What counts as "the real solving angle" for COLL?** Your exact hold (camera latitude/longitude), and whether colour-neutral variants are in scope.
5. **Build or reuse for F2L?** Use f2l-trainer.top and only import its outcomes, or rebuild F2L drills inside your scheduler?
6. **Ask Roman Strakhov (bestsiteever) for permission** to reuse his ZBLL/COLL scramble map, 3D images and PLL-recognition design? Or rebuild from MIT data?
7. **Recognition-timing protocol without a smart cube:** a two-keypress split (press on recognition, press on completion), or name-the-case only?
8. **Daily time budget and goal metric** for the scheduler, e.g. 30 min/day, with ao100 or a fixed benchmark set as the north star.

---

## Sources

- csTimer — GitHub repo and source files `scramble_333_edit.js`, `tools/cross.js`, `stats/trainstat.js`, `hardware/*.js`: https://github.com/cs0x7f/cstimer
- J Perm — home page, PLL trainer, Credits: https://jperm.net, https://jperm.net/algs/pll, https://jperm.net/credits
- Roman-/zbll README and source: https://github.com/Roman-/zbll ; OLL trainer: https://github.com/Roman-/oll_trainer ; PLL Recognition Trainer: https://github.com/Roman-/pll_recognition_trainer ; bestsiteever mirror: https://github.com/Roman-/bestsiteever
- Tao Yu Alg-Trainer: https://tao-yu.github.io/Alg-Trainer/ ; Rouxles fork README: https://github.com/Rouxles/Alg-Trainer
- Cubedex: https://github.com/poliva/cubedex (`src/views/HelpView.tsx`, `src/data/defaultAlgs.json`)
- SpeedCubeDB home, trainer, cross trainer, COLL page: https://www.speedcubedb.com, /t, /cross, /a/3x3/COLL
- cubingapp: https://cubingapp.com ; https://github.com/spencerchubb/cubingapp
- rubikstrainer.com (SpeedCube Trainer) home, COLL recognition, plans: https://www.rubikstrainer.com, /recognition/coll, /plans
- "algs trainer" — SpeedSolving.com (LL-trainer): https://www.speedsolving.com/threads/algs-trainer.86254/
- or18 RubiksSolverDemo README and XCross trainer: https://github.com/or18/RubiksSolverDemo ; https://or18.github.io/RubiksSolverDemo/xcross_trainer
- "Trainer for XXCross" — SpeedSolving.com: https://www.speedsolving.com/threads/trainer-for-xxcross.96166/
- Cross To F2L: https://christianvaughn.net/C2F2L/
- F2L Trainer: https://github.com/Dave2ooo/F2LTrainer ; https://f2l-trainer.top
- f2l-radar: https://github.com/david-westerhoff/f2l-radar
- (ANOTHER) Cube trainer README and plan doc: https://github.com/wodzik/cube ; https://cubetrainer.cc
- smartcube-web-bluetooth: https://github.com/poliva/smartcube-web-bluetooth
- CubeDesk README and Prisma migration 20260705143657: https://github.com/kash/cubedesk
- Twisty Timer: https://github.com/aricneto/TwistyTimer
- cubing.js README, search exports, stickerings: https://github.com/cubing/cubing.js
- Cubeast home: https://www.cubeast.com
- acubemy home: https://acubemy.com
- CuberPal App Store listing: https://apps.apple.com/app/id6758110729
- CubeStation NEW App Store listing: https://apps.apple.com/us/app/cubestation-new/id6473158674
- Lookahead+ App Store listing: https://apps.apple.com/us/app/lookahead/id6757954556
- Brief Cubing: https://briefcubing.com ; https://github.com/AshleyF/briefcubing
- CubeSkills Membership Options: https://cubeskills.com/membership-options
- "Software and Trainers" — speedcubing.com: https://speedcubing.com/SoftwareAndTrainers.html
- @moishy/algsets on JSR: https://jsr.io/@moishy/algsets ; https://github.com/moishy-r/moishy-cubing
- min2phase: https://github.com/cs0x7f/min2phase ; https://github.com/cs0x7f/min2phase.js
- TNoodle: https://github.com/thewca/tnoodle ; twips: https://github.com/cubing/twips ; cubejs: https://github.com/ldez/cubejs
- sr-visualizer/visualcube: https://github.com/tdecker91/visualcube ; puzzle-gen: https://github.com/tdecker91/puzzle-gen
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
