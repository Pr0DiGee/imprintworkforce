"use server";

import { getServerUser } from "@/lib/server-auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const user = await getServerUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const name = formData.get("name") as string;
  const image = formData.get("image") as File | null;

  if (!name || name.trim() === "") {
    return { error: "Name is required." };
  }

  const updates: Record<string, any> = { name: name.trim() };

  if (image && image.size > 0) {
    try {
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.split('.').pop() || 'png';
      const filename = `profiles/${user.uid}-${Date.now()}.${ext}`;
      
      const bucket = getAdminStorage().bucket();
      const file = bucket.file(filename);
      
      await file.save(buffer, {
        metadata: { contentType: image.type },
        public: true,
      });
      
      const publicUrl = file.publicUrl();
      updates.photo_url = publicUrl;
    } catch (e) {
      console.error("Failed to upload image:", e);
      return { error: "Failed to upload image to storage. Make sure your Firebase Storage bucket is properly configured." };
    }
  }

  try {
    const db = getAdminDb();
    
    // 1. Update users collection
    await db.collection("users").doc(user.uid).update(updates);
    
    // 2. Update Firebase Auth displayName
    if (updates.name) {
      const { getAdminAuth } = await import("@/lib/firebase/admin");
      await getAdminAuth().updateUser(user.uid, { displayName: updates.name });
    }

    // 3. Update congregation collection (so Attendance and Roster sync the new name)
    if (updates.name) {
      const congregationRef = db.collection("congregation");
      const snap = await congregationRef.where("email", "==", user.email).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, { name: updates.name });
        });
        await batch.commit();
      }
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("Failed to update profile:", e);
    return { error: "Failed to update profile in database." };
  }
}
