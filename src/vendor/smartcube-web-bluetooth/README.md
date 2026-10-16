# smartcube-web-bluetooth (vendored, GAN subset)

- Source: https://github.com/poliva/smartcube-web-bluetooth (MIT, see `LICENSE.txt`; GitHub-only, not on npm)
- Pinned commit: `44f1f091c6e980d9cc31e6d2863c4437eca3ab3c` (2026-05-04, "initialize gyro to false for AiCube*")
- Fetched 2026-10-15 with `gh api repos/poliva/smartcube-web-bluetooth/tarball/<commit>`.
- Used through `src/app/smartcube/connection.ts` only; nothing else in the app imports this folder.

## What is here

The generic connect flow (`smartcube/connect.ts`, `smartcube/attachment/*`, the protocol registry) and the GAN
gen2/gen3/gen4 driver (`gan-cube-protocol.ts`, `smartcube/protocols/gan.ts` and its helpers). That covers the GAN 16
ui Max, 12 ui (MagLev, FreePlay), 14 ui, i4, i Carry 2/S and the MoYu AI 2023. Two upstream capture fixtures are kept
in `captures/` for the replay tests (`*.test.ts` here are ours, not upstream's).

Left out: GAN gen1 (356i; needs lz-string) and the GAN smart timers, the Giiker, GoCube, MoYu (MHC, WCU_MY3) and
QiYi drivers, the legacy `connectGanCube` API, upstream's tests, `cubeTimestampLinearFit` (the app fits the cube clock
in `src/cube/normalize.ts`). To support another brand, copy its `smartcube/protocols/<brand>.ts` (and the attachment
helpers it imports) from the same commit, apply the changes below, and import it in `smartcube/index.ts`.

## Changes from upstream

Every file starts with a comment naming its upstream path and what changed. In short:

1. `rxjs` is replaced by `rx.ts` (Subject / Observable / Subscription, same delivery rules) and `aes-js` by `aes.ts`
   (AES-128 block + one-chunk CBC, checked against the FIPS-197 and SP 800-38A vectors), so the app gains no
   dependencies.
2. Strict-TypeScript and lint fixes (`noUncheckedIndexedAccess` assertions, `var` → `let`/`const`, case-block braces).
   No behaviour change.
3. `connectSmartCube` takes an optional `device` to reuse a chosen device without the chooser (reconnect, or retry
   with a corrected MAC), and throws a clear error when `navigator.bluetooth` is missing.
4. A GAN gen1 cube is refused with an error instead of driven.

Web Bluetooth types come from `src/vendor/web-bluetooth/index.d.ts` (@types/web-bluetooth 0.0.21, MIT).
