import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkflowState } from "./attention-types.js";

function getWorkflowDataDir(): string {
  return process.env["ARUS_WORKFLOW_DATA_DIR"] || path.resolve(process.cwd(), "data", "workflow");
}

function getWorkflowStateFile(): string {
  return path.join(getWorkflowDataDir(), "attention-workflow-state.json");
}

function emptyState(): WorkflowState {
  return { handovers: [], blockerResolutions: [], issueReports: [] };
}

export async function readWorkflowState(): Promise<WorkflowState> {
  try {
    const raw = await readFile(getWorkflowStateFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkflowState>;
    return {
      handovers: Array.isArray(parsed.handovers) ? parsed.handovers : [],
      blockerResolutions: Array.isArray(parsed.blockerResolutions) ? parsed.blockerResolutions : [],
      issueReports: Array.isArray(parsed.issueReports) ? parsed.issueReports : [],
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return emptyState();
    }
    throw error;
  }
}

export async function writeWorkflowState(state: WorkflowState): Promise<void> {
  await mkdir(getWorkflowDataDir(), { recursive: true });
  await writeFile(getWorkflowStateFile(), JSON.stringify(state, null, 2), "utf8");
}
