import { format, differenceInDays, parseISO } from "date-fns";

export function getCertExpiryStatus(expiryDate: string | Date | null | undefined): {
  level: string;
  label: string;
  badgeClass: string;
} | null {
  if (!expiryDate) {
    return null;
  }
  const expiry = typeof expiryDate === "string" ? parseISO(expiryDate) : expiryDate;
  const now = new Date();
  const days = differenceInDays(expiry, now);

  if (days < 0) {
    return {
      level: "expired",
      label: "Expired",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (days <= 30) {
    return {
      level: "critical",
      label: `${days} days`,
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (days <= 60) {
    return {
      level: "warning",
      label: `${days} days`,
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  if (days <= 90) {
    return {
      level: "notice",
      label: `${days} days`,
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }
  return {
    level: "current",
    label: "Current",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "valid":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "suspended":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "withdrawn":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "pending_renewal":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) {
    return "—";
  }
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "dd MMM yyyy");
  } catch {
    return "—";
  }
}
