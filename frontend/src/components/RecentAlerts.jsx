import { Bell } from "lucide-react";
import { Card, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { formatTimestamp, riskColor } from "../utils/colors";

export default function RecentAlerts({ alerts = [] }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Recent Alerts"
        subtitle={alerts.length > 0 ? `${alerts.length} recorded` : "No alerts yet"}
      />
      <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sentinel-muted-dark">
            <Bell className="w-5 h-5 mb-2 opacity-40" />
            <p className="text-xs">Alerts will appear here when hazards are detected</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const variant =
              alert.level === "CRITICAL"
                ? "critical"
                : alert.level === "HIGH" || alert.level === "MEDIUM"
                  ? "warning"
                  : "default";

            return (
              <div key={alert.id} className="rounded-[20px] border border-sentinel-border-subtle bg-[#11151F] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white leading-snug line-clamp-2">{alert.english}</p>
                    {alert.hindi && (
                      <p className="text-[11px] text-sentinel-muted font-hindi line-clamp-1 mt-1">
                        {alert.hindi}
                      </p>
                    )}
                  </div>
                  <Badge variant={variant}>{alert.level}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-sentinel-muted-dark">
                  <span>{formatTimestamp(alert.timestamp)}</span>
                  {alert.riskScore != null && (
                    <span className="font-semibold" style={{ color: riskColor(alert.level) }}>
                      {(alert.riskScore * 100).toFixed(0)}% risk
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
