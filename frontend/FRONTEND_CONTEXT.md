# FRONTEND CONTEXT — SENTINEL HMI Dashboard
**Stack: React 18 · Vite · TailwindCSS · D3.js · Web Speech API**

---

## Your Responsibility

Build the real-time ADAS dashboard that the driver sees. It connects to the backend via WebSocket and displays:
- Live camera feed with saliency heatmap overlay
- Risk score gauge (animated)
- Object detection bounding boxes
- Hindi/English voice + visual alerts
- Dynamic scene graph
- Sensor health status

---

## Setup

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install tailwindcss d3 @radix-ui/react-progress lucide-react
```

---

## `src/App.jsx`
```jsx
import { useState, useEffect, useRef } from "react";
import SceneView from "./components/SceneView";
import RiskMeter from "./components/RiskMeter";
import AlertBanner from "./components/AlertBanner";
import SceneGraph from "./components/SceneGraph";
import SensorStatus from "./components/SensorStatus";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoiceAlert } from "./hooks/useVoiceAlert";

export default function App() {
  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stream";
  const { lastMessage, sendMessage, connected } = useWebSocket(WS_URL);
  const { speak } = useVoiceAlert();
  const [inferenceData, setInferenceData] = useState(null);
  const videoRef = useRef(null);

  // Process incoming inference results
  useEffect(() => {
    if (!lastMessage) return;
    const data = JSON.parse(lastMessage);
    setInferenceData(data);
    if (data.alert?.fire) speak(data.alert.hindi || data.alert.english, "hi-IN");
  }, [lastMessage]);

  // Capture frames from demo video and send to backend
  useEffect(() => {
    const interval = setInterval(() => {
      if (!videoRef.current || !connected) return;
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 640;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0, 640, 640);
      const frame = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      sendMessage(JSON.stringify({ camera_frame: frame, frame_id: Date.now() }));
    }, 100); // 10 fps
    return () => clearInterval(interval);
  }, [connected]);

  return (
    <div className="bg-gray-950 text-white min-h-screen p-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-blue-400">SENTINEL ADAS</h1>
        <div className="flex gap-2 items-center">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`}/>
          <span className="text-xs text-gray-400">{connected ? "LIVE" : "DISCONNECTED"}</span>
          {inferenceData && (
            <span className="text-xs text-gray-500">{inferenceData.latency_ms}ms</span>
          )}
        </div>
      </div>

      {/* Alert Banner — full width, top priority */}
      {inferenceData?.alert?.fire && (
        <AlertBanner alert={inferenceData.alert} />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left: Camera + saliency overlay */}
        <div className="col-span-2">
          <SceneView
            videoRef={videoRef}
            detections={inferenceData?.detections || []}
            saliencyMap={inferenceData?.saliency_map}
            riskLabel={inferenceData?.risk_label}
          />
        </div>

        {/* Right: Risk + scene graph */}
        <div className="flex flex-col gap-4">
          <RiskMeter score={inferenceData?.risk_score ?? 0} label={inferenceData?.risk_label ?? "LOW"} />
          <SceneGraph data={inferenceData?.scene_graph} />
          <SensorStatus />
        </div>
      </div>

      {/* Hidden video element for demo footage */}
      <video ref={videoRef} src="/demo_footage.mp4" autoPlay muted loop className="hidden" />
    </div>
  );
}
```

---

## `src/components/SceneView.jsx`
```jsx
import { useRef, useEffect } from "react";

const RISK_COLORS = { LOW: "#22c55e", MEDIUM: "#eab308", HIGH: "#f97316", CRITICAL: "#ef4444" };
const CLASS_COLORS = {
  cattle: "#ff6b6b", auto_rickshaw: "#ffd93d", pedestrian: "#6bcb77",
  pothole: "#4d96ff", car: "#ffffff", truck: "#c0c0c0", default: "#a0a0a0"
};

export default function SceneView({ videoRef, detections, saliencyMap, riskLabel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoRef.current) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // Draw video frame
    ctx.drawImage(videoRef.current, 0, 0, W, H);

    // Draw saliency heatmap overlay (semi-transparent)
    if (saliencyMap) {
      const img = new Image();
      img.src = `data:image/png;base64,${saliencyMap}`;
      img.onload = () => {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.globalAlpha = 1.0;
        drawBoxes(ctx, detections, W, H);
      };
    } else {
      drawBoxes(ctx, detections, W, H);
    }
  }, [detections, saliencyMap]);

  function drawBoxes(ctx, detections, W, H) {
    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const color = CLASS_COLORS[det.class_name] || CLASS_COLORS.default;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * W, y1 * H, (x2 - x1) * W, (y2 - y1) * H);
      ctx.fillStyle = color;
      ctx.font = "11px monospace";
      ctx.fillText(
        `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`,
        x1 * W + 4, y1 * H - 4
      );
    });
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700">
      <canvas
        ref={canvasRef}
        width={640} height={480}
        className="w-full"
      />
      {riskLabel && (
        <div
          className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold"
          style={{ backgroundColor: RISK_COLORS[riskLabel] + "33", color: RISK_COLORS[riskLabel], border: `1px solid ${RISK_COLORS[riskLabel]}` }}
        >
          {riskLabel} RISK
        </div>
      )}
    </div>
  );
}
```

---

## `src/components/RiskMeter.jsx`
```jsx
import { useEffect, useRef } from "react";

const COLORS = { LOW: "#22c55e", MEDIUM: "#eab308", HIGH: "#f97316", CRITICAL: "#ef4444" };

export default function RiskMeter({ score, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cx = 100, cy = 100, r = 75;
    ctx.clearRect(0, 0, 200, 130);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 14;
    ctx.stroke();

    // Score arc
    const angle = Math.PI + (score * Math.PI);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    ctx.strokeStyle = COLORS[label] || "#22c55e";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score text
    ctx.fillStyle = COLORS[label] || "#22c55e";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText((score * 100).toFixed(0), cx, cy + 10);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px monospace";
    ctx.fillText("RISK SCORE", cx, cy + 28);
  }, [score, label]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 flex flex-col items-center">
      <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Collision Risk</p>
      <canvas ref={canvasRef} width={200} height={130} />
      <div
        className="mt-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
        style={{ backgroundColor: (COLORS[label] || "#22c55e") + "22", color: COLORS[label] || "#22c55e" }}
      >
        {label}
      </div>
    </div>
  );
}
```

---

## `src/components/AlertBanner.jsx`
```jsx
export default function AlertBanner({ alert }) {
  return (
    <div className={`w-full rounded-xl p-4 mb-4 border-2 flex items-center gap-4 animate-pulse
      ${alert.level === "CRITICAL" ? "bg-red-950 border-red-500" : "bg-orange-950 border-orange-500"}`}>
      <span className="text-3xl">⚠️</span>
      <div>
        <p className="text-white font-bold text-lg">{alert.english}</p>
        <p className="text-gray-300 text-base" style={{ fontFamily: "Noto Sans Devanagari, sans-serif" }}>
          {alert.hindi}
        </p>
      </div>
    </div>
  );
}
```

---

## `src/hooks/useWebSocket.js`
```js
import { useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(url) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    ws.current = new WebSocket(url);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => setLastMessage(e.data);
    return () => ws.current?.close();
  }, [url]);

  const sendMessage = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(msg);
  }, []);

  return { lastMessage, sendMessage, connected };
}
```

---

## `src/hooks/useVoiceAlert.js`
```js
import { useCallback, useRef } from "react";

export function useVoiceAlert() {
  const lastSpoken = useRef("");

  const speak = useCallback((text, lang = "hi-IN") => {
    if (!text || text === lastSpoken.current) return;
    if (!window.speechSynthesis) return;
    lastSpoken.current = text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setTimeout(() => { lastSpoken.current = ""; }, 4000); // allow re-trigger after 4s
  }, []);

  return { speak };
}
```

---

## `src/components/SceneGraph.jsx`
```jsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function SceneGraph({ data }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const W = 280, H = 200;

    const nodes = data.nodes || [];
    const links = data.edges || [];

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(50))
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(W / 2, H / 2));

    svg.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", "#4b5563").attr("stroke-width", 1.5);

    const node = svg.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("r", 8).attr("fill", d => d.type === "hazard" ? "#ef4444" : "#3b82f6");

    svg.append("g").selectAll("text").data(nodes).join("text")
      .text(d => d.label).attr("font-size", 9).attr("fill", "#d1d5db")
      .attr("dx", 12).attr("dy", 4);

    sim.on("tick", () => {
      svg.selectAll("line")
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("cx", d => d.x).attr("cy", d => d.y);
      svg.selectAll("text").attr("x", d => d.x).attr("y", d => d.y);
    });
  }, [data]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-3">
      <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Scene Graph</p>
      <svg ref={svgRef} width="100%" height="180" />
    </div>
  );
}
```

---

## `package.json`
```json
{
  "name": "sentinel-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "d3": "^7.9.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

---

## Frontend–Backend Contract

The frontend sends to `/ws/stream`:
```json
{ "camera_frame": "<base64 jpeg>", "frame_id": 1234567890 }
```

The backend responds with (see `InferenceResult` schema):
```json
{
  "detections": [{"class_name": "cattle", "confidence": 0.91, "bbox": [0.3, 0.4, 0.6, 0.8]}],
  "risk_score": 0.82,
  "risk_label": "CRITICAL",
  "saliency_map": "<base64 png>",
  "alert": {"fire": true, "english": "...", "hindi": "...", "level": "CRITICAL"},
  "scene_graph": {"nodes": [...], "edges": [...]},
  "latency_ms": 47.3,
  "timestamp": 1718000000.0
}
```
