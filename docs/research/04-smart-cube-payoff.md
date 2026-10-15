# 04: Is a smart cube worth it as an input device for a self-built trainer?

Researched 2026-10-15. Tags: **[verified]** means I read the primary source (retailer listing, repo source code, spec, browser source) today. **[unverified]** means memory, a secondary source, or a vendor/marketing claim I couldn't check independently. Prices are USD, seen 2026-10-15. SCS = SpeedCubeShop, TC = TheCubicle. Amazon blocked automated fetches, so it has no prices here.

## 0. Bottom line

- **Yes, it's worth it. Buy a GAN i4 MagLev UV ($69.95 SCS, $69.99 TC) as the main practice cube.** He is buying a cube anyway. The i4 costs $20 more than a GAN 15 or a Tornado V4 Pioneer ($49.95), and $15 less than a GAN 16 Max ($84.95) [verified prices]. It has a gyro, per-move hardware timestamps, recovery of lost moves, and the largest open-source support of any line. The budget pick is the **QiYi AI UV ($26.95)**.
- **What it unlocks that nothing else does cheaply:** automatic per-step splits on every solve (cross, each F2L pair, OLL, PLL), recognition vs execution time per step, pause (lookahead) maps, which case came up and which alg he used, and fully checked drills. Without one, each of these needs either keypresses that disrupt the solve or a manual video reconstruction (section 6).
- **The software side is solved.** MIT-licensed TypeScript libraries already decode GAN, MoYu, QiYi, GoCube and Giiker over Web Bluetooth (section 4). The real cost is browser friction. Brave has Web Bluetooth **off by default**, and a GAN cube needs its MAC address once (section 5).
- **Competitions:** a smart cube is not WCA-legal (Regulation 3a4), so he still needs a non-smart cube for comps. His current cube can fill that role.

## 1. Current smart 3x3 models and prices (2026-10-15)

| Model | SCS | TC | Gyro | Battery / charging | Weight |
|---|---|---|---|---|---|
| **GAN 16 ui Max** (flagship smart, SCS listing 2026-07-09) | $125.96 (list $139.95) | $139.99 | yes | 15 h standalone + 30 h via GanPod | 71 g |
| GAN 12 ui MagLev + PowerPod | $119.95 | $119.99 (2026 Ed.) | yes [verified, lib + cubetrace] | — | — |
| GAN 12 ui SP | $80.96 | $89.99 | not stated | — | ~72 g |
| **GAN i4 MagLev UV** (also matte $64.95, Leap $54.95) | $69.95 | $69.99 | yes | 30 h performance / 200 h endurance; 10-min quick charge = 10 h | 74 g |
| GAN i Carry 4 | $34.95 | $34.99 | **no** (per Twysty) | replaceable, ~150 h | ~70 g |
| GAN 356 i Carry E V2 | $29.95 | $25.99 | — | — | — |
| MoYu WeiLong V11 AI (MagLev, UV) | $114.95 | $115.99 | yes | ~30 h, non-replaceable Li-ion, charging box | — |
| MoYu Super AoLong AI | $134.95 | $134.99 | — | — | — |
| MoYu WeiLong V10 AI (MagLev UV / ball-core / Lite) | $80.96 / $53.06 | Lite $32.99 | yes | ~30 h | — |
| X-Man (QiYi) Tornado V4 AI | $79.95 with power-bank case | $59.99 with base | yes | up to 200 h with case | 76.5 g |
| **QiYi AI** (magnetic / UV) | $22.95 / $26.95 | $22.99 / $26.99 | no | "chargeless" ~800 h | — |

All rows [verified] from SCS/TC product JSON and product descriptions. The specs are vendor claims.

Notes:
- The "Pioneer" name is a **non-smart** Tornado V4 trim ($49.95) [verified]. The smart model is "Tornado V4 AI" and advertises over Bluetooth as `XMD-TornadoV4-i` [verified, csTimer source].
- GAN 14 ui FreePlay is still supported in libraries, but neither store lists it today. I saw no GAN 15 ui [verified absence in both smart-cube collections].
- I didn't price Giiker or Rubik's Connected. They are older toy-grade lines, and GoCube, Rubik's Connected and Giiker "can't report their state" at connect (CubeDesk docs) [verified].

