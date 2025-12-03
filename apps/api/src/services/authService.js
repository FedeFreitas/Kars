import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomToken, sha256 } from "../utils/crypto.js";
import {
  findUserByEmail, createUser, insertRefreshToken,
  getRefreshByHash, revokeRefreshByHash, deleteRefreshByHash, getUserById, setUserPassword
} from "../repositories/userRepo.js";
import { ACCESS_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, cookieBase } from "../config/auth.js";
import {
  createTwoFactorCode,
  getTwoFactorCode,
  consumeAttempt,
  markUsed,
  createTrustedDevice,
  findTrustedDevice,
  logLoginAttempt,
  banFingerprint,
  isFingerprintBanned,
  countRecentFailures
} from "../repositories/securityRepo.js";
import { sendMail } from "../utils/mailer.js";
import { getClientIp, getFingerprint } from "../utils/device.js";
import { logger } from "../utils/logger.js";

function signAccess(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      permissions: {
        view_leads: user.can_view_leads,
        edit_leads: user.can_edit_leads,
        view_clients: user.can_view_clients,
        edit_clients: user.can_edit_clients,
        view_users: user.can_view_users,
        edit_users: user.can_edit_users,
        view_finance: user.can_view_finance,
        edit_finance: user.can_edit_finance,
        manage_finance_types: user.can_manage_finance_types,
        void_finance: user.can_void_finance,
        view_cars: user.can_view_cars,
        edit_cars: user.can_edit_cars,
        view_movements: user.can_view_movements,
        create_movements: user.can_create_movements,
        edit_movements: user.can_edit_movements,
        manage_movement_catalogs: user.can_manage_movement_catalogs,
        view_email_templates: user.can_view_email_templates,
        edit_email_templates: user.can_edit_email_templates
      }
    },
    ACCESS_SECRET,
    { subject: user.id, expiresIn: ACCESS_TOKEN_TTL }
  );
}
function newRefreshPayload() {
  const plain = randomToken();
  return { plain, tokenHash: sha256(plain), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000) };
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendTwoFactorEmail({ user, code, purpose }) {
  const subject = purpose === "password_change" ? "Código para troca de senha" : "Código de acesso (2FA)";
  const text = `Seu código é {{code}}. Ele expira em 10 minutos.`;
  const templateKey = purpose === "password_change" ? "password_change" : "two_factor";
  await sendMail({
    to: user.email,
    subject,
    text,
    templateKey,
    params: { code }
  });
}

function trustedExpiryMs() {
  return 24 * 60 * 60 * 1000; // 24h
}

async function maybeBanFingerprint(fingerprint, reason) {
  if (!fingerprint) return;
  const fails = await countRecentFailures({ fingerprint, minutes: 30 });
  if (fails >= 5) {
    await banFingerprint({ fingerprint, reason: reason || "muitas tentativas falhas", ttlMinutes: 60 });
  }
}

export async function sendTwoFactor({ userId, purpose, req }) {
  const user = await getUserById(userId);
  if (!user) throw new Error("Usuário não encontrado");
  const fingerprint = getFingerprint(req);
  const ip = getClientIp(req);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const record = await createTwoFactorCode({
    userId: user.id,
    purpose,
    code,
    expiresAt,
    attempts: 3,
    deviceFingerprint: fingerprint,
    ip
  });
  await sendTwoFactorEmail({ user, code, purpose });
  return { codeId: record.id, expiresAt };
}

export async function requestPasswordReset({ email, req }) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Usuário não encontrado");
  const { codeId, expiresAt } = await sendTwoFactor({ userId: user.id, purpose: "password_change", req });
  return { codeId, expiresAt };
}

