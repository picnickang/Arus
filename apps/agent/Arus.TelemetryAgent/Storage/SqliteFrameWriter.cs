using System.Collections.Concurrent;
using Microsoft.Data.Sqlite;

namespace Arus.TelemetryAgent.Storage;

public record RawFrame(
    long UnixTimeMs,
    string Source,
    string Protocol,
    byte[] Payload,
    int QualityFlags = 0,
    int PayloadFormatVersion = 1
);

public class SqliteFrameWriter : IDisposable
{
    private readonly string _dbPath;
    private readonly ConcurrentQueue<RawFrame> _queue = new();
    private readonly object _writeLock = new();
    private long _framesWritten = 0;
    private long _lastFrameUnixTimeMs = 0;
    private readonly int _batchSize = 500;
    private readonly int _retentionDays = 30;
    private readonly int _cursorSafetyWindow = 10000;

    public long FramesWritten => _framesWritten;
    public long LastFrameUnixTimeMs => _lastFrameUnixTimeMs;
    public int QueueDepth => _queue.Count;

    public SqliteFrameWriter(string dbPath)
    {
        _dbPath = dbPath;
        EnsureDirectoryExists();
        InitializeDatabase();
    }

    private void EnsureDirectoryExists()
    {
        var dir = Path.GetDirectoryName(_dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
    }

    private SqliteConnection CreateConnection()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            PRAGMA busy_timeout=5000;
            PRAGMA temp_store=MEMORY;
        ";
        cmd.ExecuteNonQuery();
        return conn;
    }

    private void InitializeDatabase()
    {
        using var conn = CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS raw_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unix_time_ms INTEGER NOT NULL,
                source TEXT NOT NULL,
                protocol TEXT NOT NULL,
                payload BLOB NOT NULL,
                quality_flags INTEGER NOT NULL DEFAULT 0,
                payload_format_version INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_raw_frames_time ON raw_frames(unix_time_ms);
            CREATE INDEX IF NOT EXISTS idx_raw_frames_id ON raw_frames(id);
        ";
        cmd.ExecuteNonQuery();
    }

    public void Enqueue(RawFrame frame)
    {
        _queue.Enqueue(frame);
    }

    public int FlushBatch()
    {
        var batch = new List<RawFrame>();
        while (batch.Count < _batchSize && _queue.TryDequeue(out var frame))
        {
            batch.Add(frame);
        }

        if (batch.Count == 0) return 0;

        lock (_writeLock)
        {
            using var conn = CreateConnection();
            using var transaction = conn.BeginTransaction();
            using var cmd = conn.CreateCommand();
            cmd.Transaction = transaction;

            foreach (var frame in batch)
            {
                cmd.CommandText = @"
                    INSERT INTO raw_frames (unix_time_ms, source, protocol, payload, quality_flags, payload_format_version)
                    VALUES (@unix_time_ms, @source, @protocol, @payload, @quality_flags, @payload_format_version)
                ";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("@unix_time_ms", frame.UnixTimeMs);
                cmd.Parameters.AddWithValue("@source", frame.Source);
                cmd.Parameters.AddWithValue("@protocol", frame.Protocol);
                cmd.Parameters.AddWithValue("@payload", frame.Payload);
                cmd.Parameters.AddWithValue("@quality_flags", frame.QualityFlags);
                cmd.Parameters.AddWithValue("@payload_format_version", frame.PayloadFormatVersion);
                cmd.ExecuteNonQuery();
            }

            transaction.Commit();
        }

        _framesWritten += batch.Count;
        if (batch.Count > 0)
        {
            _lastFrameUnixTimeMs = batch[^1].UnixTimeMs;
        }

        return batch.Count;
    }

    public void RunRetention()
    {
        var cursorLastId = GetCursorLastId();
        if (cursorLastId == null)
        {
            return;
        }

        var cutoffTime = DateTimeOffset.UtcNow.AddDays(-_retentionDays).ToUnixTimeMilliseconds();
        var safeId = cursorLastId.Value - _cursorSafetyWindow;

        lock (_writeLock)
        {
            using var conn = CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                DELETE FROM raw_frames 
                WHERE id < @safe_id AND unix_time_ms < @cutoff_time
            ";
            cmd.Parameters.AddWithValue("@safe_id", safeId);
            cmd.Parameters.AddWithValue("@cutoff_time", cutoffTime);
            var deleted = cmd.ExecuteNonQuery();

            if (deleted > 0)
            {
                using var vacuumCmd = conn.CreateCommand();
                vacuumCmd.CommandText = "PRAGMA incremental_vacuum;";
                vacuumCmd.ExecuteNonQuery();
                Console.WriteLine($"Retention: deleted {deleted} frames older than {_retentionDays} days");
            }
        }
    }

    private long? GetCursorLastId()
    {
        try
        {
            using var conn = CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT last_id FROM ingest_cursor WHERE key = 'raw_frames'";
            var result = cmd.ExecuteScalar();
            return result != null ? Convert.ToInt64(result) : null;
        }
        catch (SqliteException)
        {
            return null;
        }
    }

    public long GetDiskUsageBytes()
    {
        try
        {
            var fileInfo = new FileInfo(_dbPath);
            return fileInfo.Exists ? fileInfo.Length : 0;
        }
        catch
        {
            return 0;
        }
    }

    public void Dispose()
    {
        while (!_queue.IsEmpty)
        {
            FlushBatch();
        }
    }
}
