-- Tabelas de carros e historico de edicoes
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
  tracker BOOLEAN,
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
