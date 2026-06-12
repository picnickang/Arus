import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DOCUMENT_TYPES, type CrewManagementRole } from "@/features/crew";

// "Leave unset" sentinel for the Select components (a SelectItem cannot use an
// empty-string value). Mapped back to "" before sending to the server, which
// normalizes "" to null.
const NONE = "__none__";

const DEPARTMENTS = [
  { value: "bridge", label: "Bridge" },
  { value: "engine", label: "Engine" },
  { value: "deck", label: "Deck" },
  { value: "steward", label: "Steward" },
  { value: "admin", label: "Admin" },
] as const;

export interface PermissionRole {
  id: string;
  name: string;
  displayName?: string | null;
}

export interface RoleDefaults {
  department: string;
  minRest: string;
  maxHours: string;
  watch: string;
  defaultRoleId: string;
  requiredDocuments: string[];
}

export const EMPTY_DEFAULTS: RoleDefaults = {
  department: "",
  minRest: "",
  maxHours: "",
  watch: "",
  defaultRoleId: "",
  requiredDocuments: [],
};

export function defaultsFromRole(role: CrewManagementRole): RoleDefaults {
  return {
    department: role.defaultDepartment ?? "",
    minRest: role.defaultMinRestHours != null ? String(role.defaultMinRestHours) : "",
    maxHours: role.defaultMaxHours != null ? String(role.defaultMaxHours) : "",
    watch: role.defaultWatchKeeping ?? "",
    defaultRoleId: role.defaultRoleId ?? "",
    requiredDocuments: role.requiredDocuments ?? [],
  };
}

export function defaultsToPayload(d: RoleDefaults) {
  return {
    defaultDepartment: d.department,
    defaultMinRestHours: d.minRest,
    defaultMaxHours: d.maxHours,
    defaultWatchKeeping: d.watch,
    defaultRoleId: d.defaultRoleId,
    requiredDocuments: d.requiredDocuments,
  };
}

export function RoleDefaultsFields({
  values,
  onChange,
  permissionRoles,
  idPrefix,
}: {
  values: RoleDefaults;
  onChange: (patch: Partial<RoleDefaults>) => void;
  permissionRoles: PermissionRole[];
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs text-slate-400">Department</label>
        <Select
          value={values.department || NONE}
          onValueChange={(v) => onChange({ department: v === NONE ? "" : v })}
        >
          <SelectTrigger className="h-8" data-testid={`select-${idPrefix}-department`}>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Default app access</label>
        <Select
          value={values.defaultRoleId || NONE}
          onValueChange={(v) => onChange({ defaultRoleId: v === NONE ? "" : v })}
        >
          <SelectTrigger className="h-8" data-testid={`select-${idPrefix}-access`}>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {permissionRoles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.displayName || r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Min rest (h)</label>
        <Input
          type="number"
          min={0}
          max={24}
          step="0.5"
          value={values.minRest}
          onChange={(e) => onChange({ minRest: e.target.value })}
          placeholder="e.g. 10"
          className="h-8"
          data-testid={`input-${idPrefix}-min-rest`}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Max hours / 7d</label>
        <Input
          type="number"
          min={0}
          max={168}
          step="1"
          value={values.maxHours}
          onChange={(e) => onChange({ maxHours: e.target.value })}
          placeholder="e.g. 72"
          className="h-8"
          data-testid={`input-${idPrefix}-max-hours`}
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-400">Watch / shift pattern</label>
        <Input
          value={values.watch}
          onChange={(e) => onChange({ watch: e.target.value })}
          placeholder="e.g. 0000–0400 / 1200–1600"
          className="h-8"
          data-testid={`input-${idPrefix}-watch`}
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-400">Required documents</label>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_TYPES.map((doc) => {
            const checked = values.requiredDocuments.includes(doc.value);
            return (
              <label
                key={doc.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = new Set(values.requiredDocuments);
                    if (v === true) {
                      next.add(doc.value);
                    } else {
                      next.delete(doc.value);
                    }
                    onChange({ requiredDocuments: Array.from(next) });
                  }}
                  data-testid={`checkbox-${idPrefix}-req-${doc.value}`}
                />
                {doc.label}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Crew in this role are flagged when a required document is missing or due soon.
        </p>
      </div>
    </div>
  );
}
