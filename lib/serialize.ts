/**
 * Dates in the browser are always ISO strings (e.g. "2026-10-19T22:59:59.000Z").
 *
 * Firestore hands back Timestamp objects (client SDK), `{_seconds}` objects
 * (Admin SDK data passed through JSON), or pending serverTimestamp() sentinels.
 * Run every Firestore document through `serializeData` before putting it in
 * component state or passing it to a Client Component, and read dates with
 * `toJsDate` from "@/lib/date".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeData(data: any): any {
  if (data === null || data === undefined || typeof data !== "object") return data;
  if (data instanceof Date) return data.toISOString();
  if (typeof data.toDate === "function") return data.toDate().toISOString();
  if (typeof data._seconds === "number") return new Date(data._seconds * 1000).toISOString();
  if (typeof data.seconds === "number" && typeof data.nanoseconds === "number") {
    return new Date(data.seconds * 1000).toISOString();
  }
  if (Array.isArray(data)) return data.map((item: unknown) => serializeData(item));

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(data)) result[key] = serializeData(data[key]);
  return result;
}
