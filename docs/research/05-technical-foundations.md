# 05 — Technical foundations for cube.nathanwei.org

Research date 2026-10-15. **[verified]** means I read the primary source: a repo file, a LICENSE, official docs, or the npm tarball. **[unverified]** means memory, a secondary source, or my own estimate.

## TL;DR
- **cubing.js 0.66.0** (MPL-2.0 OR GPL-3.0-or-later) is the core. It is fine in a private app; obligations apply only to modified cubing.js files. It provides algs, KPuzzle state, min2phase in a worker, TwistyPlayer and stickering masks. Two risks: it is a fast-moving 0.x line with `experimental*` APIs, and it has a documented Next.js/Turbopack hang.
- **Case scrambles: build the target state, solve it with min2phase, and invert.** This is csTimer's method. Never ship `inverse(alg)` setups.
- **Cross and xcross solvers: our own TypeScript in a Web Worker.**
  - Cross uses an exact 190,080-entry table (~190 KB), which answers every feedback question.
  - xcross uses IDA* (csTimer style, under 1 MB) or an exact 73M-state table (~18 MB at 2 bits).
  - csTimer is GPL, so read it and don't copy it. or18's solver is MIT, a good test oracle.
- **Storage is local-first.** IndexedDB (Dexie) holds an append-only log, synced to **D1** through a Worker at `/api/*`. FSRS state is recomputed from the log, so sync never conflicts.
- **Build with a Vite + React SPA and the Cloudflare Vite plugin, not Next.js.** Next 16 uses Turbopack by default, and the cubing.js maintainers say "Next.js may hang… no known workaround."

## 1. cubing.js
**Version, license and release pace:**
- Latest npm `cubing` is **0.66.0**, released 2026-10-15 [verified]. Releases are frequent and breaking: 0.64.0, 0.65.0–0.65.2 and 0.66.0 all shipped between Oct 9 and Oct 15. 0.66.0 removed `Alg.type` [verified, GitHub releases]. **Pin an exact version and wrap cubing.js in one adapter file.**
- License: `"MPL-2.0 OR GPL-3.0-or-later"` [verified, package.json, LICENSE-MPL.md, LICENSE-GPL.md]. The README says it is *"free to use in any public or private project"*. Library users *"can effectively treat all of cubing.js as if it was MPL-licensed"* [verified].
- **What MPL means for a hosted web app:** serving minified JS to browsers counts as distributing Executable Form. §3.2(a) then requires telling recipients how to get the source [verified]. For unmodified cubing.js, a licenses page linking the repo covers that. §3.3 lets our code ("Larger Work") stay private under any terms [verified]. No copyleft reaches our code unless we patch cubing.js files.
- The README has adopted Rust's LLM policy: LLM-authored contributions *"are likely to be rejected"* [verified]. Any fixes we need live in our own fork or patch.
- Requires ES2022, `moduleResolution: "bundler"`, and Node ≥ 22.3 [verified].

**Modules relevant here** (package `exports` include `alg`, `kpuzzle`, `puzzles`, `scramble`, `search`, `twisty`, `bluetooth`, `stream`) [verified]:

