import {
  ADMIN_LOGIN_NAME,
  createPasswordRecord,
  createSession,
  createUserId,
  validateCredentials,
  verifyPassword,
} from "../../lib/auth.js";
import { getDatabase, json, readJson } from "../../../lib/posts.js";

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { value, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (!validateCredentials(value)) return json({ error: "아이디 또는 비밀번호를 확인해 주세요." }, 400);

  const loginName = value.loginName.toLocaleLowerCase("ko");
  let user = await db.prepare("SELECT * FROM users WHERE login_name = ?").bind(loginName).first();
  if (!user && loginName === ADMIN_LOGIN_NAME) {
    if (!context.env.ADMIN_PASSWORD) {
      return json({ error: "관리자 계정을 처음 연결하려면 ADMIN_PASSWORD secret을 설정해야 합니다." }, 503);
    }
    if (!safeEqual(value.password, context.env.ADMIN_PASSWORD)) {
      return json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." }, 401);
    }
    const passwordRecord = await createPasswordRecord(value.password);
    user = {
      id: createUserId(),
      login_name: ADMIN_LOGIN_NAME,
      nickname: ADMIN_LOGIN_NAME,
      is_admin: 1,
      is_anonymous: 0,
      ...passwordRecord,
    };
    await db.prepare(`
      INSERT INTO users (id, login_name, nickname, password_salt, password_hash, is_admin, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id, user.login_name, user.nickname, user.password_salt, user.password_hash, user.is_admin, user.is_anonymous,
    ).run();
  } else if (!user || !(await verifyPassword(value.password, user))) {
    return json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." }, 401);
  }

  return json(await createSession(db, user));
};

const safeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};
