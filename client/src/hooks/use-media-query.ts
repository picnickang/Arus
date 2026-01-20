import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  // Initialize with false and check for window availability
  const [matches, setMatches] = useState(() => {
    if (typeof globalThis !== "undefined" && globalThis.matchMedia) {
      return globalThis.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Guard for non-browser environments (SSR, tests)
    if (typeof globalThis === "undefined" || !globalThis.matchMedia) {
      return;
    }

    const media = globalThis.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}
