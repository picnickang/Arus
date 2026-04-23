export function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    case "info":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
}

export function healthColor(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return "text-gray-500";
  }
  if (score >= 80) {
    return "text-green-500";
  }
  if (score >= 60) {
    return "text-yellow-500";
  }
  return "text-red-500";
}

export function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return "Never";
  }
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return "Just now";
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
