export const RISK_COLORS = {
  LOW: "#22C55E",
  MEDIUM: "#F59E0B",
  HIGH: "#F97316",
  CRITICAL: "#EF4444",
};

export const CLASS_COLORS = {
  car: "#FFFFFF",
  truck: "#C0C0C0",
  bus: "#94A3B8",
  motorcycle: "#60A5FA",
  bicycle: "#34D399",
  pedestrian: "#6BCB77",
  auto_rickshaw: "#FBBF24",
  cattle: "#F87171",
  dog: "#FB923C",
  pothole: "#4D96FF",
  construction_debris: "#A78BFA",
  speed_breaker: "#F472B6",
  cycle_rickshaw: "#FDE047",
  handcart: "#D97706",
  tractor: "#78716C",
  default: "#9CA3AF",
};

export const NODE_COLORS = {
  ego: "#3B82F6",
  hazard: "#EF4444",
  vehicle: "#60A5FA",
  pedestrian: "#22C55E",
  default: "#6B7280",
};

export function riskColor(label) {
  return RISK_COLORS[label] || RISK_COLORS.LOW;
}

export function classColor(className) {
  return CLASS_COLORS[className] || CLASS_COLORS.default;
}

export function formatClassName(name) {
  return name.replace(/_/g, " ");
}

export function formatTimestamp(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
