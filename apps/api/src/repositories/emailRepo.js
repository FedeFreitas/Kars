import { query } from "../db/pool.js";

export async function listTemplates() {
  await ensureDefaults();
  const { rows } = await query(
    "SELECT key, subject, text, html, required_placeholders, updated_at FROM email_templates ORDER BY key"
  );
  return rows;
}

export async function getTemplate(key) {
  await ensureDefaults();
  const { rows } = await query(
    "SELECT key, subject, text, html, required_placeholders FROM email_templates WHERE key=$1",
    [key]
  );
  return rows[0] || null;
}

export async function upsertTemplate({ key, subject, text, html }) {
  await ensureDefaults();
  const { rows } = await query(
    `INSERT INTO email_templates (key, subject, text, html, required_placeholders, updated_at)
     VALUES ($1,$2,$3,$4,COALESCE((SELECT required_placeholders FROM email_templates WHERE key=$1), '{}'), now())
     ON CONFLICT (key) DO UPDATE SET subject=EXCLUDED.subject, text=EXCLUDED.text, html=EXCLUDED.html, updated_at=now()
     RETURNING key, subject, text, html, required_placeholders, updated_at`,
    [key, subject, text, html]
  );
  return rows[0];
}

export async function logEmail({ templateKey, to, subject, text, html }) {
  await query(
    `INSERT INTO email_logs (template_key, to_email, subject, text_body, html_body)
     VALUES ($1,$2,$3,$4,$5)`,
    [templateKey || null, to, subject, text || null, html || null]
  );
}

export async function listEmailLogs({ limit = 50, offset = 0 }) {
  await ensureTables();
  const { rows } = await query(
    `SELECT id, template_key, to_email, subject, text_body, html_body, created_at
     FROM email_logs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function ensureDefaults() {
  await ensureTables();
  // Upsert defaults so novas instâncias exibem templates base sem depender de reexecução do init.sql
  await query(
    `INSERT INTO email_templates (key, subject, text, html, required_placeholders, updated_at)
     VALUES
       ('two_factor','Código de acesso (2FA)','Seu código é {{code}}. Ele expira em 10 minutos.',NULL, ARRAY['{{code}}'], now()),
       ('password_change','Código para troca de senha','Seu código é {{code}}. Ele expira em 10 minutos.',NULL, ARRAY['{{code}}'], now()),
       ('welcome_lead','Cadastro recebido na Kars','Recebemos seu cadastro. Crie sua senha: {{reset_link}}',NULL, ARRAY['{{reset_link}}'], now())
     ON CONFLICT (key) DO NOTHING`
  );
}

async function ensureTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS email_templates (
      key TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      text TEXT,
      html TEXT,
      required_placeholders TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS email_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_key TEXT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      text_body TEXT,
      html_body TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
  await query(
    "CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC)"
  );
}

export async function findTemplatesByImage(imagePath) {
  if (!imagePath) return [];
  const like = `%${imagePath}%`;
  const { rows } = await query(
    `SELECT key, subject FROM email_templates WHERE html ILIKE $1`,
    [like]
  );
  return rows;
}
