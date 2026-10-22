import { getFirestore, type Firestore } from "firebase/firestore";
import { app } from "./app";
import { auth } from "./client-auth";

/** Firestore for client-side writes (dashboard pages). Sign-in-only pages use ./client-auth. */
const db: Firestore = getFirestore(app);

export { app, auth, db };
