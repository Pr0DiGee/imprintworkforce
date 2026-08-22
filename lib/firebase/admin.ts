import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// Initialization runs on first request (inside a handler's try/catch) so a bad
// env var returns a clean JSON error instead of crashing the process.

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env.local. " +
        "Go to Firebase Console → Project Settings → Service Accounts → Generate new private key, " +
        "base64-encode the JSON file, paste it in .env.local, then restart the dev server."
    );
  }

  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON could not be decoded. " +
        "Ensure the value is a valid base64 string with no extra whitespace or newlines."
    );
  }

  _app = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

  return _app;
}

// Plain getter functions — no Proxies.
// Proxies lose the `this` binding on Auth/Firestore methods (e.g. verifyIdToken),
// causing silent runtime crashes. Import these functions and call them directly.
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

