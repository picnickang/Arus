namespace Arus.TelemetryAgent.Sources;

public interface IIngestSource
{
    string Id { get; }
    string Type { get; }
    string ConnectionString { get; }
    bool IsRunning { get; }

    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync();
}
