import { Camera, Radar, Radio, Compass, MapPin, Cpu } from "lucide-react";
import { Card, CardHeader } from "./ui/Card";
import { StatusChip } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";

const SENSORS = [
  { id: "camera", label: "Front Camera", icon: Camera, required: true },
  { id: "lidar", label: "LiDAR", icon: Radar, required: false },
  { id: "radar", label: "Radar", icon: Radio, required: false },
  { id: "imu", label: "IMU", icon: Compass, required: false },
  { id: "gps", label: "GPS", icon: MapPin, required: false },
  { id: "edge", label: "Edge Compute", icon: Cpu, required: true },
];

function sensorStatus(id, connected, latencyMs) {
  if (id === "edge") {
    if (!connected) return { status: "offline", health: 0 };
    if (latencyMs > 80) return { status: "degraded", health: 65 };
    if (latencyMs > 50) return { status: "online", health: 85 };
    return { status: "online", health: 98 };
  }
  if (id === "camera") {
    return connected ? { status: "online", health: 100 } : { status: "offline", health: 0 };
  }
  return connected
    ? { status: "idle", health: 0 }
    : { status: "offline", health: 0 };
}

export default function SensorStatus({ connected, latencyMs, selectedSensor, onSensorSelect = () => {} }) {
  return (
    <Card>
      <CardHeader title="Sensor Health" />
      <div className="space-y-3">
        {SENSORS.map(({ id, label, icon: Icon, required }) => {
          const { status, health } = sensorStatus(id, connected, latencyMs);
          const isActive = status === "online" || (id === "camera" && connected);
          const isSelected = selectedSensor === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSensorSelect(id)}
              className={`w-full text-left rounded-3xl border px-3 py-3 transition ${isSelected ? "border-sentinel-primary bg-[#16243a]" : "border-sentinel-border-subtle bg-[#0D1016] hover:border-sentinel-primary/40"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border"
                  style={{
                    backgroundColor: isActive ? "#3B82F610" : "#161920",
                    borderColor: isSelected ? "#3B82F6" : "rgba(255,255,255,0.08)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: isActive ? "#3B82F6" : "#6B7280" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <StatusChip
                      label={
                        status === "idle"
                          ? "Optional"
                          : status === "online"
                            ? "Active"
                            : status === "degraded"
                              ? "Degraded"
                              : "Offline"
                      }
                      status={status}
                    />
                  </div>
                  {isActive && (
                    <ProgressBar
                      value={health}
                      color={
                        status === "degraded"
                          ? "#F59E0B"
                          : health > 90
                            ? "#22C55E"
                            : "#3B82F6"
                      }
                    />
                  )}
                  {!required && status === "idle" && (
                    <p className="text-[10px] text-sentinel-muted-dark">Not connected</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
