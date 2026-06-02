-- Reverse of 0025_work_order_assignment_response.sql

ALTER TABLE work_orders
  DROP COLUMN IF EXISTS assignment_status,
  DROP COLUMN IF EXISTS assignment_responded_at,
  DROP COLUMN IF EXISTS assignment_response_reason;
