import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/server-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { can } from "@/lib/permissions";
import { APP_ROLES, DEPARTMENTS, type AppRole, type Department } from "@/types";

const validRole = (role: unknown): role is AppRole => APP_ROLES.includes(role as AppRole);
const validDepartments = (d: unknown): d is Department[] =>
  d === undefined || (Array.isArray(d) && d.every((x) => DEPARTMENTS.includes(x)));

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getServerUser();
    if (!adminUser || !can(adminUser, "manageUsers")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, email, password, role, departments } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!validRole(role) || !validDepartments(departments)) {
      return NextResponse.json({ error: "Invalid role or department" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create user profile in Firestore; if that fails, remove the login account
    // again so it doesn't linger without a profile and block the email address
    try {
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name,
        email,
        role,
        departments: departments || [],
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (profileError) {
      await auth.deleteUser(userRecord.uid).catch((cleanupError) =>
        console.error("[POST /api/admin/users] Rollback failed for", userRecord.uid, cleanupError)
      );
      throw profileError;
    }

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
    if (!adminUser || !can(adminUser, "manageUsers")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { uid, role, departments } = await req.json();

    if (!uid || !role) {
      return NextResponse.json({ error: "Missing required fields (uid, role)" }, { status: 400 });
    }
    if (!validRole(role) || !validDepartments(departments)) {
      return NextResponse.json({ error: "Invalid role or department" }, { status: 400 });
    }

    const db = getAdminDb();

    await db.collection("users").doc(uid).update({
      role,
      departments: departments || [],
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



export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await getServerUser();
    if (!adminUser || !can(adminUser, "manageUsers")) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Missing user uid' }, { status: 400 });
    }

    // Don't allow admin to delete themselves
    if (uid === adminUser.uid) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Delete from Auth
    await auth.deleteUser(uid);
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/admin/users]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

