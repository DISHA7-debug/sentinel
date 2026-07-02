import { useState, useEffect, useRef, useCallback } from "react";
import {
  BatteryCharging,
  Bell,
  Bluetooth,
  Car,
  Cloud,
  Grid,
  MapPin,
  Menu,
  Music2,
  Moon,
  Phone,
  Play,
  Power,
  Settings,
  SkipBack,
  SkipForward,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoiceAlert } from "./hooks/useVoiceAlert";
import SceneView from "./components/SceneView";
import AlertBanner from "./components/AlertBanner";
import RiskMeter from "./components/RiskMeter";
import SceneGraph from "./components/SceneGraph";
import SensorStatus from "./components/SensorStatus";

const sidebarButtons = [
  { label: "Car", icon: Car, active: true },
  { label: "Pin", icon: MapPin },
  { label: "Grid", icon: Grid },
  { label: "Location", icon: Menu },
  { label: "Settings", icon: Settings },
];

const driveModes = [
  { label: "Regular", active: true },
  { label: "Eco" },
  { label: "Sport" },
  { label: "Auto" },
];

const actionButtons = [
  { label: "Maps", icon: MapPin, active: true },
  { label: "Humidity", icon: Thermometer },
  { label: "Wind", icon: Wind },
  { label: "Bluetooth", icon: Bluetooth },
  { label: "Phone", icon: Phone },
  { label: "Music", icon: Music2 },
];

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stream";
const FRAME_INTERVAL_MS = 100;

const SAMPLE_INFERENCE_DATA = {
  detections: [
    { class_name: "pedestrian", confidence: 0.92, bbox: [0.16, 0.48, 0.34, 0.92] },
    { class_name: "car", confidence: 0.86, bbox: [0.52, 0.40, 0.78, 0.77] },
    { class_name: "pothole", confidence: 0.73, bbox: [0.12, 0.72, 0.22, 0.84] },
  ],
  saliency_map: null,
  risk_label: "LOW",
  risk_score: 0.18,
  latency_ms: 42,
  scene_graph: {
    nodes: [
      { id: "ego", label: "Ego Vehicle", type: "ego" },
      { id: "pedestrian", label: "Pedestrian", type: "pedestrian" },
      { id: "car", label: "Car", type: "car" },
    ],
    edges: [
      { source: "ego", target: "pedestrian", relation: "approaching", distance_m: 12.4 },
      { source: "ego", target: "car", relation: "ahead", distance_m: 24.8 },
    ],
  },
  alert: { fire: false, english: "", hindi: "" },
};

