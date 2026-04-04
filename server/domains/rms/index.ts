import type { Express } from "express";
import { rmsRouter } from "./routes";

export function registerRmsRoutes(app: Express): void {
  app.use("/api/rms", rmsRouter);
}
