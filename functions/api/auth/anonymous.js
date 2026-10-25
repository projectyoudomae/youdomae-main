import { createSession, createUserId, json } from "../../lib/auth.js";
import { getDatabase } from "../../../lib/posts.js";

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const now = Date.now();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  await db.prepare(`
    DELETE FROM users
    WHERE is_anonymous = 1
      AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_id = users.id)
  `).run();
  const user = {
    id: createUserId(),
    login_name: null,
    nickname: "",
    is_admin: 0,
    is_anonymous: 1,
  };
  await db.prepare(`
    INSERT INTO users (id, login_name, nickname, is_admin, is_anonymous)
    VALUES (?, ?, ?, ?, ?)
  `).bind(user.id, user.login_name, user.nickname, user.is_admin, user.is_anonymous).run();
  return json(await createSession(db, user), 201);
};
