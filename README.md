# Invoice Approval Desk — Web

Next.js 16 front end for the invoice approval workflow. A single client-rendered dashboard lists invoices, filters them by status, creates new ones, and approves or rejects anything awaiting review.

- Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, lucide-react
- Talks to the NestJS backend over plain `fetch`, no client SDK
- Deployed to Vercel

## Requirements

- Node.js 20+
- The [backend API](https://github.com/rehmanstackdev/invoice-desk-backend) running, or its Vercel URL

## Run locally

```bash
git clone https://github.com/rehmanstackdev/invoice-desk-front.git
cd invoice-desk-front

npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

`.env.local` only needs one variable:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Point it at your deployed API instead if you are not running the backend locally. The value is inlined into the client bundle at build time, so changing it requires a rebuild or redeploy, not just a restart.

If the dashboard loads but shows an error, the API is unreachable or rejecting the request. The backend allows CORS from `WEB_ORIGIN`, which defaults to `http://localhost:3000` — if you are serving the web app on a different port locally, set `WEB_ORIGIN` on the API to match.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Deploy to Vercel

1. Import `rehmanstackdev/invoice-desk-front` at [vercel.com/new](https://vercel.com/new). Leave Root Directory at the repo root.
2. Next.js is auto-detected; no build settings need changing. `vercel.json` is intentionally empty.
3. Set `NEXT_PUBLIC_API_URL` to the deployed backend URL, then deploy.
4. Add the web domain to the backend's `WEB_ORIGIN` and redeploy the API so CORS matches.

## Design notes

- **One client component.** `src/app/page.tsx` is `"use client"` because every panel (list, filters, create form) shares state and talks to the API from the browser. There is no server-side data layer, so the fetch calls are wrapped in `useEffect` and refreshed after each mutation rather than cached by the framework.
- **No data-fetching library.** Three endpoints and one screen did not justify React Query. `fetch(..., { cache: "no-store" })` keeps invoice data from being cached across requests, and mutations call a shared `load` function to re-read after a change.
- **Statuses are declared twice, deliberately.** The `InvoiceStatus` union in `page.tsx` mirrors the backend enum. It is a compile-time check that the two agree, and it fails the build rather than rendering an unknown badge if the API ever adds a status.
- **Money is formatted at the edge.** `Intl.NumberFormat` renders a single `USD` formatter used for every amount, so the list, the detail panel, and the form preview cannot drift on rounding.
