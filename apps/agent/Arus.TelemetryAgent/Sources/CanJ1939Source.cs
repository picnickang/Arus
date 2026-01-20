using Arus.TelemetryAgent.Storage;

namespace Arus.TelemetryAgent.Sources;

public class CanJ1939Source : IIngestSource
{
    public string Id { get; }
    public string Type => "CAN_J1939";
    public string ConnectionString { get; }
    public bool IsRunning { get; private set; }

    private readonly SqliteFrameWriter _frameWriter;
    private readonly ILogger _logger;
    private CancellationTokenSource? _cts;

    public CanJ1939Source(string id, string connectionString, SqliteFrameWriter frameWriter, ILogger logger)
    {
        Id = id;
        ConnectionString = connectionString;
        _frameWriter = frameWriter;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("CanJ1939Source {Id} starting (stub implementation)", Id);
        IsRunning = true;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        _logger.LogInformation("CanJ1939Source {Id} stopping", Id);
        IsRunning = false;
        _cts?.Cancel();
        return Task.CompletedTask;
    }
}
