/**
 * LLM Gateway — Unit Tests
 *
 * Covers the provider-port contract and the gateway's telemetry behaviour:
 *   - The gateway delegates `chat` to its provider and returns the response unchanged.
 *   - The gateway invokes the cost meter exactly once per successful chat call,
 *     forwarding usage / latency / model / streamed=false / caller meta.
 *   - The gateway swallows meter failures (sync and async) so a broken meter
 *     can never break a production LLM call.
 *   - Streaming records usage only after consuming the final chunk.
 *   - Providers can be swapped freely (fake provider proves the port is honoured).
 */

import { describe, it, expect } from "@jest/globals";
import { DefaultLLMGateway } from "../../server/lib/llm-gateway/gateway";
import { estimateCostUsd } from "../../server/lib/llm-gateway/cost-meter";
import type {
  CostMeter,
  CostMeterEvent,
  LLMChatParams,
  LLMChatResponse,
  LLMProviderPort,
  LLMStreamChunk,
} from "../../server/lib/llm-gateway/types";

function makeResponse(overrides: Partial<LLMChatResponse> = {}): LLMChatResponse {
  return {
    content: "hello",
    toolCalls: [],
    finishReason: "stop",
    model: "gpt-4o",
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    provider: "fake",
    latencyMs: 42,
    raw: { ok: true },
    ...overrides,
  };
}

class FakeProvider implements LLMProviderPort {
  readonly name = "fake";
  constructor(private readonly nextResponse: LLMChatResponse, private readonly stream: LLMStreamChunk[] = []) {}
  async isAvailable() { return true; }
  async chat(_params: LLMChatParams): Promise<LLMChatResponse> {
    return this.nextResponse;
  }
  async *chatStream(_params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    for (const c of this.stream) {yield c;}
  }
}

class RecordingMeter implements CostMeter {
  public events: CostMeterEvent[] = [];
  record(event: CostMeterEvent): void {
    this.events.push(event);
  }
}

describe("DefaultLLMGateway", () => {
  const baseParams: LLMChatParams = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hi" }],
    meta: { caller: "unit-test", orgId: "org-1" },
  };

  it("delegates chat to the provider and returns the response unchanged", async () => {
    const provider = new FakeProvider(makeResponse({ content: "world" }));
    const gateway = new DefaultLLMGateway({ provider });

    const res = await gateway.chat(baseParams);

    expect(res.content).toBe("world");
    expect(res.provider).toBe("fake");
    expect(res.usage.totalTokens).toBe(30);
  });

  it("records one cost event per successful chat with usage, latency, caller meta, streamed=false", async () => {
    const provider = new FakeProvider(makeResponse());
    const meter = new RecordingMeter();
    const gateway = new DefaultLLMGateway({ provider, meter });

    await gateway.chat(baseParams);

    expect(meter.events).toHaveLength(1);
    const evt = meter.events[0];
    expect(evt.provider).toBe("fake");
    expect(evt.model).toBe("gpt-4o");
    expect(evt.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(evt.latencyMs).toBe(42);
    expect(evt.streamed).toBe(false);
    expect(evt.meta?.caller).toBe("unit-test");
    expect(evt.meta?.orgId).toBe("org-1");
  });

  it("does not record when the provider throws", async () => {
    const provider: LLMProviderPort = {
      name: "broken",
      isAvailable: async () => true,
      chat: async () => { throw new Error("nope"); },
      // eslint-disable-next-line require-yield
      async *chatStream () { throw new Error("nope"); },
    };
    const meter = new RecordingMeter();
    const gateway = new DefaultLLMGateway({ provider, meter });

    await expect(gateway.chat(baseParams)).rejects.toThrow("nope");
    expect(meter.events).toHaveLength(0);
  });

  it("swallows synchronous meter failures so the LLM response still resolves", async () => {
    const provider = new FakeProvider(makeResponse());
    const meter: CostMeter = {
      record: () => { throw new Error("meter exploded"); },
    };
    const gateway = new DefaultLLMGateway({ provider, meter });

    await expect(gateway.chat(baseParams)).resolves.toMatchObject({ content: "hello" });
  });

  it("swallows asynchronous (rejected promise) meter failures", async () => {
    const provider = new FakeProvider(makeResponse());
    const meter: CostMeter = {
      record: () => Promise.reject(new Error("async meter exploded")),
    };
    const gateway = new DefaultLLMGateway({ provider, meter });

    await expect(gateway.chat(baseParams)).resolves.toMatchObject({ content: "hello" });
    // Give the microtask queue a turn so the .catch() runs without an unhandled rejection.
    await new Promise((r) => setImmediate(r));
  });

  it("records streaming usage once, after the terminal chunk, with streamed=true", async () => {
    const chunks: LLMStreamChunk[] = [
      { contentDelta: "he", raw: {} },
      { contentDelta: "llo", raw: {} },
      {
        contentDelta: "",
        finishReason: "stop",
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
        raw: {},
      },
    ];
    const provider = new FakeProvider(makeResponse(), chunks);
    const meter = new RecordingMeter();
    const gateway = new DefaultLLMGateway({ provider, meter });

    const got: string[] = [];
    for await (const c of gateway.chatStream(baseParams)) {got.push(c.contentDelta);}

    expect(got.join("")).toBe("hello");
    expect(meter.events).toHaveLength(1);
    expect(meter.events[0].streamed).toBe(true);
    expect(meter.events[0].usage.totalTokens).toBe(12);
    expect(meter.events[0].model).toBe("gpt-4o");
  });

  it("skips recording streaming when the provider never emits a usage chunk", async () => {
    const provider = new FakeProvider(makeResponse(), [{ contentDelta: "x", raw: {} }]);
    const meter = new RecordingMeter();
    const gateway = new DefaultLLMGateway({ provider, meter });

    for await (const _ of gateway.chatStream(baseParams)) { /* drain */ }
    expect(meter.events).toHaveLength(0);
  });

  it("exposes the provider name via gateway.name", () => {
    const gateway = new DefaultLLMGateway({ provider: new FakeProvider(makeResponse()) });
    expect(gateway.name).toBe("fake");
  });
});

describe("estimateCostUsd", () => {
  it("returns 0 for unknown models", () => {
    expect(estimateCostUsd("totally-made-up-model", 1000, 1000)).toBe(0);
  });

  it("scales linearly with token counts for known models", () => {
    // gpt-4o: 0.0025 in / 0.01 out per 1k tokens
    expect(estimateCostUsd("gpt-4o", 1000, 1000)).toBeCloseTo(0.0025 + 0.01, 6);
    expect(estimateCostUsd("gpt-4o", 2000, 2000)).toBeCloseTo(2 * (0.0025 + 0.01), 6);
  });
});
