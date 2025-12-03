import crypto from "crypto";

export function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    ""
  );
}

export function getFingerprint(req) {
  const headerFp = (req.headers["x-device-id"] || "").toString().trim();
  if (headerFp) return headerFp;
  const ua = (req.headers["user-agent"] || "").toString();
  const ip = getClientIp(req);
  return crypto.createHash("sha256").update(`${ua}|${ip}`).digest("hex");
}
