import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminAuth, getAdminDb } from "../lib/firebase/admin";
import { AppRole, Department } from "../types";

const DEVOTION_SCHEDULE = [
  // WEEK 1
  { date: "2026-08-24", assigned_to: "Seyi", backup_teacher: "Bolu" },
  { date: "2026-08-25", assigned_to: "Zubby", backup_teacher: "Amarachi" },
  { date: "2026-08-26", assigned_to: "Tomiyin", backup_teacher: "Temiloluwa" },
  { date: "2026-08-27", assigned_to: "Pastor Racheal", backup_teacher: "Bolu" },
  { date: "2026-08-28", assigned_to: "Wonuola", backup_teacher: "Amarachi" },
  { date: "2026-08-29", assigned_to: "Kemi", backup_teacher: "Temiloluwa" },
  
  // WEEK 2
  { date: "2026-08-31", assigned_to: "Bolu", backup_teacher: "Amarachi" },
  { date: "2026-09-01", assigned_to: "Temiloluwa", backup_teacher: "Temiloluwa" },
  { date: "2026-09-02", assigned_to: "Adeola", backup_teacher: "Bolu" },
  { date: "2026-09-03", assigned_to: "Pastor Racheal", backup_teacher: "Amarachi" },
  { date: "2026-09-04", assigned_to: "Irebami", backup_teacher: "Temiloluwa" },
  { date: "2026-09-05", assigned_to: "Amarachi", backup_teacher: "Bolu" },

  // WEEK 3
  { date: "2026-09-07", assigned_to: "Zubby", backup_teacher: "Temiloluwa" },
  { date: "2026-09-08", assigned_to: "Temiloluwa", backup_teacher: "Bolu" },
  { date: "2026-09-09", assigned_to: "Amarachi", backup_teacher: "Amarachi" },
  { date: "2026-09-10", assigned_to: "Pastor Racheal", backup_teacher: "Temiloluwa" },
  { date: "2026-09-11", assigned_to: "Esosa", backup_teacher: "Bolu" },
  { date: "2026-09-12", assigned_to: "Bolu", backup_teacher: "Amarachi" },

  // WEEK 4
  { date: "2026-09-14", assigned_to: "Zubby", backup_teacher: "Bolu" },
  { date: "2026-09-15", assigned_to: "Adeola", backup_teacher: "Amarachi" },
  { date: "2026-09-16", assigned_to: "Tomiyin", backup_teacher: "Temiloluwa" },
  { date: "2026-09-17", assigned_to: "Pastor Racheal", backup_teacher: "Bolu" },
  { date: "2026-09-18", assigned_to: "Wonuola", backup_teacher: "Amarachi" },
  { date: "2026-09-19", assigned_to: "Amarachi", backup_teacher: "Temiloluwa" },

  // WEEK 5
  { date: "2026-09-21", assigned_to: "Seyi", backup_teacher: "Amarachi" },
  { date: "2026-09-22", assigned_to: "Irebami", backup_teacher: "Temiloluwa" },
  { date: "2026-09-23", assigned_to: "Esosa", backup_teacher: "Bolu" },
  { date: "2026-09-24", assigned_to: "Zubby", backup_teacher: "Amarachi" },
  { date: "2026-09-25", assigned_to: "Pastor Racheal", backup_teacher: "Temiloluwa" },
  { date: "2026-09-26", assigned_to: "Kemi", backup_teacher: "Bolu" },

  // WEEK 6
  { date: "2026-09-28", assigned_to: "Bolu", backup_teacher: "Temiloluwa" },
  { date: "2026-09-29", assigned_to: "Temiloluwa", backup_teacher: "Bolu" },
  { date: "2026-09-30", assigned_to: "Adeola", backup_teacher: "Amarachi" },
];

