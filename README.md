# cube.nathanwei.org

Nathan Wei's Rubik's cube trainers. A Vite + React single-page app (TypeScript) served as static assets by a
Cloudflare Worker. cubing.js draws and animates the cube; `src/cube/` is our own engine (cubie model, cross and
pair solvers, last-layer case data, solve analysis). Background research lives in [docs/research/](docs/research/);
design mockups are generated locally into `concepts/` (gitignored) with `uv run tools/concepts.py round-N`.

## Everyday

```sh
pnpm install
pnpm dev                     # http://localhost:5173
pnpm build && pnpm preview   # the real static site on Cloudflare's local runtime, http://localhost:8788
```

## Checks

```sh
pnpm typecheck && pnpm lint && pnpm test
```

## Deploy

Pushing to `main` deploys through Cloudflare Workers Builds (Worker `cube-trainer`, trigger "Deploy main":
`pnpm build`, then `npx wrangler deploy`), which serves the custom domain `cube.nathanwei.org`. Builds reuse the
"nathanwei-site build token", which wraps the user API token kept in `~/nathanwei-site/.env` as
`CLOUDFLARE_API_TOKEN`: rolling that token breaks builds for both sites. Manual deploy: `pnpm run deploy` (needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment).
