-- 0042 down — drop status/severity/priority CHECK constraints
--
-- Healed values ('pending' -> 'open', clamped priorities) are not
-- restored.

ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_valid;
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_priority_valid;
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_valid;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_valid;
ALTER TABLE crew_alerts DROP CONSTRAINT IF EXISTS crew_alerts_severity_valid;
