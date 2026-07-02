import { useRef, useEffect, useCallback, useState } from "react";
import { Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { RISK_COLORS, classColor } from "../utils/colors";
import { Badge } from "./ui/Badge";

export default function SceneView({
  videoRef,
  detections = [],
  saliencyMap,
  riskLabel,
  showSaliency = true,
  onToggleSaliency,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const saliencyImgRef = useRef(null);
  const rafRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const drawBoxes = useCallback((ctx, dets, W, H) => {
    dets.forEach((det) => {
      const [x1, y1, x2, y2] = det.bbox;
      const color = classColor(det.class_name);
      const px = x1 * W;
      const py = y1 * H;
      const pw = (x2 - x1) * W;
      const ph = (y2 - y1) * H;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px, py, pw, ph);

      const label = `${det.class_name.replace(/_/g, " ")} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      const textW = ctx.measureText(label).width;
      const labelH = 20;

      ctx.fillStyle = "rgba(15, 17, 21, 0.92)";
      ctx.fillRect(px - 1, py - labelH, textW + 14, labelH);
      ctx.fillStyle = color;
      ctx.fillText(label, px + 6, py - 6);
    });
  }, []);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef?.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.drawImage(video, 0, 0, W, H);

    if (showSaliency && saliencyMap && saliencyImgRef.current?.complete) {
      ctx.globalAlpha = 0.32;
      ctx.drawImage(saliencyImgRef.current, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    drawBoxes(ctx, detections, W, H);
  }, [videoRef, detections, saliencyMap, showSaliency, drawBoxes]);

  useEffect(() => {
    if (!saliencyMap) {
      saliencyImgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = `data:image/png;base64,${saliencyMap}`;
    img.onload = () => {
      saliencyImgRef.current = img;
    };
  }, [saliencyMap]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const loop = () => {
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  const riskColor = RISK_COLORS[riskLabel] || RISK_COLORS.LOW;

  return (
    <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-sentinel-border-subtle bg-black">
      <canvas ref={canvasRef} width={640} height={480} className="w-full aspect-[4/3] object-cover" />

      <div className="absolute inset-0 bg-gradient-to-t from-sentinel-bg/70 via-transparent to-transparent pointer-events-none" />

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-border-subtle bg-[#0B0D11] px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-white/80">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-border-subtle bg-[#0B0D11]/95 px-3 py-1 text-xs text-sentinel-muted-dark">
          {detections.length} object{detections.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleSaliency}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-black/80"
        >
          {showSaliency ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          XAI Overlay
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!containerRef.current) return;
            if (document.fullscreenElement === containerRef.current) {
              await document.exitFullscreen();
            } else if (containerRef.current.requestFullscreen) {
              await containerRef.current.requestFullscreen();
            }
          }}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-black/80"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFullscreen ? "Exit" : "Fullscreen"}
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-sentinel-primary to-transparent" />

      {riskLabel && (
        <div className="absolute bottom-4 left-4 rounded-2xl border border-sentinel-border-subtle bg-[#0B0D11]/95 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-white/80">
          <span className="font-semibold" style={{ color: riskColor }}>
            {riskLabel}
          </span>{" "}
          collision risk
        </div>
      )}
    </div>
  );
}
