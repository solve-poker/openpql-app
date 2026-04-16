# Deploying openpql-playground to Cloudflare Pages

The UI is a static Vite SPA that runs PQL entirely in-browser via a Web Worker + WebAssembly. The Rust `daemon/` is for local development only and is **not** deployed.

## Prerequisites

- A Cloudflare account.
- `wrangler` CLI installed globally:
  ```sh
  bun add -g wrangler   # or: npm i -g wrangler
  wrangler login
  ```

## Build

From the project root:

```sh
just build-wasm   # builds wasm into ui/src/wasm-pkg/ (defined by Agent 5)
just build-ui     # vite build → ui/dist/
```

The Vite `base` is the default `"/"`, so the app is deployed at the project root. If you ever deploy under a subpath, set `base` in `ui/vite.config.ts` accordingly.

## First-time project setup

```sh
wrangler pages project create openpql-playground --production-branch main
```

## Deploy

Preview:

```sh
wrangler pages deploy ui/dist --project-name openpql-playground --branch preview
```

Production:

```sh
wrangler pages deploy ui/dist --project-name openpql-playground --branch main
```

`wrangler.toml` at the repo root declares `pages_build_output_dir = "ui/dist"` so `wrangler pages deploy` picks up the right directory.

## Static asset behavior

- `ui/public/_headers` sets `Content-Type: application/wasm` for `.wasm` files, long-term immutable caching for hashed assets, and basic security headers (`X-Content-Type-Options`, `Referrer-Policy`).
- `ui/public/_redirects` contains the SPA fallback (`/*  /index.html  200`).
- COOP/COEP are intentionally **not** set — the runner is single-threaded wasm and does not need SharedArrayBuffer; enabling them would break third-party resources.

## CI: GitHub Actions

```yaml
- uses: actions/checkout@v4
- uses: oven-sh/setup-bun@v1
- run: just build-wasm && just build-ui
- uses: cloudflare/pages-action@v1
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    projectName: openpql-playground
    directory: ui/dist
    branch: ${{ github.ref_name }}
```
