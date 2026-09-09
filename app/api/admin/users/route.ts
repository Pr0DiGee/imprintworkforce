import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/server-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getServerUser();
    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, email, password, role, departments } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create user profile in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      email,
      role,
      departments: departments || [],
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("[POST /api/admin/users]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await getServerUser();
    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { uid, role, departments } = await req.json();

    if (!uid || !role) {
      return NextResponse.json({ error: "Missing required fields (uid, role)" }, { status: 400 });
    }

    const db = getAdminDb();

    await db.collection("users").doc(uid).update({
      role,
      departments: departments || [],
      // Sync the legacy field for backwards compatibility
      department: departments && departments.length > 0 ? departments[0] : "",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[PATCH /api/admin/users]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

