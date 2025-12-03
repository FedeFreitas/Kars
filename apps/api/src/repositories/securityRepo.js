import { query } from "../db/pool.js";

export async function createTwoFactorCode({ userId, purpose, code, expiresAt, attempts = 3, deviceFingerprint, ip }) {
  const { rows } = await query(
    `INSERT INTO two_factor_codes (user_id, purpose, code, expires_at, attempts_left, device_fingerprint, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, purpose, code, expiresAt, attempts, deviceFingerprint || null, ip || null]
  );
  return rows[0];
}

export async function getTwoFactorCode(id) {
  const { rows } = await query("SELECT * FROM two_factor_codes WHERE id=$1", [id]);
  return rows[0] || null;
}

export async function consumeAttempt(id) {
  const { rows } = await query(
    `UPDATE two_factor_codes
       SET attempts_left = GREATEST(attempts_left - 1, 0)
     WHERE id=$1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

export async function markUsed(id) {
  await query("UPDATE two_factor_codes SET used_at = now() WHERE id=$1", [id]);
}

export async function createTrustedDevice({ userId, fingerprint, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO trusted_devices (user_id, fingerprint, expires_at)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, fingerprint) DO UPDATE SET expires_at = EXCLUDED.expires_at
     RETURNING *`,
    [userId, fingerprint, expiresAt]
  );
  return rows[0];
}

export async function findTrustedDevice({ userId, fingerprint }) {
  const { rows } = await query(
    `SELECT * FROM trusted_devices WHERE user_id=$1 AND fingerprint=$2 AND expires_at > now()`,
    [userId, fingerprint]
  );
  return rows[0] || null;
}

export async function logLoginAttempt({ userId, emailAttempt, ip, userAgent, fingerprint, status, reason }) {
  await query(
    `INSERT INTO login_audit (user_id, email_attempt, ip, user_agent, device_fingerprint, status, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId || null, emailAttempt || null, ip || null, userAgent || null, fingerprint || null, status, reason || null]
  );
}

export async function banFingerprint({ fingerprint, reason, ttlMinutes = 60 }) {
  const until = new Date(Date.now() + ttlMinutes * 60000);
  const { rows } = await query(
    `INSERT INTO banned_fingerprints (fingerprint, banned_until, reason)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [fingerprint, until, reason || null]
  );
  return rows[0];
}

export async function isFingerprintBanned(fingerprint) {
  if (!fingerprint) return false;
  const { rows } = await query(
    `SELECT 1 FROM banned_fingerprints WHERE fingerprint=$1 AND banned_until > now()`,
    [fingerprint]
  );
  return !!rows[0];
}

export async function countRecentFailures({ fingerprint, minutes = 15 }) {
  const { rows } = await query(
    `SELECT count(*)::int AS qty
       FROM login_audit
      WHERE status='fail'
        AND (device_fingerprint = $1 OR $1 IS NULL)
        AND created_at > now() - make_interval(mins => $2)`,
    [fingerprint || null, minutes]
  );
  return rows[0]?.qty || 0;
}
