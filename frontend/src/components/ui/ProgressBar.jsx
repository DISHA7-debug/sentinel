import clsx from "clsx";

export function ProgressBar({ value = 0, max = 100, color = "#3B82F6", className, showLabel }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={clsx("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-sentinel-muted mb-1">
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 bg-sentinel-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function MetricRow({ label, value, unit, accent }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-sentinel-border-subtle last:border-0">
      <span className="text-xs text-sentinel-muted">{label}</span>
      <span className="text-sm font-medium tabular-nums" style={{ color: accent || "#fff" }}>
        {value}
        {unit && <span className="text-sentinel-muted-dark text-xs ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