| Need | API (verified in source) | Notes |
|---|---|---|
| Random-state 3x3 scramble | `randomScrambleForEvent("333")` | *"always happens in a worker"*. Prefetches the next scramble. WCA filtering *"not implemented yet"* [verified, docs] |
| Solve any 3x3 state | `experimentalSolve3x3x3IgnoringCenters(pattern)` | Vendored **min2phase** (MIT) in a cached worker. `random333Pattern()` is also exported |
| Generic search | `experimentalSolveTwips(kpuzzle, pattern, {targetPattern, generatorMoves, minDepth, maxDepth})` | twips is Rust/WASM (MPL OR GPL) and runs in a dedicated worker per search |
| Algs | `Alg.fromString`, `.invert()`, `.expand()`, `.concat()`, `.experimentalSimplify({cancel:true, puzzleLoader})`, `experimentalLeafMoves()` | SiGN/WCA notation: wide moves, slices, rotations |
| State | `KPattern.applyAlg/applyMove/isIdentical/experimentalIsSolved` | Orbits are `EDGES` 12×2, `CORNERS` 8×3 and `CENTERS` 6×4 (`orientationMod` 1). `orientationMod` can mark "orientation unknown" |
| Render | `<twisty-player>` with visualization `3D`, `2D`, `experimental-2D-LL`, `experimental-2D-LL-face` | Attributes: `experimental-setup-alg`, `experimental-stickering`, `experimental-stickering-mask-orbits`, `hint-facelets`, `camera-latitude`/`-longitude`, `control-panel`. `experimentalScreenshot()` returns an image |
| Masks | `OLL, PLL, LL, COLL, OCLL, CLL, EPLL, ZBLL, LS, ELS, CLS, VLS, F2L, Cross, EOcross, CMLL, …` | Custom masks go through `experimental-stickering-mask-orbits` |

**Bundle size.** Measured from the tarball [verified]:
- `twisty/index.js`: 190 KB raw / 42 KB gzip.
- Lazy 3D chunk: 60 KB / 12.7 KB gzip.
- 3x3 min2phase chunk: 65 KB / 13.9 KB gzip.
- twips chunk: 671 KB, loaded only for twips or non-3x3 puzzles.
- three.js is imported through deep `three/src/...` paths, so it tree-shakes. WebGLRenderer still dominates the 3D weight [size unverified].
- After 2 dedicated WebGL renderers, further players share a pooled renderer [verified, Twisty3DVantage.ts].

**Speed.** From the min2phase.js README (Node 8, i7-6700HQ) [verified]:
- Full init takes ~350 ms.
- After that, a solve averages ~2.3 ms, with every solution ≤ 21 moves.
- The browser adds worker spin-up: expect ~0.3–1 s for the first scramble on a phone [unverified].

**Bundler compatibility.** cubing.js issue #323 is the maintainers' "compatibility notes" [verified]:
- They recommend esbuild.
- Vite needs `worker: { format: "es" }`.
- *"Next.js may hang during development… There is no known workaround."*
- They *"recommend against using React… if you can avoid it"*. React 19 handles custom elements fine [unverified].
- Issue #376: Turbopack dev and build hang, while webpack `next build` works [verified, comments from 2025-05].

**Bluetooth module.**
- `connectSmartPuzzle()` covers GAN, GoCube, GiiKER, Heykube and QiYi (`QY-QYSC`), plus smart timers and a `KeyboardPuzzle` [verified].
- The GAN driver uses the old `fff0` service and "Gan 356i" mappings. It likely lacks the Gen2–Gen4 encrypted protocols [unverified inference].

## 2. Case-specific scramble generation
**Approaches, worst to best:**
1. **`inverse(alg)` + random AUFs.** The scramble always ends in the alg's tail, so you learn to recognize scrambles, and the rest of the cube looks artificially solved. Use it as a dev fallback only.
2. **Target state → two-phase solve → invert.** Build a `KPattern`:
   - F2L solved.
   - LL pieces set to the case.
   - Random pre-AUF and post-AUF.
   - "Don't care" pieces random, with parity fixed.

   Then `scramble = (await experimentalSolve3x3x3IgnoringCenters(p)).invert()`, rejecting results of ≤ 3 moves. Scrambles come out natural and 18–21 moves long, at ~2–5 ms each after init. Prefetch the next one during the current rep.
