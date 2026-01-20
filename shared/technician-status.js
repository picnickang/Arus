const STATUS_DEFINITIONS = {
  normal: {
    label: "Normal",
    color: "green",
    description: "Equipment operating within normal parameters",
    icon: "check-circle",
    bgClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-400",
    borderClass: "border-green-500",
    badgeVariant: "default"
  },
  monitor: {
    label: "Monitor",
    color: "yellow",
    description: "Minor deviation detected - continue monitoring",
    icon: "alert-circle",
    bgClass: "bg-yellow-500",
    textClass: "text-yellow-700 dark:text-yellow-400",
    borderClass: "border-yellow-500",
    badgeVariant: "secondary"
  },
  action_required: {
    label: "Action Required",
    color: "orange",
    description: "Schedule maintenance within recommended timeframe",
    icon: "alert-triangle",
    bgClass: "bg-orange-500",
    textClass: "text-orange-700 dark:text-orange-400",
    borderClass: "border-orange-500",
    badgeVariant: "destructive"
  },
  critical: {
    label: "Critical",
    color: "red",
    description: "Immediate attention required - potential failure imminent",
    icon: "x-octagon",
    bgClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-red-500",
    badgeVariant: "destructive"
  }
};
const SYSTEM_TYPES = {
  propulsion: {
    label: "Propulsion",
    icon: "engine",
    color: "#3b82f6",
    // blue
    description: "Main engines, thrusters, propellers, and drive systems"
  },
  electrical: {
    label: "Electrical",
    icon: "zap",
    color: "#f59e0b",
    // amber
    description: "Generators, switchboards, and electrical distribution"
  },
  auxiliary: {
    label: "Auxiliary Systems",
    icon: "cog",
    color: "#8b5cf6",
    // purple
    description: "Pumps, compressors, and support equipment"
  },
  hvac: {
    label: "HVAC",
    icon: "wind",
    color: "#06b6d4",
    // cyan
    description: "Heating, ventilation, and air conditioning"
  },
  hydraulic: {
    label: "Hydraulic",
    icon: "droplet",
    color: "#ec4899",
    // pink
    description: "Hydraulic pumps, cylinders, and control systems"
  },
  navigation: {
    label: "Navigation",
    icon: "compass",
    color: "#10b981",
    // green
    description: "Navigation equipment, radar, and communication systems"
  },
  safety: {
    label: "Safety",
    icon: "shield",
    color: "#ef4444",
    // red
    description: "Fire suppression, life safety, and emergency equipment"
  }
};
const PRIORITY_DEFINITIONS = {
  immediate: {
    label: "Immediate",
    timeframe: "Immediately",
    color: "red",
    description: "Stop operations and address now"
  },
  urgent: {
    label: "Urgent",
    timeframe: "Within 24-72 hours",
    color: "orange",
    description: "Schedule at next safe opportunity"
  },
  scheduled: {
    label: "Scheduled",
    timeframe: "Within 1-2 weeks",
    color: "yellow",
    description: "Add to next planned maintenance"
  },
  monitor: {
    label: "Monitor",
    timeframe: "Routine",
    color: "green",
    description: "Continue normal monitoring"
  }
};
function determineStatusLevel(failureProbability, confidence) {
  if (failureProbability > 0.7 && confidence > 0.7) {
    return "critical";
  }
  if (failureProbability > 0.5 || failureProbability > 0.3 && confidence > 0.8) {
    return "action_required";
  }
  if (failureProbability > 0.2) {
    return "monitor";
  }
  return "normal";
}
function getPriorityFromStatus(status) {
  const priorityMap = {
    critical: "immediate",
    action_required: "urgent",
    monitor: "scheduled",
    normal: "monitor"
  };
  return priorityMap[status];
}
function getStatusColorClass(status) {
  return STATUS_DEFINITIONS[status].borderClass;
}
function getSystemTypeInfo(systemType) {
  return SYSTEM_TYPES[systemType] || {
    label: systemType,
    icon: "cog",
    color: "#6b7280",
    description: "General equipment"
  };
}
function formatConfidence(confidence) {
  const pct = (confidence * 100).toFixed(0);
  if (confidence > 0.8) {
    return `High confidence (${pct}%)`;
  } else if (confidence > 0.6) {
    return `Moderate confidence (${pct}%)`;
  }
  return `Low confidence (${pct}%)`;
}
function formatFailureProbability(probability) {
  const pct = (probability * 100).toFixed(1);
  if (probability > 0.7) {
    return `High risk (${pct}%)`;
  } else if (probability > 0.5) {
    return `Moderate risk (${pct}%)`;
  } else if (probability > 0.3) {
    return `Low risk (${pct}%)`;
  }
  return `Very low risk (${pct}%)`;
}
export {
  PRIORITY_DEFINITIONS,
  STATUS_DEFINITIONS,
  SYSTEM_TYPES,
  determineStatusLevel,
  formatConfidence,
  formatFailureProbability,
  getPriorityFromStatus,
  getStatusColorClass,
  getSystemTypeInfo
};
