import clsx from "clsx";

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx("flex gap-1 p-1 bg-sentinel-bg rounded-md border border-sentinel-border-subtle", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
            active === tab.id
              ? "bg-sentinel-surface-raised text-white"
              : "text-sentinel-muted hover:text-white"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