export async function confirmPasswordReset({ codeId, code, password, req }) {
  if (!password || password.length < 6) throw new Error("Senha inválida");
  await verifyTwoFactor({ codeId, code, req, rememberDevice: false, purpose: "password_change" });
  const record = await getTwoFactorCode(codeId);
  const userId = record?.user_id;
  if (!userId) throw new Error("Usuário não encontrado");
  const hash = await bcrypt.hash(password, 10);
  await setUserPassword(userId, hash);
  return { ok: true };
}

export async function register({ email, name, password }) {
  const exists = await findUserByEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);
  if (exists) {
    if (!exists.password_hash) {
      return await setUserPassword(exists.id, passwordHash);
    }
    throw new Error("Email already registered");
  }
  return await createUser({ email, name, passwordHash });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: {
      view_leads: user.can_view_leads,
      edit_leads: user.can_edit_leads,
      view_clients: user.can_view_clients,
      edit_clients: user.can_edit_clients,
      view_users: user.can_view_users,
      edit_users: user.can_edit_users,
      view_finance: user.can_view_finance,
      edit_finance: user.can_edit_finance,
      manage_finance_types: user.can_manage_finance_types,
      void_finance: user.can_void_finance,
      view_cars: user.can_view_cars,
      edit_cars: user.can_edit_cars,
      view_movements: user.can_view_movements,
      create_movements: user.can_create_movements,
      edit_movements: user.can_edit_movements,
      manage_movement_catalogs: user.can_manage_movement_catalogs,
      view_email_templates: user.can_view_email_templates,
      edit_email_templates: user.can_edit_email_templates
    }
  };
}

export async function login({ email, password, req }) {
  const fingerprint = getFingerprint(req);
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";

  if (await isFingerprintBanned(fingerprint)) {
    await logLoginAttempt({ emailAttempt: email, ip, userAgent, fingerprint, status: "banned", reason: "fingerprint banned" });
    throw new Error("Dispositivo temporariamente bloqueado");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    await logLoginAttempt({ emailAttempt: email, ip, userAgent, fingerprint, status: "fail", reason: "invalid user" });
    await maybeBanFingerprint(fingerprint, "muitas falhas");
    throw new Error("Credenciais inválidas");
  }
  if (!user.password_hash) {
    const reset = await requestPasswordReset({ email, req });
    await logLoginAttempt({ userId: user.id, emailAttempt: email, ip, userAgent, fingerprint, status: "fail", reason: "password_not_set" });
    return { requiresReset: true, codeId: reset.codeId, expiresAt: reset.expiresAt, email };
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await logLoginAttempt({ userId: user.id, emailAttempt: email, ip, userAgent, fingerprint, status: "fail", reason: "bad password" });
    await maybeBanFingerprint(fingerprint, "muitas falhas");
    throw new Error("Credenciais inválidas");
  }

  // trusted device?
  const trusted = await findTrustedDevice({ userId: user.id, fingerprint });
  if (trusted) {
    const access = signAccess(user);
    const { plain, tokenHash, expiresAt } = newRefreshPayload();
    await insertRefreshToken({ userId: user.id, tokenHash, expiresAt });
    await logLoginAttempt({ userId: user.id, emailAttempt: email, ip, userAgent, fingerprint, status: "success", reason: "trusted_device" });
    return { user: publicUser(user), access, refreshPlain: plain, refreshExp: expiresAt, trusted: true };
  }

  // generate code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const record = await createTwoFactorCode({
    userId: user.id,
    purpose: "login",
    code,
    expiresAt,
    attempts: 3,
    deviceFingerprint: fingerprint,
    ip
  });
  await sendTwoFactorEmail({ user, code, purpose: "login" });
  await logLoginAttempt({ userId: user.id, emailAttempt: email, ip, userAgent, fingerprint, status: "fail", reason: "2fa_required" });

  return {
    requires2fa: true,
    codeId: record.id,
    expiresAt
  };
}

