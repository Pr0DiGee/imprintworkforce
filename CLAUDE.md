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
npm test                           # vitest run (includes the rules/permissions sync check)
npx vitest run __tests__/permissions.test.ts   # single test file
npm run rules:sync                 # regenerate the permissions block in firestore.rules from lib/permissions.ts
npm run rules:check                # fail if firestore.rules is out of date
npm run seed:dev                   # seed users + devotion/roster schedule into the DEV project (refuses to run against production)
npx firebase-tools deploy --only firestore --project dev   # rules + indexes to imprintworkforce-dev (alias in .firebaserc)
npx firebase-tools deploy --only firestore --project default   # same to PRODUCTION; only after testing on dev
```

Test coverage is thin: `__tests__/permissions.test.ts` checks the permission decisions and that `firestore.rules` matches `lib/permissions.ts`; `__tests__/auth.test.ts` is a placeholder. Vitest uses jsdom and the `@/` → repo-root alias.

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
4. `app/dashboard/layout.tsx` passes that profile to `DashboardShell` → `SidebarNav`/`SidebarUserInfo`, so menus never fetch it client-side. `getServerUser` and `fetchAllUsers`/`fetchUserMap` are wrapped in React `cache()`, so the layout and page share one lookup per request. After a profile change, call `router.refresh()`.
5. Firebase browser SDK: `lib/firebase/client-auth.ts` (Auth only; sign-in pages) and `lib/firebase/client.ts` (adds Firestore; dashboard writers). Public pages (check-in) load neither.

All session code lives in `lib/server-auth.ts` (sign, verify, cookie options, `getServerUser`). Changing a password or email sets `users/{uid}.sessions_valid_after` (seconds) and revokes Firebase refresh tokens, which signs out every other device; the changing device gets a fresh cookie and re-signs in to Firebase in `ProfileForm`.

### Data flow: server reads, client writes
- **Reads**: dashboard `page.tsx` Server Components fetch with the Admin SDK (helpers in `lib/server-data.ts`, getters in `lib/firebase/admin.ts`), pass the data as props to a sibling `*Client.tsx` component. Dates in the browser are ISO strings: run every Firestore document through `serializeData()` (`lib/serialize.ts`) before it reaches component state, including client-side reloads, and read dates with `toJsDate()` from `lib/date.ts` (it accepts every shape and never returns an Invalid Date). Don't put `serverTimestamp()` sentinels in local state; use `new Date().toISOString()`.
- **Writes**: mostly done directly from client components with the Firebase client SDK (`setDoc`/`updateDoc`/`addDoc`), so **`firestore.rules` is the real authorization layer** for reports, tasks, roster, devotion, feedback, notes, and follow-up. When changing who can do what, update both the UI gating and the rules.
- **Server-only writes** (Admin SDK, bypass rules): user CRUD (`/api/admin/users`, ADMIN only), credential changes (`/api/auth/update-credentials`), profile name/photo (`app/dashboard/profile/actions.ts`), public check-in (`app/checkin/actions.ts`), push subscriptions.
- `FIREBASE_SERVICE_ACCOUNT_JSON` is the **base64-encoded** service account JSON; the Admin app is a lazy singleton.

### Roles, departments and permissions
Roles (`types/index.ts`): `WORKER`, `PASTOR`, `LEAD_PASTOR`, `ADMIN` (super-user). Users also have a `departments[]` array (CHOIR, MEDIA, USHERING, DEVOTION, BABCOCK_CAMPUS); some abilities come from a department rather than a role (DEVOTION edits the devotion schedule, USHERING manages attendance).

**`lib/permissions.ts` is the single source of truth.** Never check `user.role === ...` directly: call `can(user, "editDevotion")` etc. on the server, in routes and in components. `firestore.rules` gets the same lists through a generated `// <generated:permissions>` block (`npm run rules:sync`); `npm test` fails if they drift. To change who can do something, edit `PERMISSIONS`, run `rules:sync`, and deploy the rules.

Reports lock 24 hours after submission for everyone, admins included (`reportLocked()` in the rules, `REPORT_EDIT_WINDOW_MS` in `ReportsClient.tsx`). The admin catch-all rule deliberately skips the `reports` collection.

### Large collections: never load them whole
- **Follow-up**: contacts carry a latest-log summary (`last_log_at`, `last_log_method`, `last_log_notes`, `last_log_by`, `last_log_sunday`, `log_count`), written together with each log by `logFollowUp()` in `app/dashboard/followup/actions.ts`. Lists read only contacts; full history loads on demand (`getFollowUpHistory`, `components/FollowUpHistory.tsx`).
- **Attendance**: the page shows only who came that Sunday (`fetchAttendeesForSunday`); search/filter happen on that list.
- **Notes / History**: counts come from Firestore `count()` aggregations, not downloaded documents.
- `scripts/backfill-summaries.ts` recomputes the stored summaries, search fields and attendance visit numbers/counts (dev by default, `--production` for prod); `scripts/seed-volume.ts` fills dev with realistic volume.

