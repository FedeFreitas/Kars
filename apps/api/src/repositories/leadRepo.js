import { query } from "../db/pool.js";

const baseSelect = `
  id, name, cpf, birthdate, phone, email, user_id, city, ear, uber,
  stage, stage_entered_at, created_at, updated_at
`;

export async function createLead(data) {
  const sql = `
    INSERT INTO leads (name, cpf, birthdate, phone, email, user_id, city, ear, uber, stage)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING ${baseSelect}`;
  const params = [
    data.name,
    data.cpf || null,
    data.birthdate || null,
    data.phone,
    data.email,
    data.user_id || null,
    data.city || null,
    data.ear || null,
    data.uber || null,
    data.stage || "created"
  ];
  const { rows } = await query(sql, params);
  return rows[0];
}

export async function getLead(id) {
  const { rows } = await query(`SELECT ${baseSelect} FROM leads WHERE id=$1`, [id]);
  return rows[0] || null;
}

export async function listLeads({ stage, search }) {
  const parts = [];
  const params = [];
  if (stage) {
    params.push(stage);
    parts.push(`stage = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    parts.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR city ILIKE $${params.length} OR cpf ILIKE $${params.length})`);
  }
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT ${baseSelect} FROM leads ${where} ORDER BY updated_at DESC LIMIT 200`,
    params
  );
  return rows;
}

export async function updateLead(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getLead(id);
  const assignments = keys.map((k, i) => `${k}=$${i + 1}`);
  const params = keys.map((k) => fields[k]);
  params.push(id);
  const sql = `
    UPDATE leads SET ${assignments.join(", ")}, updated_at=NOW()
    WHERE id=$${params.length}
    RETURNING ${baseSelect}`;
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

export async function updateLeadsEmail(oldEmail, newEmail) {
  await query(
    "UPDATE leads SET email=$2, updated_at=NOW() WHERE email=$1",
    [oldEmail, newEmail]
  );
}

export async function updateLeadsCpfByEmail(email, cpf) {
  await query(
    "UPDATE leads SET cpf=$2, updated_at=NOW() WHERE email=$1",
    [email, cpf]
  );
}

export async function getLeadByEmail(email) {
  const { rows } = await query("SELECT " + baseSelect + " FROM leads WHERE email=$1 ORDER BY created_at DESC LIMIT 1", [email]);
  return rows[0] || null;
}

export async function getLeadByCpf(cpf) {
  const { rows } = await query("SELECT " + baseSelect + " FROM leads WHERE cpf=$1 ORDER BY created_at DESC LIMIT 1", [cpf]);
  return rows[0] || null;
}

export async function moveLeadStage(id, toStage) {
  const { rows } = await query(
    `UPDATE leads
     SET stage=$1, stage_entered_at=NOW(), updated_at=NOW()
     WHERE id=$2
     RETURNING ${baseSelect}`,
    [toStage, id]
  );
  return rows[0] || null;
}

export async function insertNote({ leadId, authorId, message }) {
  const { rows } = await query(
    `INSERT INTO lead_notes (lead_id, author_id, message)
     VALUES ($1,$2,$3)
     RETURNING id, lead_id, author_id, message, created_at`,
    [leadId, authorId || null, message]
  );
  return rows[0];
}

export async function getNotes(leadId) {
  const { rows } = await query(
    `SELECT n.id, n.lead_id, n.author_id, n.message, n.created_at,
            u.name AS author_name, u.email AS author_email
     FROM lead_notes n
     LEFT JOIN users u ON u.id = n.author_id
     WHERE n.lead_id=$1
     ORDER BY n.created_at DESC`,
    [leadId]
  );
  return rows;
}

export async function insertEvent({ leadId, authorId, type, fromStage, toStage, diff }) {
  await query(
    `INSERT INTO lead_events (lead_id, author_id, type, from_stage, to_stage, diff)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [leadId, authorId || null, type, fromStage || null, toStage || null, diff || null]
  );
}

export async function getEvents(leadId, limit = 50) {
  const { rows } = await query(
    `SELECT e.id, e.lead_id, e.author_id, e.type, e.from_stage, e.to_stage, e.diff, e.created_at,
            u.name AS author_name, u.email AS author_email
     FROM lead_events e
     LEFT JOIN users u ON u.id = e.author_id
     WHERE e.lead_id=$1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [leadId, limit]
  );
  return rows;
}

export async function archiveStale(thresholdDays = 90) {
  await query(
    `UPDATE leads
     SET stage='archived', stage_entered_at=NOW(), updated_at=NOW()
     WHERE stage IN ('rented','not_rented')
       AND stage_entered_at < NOW() - ($1 || ' days')::interval`,
    [thresholdDays]
  );
}
