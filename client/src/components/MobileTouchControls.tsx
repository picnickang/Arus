import { useState, useEffect } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(globalThis.innerWidth < 768);
    };
    checkMobile();
    globalThis.addEventListener("resize", checkMobile);
    return () => globalThis.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}
