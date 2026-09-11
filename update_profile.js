
const fs = require("fs");
let file = fs.readFileSync("app/dashboard/profile/ProfileForm.tsx", "utf8");

// Replace state
file = file.replace(
  /const \\[secCurrentPassword, setSecCurrentPassword\\] = useState\\("\\"\\);[\\s\\S]*?const \\[secSuccess, setSecSuccess\\] = useState<string \\| null>\\(null\\);/,
  `const [secMode, setSecMode] = useState<"none" | "email" | "password">("none");
  const [secCurrentPassword, setSecCurrentPassword] = useState("");
  const [secNewPassword, setSecNewPassword] = useState("");
  const [secConfirmPassword, setSecConfirmPassword] = useState("");
  const [secNewEmail, setSecNewEmail] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);`
);

// Replace handleSecuritySubmit
file = file.replace(
  /async function handleSecuritySubmit\\(e: React\\.FormEvent<HTMLFormElement>\\) \\{[\\s\\S]*?finally \\{\\s*setSecLoading\\(false\\);\\s*\\}\\s*\\}/,
  `async function handleSecuritySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setSecLoading(true);
    setSecError(null);
    setSecSuccess(null);

    const isEmailChange = secMode === "email";
    const isPasswordChange = secMode === "password";

    if (isPasswordChange && secNewPassword !== secConfirmPassword) {
      setSecError("New passwords do not match.");
      setSecLoading(false);
      return;
    }

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, secCurrentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // 2. Update Email if requested
      if (isEmailChange) {
        await updateEmail(auth.currentUser, secNewEmail);
        // Sync email to firestore users collection
        await updateDoc(doc(db, "users", user.uid), { email: secNewEmail });
      }

      // 3. Update Password if requested
      if (isPasswordChange) {
        await updatePassword(auth.currentUser, secNewPassword);
      }

      setSecSuccess(\`Successfully updated \${isEmailChange ? "email" : "password"}.\`);
      setSecCurrentPassword("");
      setSecNewPassword("");
      setSecConfirmPassword("");
      setSecNewEmail("");
      setSecMode("none");
      if (isEmailChange) {
        await refreshProfile();
      }
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setSecError("Incorrect current password.");
      } else if (err.code === "auth/email-already-in-use") {
        setSecError("That email is already in use by another account.");
      } else {
        setSecError(err.message || "Failed to update security settings.");
      }
    } finally {
      setSecLoading(false);
    }
  }`
);

// Replace JSX
const jsxRegex = /\\{\\/\\* Security Settings Form \\*\\/\\}[\\s\\S]*?(?=<\\/div>\\s*<\\/div>\\s*\\);\\s*\\})/
file = file.replace(jsxRegex, 
  \`{/* Security Settings Form */}
      <div className="pt-8" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Security Settings</h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Update your email address or password. You must provide your current password to make security changes.
        </p>

        {secMode === "none" && (
          <div className="flex gap-4">
            <button
              onClick={() => { setSecMode("email"); setSecSuccess(null); setSecError(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ background: "var(--bg-page)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            >
              Update Email
            </button>
            <button
              onClick={() => { setSecMode("password"); setSecSuccess(null); setSecError(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ background: "var(--bg-page)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            >
              Update Password
            </button>
          </div>
        )}

        {secSuccess && secMode === "none" && (
          <p className="text-sm px-4 py-3 mt-4 max-w-md rounded-lg bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]">
            {secSuccess}
          </p>
        )}

        {secMode !== "none" && (
          <form onSubmit={handleSecuritySubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                Current Password <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                required
                value={secCurrentPassword}
                onChange={(e) => {
                  setSecCurrentPassword(e.target.value);
                  setSecSuccess(null);
                  setSecError(null);
                }}
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                placeholder="Enter current password"
              />
            </div>

            {secMode === "email" && (
              <div className="pt-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                  New Email Address <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={secNewEmail}
                  onChange={(e) => {
                    setSecNewEmail(e.target.value);
                    setSecSuccess(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}

            {secMode === "password" && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                    New Password <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={secNewPassword}
                    onChange={(e) => {
                      setSecNewPassword(e.target.value);
                      setSecSuccess(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                    Confirm Password <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={secConfirmPassword}
                    onChange={(e) => {
                      setSecConfirmPassword(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
            )}

            {secError && (
              <p className="text-sm px-4 py-3 mt-4 rounded-lg bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]">
                {secError}
              </p>
            )}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSecMode("none");
                  setSecCurrentPassword("");
                  setSecNewPassword("");
                  setSecConfirmPassword("");
                  setSecNewEmail("");
                  setSecError(null);
                }}
                className="px-4 py-2.5 text-sm font-medium rounded-lg"
                disabled={secLoading}
                style={{ color: "var(--text-primary)", background: "var(--bg-page)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={secLoading || !secCurrentPassword || (secMode === "email" && !secNewEmail) || (secMode === "password" && !secNewPassword)}
                className="py-2.5 px-6 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70 shadow-sm hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                {secLoading ? "Updating..." : \`Update \${secMode === "email" ? "Email" : "Password"}\`}
              </button>
            </div>
          </form>
        )}
      </div>
\`);
fs.writeFileSync("app/dashboard/profile/ProfileForm.tsx", file);
console.log("Success");

