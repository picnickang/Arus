/**
 * Wave 3.5 — Prompt Registry.
 *
 * Externalizes LLM prompts from inline string literals into versioned,
 * diff-friendly modules. Callers reference prompts by `id@version`
 * (e.g. `risk-narrative@1.0.0`) so prompt iteration is auditable and
 * a regression in one version does not silently affect every caller.
 *
 * Prompts live in `server/prompts/templates/` as plain TS modules so we
 * do not pay for a YAML parser install. Each template exports a
 * `PromptDefinition` and self-registers when the registry is bootstrapped.
 *
 * Design intent:
 *   - Templates are immutable once registered. A "new version" is a new
 *     row, not an in-place mutation, so old logs that reference
 *     `risk-narrative@1.0.0` remain reproducible forever.
 *   - `render(vars)` does cheap `{{var}}` interpolation only — no logic.
 *     Anything more complex belongs in the caller.
 *   - Strict mode rejects unreferenced/missing vars so silent typos
 *     don't ship to OpenAI.
 */

import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Prompts:Registry");

export interface PromptDefinition {
  /** Stable identifier, e.g. "risk-narrative". */
  id: string;
  /** Semver, bumped on every wording change. */
  version: string;
  /** Short, human-readable description for the catalog UI. */
  description: string;
  /** Optional owning team / domain. */
  owner?: string;
  /** Template body. Variables are `{{name}}`. */
  template: string;
  /** Variables the template expects. */
  variables: readonly string[];
  /** Model defaults the prompt was tuned for. */
  defaults?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface RenderedPrompt {
  ref: string;
  text: string;
  defaults?: PromptDefinition["defaults"];
}

const INTERP_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

class PromptRegistry {
  private readonly byRef = new Map<string, PromptDefinition>();
  private readonly latest = new Map<string, string>();

  register(def: PromptDefinition): void {
    const ref = `${def.id}@${def.version}`;
    if (this.byRef.has(ref)) {
      throw new Error(`Prompt ${ref} already registered — bump the version instead of mutating it.`);
    }

    const referenced = new Set<string>();
    let match: RegExpExecArray | null;
    INTERP_RE.lastIndex = 0;
    while ((match = INTERP_RE.exec(def.template)) !== null) {
      referenced.add(match[1] ?? '');
    }
    const declared = new Set(def.variables);
    for (const v of referenced) {
      if (!declared.has(v)) {
        throw new Error(`Prompt ${ref} references undeclared variable {{${v}}}.`);
      }
    }

    this.byRef.set(ref, def);
    const currentLatest = this.latest.get(def.id);
    if (!currentLatest || compareSemver(def.version, currentLatest) > 0) {
      this.latest.set(def.id, def.version);
    }
    logger.debug?.(`Registered prompt ${ref}`);
  }

  get(ref: string): PromptDefinition | undefined {
    if (ref.includes("@")) return this.byRef.get(ref);
    const latest = this.latest.get(ref);
    return latest ? this.byRef.get(`${ref}@${latest}`) : undefined;
  }

  render(ref: string, vars: Record<string, string | number>): RenderedPrompt {
    const def = this.get(ref);
    if (!def) throw new Error(`Unknown prompt ref ${ref}`);
    const resolvedRef = `${def.id}@${def.version}`;

    for (const v of def.variables) {
      if (!(v in vars)) {
        throw new Error(`Prompt ${resolvedRef} requires variable {{${v}}} which was not supplied.`);
      }
    }

    const text = def.template.replace(INTERP_RE, (_, name: string) => {
      const value = vars[name];
      return value === undefined || value === null ? "" : String(value);
    });

    return { ref: resolvedRef, text, defaults: def.defaults };
  }

  list(): PromptDefinition[] {
    return Array.from(this.byRef.values());
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export const promptRegistry = new PromptRegistry();

import { SEED_PROMPTS } from "./templates";
for (const def of SEED_PROMPTS) {
  try {
    promptRegistry.register(def);
  } catch (err) {
    logger.warn(`Failed to register seed prompt ${def.id}@${def.version}`, {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
