import { Router, type Request, type Response } from "express";
import { insertAssetTwinTemplateSchema, insertAssetTwinSchema } from "@shared/schema";
import { TwinDefinitionAdapter } from "./adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const adapter = new TwinDefinitionAdapter();

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await adapter.listTemplates(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await adapter.getTemplate(orgId, req.params.templateId);
    if (!result) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = insertAssetTwinTemplateSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await adapter.createTemplate(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await adapter.listTwins(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await adapter.getTwin(orgId, req.params.twinId);
    if (!result) {
      return res.status(404).json({ error: "Twin not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/twins", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = insertAssetTwinSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await adapter.createTwin(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinDefinitionRouter };
