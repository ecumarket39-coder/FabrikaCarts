import { getSql } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function logOps(
  level: "info" | "warn" | "error",
  kind: string,
  message: string,
  payload?: unknown,
): Promise<void> {
  const sql = await getSql();
  const json = payload === undefined ? null : JSON.stringify(payload);
  await sql`
    insert into ops_events (id, level, kind, message, payload_json)
    values (${newId()}, ${level}, ${kind}, ${message}, ${json})
  `;
}
