const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export const parseShipmateDate = (v: string): Date | null => {
  if (!v || v === "" || v.toLowerCase() === "n/a") {
    return null;
  }
  const trimmed = v.trim();

  const dmy = trimmed.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    const month = MONTH_MAP[dmy[2].toLowerCase()];
    if (month) {
      return new Date(`${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`);
    }
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash && slash[1] && slash[2] && slash[3]) {
    return new Date(`${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`);
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(trimmed);
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

export const parseNum = (v: string): number | null => {
  if (!v || v === "" || v.toLowerCase() === "n/a") {
    return null;
  }
  const n = Number(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

export const parseBool = (v: string): boolean => {
  return ["yes", "y", "true", "1", "active"].includes(v.toLowerCase().trim());
};

export const clean = (v: string): string | null => {
  if (!v || v.trim() === "" || v.toLowerCase() === "n/a") {
    return null;
  }
  return v.trim();
};

export const mapCriticality = (v: string): string => {
  const map: Record<string, string> = {
    critical: "critical",
    essential: "high",
    important: "medium",
    general: "low",
    "class critical": "critical",
    "class essential": "high",
    a: "critical",
    b: "high",
    c: "medium",
    d: "low",
    "1": "critical",
    "2": "high",
    "3": "medium",
    "4": "low",
  };
  return map[v.toLowerCase().trim()] || "medium";
};

export const mapJobStatus = (v: string): string => {
  const map: Record<string, string> = {
    planned: "planned",
    "in progress": "in_progress",
    "in-progress": "in_progress",
    active: "in_progress",
    done: "completed",
    completed: "completed",
    closed: "closed",
    "closed out": "closed",
    overdue: "overdue",
    deferred: "deferred",
    postponed: "deferred",
    cancelled: "cancelled",
  };
  return map[v.toLowerCase().trim()] || "open";
};

export const mapMaintType = (v: string): string => {
  const map: Record<string, string> = {
    preventive: "preventive",
    pm: "preventive",
    "planned maintenance": "preventive",
    corrective: "corrective",
    cm: "corrective",
    breakdown: "corrective",
    "condition-based": "predictive",
    "condition based": "predictive",
    cbm: "predictive",
    "class requirement": "preventive",
    "class req": "preventive",
    modification: "modification",
    "dry dock": "drydock",
    drydock: "drydock",
  };
  return map[v.toLowerCase().trim()] || "preventive";
};

export const extractParentComponentNo = (v: string): string | null => {
  if (!v || !v.includes(".")) {
    return null;
  }
  const parts = v.split(".");
  if (parts.length <= 1) {
    return null;
  }
  return parts.slice(0, -1).join(".");
};
