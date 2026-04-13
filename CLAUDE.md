# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev
pnpm dev:e2e
pnpm build
pnpm start
pnpm lint
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:ui
```

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI, Axios, Playwright, and Vercel Analytics.

State is managed in feature hooks plus local component state. There is no active global store in the current implementation.

## App Shell And Routing

- `/` redirects to `/${defaultTab}` where `defaultTab` is `vscode`.
- `src/app/[tab]/page.tsx` validates the tab against `src/features/registry.ts` and renders `src/app/[tab]/tab-page.tsx`.
- `tab-page.tsx` dynamically imports the feature component for each tab with `ssr: false`.
- All tab panels stay mounted and are only hidden, so in-memory state survives tab switches.
- The active tab lives in the path (`/{tab}`); successful parses sync the current input into `?q=` for shareable links.

## Feature Structure

Feature modules live under `src/features/{vscode,chrome,docker,msstore}/` and generally use:

- `api/` for service helpers that call local Next.js API routes
- `hooks/` for state and async orchestration
- `components/` for UI
- `types.ts` for feature types

Additional feature-specific files:

- `src/features/docker/utils/tarBuilder.ts` builds browser-side TAR archives for `docker load`
- `src/features/msstore/download.ts` rewrites HTTP package links through the local proxy route
- `src/features/registry.ts` is the source of truth for tab ids, labels, and dynamic imports

## Shared Behavior

- Shared UI primitives live in `src/shared/ui/`.
- Shared metadata and outbound headers live in `src/shared/lib/site.ts`.
- Shared request helpers live in `src/shared/lib/http.ts`.
- Recent input history is stored in `localStorage` under:
  - `history:vscode`
  - `history:chrome`
  - `history:docker`
  - `history:msstore`
- Toast feedback is handled by `src/hooks/useToast.ts` with a single visible toast at a time.

## Feature Flows

### VSCode

- Parse a Marketplace URL by reading `itemName`.
- Split `publisher.extension` on the last `.` so dotted publishers still work.
- Query versions through `POST /api/vscode/query`.
- Build the final `.vsix` URL directly against Marketplace; the actual package download is not proxied.

### Chrome

- Input accepts a search term, extension id, or Web Store URL.
- Search is debounced by 400ms and uses `GET /api/chrome/search`.
- Details are loaded through `GET /api/chrome/detail`.
- Downloads go through `GET /api/chrome/download`.
- CRX-to-ZIP conversion happens in the browser and supports CRX2/CRX3 parsing plus ZIP magic fallback.
- Blob URLs are revoked on re-download and unmount.
- Active downloads can be cancelled with `AbortController`.

### Docker

- Accepts shorthand image refs and Docker Hub URLs.
- Fetch tags through `GET /api/docker/tags`.
- If a repository is missing, fetch candidate repositories through `GET /api/docker/search`.
- Prefetch the manifest through `GET /api/docker/auth` + `GET /api/docker/manifest` after tag resolution.
- `GET /api/docker/manifest` resolves manifest lists / OCI indexes to `linux/amd64`.
- Download each layer through `GET /api/docker/layer`, refreshing the auth token per layer.
- In the browser, layer blobs are decompressed by magic bytes, hashed to generate `diff_ids`, and packed into a `docker load` compatible TAR.
- zstd-compressed layers currently throw an explicit unsupported error.

### MSStore

- Accepts Microsoft Store URLs, `ProductId`, `PackageFamilyName`, and `CategoryId`.
- Resolution goes through `GET /api/msstore/resolve`.
- The client defaults to `market=US` and `language=en-us` because the global catalog has the best coverage.
- The resolve route combines display catalog metadata with file links from `store.rg-adguard.net`.
- HTTPS package links are used directly; HTTP links from approved Microsoft hosts are re-proxied through `GET /api/msstore/download`.
- File names are parsed and sorted so the UI can present a searchable package picker.

## API Proxy Pattern

Local API routes under `src/app/api/` handle all upstream communication that needs CORS workarounds, auth headers, or binary streaming:

- VSCode Marketplace query
- Chrome search/detail/download
- Docker Hub search/tags/auth/manifest/layer
- Microsoft Store resolve/download

The browser never calls Docker Hub, Chrome update service, or the Microsoft Store resolver service directly.

## Testing

- Playwright tests live in `tests/e2e/`.
- `playwright.config.ts` starts a production-style server with `pnpm build && pnpm start --hostname 127.0.0.1 --port 3100`.
- Tests mock same-origin `/api/*` routes rather than hitting third-party networks.
- Coverage includes all four download flows, VSCode history persistence, Docker invalid-layer tolerance, and MSStore HTTP proxy fallback.
