# cube.nathanwei.org

Nathan Wei's Rubik's cube trainers. Next.js (static export) on Cloudflare Workers, same setup as nathanwei.org.
Background research lives in [docs/research/](docs/research/).

## Everyday

```sh
pnpm install
pnpm dev                     # http://localhost:3000
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
