-- Reverse migration for 0016_prediction_outcomes.sql
-- Drops the label-pipeline table for weekly model retraining. The
-- unique constraint, FKs and indexes are dropped automatically with
-- the table. Idempotent.

DROP TABLE IF EXISTS prediction_outcomes;
