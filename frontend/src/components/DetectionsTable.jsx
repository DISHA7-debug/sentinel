import { classColor, formatClassName } from "../utils/colors";
import { Card, CardHeader } from "./ui/Card";
export default function DetectionsTable({ detections = [] }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Detected Objects"
        subtitle={`${detections.length} active detection${detections.length !== 1 ? "s" : ""}`}
      />
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-sentinel-border-subtle">
              <th className="pb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-sentinel-muted-dark">
                Class
              </th>
              <th className="pb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-sentinel-muted-dark">
                Confidence
              </th>
              <th className="pb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-sentinel-muted-dark hidden sm:table-cell">
                BBox
              </th>
            </tr>
          </thead>
          <tbody>
            {detections.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-xs text-sentinel-muted-dark">
                  No objects detected
                </td>
              </tr>
            ) : (
              detections.map((det, i) => {
                const color = classColor(det.class_name);
                const pct = (det.confidence * 100).toFixed(1);
                return (
                  <tr
                    key={`${det.class_name}-${i}`}
                    className="border-b border-sentinel-border-subtle/50 last:border-0"
                  >
                    <td className="py-2.5 px-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-white capitalize">
                          {formatClassName(det.class_name)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-sentinel-border-subtle rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-sentinel-muted">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-1 hidden sm:table-cell">
                      <span className="text-[10px] font-mono text-sentinel-muted-dark">
                        [{det.bbox.map((v) => v.toFixed(2)).join(", ")}]
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
