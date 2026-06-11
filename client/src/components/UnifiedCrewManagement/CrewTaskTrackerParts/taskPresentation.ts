import type { CrewTaskStatus, CrewTaskPriority } from "@shared/schema";
import type { CertificateItem, CrewDocumentItem, CrewTaskFilterOption } from "./types";

export const PRIORITY_TONE: Record<CrewTaskPriority, string> = {
  urgent: "bg-rose-500/15 text-rose-300",
  high: "bg-amber-500/15 text-amber-300",
  medium: "bg-sky-500/15 text-sky-300",
  low: "bg-slate-500/15 text-slate-300",
};

export const STATUS_TONE: Record<CrewTaskStatus, string> = {
  open: "bg-sky-500/15 text-sky-300",
  in_progress: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-rose-500/15 text-rose-300",
  done: "bg-slate-500/15 text-slate-400",
};

export const FILTERS: CrewTaskFilterOption[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My Tasks" },
  { key: "overdue", label: "Overdue" },
  { key: "by_vessel", label: "By vessel" },
];

export const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500";

export function humanizeType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function documentLabel(doc: CrewDocumentItem): string {
  const type = humanizeType(doc.documentType);
  return doc.documentNumber ? `${type} · ${doc.documentNumber}` : type;
}

export function certificateLabel(cert: CertificateItem): string {
  return cert.certificateNumber
    ? `${cert.certificateName} · ${cert.certificateNumber}`
    : cert.certificateName;
}

export function sourceKey(type: string, id: string): string {
  return `${type}:${id}`;
}
