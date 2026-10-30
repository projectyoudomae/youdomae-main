import { getDatabase, json } from "../../../lib/posts.js";

export const onRequestGet = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { results } = await db.prepare("PRAGMA table_info(users)").all();
  const columns = new Set(results.map((column) => column.name));
  const startedAt = performance.now();
  let stage = "importKey";

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("diagnostic-only-password"),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    stage = "deriveBits";
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode("diagnostic-salt"), iterations: 210_000 },
      key,
      256,
    );
    return json({
      passwordColumnsPresent: columns.has("password_salt") && columns.has("password_hash"),
      passwordHash: "ok",
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    return json({
      passwordColumnsPresent: columns.has("password_salt") && columns.has("password_hash"),
      passwordHash: "failed",
      failedAt: stage,
      errorName: error?.name || "Error",
      errorMessage: error?.message || "",
    }, 503);
  }
};