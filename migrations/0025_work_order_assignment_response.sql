-- Task: Let crew confirm or reject work assigned to them on equipment
--
-- Adds two-sided assignment acknowledgement to work_orders. When a
-- supervisor assigns a work order to a crew member, `assignment_status`
-- becomes 'assigned'. The assigned crew member then confirms acceptance
-- ('accepted') or flags they cannot take it ('declined') with a reason.
--
-- All three columns are nullable: existing rows (and work orders that
-- were never assigned to a specific crew member) keep a NULL
-- assignment_status, which the application treats as "no acknowledgement
-- loop in progress".

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS assignment_status text,
  ADD COLUMN IF NOT EXISTS assignment_responded_at timestamp,
  ADD COLUMN IF NOT EXISTS assignment_response_reason text;