### Weekly check-ups, to-dos and sidebar dots
- **Check-up partners** (`lib/checkups.ts`): every Monday the cron pairs everyone except admins (odd count → one ring of three), avoiding partners from the last 4 weeks. One `checkup_tasks/{monday}_{checker}` per person; `checkup_weeks/{monday}` is created in the same batch so a re-run does nothing, and pushes are claimed once via `claimPushKey`. Unfinished check-ups show for 4 weeks. Admin-only page `/dashboard/checkups` shows the current week only. Monday's cron also pushes report reminders to departments that haven't submitted.
- **To-dos** (`lib/action-items.ts`, `getActionSummary`): automatic, un-tickable items computed per request: department report not submitted, feedback not sent (both due Monday 8pm Lagos), contacts not followed up this week (Wednesday 8pm). Overdue is computed on read (`weeklyDeadlines`), not by cron. The same summary drives the **sidebar dots** (layout → `DashboardShell`); server actions call `revalidatePath("/dashboard", "layout")` and client saves call `router.refresh()` so dots update.
- **Tasks**: `personal: true` tasks are created/edited/deleted by server actions (`app/dashboard/tasks/actions.ts`) and are private to their owner; pastors/admins (`viewAllTasks`) see only `personal == false` tasks. Every new task must set `personal`.
- **Phone numbers** live in server-only `user_private/{uid}` (`lib/private-profile.ts`); only the current week's check-up partner is ever shown one. Browsers (admins included) can't read that collection.
- **Follow-up edits**: `editLatestFollowUp` lets the author edit method/notes of their latest log for a contact within 7 days.

### Deletes
Deleting a user (`DELETE /api/admin/users`) deletes tasks assigned to them, their notes and push subscriptions, and clears their roster/devotion slots, then the account. Deleting a follow-up contact goes through `app/dashboard/followup/actions.ts` and removes its logs too. Batch helpers: `lib/server-cleanup.ts`.

### Week / date model
Everything is keyed to a "target Sunday" (`YYYY-MM-DD`). `getTargetSundayString()` in `lib/date.ts` returns the most recent Sunday in Lagos time (Sun–Sat is one service week); the devotion week is the Mon–Sat after it. `lib/sunday.ts` only re-exports `lib/date.ts`.

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

### Public check-in
`/checkin` (no login) is driven by server actions in `app/checkin/actions.ts`. They only work on Sundays in Lagos time (`getLagosToday()`; `CHECKIN_TEST_NOW` fakes the clock in dev only). The member is recognised by the `iw_member_id` cookie, or by a phone number normalised with `lib/phone.ts` (`phone_normalized`, with a fallback for legacy raw numbers). Only the first name is ever returned. Existing members are never edited from check-in, and attendance docs are `{memberId}_{sunday}` (one per Sunday) and store `visit_number` (1 = first visit, as of that Sunday), which drives the first/second-timer labels. Shared logic (find by phone, create member, record attendance in a transaction) is in `lib/attendance.ts`, used by both public check-in and staff check-in (`staffCheckInRegular` / `staffCheckInFirstTimer` on the Attendance page's "Check someone in" button). Birthdays are stored as `MM-DD` (no year; `components/BirthdayInput.tsx`, `normalizeBirthday`). Phone lookups are rate-limited per IP in `checkin_rate_limits`; the daily cron deletes expired records (`cleanupExpiredRateLimits`). Pastors and members of the USHERING department (`canManageAttendance`) see `/dashboard/attendance` and edit member details via `app/dashboard/attendance/actions.ts`. Browsers can't write `congregation`/`attendance` at all.

### PWA
`public/manifest.json` + `public/sw.js` (caches only static assets, cache-first; pages/data/API are never cached; navigations fall back to `public/offline.html`; bump `CACHE_NAME` when changing the policy) plus push/notificationclick handlers, registered from an inline script in `app/layout.tsx` that also applies the dark-mode class before hydration. `proxy.ts` must keep letting `/manifest.json`, `/sw.js`, `/offline.html`, and `*.png` through without auth. The logo is rendered via `components/Logo.tsx` (next/image at display size).

### Styling
Tailwind v4 via `@tailwindcss/postcss`, with no `tailwind.config.js`; theme tokens are CSS variables in `app/globals.css` (`--bg-page`, `--text-primary`, `--accent`, …) and components mostly use them through inline `style={{ … "var(--x)" }}`. Dark mode is a `dark` class on `<html>` handled by `context/ThemeContext.tsx` (localStorage key `iw-theme`); `next-themes` is installed but not used. `components.json` (shadcn) exists but there is no `components/ui` directory. Print layouts rely on `.no-print` / `.print-full-width` classes.

## Environment

Two Firebase projects: **production** `imprintworkforce-49256` (values in `.env.local`, and on Vercel) and a **dev** project whose values live in `.env.development.local`. Next loads `.env.development.local` before `.env.local` during `next dev`, so local development uses the dev project; anything not overridden there (Resend, VAPID, cron secret) falls back to `.env.local`. `lib/firebase/admin.ts` throws if the service account and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` point at different projects, and the seed script refuses to run against production. Never test writes, pushes, or emails against production. `.env.example` lists every key.

`.env.local` needs: `NEXT_PUBLIC_FIREBASE_*` (client config), `FIREBASE_SERVICE_ACCOUNT_JSON`, `SESSION_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, plus `CHURCH_EMAIL` / `LEAD_PASTOR_EMAIL` / `DEVELOPER_EMAIL` for report forwarding.
