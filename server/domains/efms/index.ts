import type { Express } from "express";
import { efmsRouter } from "./routes";

export function registerEfmsRoutes(app: Express) {
  app.use("/api/efms", efmsRouter);
}
