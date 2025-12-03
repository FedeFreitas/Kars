CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT, -- pode ser preenchida apos lead criar conta
  role TEXT NOT NULL DEFAULT 'pending', -- pending | viewer | editor | admin | client
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissoes verticais (um registro por acesso)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, perm_key)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);

-- 2FA codes
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, -- login | password_change
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts_left INT NOT NULL DEFAULT 3,
  used_at TIMESTAMPTZ,
  device_fingerprint TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_two_factor_user ON two_factor_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_exp ON two_factor_codes(expires_at);

-- trusted devices (lembrar dispositivo por 24h)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);

-- audit de login
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email_attempt TEXT,
  ip TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  status TEXT NOT NULL, -- success | fail | banned
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_fingerprint ON login_audit(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_login_audit_ip ON login_audit(ip);

-- dispositivos/ip banidos
CREATE TABLE IF NOT EXISTS banned_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  banned_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_banned_fingerprint_until ON banned_fingerprints(banned_until);

-- Leads (funil de locação)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  birthdate DATE,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  city TEXT,
  ear TEXT,
  uber TEXT,
  stage TEXT NOT NULL DEFAULT 'created',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_cpf ON leads(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(city,'')));
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_user ON leads(user_id) WHERE user_id IS NOT NULL;

-- Perfis de cliente (dados estendidos)
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT,
  tarifa TEXT,
  tipo_tarifa TEXT,
  nome_uber TEXT,
  birthdate DATE,
  cpf TEXT,
  rg TEXT,
  cnh TEXT,
  validade_cnh DATE,
  observacoes TEXT,
  email TEXT,
  email_uber TEXT,
  celular TEXT,
  whatsapp TEXT,
  contato_emergencia_nome TEXT,
  contato_emergencia_numero TEXT,
  endereco_rua TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_cep TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  banco_favorecido TEXT,
  banco_cpf_cnpj TEXT,
  banco_nome TEXT,
  banco_agencia TEXT,
  banco_conta TEXT,
  banco_digito TEXT,
  banco_tipo TEXT,
  banco_pix TEXT,
  caucao TEXT,
  forma_pagamento TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- normaliza registros legados sem active
UPDATE client_profiles SET active = true WHERE active IS NULL;

-- garantimos coluna nome mesmo em bancos antigos
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS cobranca_tipo TEXT DEFAULT 'pos';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS ciclo_fechamento TEXT DEFAULT 'semanal';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS locacao_inicio DATE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS locacao_fim DATE;

CREATE TABLE IF NOT EXISTS client_tariff_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- tarifa | tipo_tarifa
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, value)
);

-- Opções padrão de tarifa e tipo de tarifa
INSERT INTO client_tariff_options (kind, value)
VALUES
  ('tipo_tarifa', 'diario'),
  ('tipo_tarifa', 'semanal'),
  ('tipo_tarifa', 'mensal'),
  ('tarifa', '200.00'),
  ('tarifa', '350.00'),
  ('tarifa', '500.00')
ON CONFLICT (kind, value) DO NOTHING;

CREATE TABLE IF NOT EXISTS client_profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  author_id UUID,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas para ignorar eventos (ocultar de KPIs/visualizacoes)
ALTER TABLE client_profile_history
  ADD COLUMN IF NOT EXISTS ignored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ignored_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_client_history_active_visible
  ON client_profile_history ((diff->'active'))
  WHERE ignored_at IS NULL;

-- Triggers para garantir consistencia de email/CPF entre users, leads e client_profiles
CREATE OR REPLACE FUNCTION trg_users_email_cascade() RETURNS trigger AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE leads SET email = NEW.email, updated_at = now() WHERE user_id = NEW.id;
    UPDATE client_profiles SET email = NEW.email, updated_at = now() WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_leads_consistency() RETURNS trigger AS $$
