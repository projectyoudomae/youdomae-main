import { createPasswordRecord } from "../../lib/auth.js";
import { getDatabase, json } from "../../../lib/posts.js";

export const onRequestGet = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { results } = await db.prepare("PRAGMA table_info(users)").all();
  const columns = new Set(results.map((column) => column.name));
  const startedAt = performance.now();

  try {
    await createPasswordRecord("diagnostic-only-password");
    return json({
      passwordColumnsPresent: columns.has("password_salt") && columns.has("password_hash"),
      passwordHash: "ok",
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    return json({
      passwordColumnsPresent: columns.has("password_salt") && columns.has("password_hash"),
      passwordHash: "failed",
      errorName: error?.name || "Error",
    }, 503);
  }
};