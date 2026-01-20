using Arus.TelemetryAgent;
using Arus.TelemetryAgent.Services;
using Arus.TelemetryAgent.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "ARUS Telemetry Agent";
});

var dbPath = Environment.GetEnvironmentVariable("ARUS_DB_PATH") ?? @"C:\ARUS\data\arus.sqlite";
var heartbeatPath = Environment.GetEnvironmentVariable("ARUS_HEARTBEAT_PATH") ?? @"C:\ARUS\data\agent-heartbeat.json";
var grpcPort = int.Parse(Environment.GetEnvironmentVariable("ARUS_GRPC_PORT") ?? "50051");

builder.Services.AddSingleton(new SqliteFrameWriter(dbPath));
builder.Services.AddSingleton(sp => new Worker(
    sp.GetRequiredService<SqliteFrameWriter>(),
    heartbeatPath,
    sp.GetRequiredService<ILogger<Worker>>()
));
builder.Services.AddHostedService(sp => sp.GetRequiredService<Worker>());

builder.Services.AddGrpc();

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(grpcPort, listenOptions =>
    {
        listenOptions.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http2;
    });
});

var app = builder.Build();

app.MapGrpcService<TelemetryAgentGrpcService>();

Console.WriteLine($"ARUS Telemetry Agent starting on gRPC port {grpcPort}...");
Console.WriteLine($"SQLite path: {dbPath}");
Console.WriteLine($"Heartbeat path: {heartbeatPath}");

app.Run();