export default function App() {
  const { lastMessage, sendMessage, connected } = useWebSocket(WS_URL);
  const { speak } = useVoiceAlert();
  const [theme, setTheme] = useState("dark");
  const [inferenceData, setInferenceData] = useState(SAMPLE_INFERENCE_DATA);
  const [showSaliency, setShowSaliency] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState("camera");
  const [frameCount, setFrameCount] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const data = JSON.parse(lastMessage);
      setInferenceData(data);
      if (data.alert?.fire) {
        speak(data.alert.hindi || data.alert.english, data.alert.hindi ? "hi-IN" : "en-US");
      }
    } catch {
      // ignore malformed messages
    }
  }, [lastMessage, speak]);

  const captureAndSend = useCallback(() => {
    const video = videoRef.current;
    if (!video || !connected || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    canvas.getContext("2d").drawImage(video, 0, 0, 640, 640);
    const frame = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    setFrameCount((c) => c + 1);
    sendMessage(JSON.stringify({ camera_frame: frame, frame_id: Date.now() }));
  }, [connected, sendMessage]);

  useEffect(() => {
    const interval = setInterval(captureAndSend, FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [captureAndSend]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1680px] px-6 py-6">
        <div className="flex gap-4">
          <aside className="flex w-24 flex-col items-center gap-4 rounded-[26px] border border-[var(--card-border)] p-4 shadow-[0_45px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl" style={{ backgroundColor: "rgba(var(--card-rgb), 0.9)" }}>
            {sidebarButtons.map((button) => {
              const Icon = button.icon;
              return (
                <button
                  key={button.label}
                  type="button"
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                    button.active
                      ? "border border-[#37E36E]/50 bg-[var(--button)] text-[var(--text)] shadow-[0_18px_30px_rgba(55,227,110,0.18)]"
                      : "bg-[var(--button)] text-[var(--muted)] hover:border hover:border-[var(--card-border)]"
                  }`}
                  aria-label={button.label}
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            })}
          </aside>

          <main className="flex-1 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="glass-card p-5">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">9:45 am</p>
                <p className="mt-4 text-lg font-semibold text-[var(--text)]">Monday - November 24, 2025</p>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center gap-3">
                  <Cloud className="h-6 w-6 text-[var(--muted)]" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">29° C</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--text)]">22 MG Road, Pune, Maharashtra 411001</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Arjun Singh</p>
                    <p className="mt-3 text-lg font-semibold text-[var(--text)]">Profile</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full border border-[var(--card-border)]" style={{ backgroundColor: "rgba(var(--card-rgb), 0.85)" }} />
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--text)]">60%</p>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Battery</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Theme</p>
                  <button
                    type="button"
                    onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition"
                    style={{ backgroundColor: "rgba(var(--card-rgb), 0.8)" }}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr_0.95fr] gap-4">
              <div className="space-y-4">
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Tata Harrier</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">2024 Tata Harrier</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-2 text-xs uppercase tracking-[0.35em] text-[var(--muted)]" style={{ backgroundColor: "rgba(var(--card-rgb), 0.5)" }}>
                      P R N D
                    </div>
                  </div>

                  <div className="mt-6">
                    <SceneView
                      videoRef={videoRef}
                      detections={inferenceData?.detections || []}
                      saliencyMap={inferenceData?.saliency_map}
                      riskLabel={inferenceData?.risk_label}
                      showSaliency={showSaliency}
                      onToggleSaliency={() => setShowSaliency((current) => !current)}
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-4 gap-3">
                    {driveModes.map((mode) => (
                      <button
                        key={mode.label}
                        type="button"
                        className={`rounded-3xl border px-3 py-3 text-sm font-semibold uppercase tracking-[0.25em] transition ${
                          mode.active
                            ? "border-[#37E36E] bg-[#1f3122] text-[#37E36E] shadow-[0_16px_32px_rgba(55,227,110,0.18)]"
                            : "border-[var(--card-border)] bg-[var(--button)] text-[var(--muted)] hover:border-[var(--card-border)]"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[26px] border border-[var(--card-border)] p-3" style={{ backgroundColor: "rgba(var(--card-rgb), 0.8)" }}>
                    <div className="grid grid-cols-4 gap-3 text-center text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
                      {['P', 'R', 'N', 'D'].map((gear) => (
                        <div
                          key={gear}
                          className={`rounded-3xl px-3 py-3 ${gear === 'D' ? 'bg-[#1f4025] text-[#37E36E]' : 'bg-[var(--button)] text-[var(--muted)]'}`}
                        >
                          {gear}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Air Condition</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">16°C</p>
                    </div>
                    <button className="rounded-full border border-[var(--card-border)] p-3 text-[var(--text)] transition" style={{ backgroundColor: "rgba(var(--card-rgb), 0.8)" }}> <Thermometer className="h-5 w-5" /></button>
                  </div>

                  <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-4 rounded-[26px] border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.5)" }}>
                    <button className="flex h-14 w-14 items-center justify-center rounded-3xl border border-[var(--card-border)] bg-[var(--button)] text-[var(--text)] text-3xl">-</button>
                    <div className="text-center text-5xl font-semibold text-[var(--text)]">16°C</div>
                    <button className="flex h-14 w-14 items-center justify-center rounded-3xl border border-[var(--card-border)] bg-[var(--button)] text-[var(--text)] text-3xl">+</button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
                    <div className="rounded-3xl border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.7)" }}>
                      <p>Fan</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">Mid</p>
                    </div>
                    <div className="rounded-3xl border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.7)" }}>
                      <p>Timer</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">5h</p>
                    </div>
                    <div className="rounded-3xl border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.7)" }}>
                      <p>Power</p>
                      <p className="mt-2 inline-flex items-center justify-center rounded-full bg-[#FF3B30] px-2 py-1 text-sm font-semibold text-[var(--text)]">On</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">System Status</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">{connected ? "Live stream connected" : "Offline — reconnecting"}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${connected ? "bg-[#1b2f1b] text-[#37E36E]" : "bg-[#3d1515] text-[#f97316]"}`}>
                      <span className="text-xs font-semibold uppercase tracking-[0.35em]">{connected ? "LIVE" : "OFF"}</span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.7)" }}>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Inference Latency</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{inferenceData?.latency_ms ?? "--"} ms</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--card-border)] p-4" style={{ backgroundColor: "rgba(var(--card-rgb), 0.7)" }}>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Frames Sent</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{frameCount}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6">
                  <RiskMeter score={inferenceData?.risk_score ?? 0} label={inferenceData?.risk_label ?? "LOW"} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-card p-6">
                  <SensorStatus
                    connected={connected}
                    latencyMs={inferenceData?.latency_ms ?? 0}
                    selectedSensor={selectedSensor}
                    onSensorSelect={setSelectedSensor}
                  />
                </div>

                <div className="glass-card p-6">
                  <SceneGraph data={inferenceData?.scene_graph || { nodes: [], edges: [] }} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
