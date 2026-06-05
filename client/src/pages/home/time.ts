import { formatDistanceToNow } from "date-fns";

export function relativeTime(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

export function greetingForNow(now: Date): string {
  const h = now.getHours();
  if (h < 12) {
    return "Good morning";
  }
  if (h < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}