DECLARE u_email TEXT;
DECLARE p_cpf TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT id, email INTO NEW.user_id, u_email FROM users WHERE email = NEW.email;
  ELSE
    SELECT email INTO u_email FROM users WHERE id = NEW.user_id;
  END IF;
  IF u_email IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado para lead (email %)', NEW.email;
  END IF;
  IF NEW.email IS DISTINCT FROM u_email THEN
    RAISE EXCEPTION 'Email do lead deve ser igual ao email do usuario';
  END IF;
  SELECT cpf INTO p_cpf FROM client_profiles WHERE user_id = NEW.user_id;
  IF p_cpf IS NOT NULL AND NEW.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM p_cpf THEN
    RAISE EXCEPTION 'CPF do lead deve ser igual ao CPF do client_profile';
  END IF;
  IF p_cpf IS NOT NULL AND NEW.cpf IS NULL THEN
    NEW.cpf := p_cpf;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_client_profile_consistency() RETURNS trigger AS $$
DECLARE u_email TEXT;
DECLARE l_cpf TEXT;
BEGIN
  SELECT email INTO u_email FROM users WHERE id = NEW.user_id;
  IF u_email IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado para client_profile (user_id %)', NEW.user_id;
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM u_email THEN
    RAISE EXCEPTION 'Email do client_profile deve ser igual ao email do usuario';
  ELSE
    NEW.email := u_email;
  END IF;
  SELECT cpf INTO l_cpf FROM leads WHERE user_id = NEW.user_id;
  IF l_cpf IS NOT NULL AND NEW.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM l_cpf THEN
    RAISE EXCEPTION 'CPF do client_profile deve ser igual ao CPF do lead';
  END IF;
  IF l_cpf IS NOT NULL AND NEW.cpf IS NULL THEN
    NEW.cpf := l_cpf;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_email_cascade ON users;
CREATE TRIGGER trg_users_email_cascade AFTER UPDATE OF email ON users FOR EACH ROW EXECUTE FUNCTION trg_users_email_cascade();

DROP TRIGGER IF EXISTS trg_leads_consistency ON leads;
CREATE TRIGGER trg_leads_consistency BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION trg_leads_consistency();

DROP TRIGGER IF EXISTS trg_client_profile_consistency ON client_profiles;
CREATE TRIGGER trg_client_profile_consistency BEFORE INSERT OR UPDATE ON client_profiles FOR EACH ROW EXECUTE FUNCTION trg_client_profile_consistency();

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id UUID,
  type TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);

-- Tipos e lancamentos financeiros
CREATE TABLE IF NOT EXISTS finance_entry_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('credit','debit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id UUID REFERENCES finance_entry_types(id),
  label TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('credit','debit')),
  amount NUMERIC(12,2) NOT NULL,
  emission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado','em_fechamento')),
  voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_client ON finance_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_due ON finance_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status ON finance_entries(status);

