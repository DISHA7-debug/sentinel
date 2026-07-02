import { Shield, LayoutDashboard, Activity } from "lucide-react";
import clsx from "clsx";
import { StatusChip } from "../ui/Badge";

const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "sensors", label: "Sensors", icon: Activity },
];

export default function Header({ connected, latencyMs, fps, activeNav = "dashboard" }) {
  return (
    <header className="flex flex-col gap-3 px-5 py-4 border-b border-sentinel-border-subtle bg-sentinel-surface">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sentinel-primary/15 border border-sentinel-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-sentinel-primary" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">SENTINEL ADAS</h1>
            <p className="text-[10px] uppercase tracking-[0.35em] text-sentinel-muted">Premium driver assistance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-sentinel-border-subtle bg-[#0D1016] px-3 py-2 text-[10px] uppercase tracking-[0.35em] text-sentinel-muted">
              <div className="font-semibold text-white tabular-nums">{latencyMs != null ? `${latencyMs.toFixed(1)} ms` : "—"}</div>
              <div>Latency</div>
            </div>
            <div className="rounded-2xl border border-sentinel-border-subtle bg-[#0D1016] px-3 py-2 text-[10px] uppercase tracking-[0.35em] text-sentinel-muted">
              <div className="font-semibold text-white tabular-nums">{fps || "—"} fps</div>
              <div>Stream</div>
            </div>
          </div>
          <StatusChip label={connected ? "LIVE" : "DISCONNECTED"} status={connected ? "online" : "offline"} />
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:max-w-md">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(
              "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition",
              activeNav === id ? "bg-sentinel-surface-raised text-white" : "bg-[#10131A] text-sentinel-muted hover:text-white"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
