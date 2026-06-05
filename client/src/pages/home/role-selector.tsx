import { ROLES } from "@/config/roles";

export function RoleSelector({ onSelect }: { onSelect: (roleId: string) => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-welcome-title">
          Welcome to ARUS
        </h1>
        <p className="text-muted-foreground">
          Choose your role to customize your home screen. You can change this anytime in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {Object.values(ROLES).map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              data-testid={`button-role-${role.id}`}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border
                         bg-card hover:border-primary hover:bg-primary/5 transition-all
                         text-left cursor-pointer touch-target"
            >
              <Icon className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{role.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("default")}
        data-testid="button-skip-role"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip — show all categories
      </button>
    </div>
  );
}
