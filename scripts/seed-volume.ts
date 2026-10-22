/**
 * Fill the DEV project with a realistic volume of data, so performance work
 * can be measured against something closer to a year of real use:
 * follow-up contacts + logs, congregation + weekly attendance, reports, notes.
 *
 *   npx tsx scripts/seed-volume.ts
 *
 * Refuses to run against production. Re-running adds more data.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

import { Timestamp, type WriteBatch } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase/admin";
import { DEPARTMENTS } from "../types";
import { normalizePhone } from "../lib/phone";
import { getTargetSundayString, addWeeksToDate } from "../lib/date";

if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "imprintworkforce-49256") {
  console.error("Refusing to seed volume data into production.");
  process.exit(1);
}

const CONTACTS = 150;
const LOGS = 1500;
const MEMBERS = 300;
const ATTENDANCE_WEEKS = 8;
const REPORT_WEEKS = 20;
const NOTES = 100;

const FIRST = ["Ada", "Tunde", "Ngozi", "Emeka", "Funmi", "Bisi", "Chidi", "Kemi", "Segun", "Amaka", "Yemi", "Ifeoma", "Dayo", "Tolu", "Uche"];
const LAST = ["Okafor", "Adeyemi", "Balogun", "Eze", "Okonkwo", "Bello", "Nwosu", "Adebayo", "Ogunleye", "Obi"];
const pick = <T,>(a: readonly T[], i: number) => a[i % a.length];
const phone = (i: number) => `080${String(30000000 + i).padStart(8, "0")}`;

async function writeAll(items: ((b: WriteBatch) => void)[]) {
  const db = getAdminDb();
  for (let i = 0; i < items.length; i += 400) {
    const batch = db.batch();
    items.slice(i, i + 400).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

(async () => {
  const db = getAdminDb();
  const users = (await db.collection("users").get()).docs.map((d) => ({ uid: d.id, ...d.data() })) as { uid: string; name: string; role: string }[];
  const workers = users.filter((u) => u.role !== "ADMIN");
  const pastor = users.find((u) => u.name === "Pastor Racheal") ?? users[0];
  const thisSunday = getTargetSundayString();
  const sundays = (n: number) => Array.from({ length: n }, (_, i) => addWeeksToDate(thisSunday, -i));
  const ops: ((b: WriteBatch) => void)[] = [];

  // Follow-up contacts + logs over the last 20 weeks
  const contactRefs = Array.from({ length: CONTACTS }, (_, i) => {
    const ref = db.collection("followup_contacts").doc();
    ops.push((b) => b.set(ref, {
      name: `${pick(FIRST, i)} ${pick(LAST, i * 7)} (vol)`, phone: phone(i), address: "Lagos",
      assigned_to: pick(workers, i).uid, campus: i % 5 === 0 ? "BABCOCK" : "GLOBAL",
      created_at: Timestamp.fromDate(new Date(Date.now() - 150 * 864e5)),
    }));
    return { ref, assigned: pick(workers, i).uid };
  });
  const logSundays = sundays(20);
  for (let i = 0; i < LOGS; i++) {
    const c = pick(contactRefs, i * 13);
    const sunday = pick(logSundays, i);
    ops.push((b) => b.set(db.collection("followup_logs").doc(), {
      contact_id: c.ref.id, worker_id: c.assigned, method: pick(["CALL", "TEXT", "PHYSICAL"], i),
      notes: i % 3 === 0 ? "Prayed together, will come Sunday" : "", target_sunday: sunday,
      logged_at: Timestamp.fromDate(new Date(`${sunday}T12:00:00Z`)),
    }));
  }

  // Congregation + attendance for the last 8 Sundays
  const members = Array.from({ length: MEMBERS }, (_, i) => {
    const ref = db.collection("congregation").doc();
    const raw = `081${String(40000000 + i).padStart(8, "0")}`;
    ops.push((b) => b.set(ref, {
      name: `${pick(FIRST, i * 3)} ${pick(LAST, i)} (vol)`, phone: raw, phone_normalized: normalizePhone(raw),
      email: null, birthday: null, address: null, attendance_count: 0,
      created_at: Timestamp.fromDate(new Date(Date.now() - 90 * 864e5)),
    }));
    return ref;
  });
  const visits: Record<string, number> = {};
  for (const sunday of sundays(ATTENDANCE_WEEKS)) {
    members.forEach((m, i) => {
      if ((i + sunday.charCodeAt(9)) % 2 !== 0) return; // ~half attend each week
      visits[m.id] = (visits[m.id] ?? 0) + 1;
      ops.push((b) => b.set(db.collection("attendance").doc(`${m.id}_${sunday}`), {
        member_id: m.id, service_date: sunday, checked_in_at: Timestamp.fromDate(new Date(`${sunday}T09:00:00Z`)),
      }));
    });
  }
  members.forEach((m) => ops.push((b) => b.update(m, { attendance_count: visits[m.id] ?? 0 })));

  // Reports: every department, last 20 Sundays (skip the current week)
  for (const sunday of sundays(REPORT_WEEKS + 1).slice(1)) {
    for (const dept of DEPARTMENTS) {
      ops.push((b) => b.set(db.collection("reports").doc(`${dept}_${sunday}`), {
        department: dept, target_sunday: sunday, status: "SUBMITTED", last_edited_by: pastor.uid,
        content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `${dept} report for ${sunday}. `.repeat(20) }] }] }),
        created_at: Timestamp.fromDate(new Date(`${sunday}T10:00:00Z`)), submitted_at: Timestamp.fromDate(new Date(`${sunday}T18:00:00Z`)),
      }, { merge: true }));
    }
  }

  // Notes for Pastor Racheal across 3 folders + quick notes
  const folders = ["Sermons", "Meetings", "Ideas"].map((name, i) => {
    const ref = db.collection("note_folders").doc();
    ops.push((b) => b.set(ref, { user_id: pastor.uid, name: `${name} (vol)`, color: "#1d4ed8", created_at: Timestamp.fromDate(new Date(Date.now() - i * 864e5)) }));
    return ref.id;
  });
  for (let i = 0; i < NOTES; i++) {
    ops.push((b) => b.set(db.collection("notes").doc(), {
      user_id: pastor.uid, folder_id: pick([...folders, "quick-notes"], i), title: `Note ${i + 1}`,
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Lorem ipsum dolor sit amet. ".repeat(60) }] }] }),
      created_at: Timestamp.fromDate(new Date(Date.now() - i * 36e5)), updated_at: Timestamp.fromDate(new Date(Date.now() - i * 36e5)),
    }));
  }

  await writeAll(ops);
  console.log(`Seeded ${ops.length} writes: ${CONTACTS} contacts, ${LOGS} logs, ${MEMBERS} members + attendance, ${REPORT_WEEKS * DEPARTMENTS.length} reports, ${NOTES} notes.`);
  process.exit(0);
})();
