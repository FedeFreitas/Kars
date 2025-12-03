import { query } from "../db/pool.js";

const profileSelectAlias = `
  cp.id AS profile_id, cp.user_id AS profile_user_id, cp.nome, cp.tarifa, cp.tipo_tarifa, cp.cobranca_tipo, cp.ciclo_fechamento,
  cp.locacao_inicio, cp.locacao_fim,
  cp.nome_uber, cp.birthdate, cp.cpf,
  cp.rg, cp.cnh, cp.validade_cnh, cp.observacoes, cp.email, cp.email_uber, cp.celular, cp.whatsapp,
  cp.contato_emergencia_nome, cp.contato_emergencia_numero, cp.endereco_rua, cp.endereco_numero,
  cp.endereco_complemento, cp.endereco_cep, cp.endereco_bairro, cp.endereco_cidade,
  cp.endereco_estado, cp.banco_favorecido, cp.banco_cpf_cnpj, cp.banco_nome, cp.banco_agencia,
  cp.banco_conta, cp.banco_digito, cp.banco_tipo, cp.banco_pix, cp.caucao, cp.forma_pagamento, cp.active,
  cp.created_at, cp.updated_at
`;

const profileSelect = `
  id AS profile_id, user_id, nome, tarifa, tipo_tarifa, cobranca_tipo, ciclo_fechamento,
  locacao_inicio, locacao_fim,
  nome_uber, birthdate, cpf,
  rg, cnh, validade_cnh, observacoes, email, email_uber, celular, whatsapp,
  contato_emergencia_nome, contato_emergencia_numero, endereco_rua, endereco_numero,
  endereco_complemento, endereco_cep, endereco_bairro, endereco_cidade,
  endereco_estado, banco_favorecido, banco_cpf_cnpj, banco_nome, banco_agencia,
  banco_conta, banco_digito, banco_tipo, banco_pix, caucao, forma_pagamento, active,
  created_at, updated_at
`;

const userSelect = `
  u.id AS user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role
`;

