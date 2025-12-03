-- Tabela de opcoes para carros (categorias, modelos, fornecedores, tarifas, rastreadores)
CREATE TABLE IF NOT EXISTS car_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- category | model | supplier | rate | tracker
  name TEXT NOT NULL,
  amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, name)
);
