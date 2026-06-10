/**
 * Node globals that jest-environment-jsdom strips but MSW v2 and the data
 * layer need. Runs before the test framework (jest setupFiles).
 *
 * undici is imported dynamically because it reads TextDecoder at load time —
 * the encoder globals must be installed first (static imports are hoisted).
 */

import { TextDecoder, TextEncoder } from "node:util";
import { ReadableStream, TransformStream, WritableStream } from "node:stream/web";
import { BroadcastChannel, MessageChannel, MessagePort } from "node:worker_threads";
import { Blob, File } from "node:buffer";

Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder, writable: true, configurable: true },
  TextEncoder: { value: TextEncoder, writable: true, configurable: true },
  ReadableStream: { value: ReadableStream, writable: true, configurable: true },
  TransformStream: { value: TransformStream, writable: true, configurable: true },
  WritableStream: { value: WritableStream, writable: true, configurable: true },
  BroadcastChannel: { value: BroadcastChannel, writable: true, configurable: true },
  MessageChannel: { value: MessageChannel, writable: true, configurable: true },
  MessagePort: { value: MessagePort, writable: true, configurable: true },
  Blob: { value: Blob, writable: true, configurable: true },
  File: { value: File, writable: true, configurable: true },
});

const { fetch, Headers, FormData, Request, Response } = await import("undici");

Object.defineProperties(globalThis, {
  fetch: { value: fetch, writable: true, configurable: true },
  Headers: { value: Headers, writable: true, configurable: true },
  FormData: { value: FormData, writable: true, configurable: true },
  Request: { value: Request, writable: true, configurable: true },
  Response: { value: Response, writable: true, configurable: true },
});
