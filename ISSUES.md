# Known issues

Audit of the codebase as received from the previous developer. Tick items off as they are fixed.
Suggested order: A (security) → 8 → 9–11 → C (speed) → the rest.

## A. Security

- [x] **1. `/api/send` is an open email relay.** *(Fixed in code. Live needs `CHURCH_EMAIL` and `LEAD_PASTOR_EMAIL` set on Vercel.)* No auth check, any recipient, any HTML. `proxy.ts` lets all `/api/*` through.
  Fix: require a signed-in user; only allow the fixed church / lead pastor recipients; build the email wrapper on the server; drop the unused developer recipient.
- [x] **2. `/api/notifications/send` lets any signed-in user push any message to any user.** *(Fixed: event-based, server picks recipient/text; duplicates blocked via `push_events`.)*
  Fix: decide recipients and text on the server from the action that happened.
- [x] **3. Public check-in phone lookup leaks PII** (`lookupByPhone` in `app/checkin/actions.ts` returns name, email, birthday, address to anyone). *(Fixed: check-in redesigned; only the first name is ever shown)*
  Fix: return only enough to confirm identity (first name), nothing else.
- [x] **4. Anyone can overwrite congregation records.** `processCheckIn` trusts a member `id` from the browser; Firestore rules allow unauthenticated `create`/`update` on `congregation` and `create` on `attendance`. *(Fixed: browsers can't write congregation/attendance; existing members are never edited from check-in, ushers edit from Attendance. Rules deployed to dev and production)*
  Fix: close those rules (check-in uses the Admin SDK) and validate the id server-side.
- [x] **5. Department self-escalation.** Users can edit the legacy `department` field on their own profile, and the rules fall back to it in `userDepartments()`. *(Fixed: rules read only `departments`; users can't write their own profile from the browser. Old field removed from all users; rules live on dev and production)*
  Fix: block the field in rules, then drop the fallback.
- [x] **6. Public self sign-up on `/login`.** Decide whether accounts should only be created by admins. *(Create Account removed from /login. Also turn off sign-up in Firebase console → Authentication → Settings → User actions (dev + prod))* *(Fixed: Create Account removed from /login; sign-up disabled in Firebase on dev and production)*
- [x] **7. Seeded accounts may use `changeme123`.** If `scripts/seed-schedule.ts` ran against production, ~15 accounts plus `admin@imprint.local` share that password. *(Won't fix: account owners will change their own passwords)*
  Fix: check, then reset or remove.

## B. Bugs

- [x] **8. "Email already in use" for an email nobody uses.** Sign-up creates the Auth account, then the Firestore profile write is denied by the rules, leaving a hidden Auth account. Admin create has no rollback either. *(Fixed: hidden account for Pastor Racheal's Gmail deleted on production (email now free); sign-up disabled; admin create-user now rolls back the login if the profile save fails)*
  Fix: align rules with the sign-up decision, roll back on failure, clean up existing orphan Auth accounts.
- [x] **9. Notes autosave (likely) kicks you out of the editor** after 1.5s idle and shows a "Note saved" toast. Needs browser confirmation. *(Fixed: autosave is silent and keeps you in the editor ("Saved" indicator, saves on close); "Invalid Date" fixed; links/refresh reopen the folder and note)*
  Fix: separate silent autosave from the explicit Save.
- [x] **10. Task deadlines missing on first load.** Server serializes deadlines to ISO strings; `TaskCard`/`sortTasks` only understand Timestamp objects → no due date, no overdue badge, wrong sort. *(Fixed: one date format in the browser (ISO), read via toJsDate())*
- [x] **11. Roster "Claim" always fails for workers** — rules only allow pastors to write roster. *(Fixed: Claim removed entirely; pastors assign duties)*
- [x] **12. 24-hour report lock is client-side only** — not enforced in `firestore.rules`. *(Fixed: enforced in firestore.rules for everyone, admins included; the submission time can't be reset)*
- [x] **13. Role lists disagree** between `lib/roles.ts`, `firestore.rules`, `SidebarNav`, devotion page, follow-up page (ADMIN / SYSTEM_ADMIN handling). *(Fixed: lib/permissions.ts is the single source; rules generated from it; ADMIN super-user; all pastors see all tasks; only Lead Pastor/Admin write any report; Devotion department edits the schedule; DEVOTION_LEAD and SYSTEM_ADMIN removed)*
  Fix: single source of truth, mirrored in rules.
- [x] **33. Admins see no tasks.** Server treats ADMIN as a pastor (shows tasks they assigned) while the page/reload treat them as a worker; confirmed on dev. Part of #13. *(Fixed by #13)*
- [x] **14. Devotion notes toast "saved" even when the save failed.** *(Fixed: only says saved when it saved; reverts and keeps the editor open on failure)*
- [x] **15. Duplicate check-ins on the same Sunday inflate `attendance_count`.** *(Fixed: one attendance record per member per Sunday)*
  Fix: one attendance doc per member per Sunday (`{memberId}_{sunday}`).
- [x] **16. Deletes leave orphans** — contact delete leaves follow-up logs; user delete leaves tasks/roster/contacts showing "Unknown". *(Fixed: deleting a contact deletes all its follow-up logs (server-side). Deleting a user: tasks assigned to them and private notes deleted, roster/devotion slots unassigned; reports, feedback and follow-up history kept)*
- [x] **17. Deleting a user leaves their duties and tasks behind.** *(Fixed together with #16: tasks assigned to them deleted, roster/devotion slots unassigned)*
- [x] **30. iPhone pushes failed when running locally.** The local `.env.local` had `VAPID_SUBJECT=mailto:pastorboye@imprint.local`; Apple rejects non-real domains (403 BadJwtToken). Live was unaffected: Vercel already uses a real Gmail address. *(Fixed locally and in the code's fallback.)*
- [x] **18. Small ones:** dashboard report total hard-coded to 5; target Sunday computed in UTC not Lagos time (first hour of Sunday is "last week"); password change doesn't invalidate other sessions; `GET /api/auth/session` returns 500 on a malformed cookie. *(Fixed: report total uses DEPARTMENTS; target Sunday uses Lagos time; password/email change signs out other devices; malformed cookie → 401; one copy of session code in lib/server-auth.ts)*

- [x] **31. Attendance visitor labels ignored the real visit count** (`attendance_count` wasn't passed to the page, so labels guessed from the sign-up date). *(Fixed.)*
- [x] **32. Clean up `checkin_rate_limits`.** Old rate-limit windows pile up; enable a Firestore TTL policy on `expires_at` for that collection (Firebase console → Firestore → TTL). *(Needs a TTL policy on checkin_rate_limits.expires_at in both projects. The app's service accounts lack permission to create it (403); do it in Google Cloud console → Firestore → TTL, or grant the role)* *(Fixed in code: the daily 8am cron deletes expired records. A TTL policy wasn't possible: dev has billing off, and the collection doesn't exist on production until the first Sunday check-in)*

- [x] **34. Devotion topic saves on every keystroke** (one database write per letter typed). Debounce it like notes autosave. *(Fixed: saves once typing pauses (0.8s) or the box loses focus; 20 letters → 1 write)*
- [x] **35. Follow-up contacts of a deleted user keep pointing at them** ("Unknown Worker"). Decide: reassign, or leave for pastors to reassign. *(Fixed: shown as "Unassigned: needs reassigning"; pastors/admins reassign from Follow-Up → Global List)*
- [x] **36. Signing out doesn't stop push notifications on that device.** The device's push subscription stays linked to the user until someone else signs in there. *(Fixed: signing out unlinks this device; the next person to sign in on it re-links it to themselves)*

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

- [x] **25. Three timestamp formats in use** (Timestamp, `{_seconds}`, ISO string) — root cause of #10. Pick one. *(Fixed with #10)*
- [ ] **26. Few real tests** *(npm test now exists and checks permissions + rules sync; setup mock fixed)*
- [ ] **27. 124 lint problems**; delete stray `fix_profile.js`, `update_profile.js`, `scratch_script.js`.
- [ ] **28. Duplicated `verifySession`**, route-to-route import; unused deps (`next-themes`, `html2pdf.js`, `class-variance-authority`); stale `components.json`; boilerplate README.
- [ ] **29. Account ownership.** Email sender is `no-reply@zubby.me` (previous developer's domain?). Confirm the church owns Firebase, Vercel, Resend, GitHub; rotate secrets; set missing env vars on Vercel.
