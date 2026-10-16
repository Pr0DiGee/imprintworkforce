# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Imprint Workforce — internal staff portal (installable PWA) for Imprint Global Church: weekly department reports, tasks, Sunday roster, devotion schedule, service feedback, follow-up contacts, private notes, and a public congregation check-in with attendance. Next.js 16 App Router + React 19 + Firebase (Auth, Firestore, Storage), deployed on Vercel. Firebase project: `imprintworkforce-49256`.

## Commands

```bash
npm run dev                        # dev server (localhost:3000)
npm run build                      # production build
npm run lint                       # eslint (flat config, eslint-config-next)
npx tsc --noEmit                   # typecheck (not wired into a script)
npx vitest run                     # tests (no "test" script exists)
npx vitest run __tests__/auth.test.ts   # single test file
npx tsx scripts/seed-schedule.ts   # seed users + devotion/roster schedule (tsx is not a dependency; writes to the real Firebase project from .env.local)
firebase deploy --only firestore:rules  # rules live in firestore.rules
```

Test coverage is effectively nil (`__tests__/auth.test.ts` is a placeholder; `__tests__/setup.ts` mocks a `@/context/ToastContext` that no longer exists — toasts are `sonner`). Vitest uses jsdom and the `@/` → repo-root alias.

Root-level `fix_profile.js`, `update_profile.js`, `scratch_script.js` are leftover one-off codemod scripts, not part of the app (they also produce lint parse errors).

## Next.js 16 specifics seen in this repo

- Route protection is `proxy.ts` (the Next 16 replacement for `middleware.ts`), exporting `proxy()`. It only checks that a `session` cookie *exists*; everything under `/api`, `/login`, `/checkin`, `/forgot-password`, `/reset-password` is let through unauthenticated, so **API routes and server actions must do their own auth**.
- `params`/`searchParams` are Promises and `cookies()`/`headers()` are async.
- `firebase-admin`, `web-push`, and Google Cloud deps are listed in `serverExternalPackages` in `next.config.ts` — keep new Node-only server deps there if bundling fails.

## Architecture

### Auth / session
1. Client signs in with Firebase Auth (`lib/firebase/client.ts`), gets an ID token.
2. `POST /api/auth/session` verifies the token via the Identity Toolkit REST API and sets an httpOnly `session` cookie of the form `uid.timestamp.hmacSHA256` (7 days, signed with `SESSION_SECRET`). It is a custom HMAC cookie, **not** a Firebase session cookie.
3. Server Components / routes call `getServerUser()` (`lib/server-auth.ts`), which verifies the cookie and loads `users/{uid}` via the Admin SDK. Every dashboard `page.tsx` does `const user = await getServerUser(); if (!user) redirect("/login")` and then does its own role check.
4. Client-side, `context/AuthContext.tsx` (`useAuth()`) tracks the Firebase user and the Firestore profile; it re-fetches the profile every 5 minutes to pick up role changes.

`verifySession` is duplicated in `app/api/auth/session/route.ts` (imported by the notifications routes) and as `verifySessionCookie` in `lib/server-auth.ts` — keep them in sync or consolidate.

### Data flow: server reads, client writes
- **Reads**: dashboard `page.tsx` Server Components fetch with the Admin SDK (helpers in `lib/server-data.ts`, getters in `lib/firebase/admin.ts`), pass the data as props to a sibling `*Client.tsx` component. Firestore Timestamps must go through `serializeData()` (→ ISO strings) before crossing to client components; client code therefore handles deadlines/timestamps as either ISO strings, client `Timestamp`s, or `{_seconds}` objects.
- **Writes**: mostly done directly from client components with the Firebase client SDK (`setDoc`/`updateDoc`/`addDoc`), so **`firestore.rules` is the real authorization layer** for reports, tasks, roster, devotion, feedback, notes, and follow-up. When changing who can do what, update both the UI gating and the rules.
- **Server-only writes** (Admin SDK, bypass rules): user CRUD (`/api/admin/users`, ADMIN only), credential changes (`/api/auth/update-credentials`), profile name/photo (`app/dashboard/profile/actions.ts`), public check-in (`app/checkin/actions.ts`), push subscriptions.
- `FIREBASE_SERVICE_ACCOUNT_JSON` is the **base64-encoded** service account JSON; the Admin app is a lazy singleton.

