import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Edit,
  Power,
  MoreHorizontal,
  Trash2,
  UserX,
  UserPlus,
  X,
  KeyRound,
  FileText,
} from "lucide-react";
import { useUnifiedCrewData, type CrewListItem } from "@/features/crew";
import { createHeaders, resolveUrl } from "@/lib/queryClient";
import type { LifecycleAction } from "./LifecycleDialog";

export type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

export interface CrewRowPermissions {
  canManageCrew: boolean;
  canDeleteCrew: boolean;
  canManageAccess: boolean;
}

/** Two-letter initials for the avatar chip, derived from the crew name. */
export function crewInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) {
    return "?";
  }
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

const AVATAR_TONES = [
  "bg-sky-500/15 text-sky-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-violet-500/15 text-violet-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
];

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? "";
}

/**
 * Loads an auth-gated object-storage path into a blob URL. The API uses
 * Bearer-token auth, so a bare `<img src="/objects/…">` would not carry
 * credentials — we fetch with the standard auth headers and hand back an
 * object URL, revoking it on cleanup.
 */
export function useAuthedObjectUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(resolveUrl(path), {
          headers: createHeaders(false),
          credentials: "include",
        });
        if (!res.ok || cancelled) {
          return;
        }
        const blob = await res.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        // Fall back to initials on any load failure.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setUrl(null);
    };
  }, [path]);
  return url;
}

export function CrewAvatar({
  name,
  id,
  photoPath,
}: {
  name: string;
  id: string;
  photoPath?: string | null | undefined;
}) {
  const photoUrl = useAuthedObjectUrl(photoPath);
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${name} profile photo`}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        data-testid={`avatar-crew-${id}`}
      />
    );
  }
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(
        id
      )}`}
      aria-hidden="true"
      data-testid={`avatar-crew-${id}`}
    >
      {crewInitials(name)}
    </div>
  );
}

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

const PILL_TONE_CLASS: Record<PillTone, string> = {
  neutral: "bg-white/[0.06] text-slate-300 border border-white/10",
  info: "bg-sky-500/15 text-sky-300 border border-sky-500/20",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-500/20",
};

export function StatusPill({
  tone = "neutral",
  children,
  testId,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL_TONE_CLASS[tone]}`}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

/** Shared row-action dropdown reused by the current roster + former archive. */
export function CrewActionsMenu({
  d,
  member,
  isFormerView,
  openLifecycle,
  perms,
}: {
  d: UnifiedCrewData;
  member: CrewListItem;
  isFormerView: boolean;
  openLifecycle: (
    action: LifecycleAction,
    crewId: string,
    crewName: string,
    vesselName?: string,
    contractPenalty?: number
  ) => void;
  perms: CrewRowPermissions;
}) {
  const { canManageCrew, canDeleteCrew, canManageAccess } = perms;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-300 hover:text-white hover:bg-white/[0.06]"
          data-testid={`button-crew-actions-${member.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isFormerView && (
          <>
            {d.accessReadinessEnabled && canManageAccess && (
              <DropdownMenuItem
                onClick={() => d.handleViewProfile(member, "access")}
                data-testid={`action-access-${member.id}`}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {member.userId ? "Review Access" : "Set Up Access"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => d.handleViewProfile(member)}
              data-testid={`action-view-${member.id}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => d.handleViewProfile(member, "documents")}
              data-testid={`action-documents-${member.id}`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </DropdownMenuItem>
            {canManageCrew && (
              <>
                <DropdownMenuItem
                  onClick={() => d.handleEditCrew(member)}
                  data-testid={`action-edit-${member.id}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => d.handleToggleDuty(member.id)}
                  data-testid={`action-toggle-duty-${member.id}`}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {member.onDuty ? "End Duty" : "Start Duty"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    openLifecycle(
                      "retire",
                      member.id,
                      member.name,
                      member.vesselId ? d.getVesselName(member.vesselId) : undefined,
                      member.contractPenalty
                    )
                  }
                  data-testid={`action-retire-${member.id}`}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Retire
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    openLifecycle(
                      "cancel",
                      member.id,
                      member.name,
                      member.vesselId ? d.getVesselName(member.vesselId) : undefined,
                      member.contractPenalty
                    )
                  }
                  className="text-destructive"
                  data-testid={`action-cancel-${member.id}`}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Contract
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        {isFormerView && (
          <>
            <DropdownMenuItem
              onClick={() => d.handleViewProfile(member)}
              data-testid={`action-view-${member.id}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </DropdownMenuItem>
            {canManageCrew && (
              <DropdownMenuItem
                onClick={() => openLifecycle("reinstate", member.id, member.name)}
                data-testid={`action-reinstate-${member.id}`}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Reinstate
              </DropdownMenuItem>
            )}
            {canDeleteCrew && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openLifecycle("delete", member.id, member.name)}
                  className="text-destructive"
                  data-testid={`action-delete-${member.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Record
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
