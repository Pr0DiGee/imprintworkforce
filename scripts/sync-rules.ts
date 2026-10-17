/**
 * Copies the role/department lists from lib/permissions.ts into the generated
 * block of firestore.rules, so the database enforces exactly what the app shows.
 *
 *   npm run rules:sync    rewrite the block
 *   npm run rules:check   exit 1 if the block is out of date (also covered by tests)
 */
import fs from "fs";
import path from "path";
import { PERMISSIONS } from "../lib/permissions";

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");
const START = "// <generated:permissions>";
const END = "// </generated:permissions>";

function list(values: readonly string[] = []): string {
  return `[${values.map((v) => `'${v}'`).join(", ")}]`;
}

export function generatedBlock(indent = "    "): string {
  const lines = [
    `${START}`,
    `// Generated from lib/permissions.ts by \`npm run rules:sync\`. Do not edit by hand.`,
  ];
  for (const [name, rule] of Object.entries(PERMISSIONS)) {
    const fn = `can${name[0].toUpperCase()}${name.slice(1)}`;
    const departments = "departments" in rule ? rule.departments : [];
    lines.push(
      `function ${fn}() {`,
      `  return hasPermission(${list(rule.roles)}, ${list(departments)});`,
      `}`
    );
  }
  lines.push(END);
  return lines.map((l) => indent + l).join("\n");
}

export function syncRules(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(START);
  const end = normalized.indexOf(END);
  if (start < 0 || end < 0) throw new Error(`firestore.rules is missing the ${START} … ${END} markers`);
  const lineStart = normalized.lastIndexOf("\n", start) + 1;
  const indent = normalized.slice(lineStart, start);
  return normalized.slice(0, lineStart) + generatedBlock(indent) + normalized.slice(end + END.length);
}

if (require.main === module) {
  const current = fs.readFileSync(RULES_PATH, "utf8");
  const next = syncRules(current);
  const upToDate = next === current.replace(/\r\n/g, "\n");
  if (process.argv.includes("--check")) {
    if (!upToDate) {
      console.error("firestore.rules is out of date with lib/permissions.ts. Run: npm run rules:sync");
      process.exit(1);
    }
    console.log("firestore.rules matches lib/permissions.ts");
  } else {
    fs.writeFileSync(RULES_PATH, next);
    console.log(upToDate ? "firestore.rules already up to date" : "firestore.rules updated from lib/permissions.ts");
  }
}
