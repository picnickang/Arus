-- 0046 down — drop the org FKs this migration created.
-- Scoped by the deterministic name prefix `fk_<table>_org` AND the
-- referenced table, so pre-existing org FKs (drizzle-named
-- `<table>_org_id_organizations_id_fk`, 0040's named constraints, the
-- 0018 CASCADE quota FKs) are untouched.

DO $fk_down$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT c.conname, r.relname AS tbl
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = current_schema()
       AND c.contype = 'f'
       AND c.confrelid = 'organizations'::regclass
       AND c.conname ~ '^fk_.+_org$'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.tbl, rec.conname);
  END LOOP;
END
$fk_down$ LANGUAGE plpgsql;
