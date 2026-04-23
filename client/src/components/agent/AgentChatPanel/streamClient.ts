import { RETRY_BASE_MS } from "./constants";

export class ClientError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ClientError";
  }
}

export async function fetchStreamWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries: number,
  onRetry: (attempt: number) => void
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers, credentials: "include" });
      if (response.ok) {
        return response;
      }
      const status = response.status;
      const errBody = await response.text().catch(() => "");
      if (status >= 400 && status < 500) {
        throw new ClientError(errBody || `HTTP ${status}`, status);
      }
      lastError = new Error(errBody || `HTTP ${status}`);
    } catch (err) {
      if (err instanceof ClientError) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxRetries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      onRetry(attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError || new Error("Stream connection failed");
}

export async function readStreamWithRetry(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onDisconnect: (attempt: number) => void,
  maxRetries: number
): Promise<void> {
  const decoder = new TextDecoder();
  let disconnects = 0;

  while (true) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      disconnects = 0;
      onChunk(decoder.decode(value, { stream: true }));
    } catch (err) {
      disconnects++;
      if (disconnects > maxRetries) {
        throw err instanceof Error ? err : new Error("Stream read failed");
      }
      onDisconnect(disconnects);
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, disconnects - 1)));
    }
  }
}
