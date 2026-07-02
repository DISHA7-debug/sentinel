import { Home, Layers, Shield, SlidersHorizontal, Activity } from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "sensors", label: "Sensors", icon: Activity },
  { id: "status", label: "Status", icon: Layers },
  { id: "safety", label: "Safety", icon: Shield },
  { id: "controls", label: "Controls", icon: SlidersHorizontal, disabled: true },
];

export default function Sidebar({ active = "overview" }) {
  return (
    <aside className="hidden lg:flex w-24 flex-col items-center gap-4 border-r border-sentinel-border-subtle bg-[#0D1016] px-3 py-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sentinel-primary/10 border border-sentinel-primary/20 text-sentinel-primary">
        <Shield className="w-6 h-6" />
      </div>
      <div className="flex flex-1 flex-col items-center gap-3 py-2">
        {NAV_ITEMS.map((item) => {
          const activeItem = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={`group flex h-14 w-14 items-center justify-center rounded-3xl transition ${
                activeItem ? "bg-sentinel-surface-raised text-white" : "bg-[#10131A] text-sentinel-muted hover:bg-sentinel-surface"
              } ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>
      <div className="space-y-1 text-center text-[10px] text-sentinel-muted">
        <p>ADAS Hub</p>
        <p className="text-sentinel-muted-dark">v1.0</p>
      </div>
    </aside>
  );
}
