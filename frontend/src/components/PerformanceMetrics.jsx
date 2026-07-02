import { Activity, Clock, Zap, Wifi } from "lucide-react";
import { Card, CardHeader } from "./ui/Card";
import { MetricRow } from "./ui/ProgressBar";
import { riskColor } from "../utils/colors";

export default function PerformanceMetrics({
  latencyMs,
  fps,
  connected,
  riskScore,
  riskLabel,
  detectionCount,
  frameCount,
}) {
  const latencyColor =
    latencyMs == null
      ? undefined
      : latencyMs > 80
        ? "#EF4444"
        : latencyMs > 50
          ? "#F59E0B"
          : "#22C55E";

  return (
    <Card className="h-full">
      <CardHeader title="Performance" subtitle="Real-time pipeline metrics" />
      <div className="space-y-0">
        <MetricRow
          label="Inference Latency"
          value={latencyMs != null ? latencyMs.toFixed(1) : "—"}
          unit={latencyMs != null ? "ms" : undefined}
          accent={latencyColor}
        />
        <MetricRow label="Stream FPS" value={fps || "—"} unit={fps ? "fps" : undefined} />
        <MetricRow
          label="WebSocket"
          value={connected ? "Connected" : "Disconnected"}
          accent={connected ? "#22C55E" : "#EF4444"}
        />
        <MetricRow
          label="Risk Score"
          value={riskScore != null ? (riskScore * 100).toFixed(0) : "—"}
          unit={riskScore != null ? "%" : undefined}
          accent={riskLabel ? riskColor(riskLabel) : undefined}
        />
        <MetricRow label="Detections" value={detectionCount ?? 0} />
        <MetricRow label="Frames Processed" value={frameCount ?? 0} />
      </div>

      <div className="mt-4 pt-3 border-t border-sentinel-border-subtle grid grid-cols-4 gap-2">
        {[
          { icon: Clock, label: "Latency", ok: latencyMs != null && latencyMs < 100 },
          { icon: Zap, label: "FPS", ok: fps >= 8 },
          { icon: Wifi, label: "Stream", ok: connected },
          { icon: Activity, label: "Pipeline", ok: latencyMs != null },
        ].map(({ icon: Icon, label, ok }) => (
          <div
            key={label}
            className="flex flex-col items-center py-2 rounded border border-sentinel-border-subtle"
          >
            <Icon
              className="w-3.5 h-3.5 mb-1"
              style={{ color: ok ? "#22C55E" : "#6B7280" }}
            />
            <span className="text-[9px] text-sentinel-muted-dark">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
