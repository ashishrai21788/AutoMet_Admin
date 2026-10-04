# AutoMet Admin

Web admin dashboard for the AutoMet ride-hailing platform. React 19 + TypeScript + Vite, Tailwind CSS 4, React Router, TanStack Query, Zustand.

## Roles and client isolation

| Role | Scope | Can |
|---|---|---|
| Super admin | Whole platform | Create and suspend businesses, open any business, everything a client admin can do |
| Client admin | Own client only | Everything for their client except managing clients |
| Operations / Support / Finance | Own client only | Subsets of the above (see `src/lib/permissions.ts`) |

- Menu items and routes are filtered by permission (`src/components/guards.tsx`).
- `resolveTenantScope` in `src/lib/scope.ts` is the single rule for which client's data a request may touch. The UI and the mock API both use it.
- **The UI check is a convenience, not security.** The backend must enforce the same tenant rule on every `/api/admin` request, from the token, never from a request parameter alone.

## Run locally

The dashboard talks only to the real API (there is no demo-data mode). Start the backend, then the dashboard:

```bash
# terminal 1: AutoMet_Webend_Apis (in-memory database, nothing saved; prints the demo super admin login)
npm run dev:fake
# terminal 2: this project
npm install
cp .env.example .env.local   # VITE_API_BASE_URL=http://localhost:3000
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build into dist/
```

To use a real backend, set `VITE_API_BASE_URL` to its URL.

## Deploy to Vercel

1. Import the repo in Vercel (framework preset: Vite; build `npm run build`; output `dist`). `vercel.json` rewrites all routes to `index.html`.
2. Environment variable: `VITE_API_BASE_URL` = the backend URL.
3. Add the Vercel domain to the backend's CORS allow-list.
4. The first super admin is created by the backend from `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (see the backend's `ADMIN_API.md`).

## Backend contract

See `AutoMet_Webend_Apis/ADMIN_API.md`. The client is `src/api/index.ts`; every business request sends the selected business in the `X-App-Id` header, and the server checks it against the signed-in account.

## Structure

```
src/api        API client and React Query hooks (business data is cached per appId)
src/lib        types, permissions, tenant scoping, country/city data (loaded on demand)
src/store      auth session (sessionStorage), sidebar preference
src/layouts    app shell: collapsible sidebar, mobile drawer, business switcher
src/components shared UI: tables, dialogs, toasts, setup guide
src/pages      Businesses, Dashboard, Regions, Categories, Pricing, Ride Settings, Business Settings, Team, Admin Profile
```

## Status

Built: Super Admin business list and creation (unique immutable App ID), guided onboarding (country and regions, vehicle categories, pricing with live fare preview and cancellation policy, confirm), dashboard with setup progress and warnings, business settings, team, forced password change.

Not built: ride settings (dispatch), driver and rider management, trips, payments, audit log screen. Operational statistics are intentionally not shown until real data is tied to each business.

The saved fare rules are not yet used by the rider app to price live rides.
