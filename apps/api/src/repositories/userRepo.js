import { query } from "../db/pool.js";

const userFields = `
  id, email, name, role, password_hash, created_at
`;

function defaultPermissionsForRole(role) {
  // Nenhum papel recebe permissoes por default; tudo configurado de forma granular
  return [];
}

async function applyPermissions(userId, permKeys) {
  await query("DELETE FROM user_permissions WHERE user_id=$1", [userId]);
  if (!permKeys?.length) return;
  const values = permKeys.map((p, i) => `($1, $${i + 2}, true)`);
  await query(
    `INSERT INTO user_permissions (user_id, perm_key, allowed) VALUES ${values.join(",")}`,
    [userId, ...permKeys]
  );
}

async function fetchPermissions(userId) {
  const { rows } = await query(
    "SELECT perm_key, allowed FROM user_permissions WHERE user_id=$1",
    [userId]
  );
  const map = {};
  rows.forEach((r) => { map[r.perm_key] = !!r.allowed; });
  return {
    can_view_leads: !!map.view_leads,
    can_edit_leads: !!map.edit_leads,
    can_view_clients: !!map.view_clients,
    can_edit_clients: !!map.edit_clients,
    can_view_users: !!map.view_users,
    can_edit_users: !!map.edit_users,
    can_view_finance: !!map.view_finance,
    can_edit_finance: !!map.edit_finance,
    can_manage_finance_types: !!map.manage_finance_types,
    can_void_finance: !!map.void_finance,
    can_view_cars: !!map.view_cars,
    can_edit_cars: !!map.edit_cars,
    can_view_movements: !!map.view_movements,
    can_create_movements: !!map.create_movements,
    can_edit_movements: !!map.edit_movements,
    can_manage_movement_catalogs: !!map.manage_movement_catalogs,
    can_view_email_templates: !!map.view_email_templates,
    can_edit_email_templates: !!map.edit_email_templates
  };
}

export async function findUserByEmail(email) {
  const { rows } = await query(`SELECT ${userFields} FROM users WHERE email=$1`, [email]);
  if (!rows[0]) return null;
  const perms = await fetchPermissions(rows[0].id);
  return { ...rows[0], ...perms };
}

export async function updateUserEmailByEmail(oldEmail, newEmail) {
  const { rows } = await query(
    `UPDATE users SET email=$2, updated_at=NOW() WHERE email=$1 RETURNING ${userFields}`,
    [oldEmail, newEmail]
  );
  if (!rows[0]) return null;
  const perms = await fetchPermissions(rows[0].id);
  return { ...rows[0], ...perms };
}

export async function updateUserEmailById(id, newEmail) {
  const { rows } = await query(
    `UPDATE users SET email=$2, updated_at=NOW() WHERE id=$1 RETURNING ${userFields}`,
    [id, newEmail]
  );
  if (!rows[0]) return null;
  const perms = await fetchPermissions(id);
  return { ...rows[0], ...perms };
}
export async function createUser({ email, name, passwordHash, role = "pending" }) {
  const perms = defaultPermissionsForRole(role);
  const sql = `
    INSERT INTO users (email, name, password_hash, role)
    VALUES ($1,$2,$3,$4)
    RETURNING ${userFields}`;
  const { rows } = await query(sql, [
    email,
    name || null,
    passwordHash || null,
    role
  ]);
  const user = rows[0];
  await applyPermissions(user.id, perms);
  return { ...user, ...(await fetchPermissions(user.id)) };
}

export async function insertRefreshToken({ userId, tokenHash, expiresAt }) {
  const sql = `
    INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
    VALUES ($1,$2,$3) RETURNING id`;
  await query(sql, [tokenHash, userId, expiresAt]);
}

export async function getRefreshByHash(tokenHash) {
  const { rows } = await query(
    "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash=$1",
    [tokenHash]
  );
  return rows[0] || null;
}

