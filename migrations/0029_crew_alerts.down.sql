-- Down: remove manager-raised custom crew alerts
DROP INDEX IF EXISTS idx_crew_alerts_crew;
DROP INDEX IF EXISTS idx_crew_alerts_org;
DROP TABLE IF EXISTS crew_alerts;
