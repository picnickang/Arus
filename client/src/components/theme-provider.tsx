import * as React from "react";

type Theme = "light" | "dark" | "bridge" | "daylight" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark" | "bridge" | "daylight";
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  resolvedTheme: "dark",
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "arus-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof globalThis !== "undefined") {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<
    "light" | "dark" | "bridge" | "daylight"
  >("dark");

  React.useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove("light", "dark", "bridge", "daylight");

    let effectiveTheme: "light" | "dark" | "bridge" | "daylight" = "dark";

    if (theme === "system") {
      const systemTheme = globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      effectiveTheme = systemTheme;
    } else {
      effectiveTheme = theme;
    }

    // Tailwind dark-variant compat: "bridge" is night-vision (read: dark) and
    // must inherit the `dark:` utility variants. "daylight" is high-contrast
    // light. Class drives Tailwind variants; data-theme drives token rules in
    // index.css. Both are set so existing `dark:` utilities and new theme-
    // specific token blocks work side by side.
    if (effectiveTheme === "bridge") {
      root.classList.add("dark");
    } else {
      root.classList.add(effectiveTheme);
    }
    root.setAttribute("data-theme", effectiveTheme);
    setResolvedTheme(effectiveTheme);
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme: (newTheme: Theme) => {
        if (typeof globalThis !== "undefined") {
          localStorage.setItem(storageKey, newTheme);
        }
        setTheme(newTheme);
      },
      resolvedTheme,
    }),
    [theme, resolvedTheme, storageKey]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
