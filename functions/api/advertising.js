import { getDatabase, json, readJson } from "../../lib/posts.js";

const CONTACT_EMAIL = "keaji1614@gmail.com";
const RATE_LIMIT_MS = 10 * 60 * 1000;
const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const onRequestGet = async (context) => {
  const missing = ["RESEND_API_KEY", "ADS_FROM_EMAIL"].filter((name) => !context.env[name]?.trim());
  return json({ configured: missing.length === 0, missing });
};

export const onRequestPost = async (context) => {
  const origin = context.request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(context.request.url).origin) {
        return json({ error: "This request is not allowed." }, 403);
      }
    } catch {
      return json({ error: "The request origin is invalid." }, 403);
    }
  }

  if (Number(context.request.headers.get("content-length")) > 10_000) {
    return json({ error: "The inquiry is too large." }, 413);
  }

  const { value, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (typeof value?.website === "string" && value.website.trim()) {
    return json({ ok: true });
  }

  const email = typeof value?.email === "string" ? value.email.trim() : "";
  const message = typeof value?.message === "string" ? value.message.trim() : "";
  if (
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !message || message.length > 2000
  ) {
    return json({ error: "이름, 이메일 주소와 문의 내용을 확인해 주세요." }, 400);
  }

  const { RESEND_API_KEY, ADS_FROM_EMAIL } = context.env;
  if (!RESEND_API_KEY || !ADS_FROM_EMAIL) {
    return json({ error: "광고 문의 메일 설정이 아직 완료되지 않았습니다." }, 503);
  }

  const { db, error: databaseError } = getDatabase(context);
  if (databaseError) return databaseError;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS advertising_rate_limits (
      ip_hash TEXT PRIMARY KEY,
      last_submitted_at INTEGER NOT NULL
    )
  `).run();

  const now = Date.now();
  const ipHash = await sha256(context.request.headers.get("CF-Connecting-IP") || "unknown");
  const rateLimit = await db.prepare(`
    INSERT INTO advertising_rate_limits (ip_hash, last_submitted_at)
    VALUES (?, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET last_submitted_at = excluded.last_submitted_at
    WHERE advertising_rate_limits.last_submitted_at <= ?
  `).bind(ipHash, now, now - RATE_LIMIT_MS).run();
  if (!rateLimit.meta.changes) {
    return json({ error: "문의는 10분에 한 번씩 보낼 수 있습니다." }, 429);
  }

  let emailResponse;
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: ADS_FROM_EMAIL,
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: `[모여] 배너 광고 문의 - ${email}`,
        text: `회신 이메일: ${email}\n\n문의 내용:\n${message}`,
      }),
    });
  } catch (error) {
    console.error("Could not reach Resend for an advertising inquiry.", error);
    await db.prepare(`
      DELETE FROM advertising_rate_limits
      WHERE ip_hash = ? AND last_submitted_at = ?
    `).bind(ipHash, now).run();
    return json({ error: "메일 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
  if (!emailResponse.ok) {
    let errorCode = "unknown";
    try {
      const responseBody = await emailResponse.json();
      if (typeof responseBody?.name === "string" && /^[a-z0-9_-]{1,64}$/i.test(responseBody.name)) {
        errorCode = responseBody.name;
      }
    } catch (error) {
      console.error("Could not read Resend's advertising inquiry error response.", error);
    }
    console.error("Resend rejected an advertising inquiry.", {
      status: emailResponse.status,
      code: errorCode,
    });
    await db.prepare(`
      DELETE FROM advertising_rate_limits
      WHERE ip_hash = ? AND last_submitted_at = ?
    `).bind(ipHash, now).run();
    return json({
      error: "문의 메일 발송에 실패했습니다.",
      providerStatus: emailResponse.status,
      providerCode: errorCode,
    }, 502);
  }

  return json({ ok: true });
};
