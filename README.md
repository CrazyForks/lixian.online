# Lixian.Online

Helps developers obtain offline installation resources for VSCode extensions, Chrome extensions, Docker images, and Microsoft Store apps when direct access to upstream services is unreliable.

**Live demo:** [lixian.online](https://lixian.online)

**Docs:** [English](./README.md) | [中文文档](./README.zh.md)

![lixian.online](.github/assets/homepage.png)

## Features

| Feature | Accepted input | Result | Notes |
| --- | --- | --- | --- |
| VSCode Extensions | Marketplace URL with `itemName=` | Direct `.vsix` link | Versions are queried through `/api/vscode/query`; the final file is downloaded from Marketplace directly |
| Chrome Extensions | Extension name, 32-char ID, or Web Store URL | `.crx` and/or `.zip` | Search/detail/download use same-origin APIs; `.zip` is converted from CRX in the browser |
| Docker Images | Image ref such as `nginx:latest`, `library/nginx`, or `hub.docker.com/r/library/nginx` | `docker load` compatible `.tar` | Auth, manifest, and layer fetches are proxied; layers are decompressed and repacked in the browser |
| Microsoft Store | Store URL, `ProductId`, `PackageFamilyName`, or `CategoryId` | Package download link | Resolution uses `/api/msstore/resolve`; HTTP file links are re-proxied through `/api/msstore/download` |

## Key Behaviors

- `/` redirects to `/vscode`, and each tool is directly addressable at `/{tab}`.
- After a successful parse, the current input is synced into `?q=` so links can reopen the same query.
- Tab panels stay mounted while switching tabs, so per-tab state survives within the current session.
- Recent inputs are stored in `localStorage` under `history:vscode`, `history:chrome`, `history:docker`, and `history:msstore`.
- The server only proxies upstream APIs or binary streams when CORS, auth, or HTTP-only download links require it.

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI, Axios, Playwright, and Vercel Analytics.

## Getting Started

```bash
pnpm install

# Development
pnpm dev

# Production build
pnpm build

# Production server
pnpm start

# Lint
pnpm lint

# E2E
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:ui
```

## Project Structure

```text
src/
├── app/
│   ├── [tab]/                  # Tab shell, route validation, query sync
│   ├── api/                    # Next.js proxy routes for upstream services
│   ├── layout.tsx              # Metadata, toaster, analytics
│   └── page.tsx                # Redirects / -> /vscode
├── features/
│   ├── registry.ts             # Tab registry + dynamic loader metadata
│   ├── vscode/
│   ├── chrome/
│   ├── docker/
│   └── msstore/
├── hooks/                      # Shared hooks (history, toast)
└── shared/                     # Shared UI components and utilities

tests/e2e/                      # Playwright browser tests
docs/                           # Spec + API request examples
```

Each feature module follows the same pattern:

- `api/`: service helpers that talk to the local API routes
- `hooks/`: state orchestration and async flow control
- `components/`: feature UI
- `types.ts`: feature-specific types

## Documentation

- [docs/spec.md](./docs/spec.md): implementation-aligned behavior and API contract
- [docs/api.http](./docs/api.http): REST Client examples for local manual testing

## E2E Testing

Playwright runs against a production-style server:

- `webServer.command` is `pnpm build && pnpm start --hostname 127.0.0.1 --port 3100`
- Tests mock same-origin `/api/*` routes instead of depending on third-party networks
- Coverage includes all four feature flows, Docker invalid-layer tolerance, VSCode history persistence, and MSStore HTTP download proxy fallback

## Acknowledgements

- Microsoft Store package resolution relies on the public service provided by [store.rg-adguard.net](https://store.rg-adguard.net/).

## License

MIT
