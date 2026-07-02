import clsx from "clsx";

const VARIANTS = {
  default: "bg-sentinel-surface-raised text-sentinel-muted border-sentinel-border-subtle",
  primary: "bg-sentinel-primary/10 text-sentinel-primary border-sentinel-primary/20",
  success: "bg-sentinel-success/10 text-sentinel-success border-sentinel-success/20",
  warning: "bg-sentinel-warning/10 text-sentinel-warning border-sentinel-warning/20",
  critical: "bg-sentinel-critical/10 text-sentinel-critical border-sentinel-critical/20",
};

export function Badge({ children, variant = "default", className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusChip({ label, status = "offline", className }) {
  const colors = {
    online: "bg-sentinel-success",
    degraded: "bg-sentinel-warning",
    offline: "bg-sentinel-critical",
    idle: "bg-sentinel-muted-dark",
  };

  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs text-sentinel-muted", className)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", colors[status] || colors.offline)} />
      {label}
    </span>
  );
}
