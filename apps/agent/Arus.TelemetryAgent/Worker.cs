using System.Text.Json;
using Arus.TelemetryAgent.Storage;
using Arus.TelemetryAgent.Sources;

namespace Arus.TelemetryAgent;

public class Worker : BackgroundService
{
    private readonly SqliteFrameWriter _frameWriter;
    private readonly string _heartbeatPath;
    private readonly ILogger<Worker> _logger;
    private readonly Dictionary<string, IIngestSource> _sources = new();
    private readonly string _serviceVersion = "0.1.0";

    private DateTime _lastRetentionRun = DateTime.MinValue;
    private readonly TimeSpan _retentionInterval = TimeSpan.FromHours(6);
    private readonly TimeSpan _flushInterval = TimeSpan.FromMilliseconds(50);
    private readonly TimeSpan _heartbeatInterval = TimeSpan.FromSeconds(1);

    public SqliteFrameWriter FrameWriter => _frameWriter;
    public IReadOnlyDictionary<string, IIngestSource> Sources => _sources;

    public Worker(SqliteFrameWriter frameWriter, string heartbeatPath, ILogger<Worker> logger)
    {
        _frameWriter = frameWriter;
        _heartbeatPath = heartbeatPath;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ARUS Telemetry Agent Worker started");

        var flushTask = RunFlushLoopAsync(stoppingToken);
        var heartbeatTask = RunHeartbeatLoopAsync(stoppingToken);
        var retentionTask = RunRetentionLoopAsync(stoppingToken);

        await Task.WhenAll(flushTask, heartbeatTask, retentionTask);
    }

    private async Task RunFlushLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var flushed = _frameWriter.FlushBatch();
                if (flushed > 0)
                {
                    _logger.LogDebug("Flushed {Count} frames to SQLite", flushed);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error flushing frames to SQLite");
            }

            await Task.Delay(_flushInterval, ct);
        }
    }

    private async Task RunHeartbeatLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                WriteHeartbeat();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error writing heartbeat");
            }

            await Task.Delay(_heartbeatInterval, ct);
        }
    }

    private async Task RunRetentionLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - _lastRetentionRun > _retentionInterval)
                {
                    _logger.LogInformation("Running retention cleanup...");
                    _frameWriter.RunRetention();
                    _lastRetentionRun = DateTime.UtcNow;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running retention");
            }

            await Task.Delay(TimeSpan.FromMinutes(10), ct);
        }
    }

    private void WriteHeartbeat()
    {
        var heartbeat = new
        {
            unixTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            framesWritten = _frameWriter.FramesWritten,
            lastFrameUnixTimeMs = _frameWriter.LastFrameUnixTimeMs,
            queueDepth = _frameWriter.QueueDepth,
            serviceVersion = _serviceVersion,
            status = "running"
        };

        var json = JsonSerializer.Serialize(heartbeat, new JsonSerializerOptions { WriteIndented = true });
        var tmpPath = _heartbeatPath + ".tmp";

        var dir = Path.GetDirectoryName(_heartbeatPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        File.WriteAllText(tmpPath, json);
        File.Move(tmpPath, _heartbeatPath, overwrite: true);
    }

    public bool StartSource(string id, string type, string connectionString)
    {
        if (_sources.ContainsKey(id))
        {
            _logger.LogWarning("Source {Id} already exists", id);
            return false;
        }

        IIngestSource? source = type.ToUpperInvariant() switch
        {
            "SERIAL" => new SerialSource(id, connectionString, _frameWriter, _logger),
            "CAN_J1939" => new CanJ1939Source(id, connectionString, _frameWriter, _logger),
            _ => null
        };

        if (source == null)
        {
            _logger.LogWarning("Unknown source type: {Type}", type);
            return false;
        }

        _sources[id] = source;
        source.StartAsync(CancellationToken.None);
        _logger.LogInformation("Started source {Id} ({Type})", id, type);
        return true;
    }

    public bool StopSource(string id)
    {
        if (!_sources.TryGetValue(id, out var source))
        {
            _logger.LogWarning("Source {Id} not found", id);
            return false;
        }

        source.StopAsync();
        _sources.Remove(id);
        _logger.LogInformation("Stopped source {Id}", id);
        return true;
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("ARUS Telemetry Agent Worker stopping...");

        foreach (var source in _sources.Values)
        {
            await source.StopAsync();
        }
        _sources.Clear();

        _frameWriter.Dispose();

        await base.StopAsync(cancellationToken);
    }
}
