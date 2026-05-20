# Telemetry Warehouse Export — Data Team Reference

This document describes the daily Parquet exports of telemetry rollups
produced by the ARUS backend (Task #95). Use it to wire external tables
in BigQuery, Athena, or Snowflake against the export bucket.

Source code:
- `server/services/telemetry-warehouse-export/parquet-exporter.ts` (schema + writer)
- `server/services/telemetry-warehouse-export/storage-config.ts` (partition layout)
- `server/services/telemetry-warehouse-export/manifest.ts` (per-org manifest)
- `server/services/telemetry-warehouse-export/retention.ts` (retention prune)

## Cadence

One run per UTC day, exporting the previous UTC day's `1_hour` rollups
from `telemetry_aggregated`. Each `(orgId, date)` partition is written
as a single Parquet object. Re-running for the same day overwrites the
same object key with identical logical content (rows are ordered by
`equipment_id`, `sensor_type`, `bucket_start`).

## Bucket layout

The export lives under the app's Replit App Storage private prefix
(`PRIVATE_OBJECT_DIR`, format `/<bucket>/<prefix>`):

```
<bucketName>/
  <privatePrefix>/
    telemetry-warehouse/
      orgId=<orgId>/
        _manifest.json
        date=YYYY-MM-DD/
          part-0001.parquet
        date=YYYY-MM-DD/
          part-0001.parquet
        ...
```

Notes:
- `orgId` and `date` use Hive-style partition keys (`key=value`), so
  every major engine (Athena, BigQuery, Spark, DuckDB) can auto-detect
  partitions when pointed at `…/telemetry-warehouse/`.
- `orgId` values are URL-encoded in the path. ARUS org IDs are UUID-
  shaped, so encoding is effectively a no-op in practice but should be
  honoured by any tooling that constructs paths by hand.
- Files are SNAPPY-compressed Parquet (parquetjs default).
- One file per partition (`part-0001.parquet`). There is no multi-part
  splitting today.
- Partitions are never written across tenants — each Parquet contains
  only the rows for a single `orgId`.

## Parquet schema

Mirrors the columns the data team needs from `telemetry_aggregated`.
Treat this as a stable contract: any change is a breaking bump for
external tables.

| Column         | Parquet type        | Nullable | Notes                                              |
| -------------- | ------------------- | -------- | -------------------------------------------------- |
| `org_id`       | `UTF8`              | no       | Same as the partition `orgId`.                     |
| `equipment_id` | `UTF8`              | no       |                                                    |
| `sensor_type`  | `UTF8`              | no       |                                                    |
| `bucket_start` | `TIMESTAMP_MILLIS`  | no       | UTC, hour-aligned.                                 |
| `bucket_size`  | `UTF8`              | no       | Always `"1_hour"` in this dataset.                 |
| `count`        | `INT64`             | no       | Number of raw readings in the bucket.              |
| `min_value`    | `DOUBLE`            | yes      |                                                    |
| `max_value`    | `DOUBLE`            | yes      |                                                    |
| `avg_value`    | `DOUBLE`            | yes      |                                                    |
| `stddev_value` | `DOUBLE`            | yes      |                                                    |
| `p50_value`    | `DOUBLE`            | yes      |                                                    |
| `p95_value`    | `DOUBLE`            | yes      |                                                    |
| `p99_value`    | `DOUBLE`            | yes      |                                                    |
| `first_value`  | `DOUBLE`            | yes      |                                                    |
| `last_value`   | `DOUBLE`            | yes      |                                                    |

Per-object metadata (set on the storage object, not inside Parquet):

- `contentType: application/vnd.apache.parquet`
- `orgId`, `date`, `rowCount`, `bucketSize=1_hour`, `schemaVersion=1`,
  `exportedAt` (ISO 8601 UTC).

## Per-org manifest

Each org has a single manifest at
`…/telemetry-warehouse/orgId=<orgId>/_manifest.json` listing every
Parquet object that currently exists for that org. The data team can
use it to detect gaps without listing the bucket.

Shape:

```json
{
  "orgId": "11111111-2222-3333-4444-555555555555",
  "updatedAt": "2026-05-20T03:15:42.000Z",
  "exports": [
    {
      "date": "2026-05-19",
      "parquetKey": ".private/telemetry-warehouse/orgId=11111111-.../date=2026-05-19/part-0001.parquet",
      "rowCount": 18432,
      "exportedAt": "2026-05-20T03:15:40.000Z",
      "sizeBytes": 524288
    }
  ]
}
```

Properties:
- `exports` is sorted by `date` descending (most recent first).
- Re-running an export for a date replaces the existing entry in place
  (no duplicates).
- Retention prunes remove entries whose `date` is older than the cutoff
  (see below).
- `parquetKey` is relative to the storage bucket, including the
  `PRIVATE_OBJECT_DIR` prefix.

## Retention

Controlled by the `TELEMETRY_WAREHOUSE_RETENTION_DAYS` env var:

- Unset or `0` → retain forever (default).
- Positive integer → after each daily run, delete every Parquet object
  whose partition `date` is older than `now - N days`, and drop the
  matching entries from each org's manifest.
- Invalid value → logged as a warning; retention disabled for that run.

## Example external-table DDL

In every example, replace the bucket/prefix with the actual values
derived from `PRIVATE_OBJECT_DIR`. Athena and BigQuery both auto-detect
the `orgId=…/date=…` Hive partitions.

### Amazon Athena

```sql
CREATE EXTERNAL TABLE telemetry_rollups_1h (
  org_id        string,
  equipment_id  string,
  sensor_type   string,
  bucket_start  timestamp,
  bucket_size   string,
  count         bigint,
  min_value     double,
  max_value     double,
  avg_value     double,
  stddev_value  double,
  p50_value     double,
  p95_value     double,
  p99_value     double,
  first_value   double,
  last_value    double
)
PARTITIONED BY (orgId string, date string)
STORED AS PARQUET
LOCATION 's3://<bucket>/<privatePrefix>/telemetry-warehouse/'
TBLPROPERTIES (
  'parquet.compression' = 'SNAPPY',
  'projection.enabled'  = 'true',
  'projection.orgId.type' = 'injected',
  'projection.date.type'  = 'date',
  'projection.date.range' = '2026-01-01,NOW',
  'projection.date.format' = 'yyyy-MM-dd',
  'storage.location.template' =
    's3://<bucket>/<privatePrefix>/telemetry-warehouse/orgId=${orgId}/date=${date}/'
);
```

### BigQuery (external table)

```sql
CREATE EXTERNAL TABLE `project.dataset.telemetry_rollups_1h`
WITH PARTITION COLUMNS (
  orgId STRING,
  date  DATE
)
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://<bucket>/<privatePrefix>/telemetry-warehouse/*'],
  hive_partition_uri_prefix = 'gs://<bucket>/<privatePrefix>/telemetry-warehouse',
  require_hive_partition_filter = true
);
```

### Snowflake (external table on S3/GCS stage)

```sql
CREATE OR REPLACE EXTERNAL TABLE telemetry_rollups_1h (
  org_id        STRING       AS (VALUE:org_id::STRING),
  equipment_id  STRING       AS (VALUE:equipment_id::STRING),
  sensor_type   STRING       AS (VALUE:sensor_type::STRING),
  bucket_start  TIMESTAMP_NTZ AS (TO_TIMESTAMP_NTZ(VALUE:bucket_start::NUMBER / 1000)),
  bucket_size   STRING       AS (VALUE:bucket_size::STRING),
  count         NUMBER       AS (VALUE:count::NUMBER),
  min_value     FLOAT        AS (VALUE:min_value::FLOAT),
  max_value     FLOAT        AS (VALUE:max_value::FLOAT),
  avg_value     FLOAT        AS (VALUE:avg_value::FLOAT),
  stddev_value  FLOAT        AS (VALUE:stddev_value::FLOAT),
  p50_value     FLOAT        AS (VALUE:p50_value::FLOAT),
  p95_value     FLOAT        AS (VALUE:p95_value::FLOAT),
  p99_value     FLOAT        AS (VALUE:p99_value::FLOAT),
  first_value   FLOAT        AS (VALUE:first_value::FLOAT),
  last_value    FLOAT        AS (VALUE:last_value::FLOAT),
  org_id_part   STRING       AS (SPLIT_PART(SPLIT_PART(METADATA$FILENAME, '/', -3), '=', 2)),
  date_part     DATE         AS (TO_DATE(SPLIT_PART(SPLIT_PART(METADATA$FILENAME, '/', -2), '=', 2)))
)
PARTITION BY (org_id_part, date_part)
LOCATION = @telemetry_warehouse_stage/
FILE_FORMAT = (TYPE = PARQUET)
AUTO_REFRESH = TRUE;
```

## Operational notes

- Empty days for an org are skipped (no Parquet written, no manifest
  entry). The export job summary distinguishes `exported`,
  `skipped-empty`, and `failed` per org.
- Object writes are overwrite-idempotent, so a re-run after a failed
  day is safe.
- All timestamps in the dataset and manifest are UTC.
