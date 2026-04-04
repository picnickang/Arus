import type { Express } from "express";
import { charterRouter } from "./routes";

export function registerCharterRoutes(app: Express) {
  app.use("/api/charter", charterRouter);
}
