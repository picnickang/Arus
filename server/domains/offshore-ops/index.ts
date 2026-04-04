import type { Express } from "express";
import { offshoreOpsRouter } from "./routes";

export function registerOffshoreOpsRoutes(app: Express) {
  app.use("/api/offshore-ops", offshoreOpsRouter);
}