**Smart premium over the non-smart twin** [verified prices, SCS]:
- GAN 16 ui Max vs GAN 16 Max ($84.95): **+$41 on sale, +$55 at list**.
- WeiLong V11 AI vs WeiLong V11 MagLev 20-magnet UV ($49.95): **+$65**.
- Super AoLong AI vs Super AoLong UV ($79.95): **+$55**.
- Tornado V4 AI vs V4 Pioneer ($49.95): **+$10 to +$30**.
- GAN i4 has no non-smart twin. It is +$20 over a GAN 15 ($49.95) and −$15 vs a GAN 16 Max.

## 2. Turning quality vs non-smart flagships

- **Weight is the measurable cost.** The smart cubes weigh 70–76.5 g: i4 74 g, 16 ui Max 71 g, Tornado V4 AI 76.5 g. Current non-smart flagships weigh 60–67 g: WeiLong V11 versions 60–67 g per the SCS table, GAN 16 Max ~64 g per retailer reviews [verified listings]. So the penalty is +7 to +14 g.
- **acubemy's GAN i4 review** (2026-06-30, rev. 07-27; GAN supplied the unit, and acubemy sells smart-cube software) [verified source]:
  - Turns "close to a flagship feel", but "against GAN's own 12 UI, the flagship is still the better cube, no question about it."
  - Corner cutting ~45° forward and ~35° reverse. Under 5 corner twists per 1,000 solves. No pops.
  - Magnet strength is **fixed**. The plastic creaks under force.
  - The GanPod charges through pogo pins and is picky: laptop USB ports failed for them.
- **Vendor claims, unverified:**
  - GAN 16 ui Max: 124 magnets, 72 tuning positions, "90-degree full corner-cutting".
  - V11 AI: 88 magnets and gyro. Its non-smart V11 broke the 3x3 average WR, but that is the non-AI cube.
  - Tornado V4 AI: a smart core 13% smaller, "to preserve" V4 performance.
- **I found no independent head-to-head of smart vs non-smart feel** from a respected reviewer for the 2026 models. My search tool couldn't reach Reddit or SpeedSolving threads. Community consensus that "the smart versions feel a notch below their non-smart twins" is [unverified].
- **Does an 18 s solver give anything up?** A 7–14 g heavier cube with fixed magnets (i4) is a small handicap next to what the data buys. At sub-12 it might matter more [judgement]. The bigger risk is **feel mismatch**: practicing on one cube and competing on another. That argues for a comp cube that feels close to the practice cube, or for buying a smart cube whose non-smart twin exists (GAN 16 ui Max ↔ GAN 16 Max).

## 3. Data quality

**Hardware timestamps exist on every modern protocol** [verified from driver source]:
- GAN Gen2: a 16-bit cube timestamp that overflows.
- GAN Gen3/Gen4: a `cubeTimestamp` on each MOVE event. Recovered moves have no local timestamp and must be interpolated (`gan-cube-protocol.ts`).
- QiYi: a 32-bit timestamp in every state packet. The protocol doc says to divide by 1.6 to get ms.
- MoYu32 (V10/V11 AI): each move packet carries the last 5 moves with 16-bit ms deltas.

**Measured on real GAN cubes** by the open-source project cubetrace (`docs/DEVICES.md`, 1,802 moves, Chrome 153 on macOS and Chrome on Android) [verified]:
- The GAN 12 ui FreePlay's clock runs **0.7% slow** while it is being turned. The GAN 356 i3's runs **0.1% slow**.
- Host-arrival jitter is **p95 13–23 ms**.
- One Gen2 packet can carry up to 7 moves.
- The cube clock **restarts on reconnect**.
- So he should fit cube time to host time **per attempt**, not per session. One fit over a 14-minute session had ±600 ms errors at its ends.
- Implication: recognition times (0.3–1.5 s) and pauses are measurable to about 1 ms with a per-attempt fit, or about ±20 ms using arrival time alone. Both are fine for training.

