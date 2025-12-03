export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
export const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access";
export const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh"; 
const isProd = process.env.NODE_ENV === "production";
export function cookieBase(path = "/") {
  const base = {
    httpOnly: true, sameSite: "lax",
    secure: isProd && process.env.SECURE_COOKIES === "true",
    path
  };
  if (process.env.COOKIE_DOMAIN) base.domain = process.env.COOKIE_DOMAIN;
  return base;
}