export async function revokeRefreshByHash(tokenHash) {
  await query("UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1", [tokenHash]);
}
export async function deleteRefreshByHash(tokenHash) {
  await query("DELETE FROM refresh_tokens WHERE token_hash=$1", [tokenHash]);
}
export async function getUserById(id) {
  const { rows } = await query(`SELECT ${userFields} FROM users WHERE id=$1`, [id]);
  if (!rows[0]) return null;
  const perms = await fetchPermissions(id);
  return { ...rows[0], ...perms };
}

export async function listUsers() {
  const { rows } = await query(
    `SELECT ${userFields} FROM users ORDER BY created_at DESC`
  );
  const result = [];
  for (const row of rows) {
    const perms = await fetchPermissions(row.id);
    result.push({ ...row, ...perms });
  }
  return result;
}

export async function updateUserRole(id, role) {
  const permKeys = defaultPermissionsForRole(role);
  const { rows } = await query(
    `UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING ${userFields}`,
    [role, id]
  );
  const user = rows[0] || null;
  if (!user) return null;
  await applyPermissions(id, permKeys);
  return { ...user, ...(await fetchPermissions(id)) };
}

export async function deleteRefreshByUserId(userId) {
  await query("DELETE FROM refresh_tokens WHERE user_id=$1", [userId]);
}

export async function setUserPassword(id, passwordHash) {
  const { rows } = await query(
    `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 RETURNING ${userFields}`,
    [passwordHash, id]
  );
  const user = rows[0] || null;
  if (!user) return null;
  const perms = await fetchPermissions(id);
  return { ...user, ...perms };
}

export async function updateUserName(id, name) {
  const { rows } = await query(
    `UPDATE users SET name=$2, updated_at=NOW() WHERE id=$1 RETURNING ${userFields}`,
    [id, name]
  );
  const user = rows[0] || null;
  if (!user) return null;
  const perms = await fetchPermissions(id);
  return { ...user, ...perms };
}

export async function upsertLeadUser({ email, name }) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, name, passwordHash: null, role: "client" });
}

export async function ensureClientRoleByEmail(email) {
  const u = await findUserByEmail(email);
  if (!u) return null;
  if (u.role === "pending") {
    const permKeys = defaultPermissionsForRole("client");
    const { rows } = await query(
      `UPDATE users SET role='client', updated_at=NOW()
       WHERE email=$1
       RETURNING ${userFields}`,
      [email]
    );
    if (rows[0]) {
      await applyPermissions(rows[0].id, permKeys);
      return { ...rows[0], ...(await fetchPermissions(rows[0].id)) };
    }
  }
  return u;
}

export async function updateUserPermissions(id, perms) {
  const fields = Object.keys(perms || {}).filter((k) => perms[k] !== undefined);
  if (!fields.length) return getUserById(id);
  const permKeyMap = {
    can_view_leads: "view_leads",
    can_edit_leads: "edit_leads",
    can_view_clients: "view_clients",
    can_edit_clients: "edit_clients",
    can_view_users: "view_users",
    can_edit_users: "edit_users",
    can_view_finance: "view_finance",
    can_edit_finance: "edit_finance",
    can_manage_finance_types: "manage_finance_types",
    can_void_finance: "void_finance",
    can_view_cars: "view_cars",
    can_edit_cars: "edit_cars",
    can_view_movements: "view_movements",
    can_create_movements: "create_movements",
    can_edit_movements: "edit_movements",
    can_manage_movement_catalogs: "manage_movement_catalogs",
    can_view_email_templates: "view_email_templates",
    can_edit_email_templates: "edit_email_templates"
  };
  // upsert each permission key
  for (const key of fields) {
    const allowed = !!perms[key];
    const permKey = permKeyMap[key] || key.replace("can_", "").replace("can-", "").replace("can", "");
    await query(
      `INSERT INTO user_permissions (user_id, perm_key, allowed)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, perm_key) DO UPDATE SET allowed=EXCLUDED.allowed, updated_at=NOW()`,
      [id, permKey.startsWith("_") ? permKey.slice(1) : permKey, allowed]
    );
  }
  return getUserById(id);
}