**Missed moves and recovery.** Every protocol has a recovery path, which shows that BLE drops happen [verified, source]:
- GAN Gen3/4 track a 0–255 serial number and auto-request move history when they see a gap.
- QiYi sends the **full cube state plus a timestamped history of previous moves in every packet**, which makes it self-healing.
- MoYu32 replays from its 5-move history.

**Known failure modes** [verified]:
- GAN Gen3 (i Carry 2) and Gen4 have firmware bugs near the 255 serial wrap. Moves "beyond the edge will be spoofed with 'D'" (gan-web-bluetooth source comments).
- **A GAN i4 "can lose the second report of a slice turn"**, because M is reported as two face turns. A fork fixed this on 2026-10-03 by requesting history right away (mjohnson139/gan-web-bluetooth PR #4).
- QiYi skips the solved-state packet when a solve ends during fast slice moves, such as an H-perm (QiYi protocol doc).
- A wrong MAC leaves the cube "connected" but silent or garbled (csTimer issues #480, #518; F2LTrainer #53).
- Turning the cube while it is disconnected, or a popped piece, desyncs the stored state. GAN and QiYi can be re-synced; MoYu "can't be reset this way" (CubeDesk docs).

**Accuracy at 10+ TPS:**
- acubemy reports **zero dropped moves over weeks, including bursts above 15 TPS** on the i4 [verified source; not independent].
- GAN 12 ui SP marketing cites "6 core angle sensors" to prevent "lost steps". The i4 and i Carry 4 claim "zero-loss" induction sensing [unverified claims].
- A QiYi AliExpress page claims "99.2% vs 87%" accuracy [unverified, no method].

**Gyro.** Updates are slow and drift:
- GAN i4: about **10 Hz**, and "the gyro drifts, and that drift accumulates", so it needs a reset between solves (acubemy).
- GAN 12 ui: median **11 Hz** (89 ms), bursts at ~17 Hz, gaps up to 165 ms (cubetrace) [verified].
- That is good enough to detect pickup, x/y/z rotations and the solving frame, but too coarse for fine regrip analysis.

**What the stream actually is:**
- Outer-face quarter turns in the cube's own centre frame.
- A double turn is two events. M is an R/L′ pair. A wide move is a face turn plus a rotation.
- Rotations are visible only through the gyro.
- Phase detection should work from **cube state** (as csTimer does), not from move-pattern matching. That approach is robust to all of the above.

**Connect time on macOS:** 5–10 s, cut to 1–2.5 s by keeping an active scan running during `gatt.connect()` (CubeDesk PR #256) [verified].

## 4. Protocols and libraries

| Protocol / cube | Crypto & MAC | Gyro | Notes |
|---|---|---|---|
| GAN Gen2 (12 ui FreePlay, i Carry, i3, Mini ui, MoYu AI 2023) | AES salted with the cube's MAC | yes | 16-bit timestamp |
| GAN Gen3 (i Carry 2; i Carry 4 per Twysty) | AES + MAC salt; message windows encrypted separately | no | firmware bug at serial 255 |
| GAN Gen4 (12 ui MagLev, 14 ui FreePlay, **16 ui** [two repos confirm the Gen4 service], i4 [one fork PR]) | AES + MAC salt | yes | history requests; one issue claimed Gen2 for i4/16 ui, but libraries pick the driver by service UUID, so it doesn't matter |
| MoYu32 `WCU_MY3*` (WeiLong V10 AI, **V11 AI**) | AES (GAN scheme, different key); MAC **guessable from name** (`CF:30:16:xx:xx:xx`) | yes (opcode 171) | V11 stays silent until requests are sent twice (CubeDesk PR #256); Super WeiLong V2 AI unsupported in csTimer (#488, 2025) |
| QiYi (`QY-QYSC`, `XMD-TornadoV4-i`) | AES-128-ECB with a **fixed public key**; MAC (`CC:A3:00:00:xx:xx`, guessable from name) only goes in the hello | Tornado V4 AI only (0xCC packets) | full state + history in every packet; ACK required |
| Giiker, GoCube / Rubik's Connected | unencrypted | GoCube yes | can't report state at connect |

All rows [verified] from the csTimer, poliva and cubing.js sources, the QiYi protocol doc on Codeberg, and the CubeDesk docs.

**Libraries:**

| Library | Covers | License | Status | TS |
|---|---|---|---|---|
| **poliva/smartcube-web-bluetooth** | GAN Gen1–4, Giiker, GoCube/Rubik's, MoYu (AI 2023, MHC, WCU_MY3), QiYi + Tornado V4 incl. gyro; generic `connectSmartCube()`; name-based MAC probing for MoYu/QiYi; replay tests | MIT | last commit 2026-05-04; **GitHub-only, not on npm**; powers Cubedex. One user (F2LTrainer #53, 2026-06) reported it working with GAN 16 ui Max, 12 ui MagLev, i4 MagLev UV, a QiYi and a V10 AI | yes |
| afedotov/gan-web-bluetooth | GAN Gen2/3/4 + GAN timers; RxJS; `cubeTimestampLinearFit()` | MIT | npm 3.0.2, **dormant since 2024-08-22**, 352 downloads/week, 5 open issues | yes |
| cubing.js `bluetooth` | GAN **Gen1 only** (polls service `fff0` every 150 ms), Giiker, GoCube, Heykube, QiYi (`QY-QYSC` only, no Tornado) | MPL-2.0 OR GPL-3.0+ | active (bluetooth commit 2026-10-09) | yes |
| csTimer `src/js/hardware` | GAN v1–v4 + 251 2x2, Giiker, GoCube, MoYu MHC, MoYu32, QiYi + Tornado V4 (gyro ignored) | **GPL-3.0** | active (2026-09-07) | no (JS) |
| CubeDesk | GAN incl. i Carry 4/i4/16 ui Max, WeiLong V10/V11 AI, QiYi AI, Tornado V4 AI, GoCube, Giiker | **GPL-3.0** | active (2026-10-12) | yes |

All rows [verified] from the repos, the GitHub API and npm.

**Best-supported open protocol for his app:**
- **GAN Gen4** has the most independent implementations (four codebases plus several new 2026 trainers). It also has measured timing data, gyro and history recovery.
- **QiYi** is the simplest and most robust to decode: fixed key, full state in every packet, no flags needed. But it has no gyro except on the Tornado V4 AI.
- **Use poliva's MIT library pinned to a commit.** Read csTimer and CubeDesk for behavior only; copying their code would bring GPL obligations.

## 5. Web Bluetooth availability

| Browser | Status |
|---|---|
| Chrome / Edge, macOS & Windows | Ships with no flag (Chrome 56+ / Edge 79+) [verified, MDN BCD + WebBluetoothCG status] |
| **Brave desktop** | **Off by default.** Turn on `brave://flags/#brave-web-bluetooth-api` and relaunch. In brave-core the feature is `FEATURE_DISABLED_BY_DEFAULT`; without it you get "Web Bluetooth API globally disabled" [verified, brave-core source + brave-browser #34941] |
| Brave Android | "Not available on the current platform" (user report, 2025-05) [verified comment] |
| Chrome Android | Supported [verified] |
| Safari macOS/iOS, Chrome iOS, Firefox | Not supported; no plans [verified] |
| iPhone/iPad | **Bluefy** (free) or WebBLE apps, or the iOSWebBLE Safari extension; Bluefy needs "Enable BLE Advertisements" for MAC auto-read [verified, status doc + afedotov FAQ]; acubemy and CubeDesk both recommend Bluefy |
| Linux Chrome | Behind `#enable-experimental-web-platform-features` [verified] |

**Gotchas:**
- `watchAdvertisements()` is marked "No longer pursuing" on chromestatus (updated 2025-08). `getDevices()` is still "In developer trial (Behind a flag)" [verified].
- So in stock Chrome, a GAN cube's MAC can't be read automatically, and the cube can't reconnect silently after a reload. The fixes, any one of which works:
  - Enable `chrome://flags/#enable-web-bluetooth-new-permissions-backend`. CubeDesk and cubetrace docs say this enables both MAC reading and reconnect.
  - Enable `#enable-experimental-web-platform-features` (afedotov's FAQ).
  - Type the MAC once and cache it. On macOS, get it with `system_profiler SPBluetoothDataType`; the address in `chrome://bluetooth-internals` is spoofed on macOS [verified FAQ].
- MoYu32 and QiYi MACs can usually be **guessed from the advertised name**, so those need no flags [verified source].

**Practical devices for Nathan:** Mac with Chrome (works as is), or Mac with Brave after one flag flip. An Android phone with Chrome. An iPhone only through Bluefy. The site must be HTTPS, which Cloudflare already gives him, and Web Bluetooth isn't available in Workers [verified, MDN].

## 6. What a smart cube unlocks, feature by feature

| Feature | With a smart cube | Best non-smart fallback | How much worse |
|---|---|---|---|
| Per-phase splits (cross, F2L 1–4, OLL, PLL) | Automatic on every solve, from cube state; csTimer already does `cf4op` with per-step recognition / execution / turns [verified source] | Keypress or footswitch at each phase; or film and step through frames | Keypresses break the solve and can't split F2L pairs. Video costs minutes per solve [unverified estimate], so in practice you get a few solves a week instead of every solve |
| Pause / lookahead detection | Gaps between move timestamps (±1–20 ms) | Frame-stepping video | Not feasible at volume |
| TPS (overall and per phase) | Exact | Type the solution; count moves ÷ time | Manual, overall only |
| Recognition time (case shown → first turn) and execution per alg | First-turn timestamp is ground truth; execution = first to last move | Keypress at "recognized" and at "done" | Keypresses add ~150–250 ms of motor latency and change behavior [unverified]; you only get recog+exec combined reliably |
| Did he do the alg right / which variant | Compare the move stream and resulting state | Self-report | No verification |
| Which case occurred in a real solve | State at OLL/PLL start → case ID (csTimer `identOLL`/`identPLL`) [verified] | None short of video | Effectively unavailable |
| Full reconstruction + replay | Moves + timestamps (+ gyro rotations) | Type it from memory or from video | Hours per session |
| xcross trainer that checks his solution | Validates the executed solution solves the xcross; times planning vs execution | Type the planned solution, check visually | Workable but slow; no timing split |
| Scramble verification | Live progress with error correction (CubeDesk, csTimer, cubef) | Careful scrambling | Occasional mis-scrambles go unnoticed |

**Ranked by value for an 18 s solver aiming at sub-15** [judgement]: F2L pair splits and pause maps first (F2L is most of an 18 s CFOP solve), then OLL/PLL recognition time per case, then verified alg drills. Plain keyboard timing already covers ao5/ao12 trends.

## 7. Existing apps, and whether his own build still pays

- **csTimer** (free, GPL): supports GAN/MoYu/QiYi/Giiker/GoCube. Reconstructs solves by method with per-step recognition / execution / turns / TPS, and identifies OLL and PLL cases [verified source].
- **Cubeast** (web app): recognition and execution per phase, inspection / pickup / put-down, PLL recognition average, XCross frequency, an "Academy" of drills. It says "all existing 3x3 Bluetooth cube models are supported" [verified page]. Pricing [unverified, not found].
- **acubemy**: web plus native iOS and Android, and supports the 2026 GAN/MoYu/QiYi models. F2L/OLL/PLL/CMLL stats and alg drilling. Premium costs €4.99/mo or €49.99/yr [verified FAQ].
- **CubeDesk** (open source, GPL): smart-cube timer and scramble check [verified].
- **Cubedex** (MIT): smart-cube alg trainer [verified].
- **Verdict:** buying a smart cube does **not** make his own build redundant. It makes it **cheap**, because the Bluetooth layer comes off the shelf. Build only what the existing apps lack or do badly:
  - pair-level F2L analytics and pause heatmaps
  - his own spaced-repetition drill scheduler
  - recognition-time training for his own weak cases
  - owning and exporting the data
- Prototype against csTimer's numbers for the first week to check that his own splits come out right.

## 8. WCA legality

- WCA Regulations (version April 1, 2026), **Regulation 3a4**: "Puzzles must not have electronic components (e.g. Bluetooth or Wi-Fi capabilities, motors, sensors, lights)" [verified].
- So no smart cube in competition. For practice it is irrelevant. The only consequence is that his comp cube must be a separate non-smart cube.

## 9. Camera-based alternatives

Not good enough.

- The best open attempt I found uses a 3D-CNN (r3d_18) on webcam clips. It reports **~95% per isolated clip**, with quarter turns and rotations only, and the clips are segmented by a spacebar tap (SohamJ2005/rubiks-cube-move-recognition) [verified README].
- 0.95^55 ≈ 6% chance of getting a whole 55-move solve right [arithmetic]. Continuous fast solving with fingers covering stickers is harder still.
- Vision is useful only for hands-on/hands-off timer start-stop (nntimer) or as video synced *alongside* a smart cube (cubetrace) [verified READMEs].

## 10. Payoff verdict with numbers and the purchase

**Cost.** He is buying a cube anyway, so the real cost is the extra over the cube he would otherwise buy:
- **$0–$20** for a GAN i4 instead of a GAN 15 or Tornado V4 Pioneer; it is $15 *cheaper* than a GAN 16 Max.
- **$41–$55** for the GAN 16 ui Max over a GAN 16 Max.
- **$65** for the WeiLong V11 AI over the V11.
- Plus about 1 day to integrate the library and 1–2 browser flags.

**Benefit.** Every solve becomes a labeled dataset: phase splits, pair-level times, recognition times per case, pauses, TPS, case IDs. Collecting that by hand would take minutes per solve.

**Primary pick: GAN i4 MagLev UV, $69.95 (SCS) / $69.99 (TC).** Use it as the **main practice cube**.
- Gyro, so rotations and pickup are visible.
- GAN Gen4 protocol, the best-covered one, with hardware timestamps.
- 30 h battery with quick charge; a reviewer saw zero drops above 15 TPS.
- Accept fixed magnets, +10 g, and a fussy charger. Keep his current cube as the comp cube.

**Step-up option:** if he wants flagship feel *in* the smart cube, the **GAN 16 ui Max ($125.96 SCS sale / $139.99 TC)**. Its non-smart twin (GAN 16 Max, $84.95) makes a feel-matched comp cube later.

**Budget pick: QiYi AI UV, $26.95 (SCS) / $26.99 (TC).**
- The easiest protocol to decode: no flags, full state in every packet, ~800 h battery.
- No gyro and a budget mechanism, so it is a data cube, not a main cube.
- Over the GAN i Carry 4 ($34.95), it wins on protocol: the i Carry 4 has no gyro, and one developer has an unresolved Web Bluetooth service-discovery failure with it on Windows (SparshSriva repo, 2026-10-15) [verified].

**Main cube or flagship plus smart cube?** A smart cube as the main practice cube, plus the non-smart cube he already owns for comps. Buying a flagship *and* a smart cube now only makes sense if he will compete soon and wants the newest non-smart feel.

## Sources

- SpeedCubeShop, Smart Cubes collection JSON — https://speedcubeshop.com/collections/smart-cubes/products.json (plus product .js/.json pages per handle)
- TheCubicle, Smart Cubes collection JSON — https://www.thecubicle.com/collections/smart-cubes/products.json
- acubemy, "GAN i4 Review: How Good Is GAN's Mid-Range Gyro Smart Cube?" — https://acubemy.com/blog/gan-i4-review
- acubemy FAQ — https://acubemy.com/faq
- Cubeast home page — https://www.cubeast.com/
- Twysty support — https://twysty.vercel.app/support
- afedotov/gan-web-bluetooth (README, src, LICENSE) — https://github.com/afedotov/gan-web-bluetooth ; npm registry — https://registry.npmjs.org/gan-web-bluetooth
- afedotov, GAN MAC address FAQ (gist) — https://gist.github.com/afedotov/52057533a8b27a0277598160c384ae71
- poliva/smartcube-web-bluetooth — https://github.com/poliva/smartcube-web-bluetooth ; Cubedex — https://github.com/poliva/cubedex
- cubing.js bluetooth sources — https://github.com/cubing/cubing.js/tree/main/src/cubing/bluetooth/smart-puzzle
- csTimer hardware drivers and recons — https://github.com/cs0x7f/cstimer/tree/master/src/js/hardware ; issues #480, #488, #504, #518, #553, #554
- CubeDesk (Bluetooth troubleshooting, supported devices PR #259, MoYu PR #256) — https://github.com/kash/cubedesk
- cubetrace, docs/DEVICES.md and issue #22 — https://github.com/shermam/cubetrace
- mjohnson139/gan-web-bluetooth PR #4 — https://github.com/mjohnson139/gan-web-bluetooth/pull/4
- Dave2ooo/F2LTrainer issue #53 — https://github.com/Dave2ooo/F2LTrainer/issues/53
- bytemain/cfop-trainer device-compatibility.md — https://github.com/bytemain/cfop-trainer
- AshleyF/briefcubing PR #20 — https://github.com/AshleyF/briefcubing/pull/20
- SparshSriva/gan-i-carry-4-trainer, docs/ICARRY4_BLE_RESEARCH.md — https://github.com/SparshSriva/gan-i-carry-4-trainer
- NexusTimer issue #577 — https://github.com/bryanlundberg/NexusTimer/issues/577
- Flying-Toast, QiYi Smart Cube protocol — https://codeberg.org/Flying-Toast/qiyi_smartcube_protocol
- MDN browser-compat-data, api/Bluetooth.json — https://github.com/mdn/browser-compat-data ; MDN Web Bluetooth API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- WebBluetoothCG implementation status — https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md
- chromestatus API (watchAdvertisements, getDevices) — https://chromestatus.com/features/5180688812736512 , https://chromestatus.com/features/4797798639730688
- brave-core `browser/about_flags.cc` and `chromium_src/third_party/blink/common/features.cc` — https://github.com/brave/brave-core ; brave-browser issue #34941 — https://github.com/brave/brave-browser/issues/34941
- WCA Regulations (version April 1, 2026) — https://www.worldcubeassociation.org/regulations/
- SohamJ2005/rubiks-cube-move-recognition — https://github.com/SohamJ2005/rubiks-cube-move-recognition ; qtzx06/nntimer — https://github.com/qtzx06/nntimer
- SpeedCubeShop blog, "Which Bluetooth Speed Cube is Best?" (2024-09-27) — https://speedcubeshop.com/a/blog/which-bluetooth-speed-cube-is-best

## For a human (rulings)

1. **Budget tier:** GAN i4 MagLev UV ($70, the recommendation), GAN 16 ui Max ($126–140, flagship feel), or QiYi AI ($27, a data-only cube alongside a non-smart main)?
2. **Smart cube as your main practice cube?** The recommendation is yes, with your current cube kept for competitions. The alternative is a non-smart flagship as the main cube and the smart cube only for drills, which means less data but practice and comp feel stay identical.
3. **Browser:** are you willing to turn on `brave://flags/#brave-web-bluetooth-api` in Brave? Or will you train in Google Chrome?
4. **GAN MAC handling:** are you OK with turning on one Chrome flag (`#enable-web-bluetooth-new-permissions-backend`) for auto-connect, or would you rather type the cube's MAC once (from `system_profiler SPBluetoothDataType`) and have the app remember it?
5. **Phone:** which phone do you have? On iPhone, phone training means the Bluefy browser. If that's not acceptable, the trainer is Mac-only (or Android-only).
6. **Library license:** use the MIT-licensed poliva/smartcube-web-bluetooth, pinned to a commit and vendored? Or are you fine with GPL code (csTimer/CubeDesk), which would make your whole trainer GPL?
7. **Build vs use:** which features does your trainer need that csTimer, Cubeast and acubemy don't already give you? Pair-level F2L splits, pause heatmaps, a spaced-repetition scheduler, or owning the data? That list sets the scope.
