-- Marca eventos de historico de cliente como ignorados (removidos de KPIs/visualizacao)
ALTER TABLE client_profile_history
  ADD COLUMN IF NOT EXISTS ignored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ignored_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_client_history_active_visible
  ON client_profile_history ((diff->'active'))
  WHERE ignored_at IS NULL;
