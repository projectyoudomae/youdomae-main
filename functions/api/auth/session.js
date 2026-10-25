import { authenticate, publicUser } from "../../lib/auth.js";
import { getDatabase, json } from "../../../lib/posts.js";

export const onRequestGet = async (context) => {
  const { error } = getDatabase(context);
  if (error) return error;

  const { user, error: authError } = await authenticate(context);
  if (authError) return authError;
  return json({ user: publicUser(user) });
};

export const onRequestDelete = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const token = context.request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (token) {
    const tokenHash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({ ok: true });
};