3. **csTimer does exactly #2** [verified, `scramble_333_edit.js`]. `getAnyScramble(ep, eo, cp, co, neut, rndapp, rndpre)` works like this:
   - It takes per-piece nibble masks, where `f` means random.
   - It fixes parity and applies random pre/post AUFs.
   - `neut` adds color-neutral re-orientation.
   - It calls min2phase with inverse output.

   Its case tables are compact cubie encodings with natural-frequency weights. PLL weights sum to 72 with solved, which is 288 LL permutations ÷ 4 AUFs [verified count]. The COLL table has 43 entries: 40 + O-Adj + O-Diag + O-AUF. The F2L table has 41 + solved [verified]. **csTimer is GPL-3.0** [verified]: re-implement the idea, don't copy code or tables.
4. **Random-state subset scrambles** are #2 with uniform sampling of the free pieces. cubing.js has no subset scrambler: `cubing/scramble` exports only `randomScrambleForEvent` and `experimentalDeriveScrambleForEvent` [verified].

**Specific targets:**
- **"Cross in exactly N moves":** sample uniformly from the exact cross table at depth N. Rejection sampling fails because only 102 of 190,080 crosses need 8 moves [verified]. Randomize the other pieces, then solve and invert. csTimer's `getEasyCross(n)` does this [verified].
- **xcross targets** work the same way using the xcross solver.
- **Orientation gotcha:** scrambles are applied in WCA orientation (white top, green front), while LL cases are defined yellow-up. Conjugate the target by the solving rotation (z2 or x2) before solving.

**Libraries:**
- cubing.js `cubing/search` (min2phase): **recommended**.
- `min2phase.js` 0.0.4: README says GPLv3 / MIT dual, the LICENSE file is GPL, and package.json says `(MIT or GPL-3.0)` [verified]. It is redundant with cubing.js.
- `cubejs` (MIT, last published 2022) has a multi-second init [license verified; speed unverified].

