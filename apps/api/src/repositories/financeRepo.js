import { pool, query } from "../db/pool.js";

function describeDiff(diff) {
  if (!diff || typeof diff !== "object") return "";
  const parts = [];
  Object.entries(diff).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const from = value.from ?? "-";
    const to = value.to ?? "-";
    const via = value.via ? ` (via ${value.via})` : "";
    parts.push(`${key}: ${from} -> ${to}${via}`);
  });
  return parts.join("; ");
}

const statusExpr = "CASE WHEN e.status = 'pendente' AND e.due_date < CURRENT_DATE THEN 'atrasado' ELSE e.status END";

function mapEntry(row) {
  if (!row) return null;
  return {
    ...row,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
    voided: !!row.voided
  };
}

export async function listTypes() {
  const { rows } = await query(
    `SELECT id, name, kind, description, created_at, updated_at
     FROM finance_entry_types
     ORDER BY name ASC`
  );
  return rows;
}

export async function getTypeById(id) {
  const { rows } = await query(
    `SELECT id, name, kind, description, created_at, updated_at
     FROM finance_entry_types
     WHERE id=$1`,
    [id]
  );
  return rows[0] || null;
}

export async function insertType(data) {
  const { rows } = await query(
    `INSERT INTO finance_entry_types (name, kind, description)
     VALUES ($1,$2,$3)
     RETURNING id, name, kind, description, created_at, updated_at`,
    [data.name, data.kind, data.description || null]
  );
  return rows[0];
}

export async function updateType(id, fields) {
  const keys = Object.keys(fields || {});
  if (!keys.length) return getTypeById(id);
  const assignments = keys.map((k, i) => `${k}=$${i + 1}`);
  const params = keys.map((k) => fields[k]);
  params.push(id);
  const { rows } = await query(
    `UPDATE finance_entry_types
     SET ${assignments.join(", ")}, updated_at=NOW()
     WHERE id=$${params.length}
     RETURNING id`,
    params
  );
  if (!rows[0]) return null;
  return getTypeById(id);
}

export async function getEntryById(id) {
  const { rows } = await query(
    `
    SELECT
      e.id, e.client_id, e.type_id, e.label, e.description, e.kind,
      ${statusExpr} AS status, e.status AS stored_status,
      e.emission_date, e.due_date, e.amount, e.voided,
      e.created_at, e.updated_at,
      t.name AS type_name, t.kind AS type_kind,
      u.email AS client_email, COALESCE(cp.nome, u.name) AS client_name
    FROM finance_entries e
    LEFT JOIN finance_entry_types t ON t.id = e.type_id
    LEFT JOIN users u ON u.id = e.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = e.client_id
    WHERE e.id=$1
    `,
    [id]
  );
  return mapEntry(rows[0]);
}

