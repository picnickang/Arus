using Arus.TelemetryAgent.Storage;

namespace Arus.TelemetryAgent.Sources;

/// <summary>
/// Generates deterministic J1939 telemetry frames for testing and validation.
/// Creates engine RPM, coolant temp, oil pressure, and fuel rate data.
/// </summary>
public class SimulatedSource : IIngestSource
{
    public string Id { get; }
    public string Type => "SIMULATED";
    public string ConnectionString { get; }
    public bool IsRunning { get; private set; }

    private readonly SqliteFrameWriter _frameWriter;
    private readonly ILogger _logger;
    private CancellationTokenSource? _cts;
    private readonly int _framesPerSecond;
    private readonly bool _deterministicMode;
    private int _sequenceNumber = 0;
    private long _framesGenerated = 0;
    
    // Common J1939 PGNs for marine engines
    private const uint PGN_ENGINE_SPEED = 61444;     // F004 - EEC1
    private const uint PGN_ENGINE_TEMP = 65262;      // FEEE - ET1
    private const uint PGN_OIL_PRESSURE = 65263;     // FEEF - EFLP1
    private const uint PGN_FUEL_RATE = 65266;        // FEF2 - LC

    public long FramesGenerated => _framesGenerated;
    public int SequenceNumber => _sequenceNumber;

    public SimulatedSource(
        string id, 
        SqliteFrameWriter frameWriter, 
        ILogger logger,
        int framesPerSecond = 100,
        bool deterministicMode = true)
    {
        Id = id;
        ConnectionString = "simulated://local";
        _frameWriter = frameWriter;
        _logger = logger;
        _framesPerSecond = framesPerSecond;
        _deterministicMode = deterministicMode;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("SimulatedSource {Id} starting at {FPS} FPS (deterministic: {Deterministic})", 
            Id, _framesPerSecond, _deterministicMode);
        
        IsRunning = true;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        
        // Start the generation loop
        _ = Task.Run(() => GenerationLoop(_cts.Token), _cts.Token);
    }

    public Task StopAsync()
    {
        _logger.LogInformation("SimulatedSource {Id} stopping. Generated {Count} frames", Id, _framesGenerated);
        IsRunning = false;
        _cts?.Cancel();
        return Task.CompletedTask;
    }

