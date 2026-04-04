import type { Express } from "express";
import { vettingRouter } from "./routes";

export function registerVettingRoutes(app: Express) {
  app.use("/api/vetting", vettingRouter);
}
