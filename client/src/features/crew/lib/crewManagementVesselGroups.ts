export const RELIEF_POOL_ID = "__relief_pool__";

export interface VesselGroupBucket<T> {
  vesselId: string;
  vesselName: string;
  isReliefPool: boolean;
  members: T[];
}

export function groupCrewByVessel<T extends { vesselId?: string | null | undefined }>(
  crew: T[],
  getVesselName: (vesselId: string) => string
): VesselGroupBucket<T>[] {
  const buckets = new Map<string, T[]>();
  for (const member of crew) {
    const vesselId = member.vesselId ?? RELIEF_POOL_ID;
    const key = vesselId === "" ? RELIEF_POOL_ID : vesselId;
    const list = buckets.get(key);
    if (list) {
      list.push(member);
    } else {
      buckets.set(key, [member]);
    }
  }
  const assigned: VesselGroupBucket<T>[] = [];
  let reliefPool: VesselGroupBucket<T> | null = null;
  for (const [vesselId, members] of buckets.entries()) {
    if (vesselId === RELIEF_POOL_ID) {
      reliefPool = {
        vesselId: RELIEF_POOL_ID,
        vesselName: "Unassigned / Relief Pool",
        isReliefPool: true,
        members,
      };
    } else {
      assigned.push({
        vesselId,
        vesselName: getVesselName(vesselId) || "Unknown vessel",
        isReliefPool: false,
        members,
      });
    }
  }
  assigned.sort((a, b) => a.vesselName.localeCompare(b.vesselName));
  return reliefPool ? [...assigned, reliefPool] : assigned;
}
