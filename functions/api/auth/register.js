import { createPasswordRecord, createSession, createUserId, validateCredentials } from "../../lib/auth.js";
import { getDatabase, json, readJson } from "../../../lib/posts.js";

const ADMIN_LOGIN_NAME = "keaji1614";

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { value, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (!validateCredentials(value)) return json({ error: "아이디 또는 비밀번호를 확인해 주세요." }, 400);

  const loginName = value.loginName.toLocaleLowerCase("ko");
  if (loginName === ADMIN_LOGIN_NAME) {
    return json({ error: "관리자 아이디는 회원가입할 수 없습니다." }, 409);
  }
  const nickname = typeof value.nickname === "string" ? value.nickname.trim() : "";
  if (nickname.length > 20) return json({ error: "표시 닉네임은 20자 이하여야 합니다." }, 400);
  if (await db.prepare("SELECT id FROM users WHERE login_name = ?").bind(loginName).first()) {
    return json({ error: "이미 사용 중인 아이디입니다." }, 409);
  }

  const passwordRecord = await createPasswordRecord(value.password);
  const user = {
    id: createUserId(),
    login_name: loginName,
    nickname: nickname || loginName,
    is_admin: 0,
    is_anonymous: 0,
    ...passwordRecord,
  };
  await db.prepare(`
    INSERT INTO users (id, login_name, nickname, password_salt, password_hash, is_admin, is_anonymous)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, user.login_name, user.nickname, user.password_salt, user.password_hash, user.is_admin, user.is_anonymous,
  ).run();
  return json(await createSession(db, user), 201);
};
