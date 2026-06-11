-- 0043 down — intentionally a no-op.
--
-- The up migration drops equipment_telemetry_old, the frozen pre-0038
-- backup of the hot table. A dropped backup cannot be resurrected, and
-- by the time 0043 runs it is stale relative to the partitioned parent
-- anyway. If a plain-table rollback target is ever needed again, run
-- 0038's down migration, which rebuilds an unpartitioned
-- equipment_telemetry from the live partitioned data.

SELECT 1;
