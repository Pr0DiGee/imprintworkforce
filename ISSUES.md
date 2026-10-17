# Known issues

Audit of the codebase as received from the previous developer. Tick items off as they are fixed.
Suggested order: A (security) → 8 → 9–11 → C (speed) → the rest.

## A. Security

- [x] **1. `/api/send` is an open email relay.** *(Fixed in code. Live needs `CHURCH_EMAIL` and `LEAD_PASTOR_EMAIL` set on Vercel.)* No auth check, any recipient, any HTML. `proxy.ts` lets all `/api/*` through.
  Fix: require a signed-in user; only allow the fixed church / lead pastor recipients; build the email wrapper on the server; drop the unused developer recipient.
- [x] **2. `/api/notifications/send` lets any signed-in user push any message to any user.** *(Fixed: event-based, server picks recipient/text; duplicates blocked via `push_events`.)*
  Fix: decide recipients and text on the server from the action that happened.
- [ ] **3. Public check-in phone lookup leaks PII** (`lookupByPhone` in `app/checkin/actions.ts` returns name, email, birthday, address to anyone).
  Fix: return only enough to confirm identity (first name), nothing else.
- [ ] **4. Anyone can overwrite congregation records.** `processCheckIn` trusts a member `id` from the browser; Firestore rules allow unauthenticated `create`/`update` on `congregation` and `create` on `attendance`.
  Fix: close those rules (check-in uses the Admin SDK) and validate the id server-side.
- [ ] **5. Department self-escalation.** Users can edit the legacy `department` field on their own profile, and the rules fall back to it in `userDepartments()`.
  Fix: block the field in rules, then drop the fallback.
- [ ] **6. Public self sign-up on `/login`.** Decide whether accounts should only be created by admins.
- [ ] **7. Seeded accounts may use `changeme123`.** If `scripts/seed-schedule.ts` ran against production, ~15 accounts plus `admin@imprint.local` share that password.
  Fix: check, then reset or remove.

## B. Bugs

- [ ] **8. "Email already in use" for an email nobody uses.** Sign-up creates the Auth account, then the Firestore profile write is denied by the rules, leaving a hidden Auth account. Admin create has no rollback either.
  Fix: align rules with the sign-up decision, roll back on failure, clean up existing orphan Auth accounts.
- [ ] **9. Notes autosave (likely) kicks you out of the editor** after 1.5s idle and shows a "Note saved" toast. Needs browser confirmation.
  Fix: separate silent autosave from the explicit Save.
- [ ] **10. Task deadlines missing on first load.** Server serializes deadlines to ISO strings; `TaskCard`/`sortTasks` only understand Timestamp objects → no due date, no overdue badge, wrong sort.
- [ ] **11. Roster "Claim" always fails for workers** — rules only allow pastors to write roster.
- [ ] **12. 24-hour report lock is client-side only** — not enforced in `firestore.rules`.
- [ ] **13. Role lists disagree** between `lib/roles.ts`, `firestore.rules`, `SidebarNav`, devotion page, follow-up page (ADMIN / SYSTEM_ADMIN handling).
  Fix: single source of truth, mirrored in rules.
- [ ] **14. Devotion notes toast "saved" even when the save failed.**
- [ ] **15. Duplicate check-ins on the same Sunday inflate `attendance_count`.**
  Fix: one attendance doc per member per Sunday (`{memberId}_{sunday}`).
- [ ] **16. Deletes leave orphans** — contact delete leaves follow-up logs; user delete leaves tasks/roster/contacts showing "Unknown".
- [ ] **17. Push subscription stays bound to the previous user after sign-out on a shared device.**
- [x] **30. iPhone pushes failed when running locally.** The local `.env.local` had `VAPID_SUBJECT=mailto:pastorboye@imprint.local`; Apple rejects non-real domains (403 BadJwtToken). Live was unaffected: Vercel already uses a real Gmail address. *(Fixed locally and in the code's fallback.)*
- [ ] **18. Small ones:** dashboard report total hard-coded to 5; target Sunday computed in UTC not Lagos time (first hour of Sunday is "last week"); password change doesn't invalidate other sessions; `GET /api/auth/session` returns 500 on a malformed cookie.

## C. Speed

- [ ] **19. Whole-collection reads on every load** — all follow-up logs/contacts/users on dashboard and follow-up; full note contents just to count notes; entire congregation on attendance; all reports on history. Grows over time.
- [ ] **20. Sequential query waterfalls** — user lookup then data; `fetchDashboardStats` runs 3 queries in series; roster page does 30 single reads then loads users.
- [ ] **21. Server region / cold starts** — no Vercel region set (default US East) while users are in Nigeria; firebase-admin cold starts.
  Fix: pin region near the Firestore location, then measure.
- [ ] **22. Firebase client SDK + duplicate profile fetch on every page** (incl. public check-in); admin/pastor nav links pop in late.
- [ ] **23. Service worker** intercepts every request, caches every page (incl. private data) without limit, gives no speed benefit.
  Fix: cache static assets only.
- [ ] **24. Minor:** 110KB logo via `<img>` (11 places); O(n²) sort in Follow-Up.

## D. Code health & handover

- [ ] **25. Three timestamp formats in use** (Timestamp, `{_seconds}`, ISO string) — root cause of #10. Pick one.
- [ ] **26. No real tests**, no `test` script, setup mocks a non-existent `ToastContext`.
- [ ] **27. 124 lint problems**; delete stray `fix_profile.js`, `update_profile.js`, `scratch_script.js`.
- [ ] **28. Duplicated `verifySession`**, route-to-route import; unused deps (`next-themes`, `html2pdf.js`, `class-variance-authority`); stale `components.json`; boilerplate README.
- [ ] **29. Account ownership.** Email sender is `no-reply@zubby.me` (previous developer's domain?). Confirm the church owns Firebase, Vercel, Resend, GitHub; rotate secrets; set missing env vars on Vercel.
