using Arus.TelemetryAgent.Storage;

namespace Arus.TelemetryAgent.Sources;

public class SerialSource : IIngestSource
{
    public string Id { get; }
    public string Type => "SERIAL";
    public string ConnectionString { get; }
    public bool IsRunning { get; private set; }

    private readonly SqliteFrameWriter _frameWriter;
    private readonly ILogger _logger;
    private CancellationTokenSource? _cts;

    public SerialSource(string id, string connectionString, SqliteFrameWriter frameWriter, ILogger logger)
    {
        Id = id;
        ConnectionString = connectionString;
        _frameWriter = frameWriter;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("SerialSource {Id} starting (stub implementation)", Id);
        IsRunning = true;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        _logger.LogInformation("SerialSource {Id} stopping", Id);
        IsRunning = false;
        _cts?.Cancel();
        return Task.CompletedTask;
    }
}
