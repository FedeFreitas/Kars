import crypto from "crypto";

const SECRET =
  process.env.RESET_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "dev-reset-token-secret";

function getKey() {
  return crypto.createHash("sha256").update(SECRET).digest();
}

export function encodeResetToken(email) {
  if (!email) throw new Error("Email obrigatório");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decodeResetToken(token) {
  if (!token) throw new Error("Token obrigatório");
  const buf = Buffer.from(token, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