const ROSTER_SCHEDULE = [
  // AUGUST 23RD
  { date: "2026-08-23", duty: "CALL_TO_WORSHIP", assigned_to: "Zubby" },
  { date: "2026-08-23", duty: "PRAYER_CHARGE", assigned_to: "Pastor Racheal" },
  { date: "2026-08-23", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-08-23", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Adeola" },
  
  // AUGUST 30TH
  { date: "2026-08-30", duty: "WORKERS_MEETING", assigned_to: "Favour" },
  { date: "2026-08-30", duty: "CALL_TO_WORSHIP", assigned_to: "Seyi" },
  { date: "2026-08-30", duty: "PRAYER_CHARGE", assigned_to: "Pastor Racheal" },
  { date: "2026-08-30", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-08-30", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Zubby" },

  // SEPTEMBER 6TH
  { date: "2026-09-06", duty: "WORKERS_MEETING", assigned_to: "Kemi" },
  { date: "2026-09-06", duty: "CALL_TO_WORSHIP", assigned_to: "Zubby" },
  { date: "2026-09-06", duty: "PRAYER_CHARGE", assigned_to: "Pastor Racheal" },
  { date: "2026-09-06", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-09-06", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Tomiyin" },

  // SEPTEMBER 13TH
  { date: "2026-09-13", duty: "WORKERS_MEETING", assigned_to: "Adeola" },
  { date: "2026-09-13", duty: "CALL_TO_WORSHIP", assigned_to: "Pastor Racheal" },
  { date: "2026-09-13", duty: "PRAYER_CHARGE", assigned_to: "Zubby" },
  { date: "2026-09-13", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-09-13", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Seyi" },

  // SEPTEMBER 20TH
  { date: "2026-09-20", duty: "WORKERS_MEETING", assigned_to: "Seyi" },
  { date: "2026-09-20", duty: "CALL_TO_WORSHIP", assigned_to: "Tomiyin" },
  { date: "2026-09-20", duty: "PRAYER_CHARGE", assigned_to: "Pastor Racheal" },
  { date: "2026-09-20", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-09-20", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Kemi" },

  // SEPTEMBER 27TH
  { date: "2026-09-27", duty: "WORKERS_MEETING", assigned_to: "Tomiyin" },
  { date: "2026-09-27", duty: "CALL_TO_WORSHIP", assigned_to: "Zubby" },
  { date: "2026-09-27", duty: "PRAYER_CHARGE", assigned_to: "Pastor Racheal" },
  { date: "2026-09-27", duty: "SERMON", assigned_to: "Pastor Boye" },
  { date: "2026-09-27", duty: "OFFERING_ANNOUNCEMENT", assigned_to: "Favour" },
];

async function seed() {
  const auth = getAdminAuth();
  const db = getAdminDb();
  
  const names = [
    "Seyi", "Zubby", "Tomiyin", "Pastor Racheal", "Wonuola", "Kemi",
    "Bolu", "Amarachi", "Temiloluwa", "Adeola", "Irebami", "Esosa",
    "Favour", "Pastor Boye"
  ];
  
  const uidMap: Record<string, string> = {};

  console.log("Creating users...");
  for (const name of names) {
    const email = `${name.toLowerCase().replace(/\s/g, "")}@imprint.local`;
    let uid = "";
    
    try {
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      console.log(`User ${name} already exists with uid ${uid}`);
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        const userRecord = await auth.createUser({
          email,
          password: "changeme123",
          displayName: name,
        });
        uid = userRecord.uid;
        
        let role: AppRole = "WORKER";
        if (name.includes("Pastor")) role = "PASTOR";
        
        const depts: Department[] = [];
        if (["Bolu", "Amarachi", "Temiloluwa"].includes(name)) {
          depts.push("DEVOTION");
        }

        await db.collection("users").doc(uid).set({
          uid,
          name,
          email,
          role,
          departments: depts,
          created_at: new Date(),
        });
        console.log(`Created user ${name} with uid ${uid}`);
      } else {
        throw e;
      }
    }
    uidMap[name] = uid;
  }
  
  // Create admin user
  try {
    await auth.getUserByEmail("admin@imprint.local");
    console.log("Admin exists.");
  } catch(e: any) {
    if (e.code === "auth/user-not-found") {
      const userRecord = await auth.createUser({
        email: "admin@imprint.local",
        password: "changeme123",
        displayName: "System Admin",
      });
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: "System Admin",
        email: "admin@imprint.local",
        role: "ADMIN",
        departments: [],
        created_at: new Date(),
      });
      console.log("Created Admin user.");
    }
  }

  console.log("Seeding Devotion...");
  for (const dev of DEVOTION_SCHEDULE) {
    const assigned_uid = uidMap[dev.assigned_to];
    const backup_uid = uidMap[dev.backup_teacher];
    
    await db.collection("devotion").doc(dev.date).set({
      date: dev.date,
      assigned_to: assigned_uid,
      backup_teacher: backup_uid,
      topic: "",
      teaching_notes: "",
      updated_at: new Date(),
    });
  }

  console.log("Seeding Roster...");
  for (const ros of ROSTER_SCHEDULE) {
    const assigned_uid = uidMap[ros.assigned_to];
    
    await db.collection("roster").doc(`${ros.date}_${ros.duty}`).set({
      service_date: ros.date,
      duty: ros.duty,
      assigned_to: assigned_uid,
      assigned_by: "system",
      created_at: new Date(),
    });
  }
  
  console.log("Done.");
  process.exit(0);
}

seed().catch(console.error);
