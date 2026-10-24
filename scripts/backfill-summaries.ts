/**
 * One-off backfill of fields the app now keeps up to date as it goes:
 *  - follow-up contacts: the "latest log" summary (last_log_at, last_log_method,
 *    last_log_notes, last_log_by, last_log_sunday, log_count), from their logs
 *  - congregation members: name_lower (search), phone_normalized (matching), and
 *    birthday reduced to "MM-DD" (birth years are not kept)
 *  - attendance: visit_number on every record (1st, 2nd, … visit, by date) and
 *    each member's attendance_count recounted from their actual records
 *  - tasks: personal = false on tasks created before personal tasks existed
 *
 *   npx tsx scripts/backfill-summaries.ts                # DEV project
 *   npx tsx scripts/backfill-summaries.ts --production   # PRODUCTION (.env.local)
 *
 * Safe to re-run: everything is recomputed from the source data each time.
 */
import { loadEnvConfig } from "@next/env";
const production = process.argv.includes("--production");
// dev=true loads .env.development.local first; dev=false uses .env.local (production)
loadEnvConfig(process.cwd(), !production);

import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase/admin";
import { normalizePhone } from "../lib/phone";
import { normalizeBirthday } from "../lib/attendance";

const PROD_ID = "imprintworkforce-49256";
if ((process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PROD_ID) !== production) {
  console.error(`Project is ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}; pass --production only for production.`);
  process.exit(1);
}

(async () => {
  const db = getAdminDb();
  const [contacts, logs] = await Promise.all([
    db.collection("followup_contacts").get(),
    db.collection("followup_logs").orderBy("logged_at", "desc").get(),
  ]);

  // Logs arrive newest first, so the first one seen per contact is the latest
  const latest = new Map<string, DocumentData>();
  const counts = new Map<string, number>();
  for (const log of logs.docs) {
    const data = log.data();
    if (!latest.has(data.contact_id)) latest.set(data.contact_id, data);
    counts.set(data.contact_id, (counts.get(data.contact_id) ?? 0) + 1);
  }

  let updated = 0;
  for (let i = 0; i < contacts.docs.length; i += 400) {
    const batch = db.batch();
    for (const contact of contacts.docs.slice(i, i + 400)) {
      const log = latest.get(contact.id);
      batch.update(contact.ref, log
        ? {
            last_log_at: log.logged_at,
            last_log_method: log.method,
            last_log_notes: log.notes ?? "",
            last_log_by: log.worker_id,
            last_log_sunday: log.target_sunday,
            log_count: counts.get(contact.id) ?? 0,
          }
        : {
            last_log_at: FieldValue.delete(),
            last_log_method: FieldValue.delete(),
            last_log_notes: FieldValue.delete(),
            last_log_by: FieldValue.delete(),
            last_log_sunday: FieldValue.delete(),
            log_count: 0,
          });
      updated++;
    }
    await batch.commit();
  }
  console.log(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}: summarised ${updated} contacts from ${logs.size} logs.`);

  // Congregation search/match fields
  const members = await db.collection("congregation").get();
  for (let i = 0; i < members.docs.length; i += 400) {
    const batch = db.batch();
    for (const m of members.docs.slice(i, i + 400)) {
      const data = m.data();
      batch.update(m.ref, {
        name_lower: String(data.name ?? "").toLowerCase(),
        phone_normalized: data.phone_normalized ?? normalizePhone(String(data.phone ?? "")) ?? null,
        birthday: normalizeBirthday(data.birthday),
      });
    }
    await batch.commit();
  }
  console.log(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}: set search fields on ${members.size} congregation members.`);

  // Attendance: number each member's visits in date order; recount totals
  const attendance = await db.collection("attendance").get();
  const byMember = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const doc of attendance.docs) {
    const list = byMember.get(doc.data().member_id) ?? [];
    list.push(doc);
    byMember.set(doc.data().member_id, list);
  }
  const writes: (() => void)[] = [];
  let batch = db.batch();
  let pending = 0;
  const queue = (fn: (b: FirebaseFirestore.WriteBatch) => void) => writes.push(() => fn(batch));
  for (const [memberId, docs] of byMember) {
    docs.sort((a, b) => String(a.data().service_date).localeCompare(String(b.data().service_date)));
    docs.forEach((doc, i) => queue((b) => b.update(doc.ref, { visit_number: i + 1 })));
    const memberRef = db.collection("congregation").doc(memberId);
    if (members.docs.some((m) => m.id === memberId)) queue((b) => b.update(memberRef, { attendance_count: docs.length }));
  }
  for (const write of writes) {
    write();
    if (++pending === 400) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (pending) await batch.commit();
  // Members with no attendance at all
  const zero = members.docs.filter((m) => !byMember.has(m.id) && m.data().attendance_count !== 0);
  for (let i = 0; i < zero.length; i += 400) {
    const b = db.batch();
    zero.slice(i, i + 400).forEach((m) => b.update(m.ref, { attendance_count: 0 }));
    await b.commit();
  }
  console.log(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}: numbered ${attendance.size} attendance records for ${byMember.size} members.`);
  // Tasks: mark pre-existing tasks as not personal (pastors query personal == false)
  const tasks = await db.collection("tasks").get();
  const unmarked = tasks.docs.filter((t) => typeof t.data().personal !== "boolean");
  for (let i = 0; i < unmarked.length; i += 400) {
    const b = db.batch();
    unmarked.slice(i, i + 400).forEach((t) => b.update(t.ref, { personal: false }));
    await b.commit();
  }
  console.log(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}: marked ${unmarked.length} existing tasks as not personal.`);

  process.exit(0);
})();