export async function listClientProfiles({ search }) {
  const params = [];
  let where = "WHERE u.role = 'client'";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (
      COALESCE(cp.nome, u.name, '') ILIKE $1
      OR COALESCE(u.email,'') ILIKE $1
      OR COALESCE(cp.cpf,'') ILIKE $1
      OR COALESCE(cp.whatsapp,'') ILIKE $1
      OR COALESCE(cp.nome_uber,'') ILIKE $1
    )`;
  }
  const { rows } = await query(
    `
    SELECT ${userSelect}, ${profileSelectAlias}
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    ${where}
    ORDER BY COALESCE(cp.updated_at, u.updated_at) DESC
    LIMIT 300
    `,
    params
  );
  return rows;
}

export async function getClientByUserId(userId) {
  const { rows } = await query(
    `
    SELECT ${userSelect}, ${profileSelectAlias}
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE u.id=$1
    `,
    [userId]
  );
  return rows[0] || null;
}

export async function getProfileByUserId(userId) {
  const { rows } = await query(
    `SELECT ${profileSelect} FROM client_profiles WHERE user_id=$1`,
    [userId]
  );
  return rows[0] || null;
}

export async function listTariffOptions() {
  const { rows } = await query(
    `SELECT id, kind, value FROM client_tariff_options ORDER BY kind, value`
  );
  return rows;
}

export async function addTariffOption(kind, value) {
  const { rows } = await query(
    `INSERT INTO client_tariff_options (kind, value)
     VALUES ($1,$2)
     ON CONFLICT (kind, value) DO NOTHING
     RETURNING id, kind, value`,
    [kind, value]
  );
  return rows[0] || { kind, value };
}

export async function upsertClientProfile(userId, data) {
  const cleanData = { ...data };
  delete cleanData.user_id;
  if (cleanData.active === undefined || cleanData.active === null) {
    cleanData.active = true;
  }
  const existing = await getProfileByUserId(userId);
  if (existing) {
    const keys = Object.keys(cleanData);
    if (!keys.length) return existing;
    const assignments = keys.map((k, i) => `${k}=$${i + 2}`);
    const params = [userId, ...keys.map((k) => cleanData[k])];
    const { rows } = await query(
      `UPDATE client_profiles SET ${assignments.join(", ")}, updated_at=NOW() WHERE user_id=$1 RETURNING ${profileSelect}`,
      params
    );
    return rows[0];
  }
  const keys = Object.keys(cleanData);
  const cols = ["user_id", ...keys];
  const vals = [userId, ...keys.map((k) => cleanData[k])];
  const placeholders = vals.map((_, i) => `$${i + 1}`);
  const { rows } = await query(
    `INSERT INTO client_profiles (${cols.join(",")}) VALUES (${placeholders.join(",")}) RETURNING ${profileSelect}`,
    vals
  );
  return rows[0];
}

export async function insertClientHistory(profileId, authorId, diff) {
  await query(
    "INSERT INTO client_profile_history (profile_id, author_id, diff) VALUES ($1,$2,$3)",
    [profileId, authorId || null, diff || null]
  );
}

export async function getClientHistory(profileId, limit = 50) {
  const hasIgnored = await hasIgnoredColumn();
  const sql = hasIgnored
    ? `SELECT h.id, h.profile_id, h.author_id, h.diff, h.created_at,
              u.name AS author_name, u.email AS author_email
       FROM client_profile_history h
       LEFT JOIN users u ON u.id = h.author_id
       WHERE h.profile_id=$1 AND h.ignored_at IS NULL
       ORDER BY h.created_at DESC
       LIMIT $2`
    : `SELECT h.id, h.profile_id, h.author_id, h.diff, h.created_at,
              u.name AS author_name, u.email AS author_email
       FROM client_profile_history h
       LEFT JOIN users u ON u.id = h.author_id
       WHERE h.profile_id=$1
       ORDER BY h.created_at DESC
       LIMIT $2`;

  const { rows } = await query(sql, [profileId, limit]);
  return rows;
}

export async function updateProfileEmailByEmail(oldEmail, newEmail) {
  await query(
    "UPDATE client_profiles SET email=$2, updated_at=NOW() WHERE email=$1",
    [oldEmail, newEmail]
  );
}

export async function updateProfileCpfByEmail(email, cpf) {
  await query(
    "UPDATE client_profiles SET cpf=$2, updated_at=NOW() WHERE email=$1",
    [email, cpf]
  );
}

export async function getClientStats() {
  const { rows: profiles } = await query(
    "SELECT id, created_at FROM client_profiles"
  );
  const hasIgnored = await hasIgnoredColumn();
  const { rows: history } = await query(
    hasIgnored
      ? "SELECT profile_id, diff, created_at FROM client_profile_history WHERE diff ? 'active' AND ignored_at IS NULL ORDER BY created_at ASC"
      : "SELECT profile_id, diff, created_at FROM client_profile_history WHERE diff ? 'active' ORDER BY created_at ASC"
  );

  // constroi eventos e reconstroi estado final apenas com eventos nao ignorados
  const events = [];
  profiles.forEach((p) => events.push({ profile_id: p.id, active: true, created_at: p.created_at }));
  history.forEach((h) => {
    const change = h?.diff?.active;
    if (change && change.to !== undefined) {
      events.push({ profile_id: h.profile_id, active: !!change.to, created_at: h.created_at });
    }
  });

  const state = {};
  events
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((e) => { state[e.profile_id] = e.active; });

  const stats = { active: 0, inactive: 0, total: 0 };
  Object.values(state).forEach((flag) => {
    if (flag) stats.active += 1;
    else stats.inactive += 1;
  });
  stats.total = stats.active + stats.inactive;
  return stats;
}

export async function getClientMonthlyStats(limitMonths = 12) {
  // Baseado no historico de (des)ativacoes: conta eventos de to=true/to=false no diff.active

  const hasIgnored = await hasIgnoredColumn();
  const { rows: history } = await query(
    hasIgnored
      ? "SELECT profile_id, diff, created_at FROM client_profile_history WHERE diff ? 'active' AND ignored_at IS NULL"
      : "SELECT profile_id, diff, created_at FROM client_profile_history WHERE diff ? 'active'"
  );

  const buckets = {};
  const addEvent = (date, active) => {
    if (!date) return;
    const month = new Date(date).toISOString().slice(0, 7);
    if (!month) return;
    if (!buckets[month]) buckets[month] = { active: 0, inactive: 0 };
    if (active) buckets[month].active += 1;
    else buckets[month].inactive += 1;
  };



  history.forEach((h) => {
    const change = h?.diff?.active;
    if (change && change.to !== undefined) {
      addEvent(h.created_at, !!change.to);
    }
  });

  const months = Object.keys(buckets).sort(); // ascendente
  const sliceStart = Math.max(0, months.length - limitMonths);
  return months.slice(sliceStart).map((m) => ({
    month: m,
    active: buckets[m].active || 0,
    inactive: buckets[m].inactive || 0
  }));
}

export async function ignoreClientHistory(id, userId) {
  const hasIgnored = await hasIgnoredColumn();
  if (!hasIgnored) return false;

  const { rowCount } = await query(
    `UPDATE client_profile_history
     SET ignored_at = NOW(), ignored_by = $2
     WHERE id = $1 AND ignored_at IS NULL
     RETURNING id`,
    [id, userId || null]
  );
  return rowCount > 0;
}

async function hasIgnoredColumn() {
  if (hasIgnoredColumn.cache !== undefined) {
    return hasIgnoredColumn.cache;
  }
  const { rows } = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='client_profile_history' AND column_name='ignored_at'
     LIMIT 1`
  );
  hasIgnoredColumn.cache = rows.length > 0;
  return hasIgnoredColumn.cache;
}
