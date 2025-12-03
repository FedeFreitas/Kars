import crypto from "crypto";
export const randomToken = () => crypto.randomBytes(64).toString("hex");
export const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
