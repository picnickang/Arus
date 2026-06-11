import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";

import request from "supertest";
import type { Express } from "express";

type TestServer = {
  app: Express;
  baseUrl: string;
  close: () => Promise<void>;
  request: () => request.Agent;
  server: Server;
};

export async function startIntegrationTestServer(
  options: { port?: number } = {}
): Promise<TestServer> {
  const { createTestApp } = await import("../../../server/app.js");
  const app = await createTestApp();
  const server = createServer(app);
  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    if (options.port) {
      server.listen(options.port);
    } else {
      server.listen(0, "127.0.0.1");
    }
  });

  const address = server.address() as AddressInfo;
  const host =
    typeof address.address === "string" && address.address !== "::" ? address.address : "127.0.0.1";

  return {
    app,
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        const finish = () => {
          server.unref();
          for (const socket of sockets) {
            socket.unref();
            socket.destroy();
          }
          setImmediate(resolve);
        };

        if (!server.listening) {
          finish();
          return;
        }

        server.close(() => finish());
        server.closeAllConnections?.();
      }),
    request: () => request(server),
    server,
  };
}
