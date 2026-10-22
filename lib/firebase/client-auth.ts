import { getAuth, type Auth } from "firebase/auth";
import { app } from "./app";

/**
 * Firebase Auth only. Pages that just sign in/out (login, password reset)
 * import this so they don't pull in the much larger Firestore library.
 */
export const auth: Auth = getAuth(app);
