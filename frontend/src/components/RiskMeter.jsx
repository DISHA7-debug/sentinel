import { useEffect, useRef } from "react";
import { riskColor } from "../utils/colors";
import { Card, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

export default function RiskMeter({ score = 0, label = "LOW" }) {
  const canvasRef = useRef(null);
  const animRef = useRef({ current: 0, target: 0 });
  const rafRef = useRef(null);

  useEffect(() => {
    animRef.current.target = score;
  }, [score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const cx = 110;
    const cy = 105;
    const r = 78;
    const color = riskColor(label);

    const draw = () => {
      const anim = animRef.current;
      const diff = anim.target - anim.current;
      if (Math.abs(diff) > 0.002) {
        anim.current += diff * 0.12;
      } else {
        anim.current = anim.target;
      }

      ctx.clearRect(0, 0, 220, 145);

      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = "#2A2D35";
      ctx.lineWidth = 12;
      ctx.stroke();

      const angle = Math.PI + anim.current * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 32px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(Math.round(anim.current * 100).toString(), cx, cy + 8);

      ctx.fillStyle = "#6B7280";
      ctx.font = "500 10px Inter, system-ui, sans-serif";
      ctx.fillText("COLLISION RISK", cx, cy + 26);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [label]);

  const badgeVariant =
    label === "CRITICAL" ? "critical" : label === "HIGH" || label === "MEDIUM" ? "warning" : "success";

  return (
    <Card className="flex flex-col items-center">
      <CardHeader title="Risk Assessment" className="w-full" />
      <canvas ref={canvasRef} width={220} height={145} className="mx-auto" />
      <Badge variant={badgeVariant} className="mt-2">
        {label}
      </Badge>
      <div className="w-full mt-4 grid grid-cols-4 gap-1">
        {[
          { key: "LOW", threshold: "< 30" },
          { key: "MEDIUM", threshold: "30–60" },
          { key: "HIGH", threshold: "60–80" },
          { key: "CRITICAL", threshold: "> 80" },
        ].map(({ key, threshold }) => (
          <div
            key={key}
            className="text-center py-1.5 rounded border border-sentinel-border-subtle"
            style={{
              backgroundColor: label === key ? `${riskColor(key)}15` : "transparent",
              borderColor: label === key ? `${riskColor(key)}40` : undefined,
            }}
          >
            <p className="text-[9px] font-semibold" style={{ color: riskColor(key) }}>
              {key}
            </p>
            <p className="text-[8px] text-sentinel-muted-dark">{threshold}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