    private async Task GenerationLoop(CancellationToken ct)
    {
        var intervalMs = 1000.0 / _framesPerSecond;
        var nextTickTime = DateTimeOffset.UtcNow;
        
        while (!ct.IsCancellationRequested && IsRunning)
        {
            try
            {
                var frame = GenerateFrame();
                _frameWriter.Enqueue(frame);
                _framesGenerated++;
                
                // Calculate next tick
                nextTickTime = nextTickTime.AddMilliseconds(intervalMs);
                var delay = nextTickTime - DateTimeOffset.UtcNow;
                
                if (delay > TimeSpan.Zero)
                {
                    await Task.Delay(delay, ct);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SimulatedSource {Id} error generating frame", Id);
                await Task.Delay(100, ct);
            }
        }
        
        _logger.LogInformation("SimulatedSource {Id} generation loop ended", Id);
    }

    private RawFrame GenerateFrame()
    {
        _sequenceNumber++;
        var unixTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        
        // Rotate through different PGNs
        var pgnIndex = _sequenceNumber % 4;
        var (pgn, data) = pgnIndex switch
        {
            0 => GenerateEngineRpm(),
            1 => GenerateCoolantTemp(),
            2 => GenerateOilPressure(),
            _ => GenerateFuelRate()
        };
        
        // Build J1939 v1 payload envelope: [canId:u32le][dlc:u8][data:0..8]
        var canId = BuildCanId(pgn, priority: 6, sourceAddress: 0);
        var payload = new byte[5 + data.Length];
        BitConverter.GetBytes(canId).CopyTo(payload, 0);
        payload[4] = (byte)data.Length;
        data.CopyTo(payload, 5);
        
        return new RawFrame(
            UnixTimeMs: unixTimeMs,
            Source: $"sim_{Id}",
            Protocol: "j1939",
            Payload: payload,
            QualityFlags: 0,
            PayloadFormatVersion: 1
        );
    }

    private uint BuildCanId(uint pgn, byte priority, byte sourceAddress)
    {
        // J1939 29-bit CAN ID format:
        // Priority (3 bits) | Reserved (1 bit) | DP (1 bit) | PF (8 bits) | PS (8 bits) | SA (8 bits)
        // For PDU1 format (PF < 240): PS = destination address
        // For PDU2 format (PF >= 240): PS = group extension, combined to form PGN
        var pf = (byte)((pgn >> 8) & 0xFF);
        var ps = (byte)(pgn & 0xFF);
        
        return (uint)(
            ((priority & 0x07) << 26) |
            (pf << 16) |
            (ps << 8) |
            sourceAddress
        );
    }

    private (uint pgn, byte[] data) GenerateEngineRpm()
    {
        // PGN 61444 (EEC1): Engine speed in bytes 3-4, 0.125 RPM/bit
        // Simulate realistic engine RPM: 600-2200 RPM
        var rpm = _deterministicMode 
            ? 1000 + ((_sequenceNumber * 7) % 600) // Deterministic: varies 1000-1600
            : 600 + Random.Shared.Next(0, 1600);    // Random: varies 600-2200
        
        var rawRpm = (ushort)(rpm / 0.125);
        var data = new byte[8];
        // Torque mode (byte 0)
        data[0] = 0x00;
        // Driver demand (byte 1)
        data[1] = 0x80; // 50%
        // Actual torque (byte 2)
        data[2] = 0x80; // 50%
        // Engine speed (bytes 3-4, little-endian)
        data[3] = (byte)(rawRpm & 0xFF);
        data[4] = (byte)((rawRpm >> 8) & 0xFF);
        // Source address (byte 5)
        data[5] = 0x00;
        // Starter mode (byte 6)
        data[6] = 0x00;
        // Demand torque high res (byte 7)
        data[7] = 0x00;
        
        return (PGN_ENGINE_SPEED, data);
    }

    private (uint pgn, byte[] data) GenerateCoolantTemp()
    {
        // PGN 65262 (ET1): Coolant temp at byte 0, offset -40°C, 1°C/bit
        // Simulate 80-95°C operating range
        var tempC = _deterministicMode 
            ? 85 + ((_sequenceNumber * 3) % 10) // Deterministic: 85-95°C
            : 80 + Random.Shared.Next(0, 15);    // Random: 80-95°C
        
        var rawTemp = (byte)(tempC + 40);
        var data = new byte[8];
        data[0] = rawTemp;
        // Other bytes: fuel temp, oil temp, etc. (set to not available)
        for (int i = 1; i < 8; i++) data[i] = 0xFF;
        
        return (PGN_ENGINE_TEMP, data);
    }

    private (uint pgn, byte[] data) GenerateOilPressure()
    {
        // PGN 65263 (EFLP1): Oil pressure at byte 0, 4 kPa/bit
        // Simulate 250-500 kPa (normal operating range)
        var pressureKpa = _deterministicMode 
            ? 350 + ((_sequenceNumber * 5) % 100) // Deterministic: 350-450 kPa
            : 250 + Random.Shared.Next(0, 250);     // Random: 250-500 kPa
        
        var rawPressure = (byte)(pressureKpa / 4);
        var data = new byte[8];
        data[0] = rawPressure;
        // Other bytes: coolant pressure, fuel pressure, etc.
        for (int i = 1; i < 8; i++) data[i] = 0xFF;
        
        return (PGN_OIL_PRESSURE, data);
    }

    private (uint pgn, byte[] data) GenerateFuelRate()
    {
        // PGN 65266 (LC): Fuel rate at bytes 0-1, 0.05 L/h per bit
        // Simulate 10-50 L/h fuel consumption
        var fuelRateLph = _deterministicMode 
            ? 20 + ((_sequenceNumber * 2) % 20) // Deterministic: 20-40 L/h
            : 10 + Random.Shared.Next(0, 40);    // Random: 10-50 L/h
        
        var rawFuelRate = (ushort)(fuelRateLph / 0.05);
        var data = new byte[8];
        data[0] = (byte)(rawFuelRate & 0xFF);
        data[1] = (byte)((rawFuelRate >> 8) & 0xFF);
        // Other bytes: set to not available
        for (int i = 2; i < 8; i++) data[i] = 0xFF;
        
        return (PGN_FUEL_RATE, data);
    }
}
