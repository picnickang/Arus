-- Task #349: per-role required document types.
-- Each crew role can declare the document types every crew member in that role
-- must hold; drives the compliance snapshot / Docs tab status and the roster
-- needs-action highlight. NULL / empty = no requirements (legacy behaviour).
ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS required_documents text[];
