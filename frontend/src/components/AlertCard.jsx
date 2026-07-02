import { Volume2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader } from "./ui/Card";
import { riskColor } from "../utils/colors";

export default function AlertCard({ alert, riskLabel }) {
  const active = alert?.fire;
  const color = active ? riskColor(alert.level || riskLabel) : "#22C55E";

  return (
    <Card className="space-y-3">
      <CardHeader title="Multilingual Alert" />
      <div
        className="rounded-[24px] border p-4 min-h-[132px] flex flex-col justify-between"
        style={{
          backgroundColor: active ? `${color}0D` : "#11151F",
          borderColor: active ? `${color}30` : "#2A2D35",
        }}
      >
        {active ? (
          <>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-snug">{alert.english}</p>
                {alert.hindi && (
                  <p className="text-sm text-sentinel-muted font-hindi leading-snug mt-1">{alert.hindi}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-sentinel-muted">
              <Volume2 className="w-4 h-4 text-sentinel-primary" />
              Voice alert active
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-sentinel-muted">
            <CheckCircle2 className="w-5 h-5 text-sentinel-success" />
            <span className="text-sm text-white">No active warnings detected</span>
          </div>
        )}
      </div>
    </Card>
  );
}