export async function rotate(refreshPlain) {
  if (!refreshPlain) throw new Error("No refresh token");
  const tokenHash = sha256(refreshPlain);
  const stored = await getRefreshByHash(tokenHash);
  if (!stored || stored.revoked_at || stored.expires_at < new Date()) throw new Error("Invalid refresh");

  await revokeRefreshByHash(tokenHash);
  const user = await getUserById(stored.user_id);
  const access = signAccess(user);
  const { plain, tokenHash: nh, expiresAt } = newRefreshPayload();
  await insertRefreshToken({ userId: user.id, tokenHash: nh, expiresAt });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: {
        view_leads: user.can_view_leads,
        edit_leads: user.can_edit_leads,
        view_clients: user.can_view_clients,
        edit_clients: user.can_edit_clients,
        view_users: user.can_view_users,
        edit_users: user.can_edit_users,
        view_finance: user.can_view_finance,
        edit_finance: user.can_edit_finance,
        manage_finance_types: user.can_manage_finance_types,
        void_finance: user.can_void_finance,
        view_cars: user.can_view_cars,
        edit_cars: user.can_edit_cars,
        view_movements: user.can_view_movements,
        create_movements: user.can_create_movements,
        edit_movements: user.can_edit_movements,
        manage_movement_catalogs: user.can_manage_movement_catalogs
      }
    },
    access,
    refreshPlain: plain,
    refreshExp: expiresAt
  };
}

export async function verifyTwoFactor({ codeId, code, req, rememberDevice = true, purpose = "login" }) {
  const fingerprint = getFingerprint(req);
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const record = await getTwoFactorCode(codeId);
  if (!record) throw new Error("Código inválido");
  if (record.purpose !== purpose) throw new Error("Código incorreto para esta operação");
  if (record.used_at) throw new Error("Código já utilizado");
  if (record.expires_at < new Date()) throw new Error("Código expirado");
  if (record.attempts_left <= 0) throw new Error("Código bloqueado");

  if (await isFingerprintBanned(fingerprint)) {
    await logLoginAttempt({ userId: record.user_id, ip, userAgent, fingerprint, status: "banned", reason: "fingerprint banned" });
    throw new Error("Dispositivo temporariamente bloqueado");
  }

  if (record.code !== code) {
    const updated = await consumeAttempt(codeId);
    await logLoginAttempt({ userId: record.user_id, ip, userAgent, fingerprint, status: "fail", reason: "codigo incorreto" });
    if (updated?.attempts_left <= 0) await maybeBanFingerprint(fingerprint, "codigo 2fa esgotado");
    throw new Error(updated?.attempts_left > 0 ? "Código incorreto" : "Código bloqueado");
  }

  await markUsed(codeId);
  const user = await getUserById(record.user_id);
  if (!user) throw new Error("Usuário não encontrado");

  // Se propósito for login, emitir tokens
  if (purpose === "login") {
    const access = signAccess(user);
    const { plain, tokenHash, expiresAt } = newRefreshPayload();
    await insertRefreshToken({ userId: user.id, tokenHash, expiresAt });
    await logLoginAttempt({ userId: user.id, ip, userAgent, fingerprint, status: "success", reason: "2fa_ok" });
    if (rememberDevice) {
      await createTrustedDevice({ userId: user.id, fingerprint, expiresAt: new Date(Date.now() + trustedExpiryMs()) });
    }
    return { user: publicUser(user), access, refreshPlain: plain, refreshExp: expiresAt };
  }

  // para outras operações apenas valida
  return { ok: true };
}

export async function doLogout(refreshPlain) {
  if (!refreshPlain) return;
  await deleteRefreshByHash(sha256(refreshPlain));
}

export function setAuthCookies(res, { access, refreshPlain, refreshExp }) {
  res.cookie("access_token", access, { ...cookieBase("/"), maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", refreshPlain, { ...cookieBase("/"), expires: refreshExp });
}
export function clearAuthCookies(res) {
  res.clearCookie("access_token", cookieBase("/"));
  res.clearCookie("refresh_token", cookieBase("/"));
}
