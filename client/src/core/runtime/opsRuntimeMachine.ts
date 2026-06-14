import { setup, assign, type ActorRefFrom } from "xstate";

export type OpsMode = "CLOUD" | "VESSEL_LOCAL";
export type Connectivity = "ONLINE" | "OFFLINE" | "DEGRADED";
export type SyncStatus = "SYNCED" | "SYNCING" | "CONFLICT" | "IDLE";

export interface OpsRuntimeContext {
  mode: OpsMode;
  connectivity: Connectivity;
  syncStatus: SyncStatus;
  pendingActions: number;
  userRole: string;
  isTransitioning: boolean;
  lastSynced: string | null;
}

export type OpsRuntimeEvent =
  | { type: "INITIALIZED" }
  | { type: "SWITCH_MODE"; targetMode: OpsMode }
  | { type: "MODE_SWITCH_SUCCESS" }
  | { type: "MODE_SWITCH_FAILED" }
  | { type: "CONNECTION_LOST" }
  | { type: "CONNECTION_RESTORED" }
  | { type: "PERFORM_ACTION"; payload: { actionType: string; id?: string } }
  | { type: "ACTION_QUEUED" }
  | { type: "ACTION_FLUSHED" }
  | { type: "SYNC_START" }
  | { type: "SYNC_SUCCESS" }
  | { type: "SYNC_CONFLICT" }
  | { type: "RECOVER" };

// XState v5: implementations (guards/actions) live in setup(), and types are
// declared there so guard/action params are inferred (not implicitly any).
const opsRuntimeMachine = setup({
  types: {
    context: {} as OpsRuntimeContext,
    events: {} as OpsRuntimeEvent,
  },
  guards: {
    canPerformCriticalAction: ({ context, event }) => {
      if (event.type !== "PERFORM_ACTION") {
        return false;
      }
      const isOnline = context.connectivity === "ONLINE";
      const notTransitioning = !context.isTransitioning;
      const hasPerms = ["chiefEngineer", "captain", "superintendent"].includes(context.userRole);
      const notOverloaded = context.pendingActions < 10;
      return isOnline && notTransitioning && hasPerms && notOverloaded;
    },
    isSafeToSwitchMode: ({ context }) => {
      return (
        context.pendingActions === 0 &&
        context.syncStatus !== "CONFLICT" &&
        !context.isTransitioning
      );
    },
    targetWasCloud: ({ event }) => {
      if (event.type !== "SWITCH_MODE") {
        return false;
      }
      return event.targetMode === "CLOUD";
    },
  },
  actions: {
    incrementPending: assign({
      pendingActions: ({ context }) => context.pendingActions + 1,
    }),
    decrementPending: assign({
      pendingActions: ({ context }) => Math.max(0, context.pendingActions - 1),
    }),
  },
}).createMachine({
  id: "opsRuntime",
  initial: "BOOTING",
  context: {
    mode: "VESSEL_LOCAL",
    connectivity: "ONLINE",
    syncStatus: "IDLE",
    pendingActions: 0,
    userRole: "chiefEngineer",
    isTransitioning: false,
    lastSynced: null,
  },
  states: {
    BOOTING: {
      on: {
        INITIALIZED: "OPERATIONAL",
      },
    },
    OPERATIONAL: {
      type: "parallel",
      states: {
        MODE: {
          initial: "VESSEL_LOCAL",
          states: {
            VESSEL_LOCAL: {
              on: {
                SWITCH_MODE: {
                  target: "TRANSITIONING",
                  guard: "isSafeToSwitchMode",
                },
              },
            },
            CLOUD: {
              on: {
                SWITCH_MODE: {
                  target: "TRANSITIONING",
                  guard: "isSafeToSwitchMode",
                },
              },
            },
            TRANSITIONING: {
              entry: assign({ isTransitioning: true }),
              exit: assign({ isTransitioning: false }),
              on: {
                MODE_SWITCH_SUCCESS: [
                  { target: "CLOUD", guard: "targetWasCloud" },
                  { target: "VESSEL_LOCAL" },
                ],
                MODE_SWITCH_FAILED: "ERROR",
              },
            },
          },
        },
        CONNECTIVITY: {
          initial: "ONLINE",
          states: {
            ONLINE: {
              on: {
                CONNECTION_LOST: "OFFLINE",
              },
            },
            OFFLINE: {
              on: {
                CONNECTION_RESTORED: "ONLINE",
              },
            },
            DEGRADED: {},
          },
        },
        ACTION_QUEUE: {
          initial: "IDLE",
          states: {
            IDLE: {
              on: {
                PERFORM_ACTION: {
                  guard: "canPerformCriticalAction",
                  target: "QUEUED",
                  actions: "incrementPending",
                },
              },
            },
            QUEUED: {
              on: {
                ACTION_FLUSHED: {
                  target: "IDLE",
                  actions: "decrementPending",
                },
              },
            },
          },
        },
      },
      on: {
        SYNC_START: {
          actions: assign({ syncStatus: "SYNCING" as const }),
        },
        SYNC_SUCCESS: {
          actions: [
            assign({ syncStatus: "SYNCED" as const, lastSynced: () => new Date().toISOString() }),
          ],
        },
        SYNC_CONFLICT: {
          actions: assign({ syncStatus: "CONFLICT" as const }),
        },
      },
    },
    ERROR: {
      on: {
        RECOVER: "OPERATIONAL",
      },
    },
  },
});

export default opsRuntimeMachine;
export type OpsRuntimeActor = ActorRefFrom<typeof opsRuntimeMachine>;
