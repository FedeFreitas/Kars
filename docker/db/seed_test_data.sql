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
  JOIN LATERAL (VALUES ('view_finance'), ('edit_finance'), ('manage_finance_types'), ('void_finance'), ('view_clients'), ('edit_clients')) AS p(perm) ON true
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
