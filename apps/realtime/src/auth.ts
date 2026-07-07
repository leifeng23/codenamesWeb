import { timingSafeEqual, webcrypto } from "node:crypto";

const SESSION_COOKIE = "cosmere_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 未配置或过短（至少 16 位），生产环境拒绝启动");
  }
  return "dev-secret-change-me";
}

async function hmac(value: string) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

function parseCookies(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

export async function readUserIdFromCookie(cookieHeader: string | undefined) {
  const token = parseCookies(cookieHeader).get(SESSION_COOKIE);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join(".");
  const expected = await hmac(payload);
  const signatureBuffer = Buffer.from(parts[3]);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }
  // 校验签发时间：超过有效期的 token 视为无效（此前只靠 cookie maxAge，被窃取的 token 永久有效）
  const issuedAt = Number(parts[2]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
    return null;
  }
  return parts[0];
}
