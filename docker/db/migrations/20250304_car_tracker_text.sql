-- Ajusta tracker para texto (ex: fornecedor do rastreador) em vez de boolean
ALTER TABLE cars
  ALTER COLUMN tracker TYPE TEXT USING tracker::text;
