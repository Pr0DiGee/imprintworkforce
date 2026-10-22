/**
 * One-off backfill of fields the app now keeps up to date as it goes:
 *  - follow-up contacts: the "latest log" summary (last_log_at, last_log_method,
 *    last_log_notes, last_log_by, last_log_sunday, log_count), from their logs
 *  - congregation members: name_lower (search) and phone_normalized (matching)
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
      });
    }
    await batch.commit();
  }
  console.log(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}: set search fields on ${members.size} congregation members.`);
  process.exit(0);
})();
