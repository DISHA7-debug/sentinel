import { AlertTriangle } from "lucide-react";
import { riskColor } from "../utils/colors";

export default function AlertBanner({ alert }) {
  if (!alert?.fire) return null;

  const color = riskColor(alert.level || "HIGH");

  return (
    <div
      className="w-full rounded-[24px] border p-4 flex flex-col gap-3 bg-[#11151F] border-sentinel-border-subtle"
      style={{ boxShadow: `0 0 0 1px ${color}10` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}20` }}>
          <AlertTriangle className="w-5 h-5" style={{ color }} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-snug">{alert.english}</p>
          {alert.hindi && <p className="text-sm text-sentinel-muted font-hindi leading-snug mt-1">{alert.hindi}</p>}
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em]"
          style={{ color, backgroundColor: `${color}16`, border: `1px solid ${color}30` }}
        >
          {alert.level}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.4em] text-sentinel-muted">
        Immediate driver attention recommended
      </div>
    </div>
  );
}
