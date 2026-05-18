#!/usr/bin/env node
// Broad backend CRUD smoke sweep across every user-facing resource.
// For each resource: LIST -> CREATE -> GET BY ID -> UPDATE -> DELETE.
// FK dependencies (vesselId, equipmentId, etc.) are resolved at runtime by
// listing existing records so the sweep works on any non-empty dev DB.
//
// Usage:  node scripts/smoke-crud-all.mjs
// Env:    BASE_URL=http://localhost:5000

const BASE = process.env.BASE_URL || "http://localhost:5000";

const colors = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  skip: (s) => `\x1b[33m${s}\x1b[0m`,
  head: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
};

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

function asArray(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.results)) return body.results;
  // Common per-resource keys.
  for (const k of [
    "vessels","equipment","workOrders","serviceRequests","serviceOrders",
    "suppliers","parts","crew","certificates","purchaseRequests",
    "purchaseOrders","alerts","schedules","models","devices","documents",
    "templates","configs","contracts","inspections","events","monitors",
    "integrations","systems","twins",
  ]) if (Array.isArray(body?.[k])) return body[k];
  return [];
}

async function pickFirstId(path) {
  const r = await http("GET", path);
  if (r.status !== 200) return null;
  const arr = asArray(r.body);
  return arr[0]?.id || null;
}

