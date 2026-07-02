import clsx from "clsx";

export function Card({ children, className, padding = "p-4" }) {
  return (
    <div className={clsx("sentinel-card", padding, className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx("flex items-start justify-between mb-3", className)}>
      <div>
        <p className="sentinel-label">{title}</p>
        {subtitle && (
          <p className="text-xs text-sentinel-muted-dark mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
