using Grpc.Core;
using Arus.TelemetryAgent.Proto;

namespace Arus.TelemetryAgent.Services;

public class TelemetryAgentGrpcService : Proto.TelemetryAgent.TelemetryAgentBase
{
    private readonly Worker _worker;
    private readonly ILogger<TelemetryAgentGrpcService> _logger;
    private const string ServiceVersion = "0.1.0";

    public TelemetryAgentGrpcService(Worker worker, ILogger<TelemetryAgentGrpcService> logger)
    {
        _worker = worker;
        _logger = logger;
    }

    public override Task<AgentStatus> GetStatus(Empty request, ServerCallContext context)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        
        return Task.FromResult(new AgentStatus
        {
            ServiceVersion = ServiceVersion,
            Status = "running",
            UnixTimeMs = now,
            FramesWritten = _worker.FrameWriter.FramesWritten,
            LastFrameUnixTimeMs = _worker.FrameWriter.LastFrameUnixTimeMs,
            ActiveSourceCount = _worker.Sources.Count
        });
    }

    public override Task<Ack> StartSource(SourceConfig request, ServerCallContext context)
    {
        var success = _worker.StartSource(request.Id, request.Type, request.ConnectionString);
        return Task.FromResult(new Ack
        {
            Ok = success,
            Message = success ? $"Started source {request.Id}" : $"Failed to start source {request.Id}"
        });
    }

    public override Task<Ack> StopSource(SourceId request, ServerCallContext context)
    {
        var success = _worker.StopSource(request.Id);
        return Task.FromResult(new Ack
        {
            Ok = success,
            Message = success ? $"Stopped source {request.Id}" : $"Failed to stop source {request.Id}"
        });
    }

    public override Task<SourceList> ListSources(Empty request, ServerCallContext context)
    {
        var sources = _worker.Sources.Values.Select(s => new SourceConfig
        {
            Id = s.Id,
            Type = s.Type,
            ConnectionString = s.ConnectionString
        });

        var result = new SourceList();
        result.Sources.AddRange(sources);
        return Task.FromResult(result);
    }

    public override async Task SubscribeStats(Empty request, IServerStreamWriter<IngestStats> responseStream, ServerCallContext context)
    {
        _logger.LogInformation("Client subscribed to stats stream");

        while (!context.CancellationToken.IsCancellationRequested)
        {
            var stats = new IngestStats
            {
                UnixTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                FramesWritten = _worker.FrameWriter.FramesWritten,
                QueueDepth = _worker.FrameWriter.QueueDepth,
                LastFrameUnixTimeMs = _worker.FrameWriter.LastFrameUnixTimeMs,
                DiskUsageBytes = _worker.FrameWriter.GetDiskUsageBytes()
            };

            await responseStream.WriteAsync(stats);
            await Task.Delay(1000, context.CancellationToken);
        }
    }
}
