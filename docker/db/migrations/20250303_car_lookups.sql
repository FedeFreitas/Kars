-- Tabela generica de opcoes para carros (categoria, modelo, tarifa, fornecedor, rastreador)
CREATE TABLE IF NOT EXISTS car_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- category | model | rate | supplier | tracker
  label TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, label)
);

CREATE INDEX IF NOT EXISTS idx_car_lookups_kind ON car_lookups(kind);