export async function listEntries(filters = {}) {
  const conditions = [];
  const params = [];
  if (!filters.includeVoided) {
    conditions.push("NOT e.voided");
  }
  if (filters.clientId) {
    params.push(filters.clientId);
    conditions.push(`e.client_id = $${params.length}`);
  }
  if (filters.startDue) {
    params.push(filters.startDue);
    conditions.push(`e.due_date >= $${params.length}`);
  }
  if (filters.endDue) {
    params.push(filters.endDue);
    conditions.push(`e.due_date <= $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (filters.typeId) {
    params.push(filters.typeId);
    conditions.push(`e.type_id = $${params.length}`);
  }
  if (filters.kind) {
    params.push(filters.kind);
    conditions.push(`e.kind = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `
    SELECT
      e.id, e.client_id, e.type_id, e.label, e.description, e.kind,
      ${statusExpr} AS status, e.status AS stored_status,
      e.emission_date, e.due_date, e.amount, e.voided,
      e.created_at, e.updated_at,
      t.name AS type_name, t.kind AS type_kind,
      u.email AS client_email, COALESCE(cp.nome, u.name) AS client_name
    FROM finance_entries e
    LEFT JOIN finance_entry_types t ON t.id = e.type_id
    LEFT JOIN users u ON u.id = e.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = e.client_id
    ${where}
    ORDER BY e.due_date DESC, e.created_at DESC
    LIMIT 500
    `,
    params
  );
  return rows.map(mapEntry);
}

export async function insertEntry(data) {
  const params = [
    data.client_id,
    data.type_id || null,
    data.label,
    data.description || null,
    data.kind,
    data.amount,
    data.emission_date,
    data.due_date,
    data.status || "pendente",
    data.voided || false
  ];
  const { rows } = await query(
    `INSERT INTO finance_entries (client_id, type_id, label, description, kind, amount, emission_date, due_date, status, voided)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    params
  );
  return getEntryById(rows[0]?.id);
}

export async function updateEntry(id, fields) {
  const keys = Object.keys(fields || {});
  if (!keys.length) return getEntryById(id);
  const assignments = keys.map((k, i) => `${k}=$${i + 1}`);
  const params = keys.map((k) => fields[k]);
  params.push(id);
  const { rows } = await query(
    `UPDATE finance_entries
     SET ${assignments.join(", ")}, updated_at=NOW()
     WHERE id=$${params.length}
     RETURNING id`,
    params
  );
  if (!rows[0]) return null;
  return getEntryById(id);
}

export async function insertEntryNote({ entryId, authorId, message }) {
  const { rows } = await query(
    `INSERT INTO finance_entry_notes (entry_id, author_id, message)
     VALUES ($1,$2,$3)
     RETURNING id, entry_id, author_id, message, created_at`,
    [entryId, authorId || null, message]
  );
  return rows[0] || null;
}

export async function listEntryNotes(entryId) {
  const { rows } = await query(
    `SELECT n.id, n.entry_id, n.author_id, n.message, n.created_at,
            u.name AS author_name, u.email AS author_email
     FROM finance_entry_notes n
     LEFT JOIN users u ON u.id = n.author_id
     WHERE n.entry_id=$1
     ORDER BY n.created_at DESC`,
    [entryId]
  );
  return rows;
}

export async function insertEntryHistory({ entryId, authorId, diff }) {
  await query(
    `INSERT INTO finance_entry_history (entry_id, author_id, diff)
     VALUES ($1,$2,$3)`,
    [entryId, authorId || null, diff || null]
  );
}

export async function listEntryHistory(entryId, limit = 50) {
  const { rows } = await query(
    `SELECT h.id, h.entry_id, h.author_id, h.diff, h.created_at,
            u.name AS author_name, u.email AS author_email
     FROM finance_entry_history h
     LEFT JOIN users u ON u.id = h.author_id
     WHERE h.entry_id=$1
     ORDER BY h.created_at DESC
     LIMIT $2`,
    [entryId, limit]
  );
  return rows.map((r) => {
    let description = "";
    try {
      const parsed = typeof r.diff === "string" ? JSON.parse(r.diff) : r.diff;
      description = describeDiff(parsed);
    } catch (e) {
      description = "";
    }
    return { ...r, description };
  });
}

export async function insertClosing({ period_start, period_end, cycle, total, entry_count, client_count, payload }, entryIds = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const closingRes = await client.query(
      `INSERT INTO finance_closings (period_start, period_end, cycle, total, entry_count, client_count, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [period_start, period_end, cycle, total || 0, entry_count || 0, client_count || 0, payload || null]
    );
    const closing = closingRes.rows[0];
    if (entryIds?.length) {
      const values = entryIds.map((id, idx) => `($1,$${idx + 2})`).join(",");
      await client.query(
        `INSERT INTO finance_closing_entries (closing_id, entry_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [closing.id, ...entryIds]
      );
      await client.query(
        `UPDATE finance_entries SET status='em_fechamento', updated_at=now()
         WHERE id = ANY($1::uuid[]) AND status <> 'pago'`,
        [entryIds]
      );
    }
    await client.query("COMMIT");
    return closing;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listClosings() {
  const { rows } = await query(
    `SELECT c.*, COUNT(fce.entry_id) AS entry_count
     FROM finance_closings c
     LEFT JOIN finance_closing_entries fce ON fce.closing_id = c.id
     GROUP BY c.id
     ORDER BY c.period_start DESC, c.created_at DESC
     LIMIT 50`
  );
  return rows;
}

export async function getClosingWithEntries(id) {
  const { rows } = await query(`SELECT * FROM finance_closings WHERE id=$1`, [id]);
  const closing = rows[0];
  if (!closing) return null;
  const payloadEntries = closing.payload?.entries;
  const { rows: entryRows } = await query(
    `SELECT e.*, u.email AS client_email, COALESCE(cp.nome, u.name) AS client_name
     FROM finance_closing_entries fce
     JOIN finance_entries e ON e.id = fce.entry_id
     LEFT JOIN users u ON u.id = e.client_id
     LEFT JOIN client_profiles cp ON cp.user_id = e.client_id
     WHERE fce.closing_id=$1`,
    [id]
  );
  const { rows: sendRows } = await query(
    `SELECT * FROM finance_closing_send_logs WHERE closing_id=$1 ORDER BY created_at DESC`,
    [id]
  );
  const payloadRows = closing.payload?.rows || null;
  return { closing, entries: payloadEntries && payloadEntries.length ? payloadEntries : entryRows.map(mapEntry), rows: payloadRows, send_logs: sendRows };
}

export async function markClosingPaid(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: closingRows } = await client.query(`UPDATE finance_closings SET status='pago', paid_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [id]);
    if (!closingRows[0]) throw new Error("Fechamento nao encontrado");
    await client.query(
      `UPDATE finance_entries SET status='pago', updated_at=now()
       WHERE id IN (SELECT entry_id FROM finance_closing_entries WHERE closing_id=$1)`,
      [id]
    );
    await client.query("COMMIT");
    return closingRows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function cancelClosing(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: closingRows } = await client.query(
      `UPDATE finance_closings SET status='cancelado', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (!closingRows[0]) throw new Error("Fechamento nao encontrado");
    await client.query(
      `UPDATE finance_entries SET status='pendente', updated_at=now()
       WHERE id IN (SELECT entry_id FROM finance_closing_entries WHERE closing_id=$1)`,
      [id]
    );
    await client.query("COMMIT");
    return closingRows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function addEntryToClosing(closingId, entryId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO finance_closing_entries (closing_id, entry_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [closingId, entryId]
    );
    await client.query(
      `UPDATE finance_entries SET status='em_fechamento', updated_at=now() WHERE id=$1 AND status <> 'pago'`,
      [entryId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return getClosingWithEntries(closingId);
}

export async function removeEntryFromClosing(closingId, entryId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM finance_closing_entries WHERE closing_id=$1 AND entry_id=$2`,
      [closingId, entryId]
    );
    await client.query(
      `UPDATE finance_entries SET status='pendente', updated_at=now() WHERE id=$1 AND status='em_fechamento'`,
      [entryId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return getClosingWithEntries(closingId);
}

export async function markClosingClientPaid(closingId, clientId) {
  const { rows: has } = await query(`SELECT 1 FROM finance_closings WHERE id=$1`, [closingId]);
  if (!has[0]) throw new Error("Fechamento nao encontrado");
  await query(
    `UPDATE finance_entries SET status='pago', updated_at=now()
     WHERE id IN (
       SELECT entry_id FROM finance_closing_entries WHERE closing_id=$1
     ) AND client_id=$2`,
    [closingId, clientId]
  );
  return getClosingWithEntries(closingId);
}

export async function updateClosingPayload(id, payload) {
  const { rows } = await query(
    `UPDATE finance_closings SET payload=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, payload || null]
  );
  return rows[0];
}

export async function insertClosingSendLog({ closingId, clientId, email, status, error }) {
  const { rows } = await query(
    `INSERT INTO finance_closing_send_logs (closing_id, client_id, email, status, error)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [closingId, clientId || null, email || null, status, error || null]
  );
  return rows[0];
}

export async function listClosingSendLogs(closingId) {
  const { rows } = await query(
    `SELECT * FROM finance_closing_send_logs WHERE closing_id=$1 ORDER BY created_at DESC`,
    [closingId]
  );
  return rows;
}
