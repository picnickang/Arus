import type { Express } from "express";
import { dpRouter } from "./routes";

export function registerDpRoutes(app: Express) {
  app.use("/api/dp", dpRouter);
}
