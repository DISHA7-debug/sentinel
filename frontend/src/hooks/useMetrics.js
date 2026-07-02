import { useRef, useEffect, useState } from "react";

export function useFpsCounter(active = true) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!active) {
      setFps(0);
      return;
    }

    let rafId;
    const tick = () => {
      frameCount.current += 1;
      const now = performance.now();
      const elapsed = now - lastTime.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastTime.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  return fps;
}

export function useRecentAlerts(inferenceData, maxItems = 8) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!inferenceData?.alert?.fire) return;

    const entry = {
      id: `${inferenceData.timestamp}-${inferenceData.alert.level}`,
      english: inferenceData.alert.english,
      hindi: inferenceData.alert.hindi,
      level: inferenceData.alert.level,
      riskScore: inferenceData.risk_score,
      timestamp: inferenceData.timestamp,
    };

    setAlerts((prev) => {
      const last = prev[0];
      if (last && last.english === entry.english) return prev;
      return [entry, ...prev].slice(0, maxItems);
    });
  }, [inferenceData, maxItems]);

  return alerts;
}