### Roles and departments
Defined in `types/index.ts` (`AppRole`, `Department`, `RosterDuty`, all collection interfaces). Role helpers live in `lib/roles.ts`, but role lists are also hard-coded in `firestore.rules`, `components/SidebarNav.tsx`, `app/dashboard/devotion/page.tsx`, and the reports pages — and they currently disagree in places (e.g. whether `ADMIN`/`SYSTEM_ADMIN` count). Users have a `departments[]` array; the legacy single `department` field is still read by the rules and written for compatibility.

### Week / date model
Everything is keyed to a "target Sunday" (`YYYY-MM-DD`). `getTargetSundayString()` in `lib/date.ts` returns the most recent Sunday (Sun–Sat is one service week); the devotion week is the Mon–Sat after it. `lib/sunday.ts` only re-exports `lib/date.ts`.

Deterministic document IDs are relied on:
- `reports/{DEPARTMENT}_{targetSunday}`
- `roster/{serviceDate}_{DUTY}`
- `devotion/{date}`
- `feedback/{serviceDate}_{uid}` (rules check the `_uid` suffix)
- `push_subscriptions/{sha256(endpoint)}`

Rich text (reports, devotion notes, notes) is stored as **stringified Tiptap JSON** in a string field; renderers `JSON.parse` with a fallback to raw text/HTML.

### Notifications and email
- Web Push (VAPID): `components/NotificationPermissionBanner.tsx` subscribes and POSTs to `/api/notifications/subscribe`; `lib/push-notifications.ts` sends and prunes 404/410 subscriptions. Client components report *events* (`notifyEvent({ type: "TASK_ASSIGNED", taskId })`, see `PushEvent` in `lib/client-notifications.ts`) to `/api/notifications/send`, which loads the record, checks the caller was allowed to perform that action, and picks the recipient and wording itself — clients never send recipients or text. Each notification claims a key in the server-only `push_events` collection via `create()`, so repeats are skipped. Adding a new push means adding an event type on both sides. Call `notifyEvent` only after the Firestore write has completed.
- Vercel cron (`vercel.json`, 08:00 UTC) hits `/api/cron/daily-reminders` (Bearer `CRON_SECRET`, check skipped outside production). Logic is in `lib/server-crons.ts`: task reminders daily, roster reminders on Saturday, devotion reminders the other days; weekday is computed in `Africa/Lagos`.
- Email goes through Resend at `/api/send` (sender `no-reply@zubby.me`). Recipients may be the placeholders `CHURCH_EMAIL`, `LEAD_PASTOR_EMAIL`, `DEVELOPER_EMAIL`, resolved from env vars of the same names.

### PWA
`public/manifest.json` + `public/sw.js` (network-first cache plus push/notificationclick handlers), registered from an inline script in `app/layout.tsx` that also applies the dark-mode class before hydration. `proxy.ts` must keep letting `/manifest.json`, `/sw.js`, and `*.png` through without auth.

### Styling
Tailwind v4 via `@tailwindcss/postcss`, with no `tailwind.config.js`; theme tokens are CSS variables in `app/globals.css` (`--bg-page`, `--text-primary`, `--accent`, …) and components mostly use them through inline `style={{ … "var(--x)" }}`. Dark mode is a `dark` class on `<html>` handled by `context/ThemeContext.tsx` (localStorage key `iw-theme`); `next-themes` is installed but not used. `components.json` (shadcn) exists but there is no `components/ui` directory. Print layouts rely on `.no-print` / `.print-full-width` classes.

## Environment

`.env.local` needs: `NEXT_PUBLIC_FIREBASE_*` (client config), `FIREBASE_SERVICE_ACCOUNT_JSON`, `SESSION_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, plus `CHURCH_EMAIL` / `LEAD_PASTOR_EMAIL` / `DEVELOPER_EMAIL` for report forwarding.
