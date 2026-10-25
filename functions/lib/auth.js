import { json } from "../../lib/posts.js";

const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 210_000;
const ADMIN_ID = "keaji1614";

const toHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const randomHex = (length) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toHex(bytes);
};

const hash = async (value) => toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const derivePasswordHash = async (password, salt) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
};

const safeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

export const publicUser = (user) => ({
  id: user.id,
  loginName: user.login_name,
  nickname: user.nickname,
  isAdmin: Boolean(user.is_admin),
  isAnonymous: Boolean(user.is_anonymous),
});

export const createSession = async (db, user) => {
  const token = randomHex(32);
  const tokenHash = await hash(token);
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).bind(tokenHash, user.id, expiresAt).run();
  return { token, user: publicUser(user) };
};

export const authenticate = async (context) => {
  const token = context.request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return { error: json({ error: "Sign in is required." }, 401) };

  const tokenHash = await hash(token);
  const user = await context.env.DB.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  if (!user) return { error: json({ error: "The session has expired." }, 401) };
  return { user };
};

export const createPasswordRecord = async (password) => {
  const salt = randomHex(16);
  return { password_salt: salt, password_hash: await derivePasswordHash(password, salt) };
};

export const verifyPassword = async (password, user) => {
  if (!user.password_salt || !user.password_hash) return false;
  const candidate = await derivePasswordHash(password, user.password_salt);
  return safeEqual(candidate, user.password_hash);
};

export const validateCredentials = (value) =>
  value &&
  typeof value.loginName === "string" &&
  /^[a-z0-9_-]{2,20}$/.test(value.loginName) &&
  typeof value.password === "string" &&
  value.password.length >= 6 &&
  value.password.length <= 64;

export const createUserId = () => `user-${randomHex(16)}`;
export const ADMIN_LOGIN_NAME = ADMIN_ID;