## 3. Cross, xcross and F2L solvers
**Cross: 12P4 × 2⁴ = 190,080 states** [verified, csTimer `cross.js`].
- Optimal HTM counts for depths 0–8: 1, 15, 158, 1,394, 9,809, 46,381, 97,254, 34,966, 102. Mean **5.81**, which matches CubeZone [verified, computed from csTimer's `ncase`].
- The exact BFS table is 190 KB as a `Uint8Array`, generated in tens of ms in a worker [estimate].
- One table serves all 6 colors: re-map the scramble's moves by rotation, as csTimer's `moveIdx` does [verified].

**xcross with a fixed color and fixed pair: 190,080 × 24 × 16 = 72,990,720 states, max 10 moves.** Mean HTM by scenario [verified, CubeZone xcross study]:

| Scenario | Mean (HTM) |
|---|---|
| Fixed color, fixed pair | 7.98 |
| Fixed color, best of 4 pairs | 7.35 |
| With pseudo-pairs | 6.78 |
| Dual color | 6.99 |
| Full color neutral | 6.45 |

- An exact table is **18.2 MB at 2 bits per state**, shared by all slots and colors via conjugation.
- A BFS in JS probably takes 10–60 s, so cache it in OPFS or IndexedDB, or prebuild it as a static asset. Workers allows 25 MiB per file [verified limit; timing unverified].

**csTimer's IDA\* approach needs no big table** [verified, `cross.js`]:
- Tables: `permPrun` 11,880 entries; `flipPrun` 7,920; `ecPrun` 4×576 (per slot); `xxPrun` 2×331,776 (pair-pair); full cross 190,080.
- `solveMulti` covers xcross over 4 slots and xxcross over adjacent and diagonal pairs.

**xxcross:** a fixed pair-of-pairs has ~2×10¹⁰ states, so an exact table is out. Run IDA* with `max(xcrossTable(A), xcrossTable(B))` as a strong heuristic [design mine, speed unverified].

**Existing implementations:**

| Project | License | Notes |
|---|---|---|
| csTimer `src/js/tools/cross.js` | GPL-3.0 [verified] | cross (6 colors), xcross, xxcross, xxxcross, easy-cross. Reference only |
| or18/Rubiks-cube-xcross-solver | **MIT** [verified] | C++ cross → xxxxcross and LL substeps. Ships `f2l_solver_lite.wasm` (205 KB) and a browser demo that lists many solutions. Full native xcross tables take 574 MB [verified]. 4★, last push 2025-03. **Use as test oracle** |
| vangie/cube-xcross | MIT [verified] | Self-reported (M4 Max, native, warm) cross 0.061 ms, XC 0.073 ms, 3XC 1.23 ms. Has *"no browser worker"*. Created 2026-07-26, 2★, pre-release. Don't depend on it |

**Recommendation:**
- Write `cross.ts` (exact table) and `xcross.ts` (IDA* first; add the 2-bit table if phones are slow) in TypeScript, behind a Comlink worker.
- Test against or18's output.
- Count in HTM; published statistics use it.

**"Your plan vs optimal" feedback.** The exact table makes all of this cheap:
1. **Score:** "Your cross: 7 (white). Optimal: 6 white, 5 best color (blue)," plus a 6-color (or dual-color) optimum table.
2. **Distance trace:** cross distance after each planned move, e.g. `6→5→5→4…`. A flat step or a rise marks the exact wasted move.
3. **All optimal solutions:** follow strictly decreasing distance. Deduplicate commuting moves (U D = D U). Show 3–5 of them plus "optimal + 1" alternatives.
4. **Pair-aware ranking:** for each optimal cross, show the F2L state it leaves (pairs solved or connected) and each slot's xcross distance, e.g. "best pair: BR, xcross 7." This is the pair-choice feedback.
5. **Metadata:** inspection time used, whether a rotation was needed, and execution time.

## 4. Case data and rendering
**Counts.** PLL 21, OLL 57, COLL 40 (42 including O-Adj and O-Diag), F2L 41 [verified via csTimer maps]. Derive F2L's 41 in code: every corner/edge placement in U or the slot, minus solved, with AUF normalized.

**Sources and their terms:**
- **algdb.net** is now a TheCubicle "Under Construction" page [verified 2026-10-15], so it is dead.
- **SpeedCubeDB** has a privacy page only; no terms, no API, and robots.txt returns 404 [verified].
- **jperm.net/algs** renders with sr-visualizer and has no terms page [verified].
- **CubeSkills PDFs** are for personal reading only [unverified].
- **`@moishy/algsets` 0.3.3** (JSR, MIT) covers PLL 21, OLL 57, COLL+EPLL 40, F2L 41×4 slots and ZBLL 472. It stores `id`, `name` and `algs[]` with source attribution; its F2L comes from SpeedCubeDB [verified].
- Individual alg strings are short functional sequences and likely not copyrightable. Bulk-copying a curated database is a terms and courtesy question [unverified legal view].

**Recommendation:**
- Generate case *definitions* from first principles: a cubie target per case plus an AUF canonicalizer.
- Store Nathan's chosen alg per case, seeded from `@moishy/algsets` with attribution.
- A vitest check runs every alg on its case state and asserts the LL is solved up to AUF.

```ts
type LLCase = {
  id: string;                            // "PLL-Ga", "COLL-T3"
  set: "PLL" | "OLL" | "COLL" | "F2L";
  target: { cp: number[]; co: number[]; ep: number[]; eo: number[] }; // U-layer cubies, yellow-up
  weight: number;                        // natural frequency (PLL: 1/2/4 of 72)
  algs: string[];
};
```

**Identifying cases and recognition features:**
- **Identify a case** by trying all 16 pre×post AUFs and canonicalizing. The same function classifies smart-cube states.
- **Recognition features:** for each (case × pre-AUF), precompute the 6 side stickers visible from the solving angle (F row + R row). Derive headlights, bars, blocks, bookends, 4-color and checkerboard as pure functions of those stickers. This enables sticker-only recognition drills and per-angle stats.

**Images:**
- **Thumbnails and grids:** our own SVG — a VisualCube-style top-down plan with side stickers, plus an isometric U+F+R view with the AUF applied. About 150 lines, no license risk, no WebGL.
- **sr-visualizer:** its repo ships COPYING and COPYING.LESSER (**LGPL-3.0**), while package.json says ISC [verified]. Avoid it.
- **Training view:**

  ```html
  <twisty-player visualization="3D" experimental-stickering="COLL" hint-facelets="none" control-panel="none">
  ```

  Apply setup alg = pre-AUF + case setup. Tune the camera latitude and longitude to the real solving view.
- **Lookahead:** stickering masks can hide pieces for "occluded" drills.

## 5. Smart-cube-ready input layer
```ts
type HostTime = number; // performance.timeOrigin + performance.now()
type InputEvent =
  | { kind: "trigger"; phase: "down" | "up"; source: "keyboard" | "touch" | "stackmat" | "ganTimer"; t: HostTime }
  | { kind: "move"; move: string; t: HostTime; deviceT: number | null; source: "smartcube" | "virtual" }
  | { kind: "state"; pattern: KPatternData; t: HostTime }
  | { kind: "answer"; caseId: string; t: HostTime }
  | { kind: "connection"; status: "connected" | "lost"; device: string; t: HostTime };
```
**Trainers as state machines.** Each trainer is a state machine over `InputEvent`: present → recognizing → executing → done.
- **Keyboard/touch:** recognition runs from paint to the first trigger-down; execution runs to the next trigger.
- **Smart cube:**
  - Recognition runs from paint to the first move.
  - Execution runs from the first move until the target state is reached.
  - Correctness is automatic.
  - The alg used is detected by matching the simplified move stream.
- Use `event.timeStamp` and the paint time from `requestAnimationFrame` [unverified best practice].

**Smart cube libraries:**
- **`gan-web-bluetooth` 3.0.2 (MIT):**
  - Supports GAN Gen2/3/4, MoYu AI 2023 and GAN timers, through RxJS.
  - Each move carries `localTimestamp` and `cubeTimestamp`. Either may be null after a recovered event.
  - `cubeTimestampLinearFit()` corrects cube-clock skew, an approach credited to csTimer [verified].
  - Last published 2024-08-22 [verified], so it may lag new models.
- **cubing.js `connectSmartPuzzle`** is the fallback.
- **csTimer** supports MoYu32, QiYi and others, but is GPL [verified].

**Smart cube flows:**
- Scrambling becomes "get from the current state to the target." Solve `current⁻¹·target` with min2phase and guide the user move by move.
- Store each move stream with host time deltas, cube timestamps and fit parameters. Don't store gyro data.

**Platform:**
- Web Bluetooth ships in Chrome on Android, ChromeOS, Mac and Windows.
- No Safari or iOS support [verified, WebBluetoothCG implementation status].
- Disabled by default in Brave; enable it via brave://flags [unverified, Brave community forum].

## 6. Data model, storage and sync
**Tables.** One Zod schema in `shared/`, used by both Dexie and D1:

| Table | Fields |
|---|---|
| `reps` (append-only) | ULID `id`, `trainer`, `caseId`, `preAuf`, `postAuf`, `scramble`, `shownAt`, `recogMs`, `execMs`, `outcome` (correct/wrong/dnf/skip), `algId?`, `inputSource`, `deviceId`, `appVersion`, `extra` JSON (move stream, plan, per-color optima), `serverSeq?` |
| `solves` (append-only) | `id`, `scramble`, `startedAt`, `totalMs`, `penalty`, `splits` JSON (cross/F2L1–4/OLL/PLL), `moves?`, `deviceId` |
| `caseConfig`, `settings` (last-writer-wins) | `chosenAlg`, `status`; key/value; `updatedAt` |
| `fsrsCards` | **Derived cache**, rebuilt by replaying `reps`; never synced |

**FSRS.** `ts-fsrs` 5.4.2 (MIT, FSRS-6) provides `createEmptyCard()` and `fsrs().next(card, now, Rating.Good)` [verified].
- Map each rep to a rating with explicit time thresholds.
- At most one FSRS review per case per day. Further same-day reps are drills that only feed stats.
- Disable fuzz so replay is deterministic [option names unverified].

**Options on Cloudflare:**
- **localStorage:** too small.
- **IndexedDB alone:** no sync.
- **KV:** eventually consistent and can't be queried.
- **Durable Objects:** more code than one user needs.
- **D1 free tier:** 500 MB per database, 100k rows written and 5M read per day, 50 queries per invocation [verified]. 300 reps a day comes to ~110k rows (~25 MB) a year [estimate].

**Recommended: Dexie 4.4.6 (Apache-2.0) as each device's source of truth, plus D1 behind `/api/sync`.**
- Push is an idempotent insert keyed on ULID.
- Pull fetches rows with `serverSeq > cursor`.
- Logs merge as a union; config uses last-writer-wins.

**Auth.**
- **Cloudflare Access:**
  - Free up to 50 users [unverified, Cloudflare blog].
  - The Worker must still verify `Cf-Access-Jwt-Assertion` against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, checking `aud` and `iss` with `jose` [verified, CF docs].
  - Expired sessions break `fetch` from an installed PWA, because Access answers with a cross-origin login redirect [unverified].
- **Device token (recommended):** created with `wrangler secret put SYNC_TOKEN`, entered once per device, sent as a Bearer header and compared in constant time. It works offline. The data is low-sensitivity; Access remains the upgrade path.

## 7. App architecture
**Next.js 16 static export:**
- Turbopack is now the default for `next dev` and `next build`; `--webpack` opts out [verified, Next.js 16 upgrade guide].
- Given the cubing.js Turbopack hang, Next would need `next build --webpack` plus client-only dynamic imports [unverified on 16.4].
- The app is fully client-interactive, so server components add nothing.

**Vite + React SPA (recommended):**
- `pnpm create cloudflare@latest -- cube --framework=react` scaffolds a React SPA, a Worker API and `@cloudflare/vite-plugin` (1.64.0) [verified, CF React guide].
- Add `worker.format: "es"` for cubing.js.
- Vite 8.3 with cubing.js is untested, so spike it on day 1.

**wrangler.jsonc.** Syntax verified against the CF static-assets and SPA docs:
- `run_worker_first` arrays need Wrangler ≥ 4.20 and disable the `Sec-Fetch-Mode: navigate` heuristic.
- Asset requests are free and unlimited.
- Free plan: 100k requests/day, 10 ms CPU per request, 20k files and 25 MiB per file [verified].

```jsonc
{
  "name": "cube",
  "main": "./worker/index.ts",
  "compatibility_date": "2026-10-15",
  "assets": { "not_found_handling": "single-page-application", "run_worker_first": ["/api/*"] },
  "d1_databases": [{ "binding": "DB", "database_name": "cube", "database_id": "<id>" }],  // [unverified syntax]
  "routes": [{ "pattern": "cube.nathanwei.org", "custom_domain": true }]                    // [unverified syntax]
}
```

**PWA (offline):** `vite-plugin-pwa` 2.0.0 (MIT, Workbox).
- Precache the shell, the cubing.js 3x3 search and twisty chunks, and the solver worker.
- `globIgnores` the twips and other-puzzle chunks.
- Keep the optional 18 MB xcross table in OPFS or the runtime cache.
- Sync on the `online` event and on focus. Don't rely on Background Sync, which is Chromium-only [unverified].

**Workers:** cubing.js manages its own. Ours are loaded with `new Worker(new URL("./cross.worker.ts", import.meta.url), {type: "module"})` and Comlink.

**Tests:** vitest 5.0.5 in Node. cubing.js's `alg`, `kpuzzle`, `search` and `scramble` *"should work perfectly"* in Node [verified, issue #323]. Add fast-check property tests:
- A case scramble applied to solved yields that case, up to AUF.
- Every stored alg solves its case.
- The cross table matches brute-force IDDFS.
- xcross optima match or18.

## 8. Recommended stack, layout, milestones, risks
**Stack:**
- Frontend: pnpm, strict TypeScript, Vite + React 19 SPA.
- Cube logic: **cubing.js pinned at 0.66.0**.
- Data: ts-fsrs, Dexie, Zod 4.6.7, Comlink.
- Backend: Worker (plain router or Hono) + D1.
- Tooling: vite-plugin-pwa, vitest + fast-check.
- Deploy: Workers Builds on push to `main`.

```
cube/
  wrangler.jsonc  vite.config.ts  package.json
  shared/schema.ts                 # Zod: Rep, Solve, CaseConfig, Sync*
  worker/{index,sync,auth}.ts   migrations/0001_init.sql
  src/cube/cubing.ts               # ONLY file importing cubing/*
  src/cube/cases/{pll,oll,coll,f2l}.ts  canonical.ts  recognition.ts  scramble.ts
  src/solvers/{cross-table,xcross}.ts  cross.worker.ts
  src/input/{types,keyboard,touch,gan}.ts
  src/trainers/{ll,f2l,cross,lookahead}/   src/render/{CaseSvg,TwistyView}.tsx
  src/data/{db,sync,fsrs}.ts   tests/
```

**Milestones:**
1. **M1 — LL trainer, offline, deployed.**
   - Day-1 spike: cubing.js scramble and solve in `vite dev`, in the production build, and offline.
   - PLL/OLL/COLL tables with alg-verification tests.
   - Case scrambler with random AUFs.
   - Keyboard/touch timing with recognition and execution split.
   - Dexie log, SVG thumbnails, TwistyPlayer view.
   - Live at cube.nathanwei.org.
2. **M2 — Sync and scheduling.** D1 + `/api/sync` with token auth, FSRS replay, per-case and per-AUF stats, installable PWA, phone layout.
3. **M3 — Cross/xcross planner + F2L.**
   - Exact cross table worker, xcross IDA*, typed plan input.
   - Feedback panel: per-color optima, distance trace, optimal solutions, pair ranking.
   - F2L 41-case trainer.
   - After M3: smart cube (gan-web-bluetooth) and lookahead drills.

**Risks:**
1. cubing.js bundler breakage (Turbopack hang, Vite worker format, Vite 8 untested). Mitigate with the spike, the adapter and the pin.
2. `experimental*` API churn: 3 minor versions in a week.
3. GPL contamination if csTimer code is copied into a publicly served app.
4. Phone memory and latency for xcross/xxcross.
5. Smart cubes: no iPhone support, Brave needs a flag, and GAN protocols drift.
6. Alg data provenance: algdb is gone and SpeedCubeDB publishes no terms.
7. FSRS models day-scale memory, not same-session drilling, so the rating thresholds are heuristic.
8. Keyboard and paint latency add ~10–30 ms of noise to recognition times [unverified].

## Sources
- cubing.js repo/README — https://github.com/cubing/cubing.js ; LICENSE-MPL — https://github.com/cubing/cubing.js/blob/main/LICENSE-MPL.md ; releases — https://github.com/cubing/cubing.js/releases ; npm — https://www.npmjs.com/package/cubing ; source files: `search/outside.ts`, `search/inside/solve/puzzles/3x3x3/{index,filter}.ts`, `puzzles/stickerings/*.ts`, `twisty/views/TwistyPlayer.ts`, `twisty/views/3D/Twisty3DVantage.ts`, `bluetooth/**`, `kpuzzle/KPattern.ts`
- "cubing.js compatibility notes" #323 — https://github.com/cubing/cubing.js/issues/323 ; issue #376 — https://github.com/cubing/cubing.js/issues/376 ; docs — https://js.cubing.net/cubing/ and https://js.cubing.net/cubing/scramble/ ; twips — https://github.com/cubing/twips
- min2phase — https://github.com/cs0x7f/min2phase ; min2phase.js — https://github.com/cs0x7f/min2phase.js ; csTimer — https://github.com/cs0x7f/cstimer (`src/js/tools/cross.js`, `src/js/scramble/scramble_333_edit.js`)
- or18 xcross solver — https://github.com/or18/Rubiks-cube-xcross-solver ; vangie cube-xcross — https://github.com/vangie/cube-xcross ; CubeZone "XCross study" — https://cubezone.be/xcrossstudy.html
- gan-web-bluetooth — https://github.com/afedotov/gan-web-bluetooth ; WebBluetoothCG implementation status — https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md ; Brave Community thread — https://community.brave.app/t/can-you-enable-web-bluetooth-api-in-brave/522553
- visualcube fork (sr-visualizer) — https://github.com/tdecker91/visualcube ; @moishy/algsets — https://jsr.io/@moishy/algsets ; SpeedCubeDB privacy — https://speedcubedb.com/privacy ; algdb.net — https://algdb.net/ ; J Perm — https://jperm.net/algs ; ts-fsrs — https://github.com/open-spaced-repetition/ts-fsrs
- Cloudflare Docs: Static Assets binding — https://developers.cloudflare.com/workers/static-assets/binding/ ; SPA routing — https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ ; React guide — https://developers.cloudflare.com/workers/framework-guides/web-apps/react/ ; Billing & limitations — https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ ; Limits — https://developers.cloudflare.com/workers/platform/limits/ ; D1 limits — https://developers.cloudflare.com/d1/platform/limits/ ; D1 pricing — https://developers.cloudflare.com/d1/platform/pricing/ ; Access JWT validation — https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ ; blog "Teams plans" — https://blog.cloudflare.com/teams-plans
- Next.js "How to upgrade to version 16" — https://nextjs.org/docs/app/guides/upgrading/version-16

## For a human (rulings)
1. **Framework:** Vite + React (recommended, because the cube library's maintainers document a Next.js hang with no workaround) or Next.js 16 to match nathanwei.org (needs the older webpack build mode and is unproven)?
2. **Public or private:** should cube.nathanwei.org be usable by anyone (training runs locally in their browser; only your sync is locked), or locked so only you can load it?
3. **Login:** is a one-time secret token per device OK (simplest, works offline)? Or do you want Google/GitHub login through Cloudflare Access (nothing to type, but sync breaks in the installed app when the session expires until you re-open the login page)?
4. **Open source?** Keeping the repo private or permissively licensed means we re-write csTimer-style parts ourselves (the plan assumes this). Making the app GPL-3.0 would let us copy csTimer's code.
5. **Smart cube:** which one do you own or plan to buy (GAN model and generation, MoYu, QiYi)? It picks the Bluetooth library. No iPhone support; Brave needs a flag; Chrome works.
6. **Cross colors:** score the cross/xcross trainer against fixed white, dual color (white/yellow), or full color neutral?
7. **Move counting:** is HTM (R2 = 1 move, the standard) fine for "optimal"?
8. **Algs:** seed from the MIT `@moishy/algsets` package (data originally from SpeedCubeDB) and edit, or type in your own from scratch?
9. **Scheduling thresholds:** what recognition and execution times count as "Good" vs "Hard" for each set? Is a wrong alg always "Again"?
10. **Phone:** must optimal xcross/xxcross analysis work offline on your phone (an ~18 MB download, or slower answers), or is laptop-only fine for that trainer?
11. **COLL scope:** 40 cases, or 42 including the two oriented-corner swaps?
12. **Case frequency:** draw cases at natural frequency (e.g., H-perm 1 in 72) or uniformly / weighted toward your weak cases?
