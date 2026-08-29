"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";

export async function processCheckIn(formData: FormData, targetSunday: string) {
  const db = getAdminDb();
  
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string | null;
  const birthday = formData.get("birthday") as string | null;
  const address = formData.get("address") as string | null;

  if (!name || !phone) {
    return { error: "Name and Phone are required." };
  }

  try {
    let memberId = id;
    const now = FieldValue.serverTimestamp();

    if (memberId) {
      // Update existing member
      await db.collection("congregation").doc(memberId).update({
        name,
        phone,
        email: email || null,
        birthday: birthday || null,
        address: address || null,
        last_checkin: now,
        attendance_count: FieldValue.increment(1),
      });
    } else {
      // Check if phone already exists
      const phoneQuery = await db.collection("congregation").where("phone", "==", phone).get();
      
      if (!phoneQuery.empty) {
        // Reuse existing profile based on phone
        memberId = phoneQuery.docs[0].id;
        await db.collection("congregation").doc(memberId).update({
          name,
          email: email || null,
          birthday: birthday || null,
          address: address || null,
          last_checkin: now,
          attendance_count: FieldValue.increment(1),
        });
      } else {
        // Create new member
        const newDoc = db.collection("congregation").doc();
        memberId = newDoc.id;
        await newDoc.set({
          name,
          phone,
          email: email || null,
          birthday: birthday || null,
          address: address || null,
          created_at: now,
          last_checkin: now,
          attendance_count: 1,
        });
      }
    }

    // Set cookie for device memory (expires in 1 year)
    const cookieStore = await cookies();
    cookieStore.set("iw_member_id", memberId, { 
      path: "/", 
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });

    // Record attendance
    await db.collection("attendance").add({
      member_id: memberId,
      service_date: targetSunday,
      checked_in_at: now,
    });

    return { success: true, memberId };
  } catch (error) {
    console.error("Check-in error:", error);
    return { error: "An error occurred during check-in. Please try again." };
  }
}

export async function lookupByPhone(phone: string) {
  const db = getAdminDb();
  try {
    const query = await db.collection("congregation").where("phone", "==", phone).get();
    if (query.empty) {
      return { member: null };
    }
    const doc = query.docs[0];
    const data = doc.data();
    return { 
      member: {
        id: doc.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        birthday: data.birthday,
        address: data.address,
      } 
    };
  } catch (error) {
    console.error("Lookup error:", error);
    return { error: "Lookup failed." };
  }
}
