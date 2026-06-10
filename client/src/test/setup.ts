import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "@jest/globals";
import { server } from "./msw/server";

// jsdom lacks matchMedia; several UI hooks read it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

beforeAll(() => {
  // Unhandled requests are test bugs: fail loudly instead of hitting the network.
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
