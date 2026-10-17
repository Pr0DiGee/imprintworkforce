import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { can, PERMISSIONS } from "@/lib/permissions";
import { syncRules } from "../scripts/sync-rules";

describe("permissions", () => {
  it("firestore.rules is in sync with lib/permissions.ts (run `npm run rules:sync`)", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8").replace(/\r\n/g, "\n");
    expect(syncRules(rules)).toBe(rules);
  });

  it("ADMIN is a super-user", () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can({ role: "ADMIN" }, permission)).toBe(true);
    }
  });

  it("matches the agreed role decisions", () => {
    const pastor = { role: "PASTOR", departments: [] };
    const lead = { role: "LEAD_PASTOR", departments: [] };
    const worker = { role: "WORKER", departments: ["CHOIR"] };

    expect(can(pastor, "viewAllTasks")).toBe(true);
    expect(can(pastor, "writeAnyReport")).toBe(false);
    expect(can(lead, "writeAnyReport")).toBe(true);
    expect(can(worker, "viewAllTasks")).toBe(false);
    expect(can(worker, "editDevotion")).toBe(false);
    expect(can({ role: "WORKER", departments: ["DEVOTION"] }, "editDevotion")).toBe(true);
    expect(can({ role: "WORKER", departments: ["USHERING"] }, "manageAttendance")).toBe(true);
    expect(can({ role: "WORKER", departments: ["USHERING"] }, "viewAllReports")).toBe(false);
    expect(can(null, "viewAllReports")).toBe(false);
  });
});