CREATE TABLE IF NOT EXISTS finance_entry_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES finance_entries(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_entry_notes_entry ON finance_entry_notes(entry_id);

CREATE TABLE IF NOT EXISTS finance_entry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES finance_entries(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_entry_history_entry ON finance_entry_history(entry_id);

-- Fechamentos financeiros
CREATE TABLE IF NOT EXISTS finance_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'semanal',
  status TEXT NOT NULL DEFAULT 'gerado' CHECK (status IN ('gerado','pago','enviado','cancelado')),
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  entry_count INT NOT NULL DEFAULT 0,
  client_count INT NOT NULL DEFAULT 0,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS finance_closing_entries (
  closing_id UUID NOT NULL REFERENCES finance_closings(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES finance_entries(id) ON DELETE CASCADE,
  PRIMARY KEY (closing_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_closing_entries_entry ON finance_closing_entries(entry_id);

CREATE TABLE IF NOT EXISTS finance_closing_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES finance_closings(id) ON DELETE CASCADE,
  client_id UUID,
  email TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opcoes lookup de carros (categorias, modelos, tarifas, fornecedores, rastreadores)
CREATE TABLE IF NOT EXISTS car_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- category | model | rate | supplier | tracker
  label TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, label)
);
CREATE INDEX IF NOT EXISTS idx_car_lookups_kind ON car_lookups(kind);

-- Opcoes, carros e historico de edicoes de carros
CREATE TABLE IF NOT EXISTS car_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- category | model | supplier | rate | tracker
  name TEXT NOT NULL,
  amount NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, name)
);

CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT UNIQUE NOT NULL,
  category TEXT,
  renavam TEXT,
  model TEXT,
  year_fabrication INT,
  year_model INT,
  supplier TEXT,
  fuel TEXT,
  tracker TEXT,
  spare_key BOOLEAN,
  color TEXT,
  status TEXT,
  displacement TEXT,
  version TEXT,
  rate NUMERIC(12,2),
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS car_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cars_plate ON cars(plate);
CREATE INDEX IF NOT EXISTS idx_car_history_car ON car_history(car_id);

-- Movimentacoes de carros (associacoes com clientes/fornecedores/officina etc) e historico
CREATE TABLE IF NOT EXISTS car_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  km INT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  obs TEXT,
  client_id UUID REFERENCES users(id), -- parceiro/finalizado
  client_rate NUMERIC(12,2),
  is_reserve BOOLEAN,
  shop_id UUID REFERENCES car_options(id), -- oficina
  service_type TEXT, -- Funilaria, Mecanica, Funilaria/Mecanica
  service_eta TEXT, -- imediata, 1-7 dias, 8-14 dias, 15-21 dias, 22-28 dias, >28 dias
  tow_id UUID REFERENCES car_options(id), -- guincho
  yard_id UUID REFERENCES car_options(id), -- patio
  yard_availability TEXT, -- disponivel/indisponivel
  team_id UUID REFERENCES car_options(id), -- equipe
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_car_movements_car ON car_movements(car_id);
CREATE INDEX IF NOT EXISTS idx_car_movements_date ON car_movements(movement_date DESC);

CREATE TABLE IF NOT EXISTS car_movement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES car_movements(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_car_movement_history_movement ON car_movement_history(movement_id);

-- Emails: templates e logs
CREATE TABLE IF NOT EXISTS email_templates (
  key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  text TEXT,
  html TEXT,
  required_placeholders TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO email_templates (key, subject, text, html, required_placeholders)
VALUES
  ('two_factor', 'Código de acesso (2FA)', 'Seu código é {{code}}. Ele expira em 10 minutos.', NULL, ARRAY['{{code}}']),
  ('password_change', 'Código para troca de senha', 'Seu código é {{code}}. Ele expira em 10 minutos.', NULL, ARRAY['{{code}}']),
  ('welcome_lead', 'Cadastro recebido na Kars', 'Recebemos seu cadastro. Crie sua senha: {{reset_link}}', NULL, ARRAY['{{reset_link}}'])
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);




/* Dados de teste */
-- Seed de dados de teste para ambiente local
-- Gera ~110 clientes (users/leads/client_profiles), 10 admins, 10 pendentes e 10 tipos padrão + 100 lançamentos

-- Usuarios base (admin, pending, clients)
WITH ins_users AS (
  INSERT INTO users (email, name, role, password_hash)
  SELECT concat('admin', lpad(gs::text, 2, '0'), '@example.com'), 'Admin ' || gs, 'admin', NULL FROM generate_series(1, 10) gs
  UNION ALL
  SELECT concat('pending', lpad(gs::text, 2, '0'), '@example.com'), 'Pending ' || gs, 'pending', NULL FROM generate_series(1, 10) gs
  UNION ALL
  SELECT concat('client', lpad(gs::text, 3, '0'), '@example.com'), 'Client ' || gs, 'client', NULL FROM generate_series(1, 110) gs
  ON CONFLICT (email) DO NOTHING
  RETURNING id, email, name, role
),
admins AS (
  SELECT id FROM (
    SELECT id, email FROM users WHERE email LIKE 'admin%'::text
    UNION
    SELECT id, email FROM ins_users WHERE role = 'admin'
  ) a
),
-- Permissoes para admins (finance completo)
perm_admin AS (
  INSERT INTO user_permissions (user_id, perm_key, allowed)
  SELECT a.id, p.perm, true
  FROM admins a
  JOIN LATERAL (VALUES ('view_finance'), ('edit_finance'), ('manage_finance_types'), ('void_finance'), ('view_clients'), ('edit_clients'),('view_users'),('edit_users'),('edit_leads'),('view_leads')) AS p(perm) ON true
  ON CONFLICT (user_id, perm_key) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
),
-- Clientes para leads/profiles
clients AS (
  SELECT id, email, name, row_number() OVER (ORDER BY email) AS rn
  FROM (
    SELECT id, email, name FROM users WHERE email LIKE 'client%'::text
    UNION
    SELECT id, email, name FROM ins_users WHERE role = 'client'
  ) c
),
ins_leads AS (
  INSERT INTO leads (name, cpf, birthdate, phone, email, user_id, city, ear, uber, stage, stage_entered_at, created_at, updated_at)
  SELECT
    c.name,
    format('0000000%05s', c.rn),
    date '1980-01-01' + ((c.rn % 100) || ' days')::interval,
    format('+55 (11) 90000-%04s', c.rn),
    c.email,
    c.id,
    'Sao Paulo',
    'yes',
    'yes',
    base.stage_choice,
    rnd.stage_dt,
    base.created_dt,
    rnd.stage_dt
  FROM clients c
  CROSS JOIN LATERAL (
    SELECT
      (date '2025-01-01' + make_interval(days => trunc(random() * 365)::int)) AS created_dt,
      CASE
        WHEN r < 0.2 THEN 'created'
        WHEN r < 0.4 THEN 'contact'
        WHEN r < 0.6 THEN 'rented'
        WHEN r < 0.8 THEN 'not_rented'
        ELSE 'archived'
      END AS stage_choice,
      trunc(random() * 60)::int AS delta_stage
    FROM (SELECT random() AS r) t
  ) base
  CROSS JOIN LATERAL (
    SELECT LEAST(date '2025-12-31', base.created_dt + make_interval(days => (5 + base.delta_stage))) AS stage_dt
  ) rnd
  ON CONFLICT DO NOTHING
  RETURNING id, user_id
),
ins_profiles AS (
  INSERT INTO client_profiles (user_id, nome, email, cpf, whatsapp, endereco_cidade, active, created_at, updated_at)
  SELECT
    c.id,
    c.name,
    c.email,
    format('0000000%05s', c.rn),
    format('+55 (11) 9%08s', c.rn),
    'Sao Paulo',
    profile_data.active_flag,
    base.activation_dt,
    profile_data.status_dt
  FROM clients c
  CROSS JOIN LATERAL (
    SELECT
      (date '2025-01-01' + make_interval(days => trunc(random() * 365)::int)) AS activation_dt,
      (random() < 0.25) AS inactive_flag,
      trunc(random() * 200)::int AS delta_change
  ) base
  CROSS JOIN LATERAL (
    SELECT
      NOT base.inactive_flag AS active_flag,
      CASE
        WHEN base.inactive_flag THEN LEAST(date '2025-12-31', base.activation_dt + make_interval(days => (5 + base.delta_change)))
        ELSE LEAST(date '2025-12-31', base.activation_dt + make_interval(days => trunc(random() * 30)::int))
      END AS status_dt
  ) profile_data
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id, user_id
),
-- Tipos padrao (10)
ins_types AS (
  INSERT INTO finance_entry_types (name, kind, description)
  VALUES
    ('Mensalidade', 'debit', 'Mensalidade recorrente'),
    ('Caucao', 'credit', 'Deposito de caucao'),
    ('Multa', 'debit', 'Multas diversas'),
    ('Desconto fidelidade', 'credit', 'Bonus de fidelidade'),
    ('Uber repasse', 'credit', 'Repasse Uber'),
    ('Manutencao', 'debit', 'Custos de manutencao'),
    ('Ajuste contábil', 'credit', 'Ajustes eventuais'),
    ('Combustivel', 'debit', 'Reembolso de combustivel'),
    ('Saldo extra', 'credit', 'Saldo complementar'),
    ('Outros debitos', 'debit', 'Debitos diversos')
  ON CONFLICT DO NOTHING
  RETURNING id, name, kind
),
types AS (
  SELECT id, name, kind FROM finance_entry_types
),
-- Lancamentos financeiros (100)
ins_entries AS (
  INSERT INTO finance_entries (client_id, type_id, label, description, kind, amount, emission_date, due_date, status, voided)
  SELECT
    c.id,
    (SELECT id FROM types ORDER BY random() LIMIT 1),
    format('Lancamento %s-%s', c.rn, n),
    'Gerado automaticamente para testes',
    CASE WHEN random() < 0.45 THEN 'credit' ELSE 'debit' END,
    round((random() * 900 + 100)::numeric, 2),
    (date '2025-01-01' + make_interval(days => (trunc(random() * 365))::int)),
    (date '2025-01-01' + make_interval(days => ((trunc(random() * 365))::int + (5 + trunc(random() * 40)::int)))),
    (ARRAY['pendente','pago','atrasado','cancelado'])[ceil(random() * 4)],
    (random() < 0.12)
  FROM clients c
  CROSS JOIN LATERAL generate_series(1, (floor(random() * 3)::int + 1)) g(n)
  ON CONFLICT DO NOTHING
  RETURNING id
),
-- Opcoes de carros
car_opts AS (
  INSERT INTO car_options (kind, name, amount)
  VALUES
    ('category','Econômico',NULL),('category','SUV',NULL),('category','Sedan',NULL),
    ('model','Onix',NULL),('model','HB20',NULL),('model','Corolla',NULL),('model','Renegade',NULL),
    ('supplier','Localiza',NULL),('supplier','Unidas',NULL),('supplier','Movida',NULL),
    ('rate','Diária Básica',150.00),('rate','Diária Plus',220.00),('rate','Diária Premium',320.00),
    ('tracker','Tracker A',NULL),('tracker','Tracker B',NULL)
  ON CONFLICT (kind,name) DO NOTHING
  RETURNING id, kind, name, amount
),
cats AS (SELECT name FROM car_options WHERE kind='category'),
models AS (SELECT name FROM car_options WHERE kind='model'),
suppliers AS (SELECT name FROM car_options WHERE kind='supplier'),
rates AS (SELECT name, amount FROM car_options WHERE kind='rate'),
trackers AS (SELECT name FROM car_options WHERE kind='tracker'),
ins_cars AS (
  INSERT INTO cars (plate, category, renavam, model, year_fabrication, year_model, supplier, fuel, tracker, spare_key, color, status, displacement, version, rate, notes, image_url, created_at, updated_at)
  SELECT
    format('ABC%04s', gs),
    (SELECT name FROM cats ORDER BY random() LIMIT 1),
    format('REN%08s', gs),
    (SELECT name FROM models ORDER BY random() LIMIT 1),
    2010 + (gs % 15),
    2011 + (gs % 15),
    (SELECT name FROM suppliers ORDER BY random() LIMIT 1),
    (ARRAY['GNV','FLEX','Elétrico','Híbrido'])[ceil(random() * 4)],
    (SELECT name FROM trackers ORDER BY random() LIMIT 1),
    (random() < 0.6),
    (ARRAY['Branco','Preto','Prata','Cinza','Azul','Vermelho','Verde','Amarelo','Marrom','Bege'])[ceil(random() * 10)],
    (ARRAY['Disponivel','Indisponivel'])[ceil(random() * 2)],
    (ARRAY['1.0','1.2','1.4','1.6','1.8','2.0','2.2','2.4','2.8','3.0','3.6','4.0+'])[ceil(random() * 12)],
    (ARRAY['Sedan','Hatch','SUV','Pickup','Coupé','Minivan'])[ceil(random() * 6)],
    COALESCE((SELECT amount FROM rates ORDER BY random() LIMIT 1), 200),
    'Gerado automaticamente',
    NULL,
    (date '2025-01-01' + make_interval(days => (trunc(random() * 365))::int)),
    (date '2025-01-01' + make_interval(days => (trunc(random() * 365))::int))
  FROM generate_series(1, 30) gs
  ON CONFLICT (plate) DO NOTHING
  RETURNING id, plate
),
ins_car_history AS (
  INSERT INTO car_history (car_id, author_id, diff, created_at)
  SELECT
    c.id,
    NULL,
    jsonb_build_object('status', jsonb_build_object('from', null, 'to', 'Disponivel')),
    (date '2025-01-01' + make_interval(days => (trunc(random() * 365))::int))
  FROM ins_cars c
  ON CONFLICT DO NOTHING
  RETURNING id
)
SELECT
  (SELECT count(*) FROM ins_users) AS new_users,
  (SELECT count(*) FROM ins_leads) AS new_leads,
  (SELECT count(*) FROM ins_profiles) AS new_profiles,
  (SELECT count(*) FROM ins_types) AS new_types,
  (SELECT count(*) FROM ins_entries) AS new_entries,
  (SELECT count(*) FROM ins_cars) AS new_cars,
  (SELECT count(*) FROM ins_car_history) AS new_car_history;
