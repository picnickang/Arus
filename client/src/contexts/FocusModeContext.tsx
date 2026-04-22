import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface FocusModeContextType {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (enabled: boolean) => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const setFocusMode = useCallback((enabled: boolean) => {
    setIsFocusMode(enabled);
  }, []);

  const value = useMemo(
    () => ({
      isFocusMode,
      toggleFocusMode,
      setFocusMode,
    }),
    [isFocusMode, toggleFocusMode, setFocusMode]
  );

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>;
}

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (context === undefined) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return context;
}
