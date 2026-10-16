# cube.nathanwei.org

Nathan Wei's Rubik's cube trainers. A Vite + React single-page app (TypeScript) served as static assets by a
Cloudflare Worker. `src/app/cube3d/` draws and animates the cube (three.js; looks in `looks.ts`), cubing.js makes
scrambles; `src/cube/` is our own engine (cubie model, cross and pair solvers, last-layer case data, solve analysis). Background research lives in [docs/research/](docs/research/);
design mockups are generated locally into `concepts/` (gitignored) with `uv run tools/concepts.py round-N`.

## Everyday

```sh
pnpm install
pnpm dev       # SPA + Worker + local D1, http://localhost:5173 (Google sign-in only works on this port)
pnpm test:layout  # build, then check no page has overlapping text or a cube covering anything (docs/UI.md)
pnpm preview   # builds, then serves the production build (Worker and local D1 included), http://localhost:8788
```

## Checks

```sh
pnpm typecheck && pnpm lint && pnpm test
```

## Deploy

Pushing to `main` deploys through Cloudflare Workers Builds (Worker `cube-trainer`, trigger "Deploy main":
`pnpm build`, then `npx wrangler deploy`), which serves the custom domain `cube.nathanwei.org`. `pnpm build` (via
`@cloudflare/vite-plugin`) writes the SPA to `dist/client` and the Worker (`worker/index.ts`, every `/api/*` route)
to `dist/cube_trainer`, and leaves `.wrangler/deploy/config.json` pointing `wrangler deploy` at the generated config.
Builds reuse the "nathanwei-site build token", which wraps the user API token kept in `~/nathanwei-site/.env` as
`CLOUDFLARE_API_TOKEN`: rolling that token breaks builds for both sites. Manual deploy: `pnpm run deploy` (needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, as do the commands below).

### Accounts and solves

Sign-in is Google OAuth (authorization code + PKCE); solves live in the D1 database `cube-trainer` (binding `DB`, id
`edd89e77-6dc5-4820-8232-bf6b8adddc58`, schema in `migrations/`). The Google OAuth client has both redirect URIs,
`https://cube.nathanwei.org/api/auth/callback/google` and `http://localhost:5173/api/auth/callback/google`.

- Production reads `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Worker secrets (both set). `wrangler.jsonc`
  lists them under `secrets.required`, so a deploy fails if either is ever removed. Change one with
  `pnpm exec wrangler secret put GOOGLE_CLIENT_ID`.
- Locally they come from `.dev.vars` (gitignored; copy `.dev.vars.example` or run `scripts/setup-accounts.sh`).
  `pnpm dev` first applies pending migrations to the local database in `.wrangler/state`; `pnpm db:migrate:local`
  does only that. Without the Google values, `/api/auth/login` answers 503.
- Solve limits: a solve body is at most 32 KB (an analysed solve is about 4 KB); an account holds at most 20,000
  solves or 40 MB of them, whichever comes first (`src/shared/schema.ts`; the API answers 507 "account full").
  `GET /api/solves` pages newest first, 500 at a time.
- Learn data (`src/shared/learn.ts`, `worker/learn.ts`): one settings document per account, saved last-writer-wins
  by its `updatedAt`, and an append-only log of drill reps. A rep is at most 8 KB, a POST carries at most 200, and an
  account holds at most 100,000 reps or 40 MB of them. `GET /api/learn/reps` pages newest first, 1,000 at a time.
- A full account (solves plus reps) is 80 MB, so about six would fill D1's 500 MB free-plan database.
- After changing bindings in `wrangler.jsonc`, run `pnpm cf-typegen` and commit `worker/worker-configuration.d.ts`.

Schema changes: add `migrations/000N_name.sql` and run `pnpm exec wrangler d1 migrations apply DB --remote`
before pushing the code that needs it (`pnpm exec wrangler d1 migrations list DB --remote` shows what is pending).
