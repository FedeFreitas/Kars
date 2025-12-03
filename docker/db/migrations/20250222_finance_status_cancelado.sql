-- Ajusta constraint de status para incluir 'cancelado' nos lancamentos financeiros
ALTER TABLE finance_entries DROP CONSTRAINT IF EXISTS finance_entries_status_check;
ALTER TABLE finance_entries ADD CONSTRAINT finance_entries_status_check CHECK (status IN ('pendente','pago','atrasado','cancelado'));