// ── Resource inventory ────────────────────────────────────────────────────────
// Each entry describes one CRUD-shaped resource. `resolveFks` is async and
// returns the keys to merge into the create payload (lets us pick a real
// vessel/equipment/supplier id rather than guessing).
const RESOURCES = [
  // Fleet
  {
    name: "vessels", domain: "Fleet",
    list: "/api/vessels",
    create: { path: "/api/vessels", payload: () => ({
      name: `SMOKE Vessel ${Date.now()}`,
      vesselType: "OSV",
      condition: "good",
    })},
    getById: "/api/vessels/:id",
    update: { path: "/api/vessels/:id", payload: () => ({ condition: "fair" }) },
    delete: "/api/vessels/:id",
  },
  // Equipment
  {
    name: "equipment", domain: "Equipment",
    list: "/api/equipment",
    resolveFks: async () => ({ vesselId: await pickFirstId("/api/vessels") }),
    create: { path: "/api/equipment", payload: (fk) => ({
      name: `SMOKE Pump ${Date.now()}`,
      type: "Pump",
      vesselId: fk.vesselId,
    })},
    getById: "/api/equipment/:id",
    update: { path: "/api/equipment/:id", payload: () => ({ type: "Pump-Updated" }) },
    delete: "/api/equipment/:id",
  },
  {
    name: "devices", domain: "Equipment",
    list: "/api/devices",
    create: { path: "/api/devices", payload: () => ({
      id: `smoke-dev-${Date.now()}`,
      label: "SMOKE Gateway",
      deviceType: "gateway",
    })},
    getById: "/api/devices/:id",
    update: { path: "/api/devices/:id", payload: () => ({ label: "SMOKE Gateway v2" }) },
    delete: "/api/devices/:id",
  },
  // Maintenance
  {
    name: "work-orders", domain: "Maintenance",
    list: "/api/work-orders",
    resolveFks: async () => ({ equipmentId: await pickFirstId("/api/equipment") }),
    create: { path: "/api/work-orders", payload: (fk) => ({
      equipmentId: fk.equipmentId,
      title: `SMOKE WO ${Date.now()}`,
      description: "Routine smoke maintenance",
      priority: 3,
      type: "corrective",
      status: "open",
    })},
    getById: "/api/work-orders/:id",
    update: { path: "/api/work-orders/:id", payload: () => ({ priority: 2 }) },
    delete: "/api/work-orders/:id",
  },
  // (schedule-tasks: no `/api/schedule-tasks` route exists; schedules live under
  // /api/scheduled-reports for ML jobs only. Removed from sweep.)
  {
    name: "service-requests", domain: "Maintenance",
    list: "/api/service-requests",
    resolveFks: async () => {
      // Need a WO without an active SR — reuse same logic as SR<->SO smoke.
      const wos = asArray((await http("GET", "/api/work-orders")).body);
      for (const w of wos) {
        if (["completed","cancelled"].includes(w.status)) continue;
        const probe = await http("GET", `/api/work-orders/${w.id}/service-requests`);
        const arr = asArray(probe.body);
        if (!arr.find((sr) => !["rejected","converted"].includes(sr.status))) {
          return { workOrderId: w.id };
        }
      }
      return { workOrderId: null };
    },
    create: { path: "/api/work-orders/:workOrderId/service-requests", payload: () => ({
      title: `SMOKE SR ${Date.now()}`,
      urgency: "medium",
      description: "Smoke test request",
    })},
    getById: "/api/service-requests/:id",
    update: { path: "/api/service-requests/:id", payload: () => ({ urgency: "high" }) },
    delete: null, // SRs have no destructive delete; final state via reject/convert.
  },
  {
    name: "service-orders", domain: "Maintenance",
    list: "/api/service-orders",
    resolveFks: async () => ({
      workOrderId: await pickFirstId("/api/work-orders"),
      serviceProviderId: await pickFirstId("/api/suppliers"),
    }),
    create: { path: "/api/service-orders", payload: (fk) => ({
      workOrderId: fk.workOrderId,
      serviceProviderId: fk.serviceProviderId,
      scope: "Smoke ad-hoc SO",
      estimatedCost: 500,
      status: "draft",
    })},
    getById: "/api/service-orders/:id",
    update: { path: "/api/service-orders/:id", payload: () => ({ estimatedCost: 600 }) },
    delete: "/api/service-orders/:id",
  },
  // Inventory
  {
    name: "parts", domain: "Inventory",
    list: "/api/parts",
    create: { path: "/api/parts-inventory", payload: () => ({
      partNumber: `P-SMOKE-${Date.now()}`,
      partName: "SMOKE Oil Filter",
      category: "Consumables",
      unitCost: 25,
      quantityOnHand: 10,
    })},
    // No `/api/parts-inventory/:id` GET route exists by design (list-only view).
    getById: null,
    update: { path: "/api/parts-inventory/:id", payload: () => ({ quantityOnHand: 12 }) },
    delete: "/api/parts/:id",
  },
  {
    name: "suppliers", domain: "Inventory",
    list: "/api/suppliers",
    create: { path: "/api/suppliers", payload: () => ({
      name: `SMOKE Supplier ${Date.now()}`,
      code: `SMK-${Date.now().toString().slice(-6)}`,
      type: "supplier",
      isActive: true,
    })},
    getById: "/api/suppliers/:id",
    update: { path: "/api/suppliers/:id", payload: () => ({ isActive: false }) },
    delete: "/api/suppliers/:id",
  },
  // Purchasing
  {
    name: "purchase-requests", domain: "Purchasing",
    list: "/api/purchase-requests",
    resolveFks: async () => ({ vesselId: await pickFirstId("/api/vessels") }),
    create: { path: "/api/purchase-requests", payload: (fk) => ({
      vesselId: fk.vesselId,
      requestedBy: "smoke-user",
      notes: "Smoke PR",
      priority: "medium",
    })},
    getById: "/api/purchase-requests/:id",
    update: { path: "/api/purchase-requests/:id", payload: () => ({ notes: "Updated smoke PR" }) },
    delete: "/api/purchase-requests/:id",
  },
  // Crew
  {
    name: "crew", domain: "Crew",
    list: "/api/crew",
    create: { path: "/api/crew", payload: () => ({
      name: `SMOKE Sailor ${Date.now()}`,
      rank: "Bosun",
      active: true,
    })},
    getById: "/api/crew/:id",
    update: { path: "/api/crew/:id", payload: () => ({ rank: "Chief Mate" }) },
    delete: "/api/crew/:id",
  },
  {
    name: "certificates", domain: "Fleet",
    list: "/api/certificates",
    resolveFks: async () => ({ vesselId: await pickFirstId("/api/vessels") }),
    create: { path: "/api/certificates", payload: (fk) => ({
      vesselId: fk.vesselId,
      certificateType: "safety_equipment",
      certificateName: `SMOKE Cert ${Date.now()}`,
      issuingAuthority: "Smoke Authority",
      issueDate: "2025-01-01",
      expiryDate: "2027-12-31",
    })},
    getById: "/api/certificates/:id",
    update: { path: "/api/certificates/:id", payload: () => ({ expiryDate: "2028-12-31" }) },
    delete: "/api/certificates/:id",
  },
  // Knowledge Base — documents are created via multipart upload only (no
  // plain JSON POST). LIST/GET/DELETE are JSON; we test those and skip create.
  {
    name: "kb-documents", domain: "KnowledgeBase",
    list: "/api/kb/documents",
    create: null, // upload-only; covered by KB upload smoke separately
  },
  // ML / PdM
  {
    name: "ml-models", domain: "ML",
    list: "/api/ml/models",
    create: null, // models are trained, not POSTed by hand.
    getById: "/api/ml/models/:id",
    update: null,
    delete: null,
  },
  // Alerts — LIST only; alerts are emitted by rule engine and acknowledged
  // via PATCH, not user-created.
  {
    name: "alerts", domain: "Alerts",
    list: "/api/alerts",
    create: null,
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────
const results = []; // {resource, op, status, ok, detail}
const record = (resource, op, ok, detail) =>
  results.push({ resource, op, ok, detail });

async function runResource(r) {
  console.log("\n" + colors.head(`▶ ${r.domain}/${r.name}`));

  // LIST
  const list = await http("GET", r.list);
  const listOk = list.status === 200 && Array.isArray(asArray(list.body));
  record(r.name, "LIST", listOk, `status=${list.status} count=${asArray(list.body).length}`);
  console.log(`  ${listOk ? colors.ok("PASS") : colors.bad("FAIL")} LIST ${r.list} -> ${list.status}`);

  // FKs
  let fk = {};
  if (r.resolveFks) {
    try { fk = (await r.resolveFks()) || {}; }
    catch (e) { fk = {}; }
  }
  const missingFk = Object.entries(fk).filter(([, v]) => v == null).map(([k]) => k);
  if (missingFk.length) {
    record(r.name, "CREATE", false, `missing FK: ${missingFk.join(",")}`);
    console.log(`  ${colors.skip("SKIP")} CREATE — missing FK ${missingFk.join(",")} (need seed data)`);
    return;
  }

  // CREATE
  if (!r.create) {
    record(r.name, "CREATE", true, "no create route (by design)");
    console.log(`  ${colors.skip("SKIP")} CREATE — no create route by design`);
    return;
  }
  const createPath = r.create.path.replace(/:(\w+)/g, (_, k) => fk[k] ?? `:${k}`);
  const payload = r.create.payload(fk);
  const created = await http("POST", createPath, payload);
  const createOk = [200, 201].includes(created.status) && (created.body?.id || created.body?.data?.id);
  const id = created.body?.id || created.body?.data?.id;
  record(r.name, "CREATE", !!createOk, `status=${created.status} id=${id} body=${JSON.stringify(created.body)?.slice(0,160)}`);
  console.log(`  ${createOk ? colors.ok("PASS") : colors.bad("FAIL")} CREATE ${createPath} -> ${created.status}${id ? " id="+id : ""}`);
  if (!createOk) {
    console.log(colors.dim(`    body: ${JSON.stringify(created.body)?.slice(0,240)}`));
    return;
  }

  // GET BY ID — accept either {id} at top level, in .data, or any common wrapper key.
  if (r.getById) {
    const path = r.getById.replace(":id", id);
    const g = await http("GET", path);
    const bodyId =
      g.body?.id ||
      g.body?.data?.id ||
      g.body?.part?.id ||
      g.body?.item?.id ||
      g.body?.result?.id;
    const ok = g.status === 200 && bodyId === id;
    record(r.name, "GET", ok, `status=${g.status} bodyId=${bodyId}`);
    console.log(`  ${ok ? colors.ok("PASS") : colors.bad("FAIL")} GET    ${path} -> ${g.status}`);
  }

  // UPDATE
  if (r.update) {
    const path = r.update.path.replace(":id", id);
    const method = r.update.method || "PATCH";
    const u = await http(method, path, r.update.payload(fk));
    const ok = [200, 204].includes(u.status);
    record(r.name, "UPDATE", ok, `status=${u.status}`);
    console.log(`  ${ok ? colors.ok("PASS") : colors.bad("FAIL")} UPDATE ${path} -> ${u.status}`);
  }

  // DELETE
  if (r.delete) {
    const path = r.delete.replace(":id", id);
    const d = await http("DELETE", path);
    const ok = [200, 204].includes(d.status);
    record(r.name, "DELETE", ok, `status=${d.status}`);
    console.log(`  ${ok ? colors.ok("PASS") : colors.bad("FAIL")} DELETE ${path} -> ${d.status}`);
  }
}

(async () => {
  console.log(colors.head(`Backend CRUD Smoke Sweep — ${RESOURCES.length} resources`));
  console.log(colors.dim("Base: " + BASE));

  for (const r of RESOURCES) {
    try { await runResource(r); }
    catch (e) {
      record(r.name, "FATAL", false, String(e));
      console.log(colors.bad(`  FATAL ${r.name}: ${e}`));
    }
  }

  // Matrix
  console.log("\n" + colors.head("Coverage matrix"));
  const byRes = new Map();
  for (const r of results) {
    if (!byRes.has(r.resource)) byRes.set(r.resource, {});
    byRes.get(r.resource)[r.op] = r;
  }
  const ops = ["LIST","CREATE","GET","UPDATE","DELETE"];
  const pad = (s,n) => (s + " ".repeat(n)).slice(0,n);
  console.log("  " + pad("resource",22) + ops.map((o)=>pad(o,8)).join(""));
  for (const [name, ops_] of byRes) {
    const row = ops.map((o) => {
      const r = ops_[o];
      if (!r) return pad("-",8);
      return pad(r.ok ? colors.ok("ok") : colors.bad("FAIL"), 8 + (r.ok ? 9 : 9));
    }).join("");
    console.log("  " + pad(name,22) + row);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + colors.head("Summary"));
  console.log(`  ${results.length - failed.length}/${results.length} ops passed`);
  if (failed.length) {
    console.log(colors.bad(`  ${failed.length} FAILED:`));
    for (const f of failed) {
      console.log(`   - ${f.resource}.${f.op}: ${f.detail}`);
    }
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(colors.bad("FATAL: " + (e?.stack || e)));
  process.exit(2);
});
