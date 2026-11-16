# car-detailing-inspect-ai-frontend

A mobile-first web app where customers upload photos of their car, grouped by part. An AI backend scores how much detailing the car needs, and the app shows an overall score, per-part results and recommended services.

- **Stack:** Next.js 16 (App Router, static export), React 19, TypeScript (strict), Tailwind CSS v4, Zod 4, Cloudflare Turnstile (`@marsidev/react-turnstile`)
- **Hosting:** Cloudflare Pages (static files only: no server runtime, API routes or Server Actions)
- **Backend:** a separate repo (a Cloudflare Worker). This repo only calls its HTTP API.

## Quick start

```bash
npm install
cp .env.example .env.local   # mock mode is on by default
npm run dev                  # http://localhost:3000
```

| Script                                    | What it does                                     |
| ----------------------------------------- | ------------------------------------------------ |
| `npm run dev`                             | Dev server                                       |
| `npm run build`                           | Static export to `out/`                          |
| `npm start`                               | Serve `out/` locally (`npx serve`)               |
| `npm run typecheck`                       | `tsc --noEmit`                                   |
| `npm run lint`                            | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm run format` / `npm run format:check` | Prettier (with Tailwind class sorting)           |
| `npm test`                                | Vitest unit tests                                |

## Environment variables

All are `NEXT_PUBLIC_*`, so they are **inlined at build time**. Changing them means rebuilding.

| Variable                         | Purpose                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | Base URL of the backend Worker, no trailing slash. The app POSTs to `${NEXT_PUBLIC_API_URL}/api/assess`.                                                    |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key. In development, use Cloudflare's test key `1x00000000000000000000AA`, which always passes (the backend needs the matching test secret). |
| `NEXT_PUBLIC_USE_MOCK`           | `true` skips the network and Turnstile, and returns realistic fake data after 2 seconds.                                                                    |

## Mock mode

With `NEXT_PUBLIC_USE_MOCK=true` you can build the whole UI without the backend:

- No Turnstile widget is shown, and no network requests are made.
- Photos are still validated and resized in the browser, so the real image pipeline runs.
- With two or more parts, the second part comes back with `photoQuality: "poor"`, so you can see the "clearer photo" notice.
- `recommendedServices` contains duplicates on purpose, to exercise the de-duplication.
- **Simulate errors** by adding a query param, for example `/?mockError=RATE_LIMITED`. This accepts any API error code (`INVALID_REQUEST`, `BOT_CHECK_FAILED`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `AI_FAILED`, `INTERNAL`), `NETWORK` (shows the retry button) or `INVALID` (a response that fails schema validation).

A "Mock mode" badge appears in the header so a mock build is never mistaken for production.

## API contract: keep in sync with the backend

`src/lib/schema.ts` holds the Zod schemas shared with the backend Worker. The contract block is copied verbatim and **must be identical in both repos**. If you change it in one repo, change it in the other in the same release.

- Request: `POST {NEXT_PUBLIC_API_URL}/api/assess`, with a JSON body matching `AssessRequestSchema`. Images are base64 JPEG **without** the `data:` prefix: at most 4 per part, 1 to 8 parts.
- Response: `AssessResponseSchema` on 200, otherwise `ErrorResponseSchema`.
- Every response is validated with Zod. A response that doesn't match shows a generic error rather than broken UI.
- `schema.ts` is excluded from Prettier (`.prettierignore`) so it stays byte-for-byte comparable with the backend copy. Below the contract it adds a few `z.infer` type aliases that are frontend-only.

The backend must allow CORS from the Pages domain (and `http://localhost:3000` for development).

## Deploying to Cloudflare Pages

1. Push this repo to GitHub or GitLab.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Build settings:
   - Framework preset: **None** (or Next.js (Static HTML Export))
   - Build command: `npm run build`
   - Build output directory: `out`
   - Environment variable `NODE_VERSION` = `22` (Next 16 needs Node 20.9 or later)
4. Under **Settings → Environment variables**, add `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_USE_MOCK=false` for Production. Preview deployments can use mock mode or the test site key.
5. In **Turnstile**, add the Pages domain (and any custom domain) to the widget's allowed hostnames.
6. Redeploy after changing any variable, because they are baked in at build time.

## How it works

```
src/
  app/            layout.tsx, page.tsx (upload/results state machine), globals.css (theme tokens)
  components/     CategorySlot, ImageDropzone, ScoreRing, PartResultCard, ResultPanel, ErrorBanner
  lib/
    schema.ts       API contract (keep in sync with the backend)
    api.ts          fetch client, error-code → friendly-message mapping, response validation, timeout
    resizeImage.ts  validate → decode → resize to ≤1024px → JPEG 0.8 → base64 (no prefix)
    categories.ts   labels and photo tips per category
    mock.ts         fake responses for mock mode
    format.ts       score → label, label colours and copy, service de-duplication
    photos.ts       photo state helpers (object-URL cleanup)
    config.ts       env vars
```

- **Image prep:** happens as soon as a photo is added, so decode failures (for example HEIC in browsers that can't read it) appear on that part's card right away. The photo is removed and the rest of the form keeps working. Non-images and files over 15 MB are rejected before decoding. Submitting waits for any resizes still in progress ("Preparing photos…"), then sends only parts that have photos.
- **Turnstile:** tokens are single-use, so the widget resets after every attempt. Submit and "Try again" are disabled until a fresh token arrives.
- **Object URLs:** thumbnail URLs are revoked when a photo is removed, when a photo fails to decode, on "Start over", and when the page unmounts. "Edit photos" keeps them.
- **Theming:** colours are CSS variables in `src/app/globals.css`, with separate light and dark values (`prefers-color-scheme`), exposed as Tailwind tokens (`bg-brand`, `text-fg-muted`, `text-level-heavy`, …). To rebrand, change `--brand`, `--brand-strong`, `--brand-fg` and `--brand-soft`.
- **No external assets:** system font stack, inline SVG icons. The only third-party request is the Turnstile script, and only when mock mode is off.

## Decisions made where the brief was open

- **Score direction:** 0 means clean and 100 means heavy detailing needed. The UI says "Higher scores mean more detailing is needed". Per-part labels use the same bands as the overall label (<25 clean, <50 light, <75 moderate, otherwise heavy). This is a frontend assumption, because the API only returns a label for the overall score.
- **Request timeout:** 90 seconds, reported as a retryable error.
- **Retryable errors:** the "Try again" button shows for network errors, timeouts, `RATE_LIMITED`, `AI_FAILED`, `INTERNAL` and invalid responses. It is hidden for `INVALID_REQUEST`, `BOT_CHECK_FAILED` (which asks the user to refresh) and `PAYLOAD_TOO_LARGE` (which asks them to remove photos).
- **Missing HTTP error body:** if a non-200 response has no valid error body, 429 maps to `RATE_LIMITED`, 413 maps to `PAYLOAD_TOO_LARGE`, and anything else gets the generic message.
- **EXIF orientation:** applied when decoding (`createImageBitmap(..., { imageOrientation: "from-image" })`), so portrait phone photos aren't sent sideways. Transparent PNGs are flattened onto white.
- **Empty MIME type:** files with an empty MIME type but an image extension (some HEIC uploads) are allowed through to the decoder rather than rejected up front.
- **`trailingSlash: true`:** set in `next.config.ts` so static routes resolve cleanly on Pages.
- **Spelling:** UK English in the copy ("bonnet", "boot", "analyse") to match the category names.
