# ARUS Telemetry Agent

C# Windows Service for collecting telemetry from marine equipment via CAN/J1939/J1587 protocols.

## Architecture

```
Hardware (CAN/Serial) → C# Agent → SQLite (WAL) → Node Bridge → PostgreSQL
                                ↓
                         Heartbeat JSON
```

## Components

- **SqliteFrameWriter**: WAL-mode SQLite writer with cursor-safe retention
- **Worker**: Background service with heartbeat, flush, and retention loops
- **TelemetryAgentGrpcService**: gRPC interface for status and source control
- **Sources**: Pluggable hardware sources (Serial, CAN J1939)

## Building

```bash
cd apps/agent/Arus.TelemetryAgent
dotnet build
dotnet publish -c Release
```

## Configuration

Environment variables:

| Variable            | Default                           | Description          |
| ------------------- | --------------------------------- | -------------------- |
| ARUS_DB_PATH        | C:\ARUS\data\arus.sqlite          | SQLite database path |
| ARUS_HEARTBEAT_PATH | C:\ARUS\data\agent-heartbeat.json | Heartbeat JSON file  |
| ARUS_GRPC_PORT      | 50051                             | gRPC server port     |

## Installation as Windows Service

```bash
sc create "ARUS Telemetry Agent" binpath= "C:\Program Files\ARUS\Agent\Arus.TelemetryAgent.exe"
sc start "ARUS Telemetry Agent"
```

## Payload Format

### J1939 v1 Envelope

| Offset | Size | Field       |
| ------ | ---- | ----------- |
| 0      | 4    | CAN ID (LE) |
| 4      | 1    | DLC         |
| 5      | 0-8  | Data        |

## SQLite Schema

```sql
CREATE TABLE raw_frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unix_time_ms INTEGER NOT NULL,
  source TEXT NOT NULL,
  protocol TEXT NOT NULL,
  payload BLOB NOT NULL,
  quality_flags INTEGER NOT NULL DEFAULT 0,
  payload_format_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ingest_cursor (
  key TEXT PRIMARY KEY,
  last_id INTEGER NOT NULL,
  last_ts INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## gRPC API

See `Protos/telemetry_agent.proto` for full API definition.

- `GetStatus()` - Agent status and stats
- `ListSources()` - Active data sources
- `StartSource(config)` - Start a new source
- `StopSource(id)` - Stop a source
- `SubscribeStats()` - Stream real-time stats

## Deployment Checklist

- [ ] Verify .NET 8 runtime installed
- [ ] Create data directory (C:\ARUS\data)
- [ ] Set correct environment variables
- [ ] Install as Windows Service
- [ ] Verify gRPC port accessible
- [ ] Test heartbeat file creation
- [ ] Configure Node bridge with matching SQLite path
