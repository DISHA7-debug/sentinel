from pathlib import Path
import pandas as pd
import json


class SceneFusionEngine:
    def __init__(self):
        self.vulnerable_classes = {
            "pedestrian", "rider", "bicycle", "motorcycle", "animal", "pothole"
        }

    def score_to_level(self, score):
        if score >= 0.80:
            return "Critical"
        elif score >= 0.60:
            return "High"
        elif score >= 0.30:
            return "Medium"
        return "Low"

    def action_from_level(self, level):
        actions = {
            "Low": "Continue driving normally",
            "Medium": "Stay alert and monitor road condition",
            "High": "Slow down and prepare to brake",
            "Critical": "Immediate driver alert: brake or avoid obstacle",
        }
        return actions.get(level, "Monitor road scene")

    def fuse_image_scene(self, image_name, group):
        max_risk = float(group["risk_score"].max())
        avg_risk = float(group["risk_score"].mean())
        critical_count = int((group["risk_level"] == "Critical").sum())
        high_count = int((group["risk_level"] == "High").sum())
        vulnerable_count = int(group["class_name"].isin(self.vulnerable_classes).sum())
        total_objects = int(len(group))

        score = 0.0
        score += 0.50 * max_risk
        score += 0.20 * avg_risk
        score += 0.15 * min(critical_count / 3, 1.0)
        score += 0.10 * min(high_count / 5, 1.0)
        score += 0.05 * min(vulnerable_count / 5, 1.0)
        score = max(0.0, min(score, 1.0))

        level = self.score_to_level(score)
        top_objects = group.sort_values(by="risk_score", ascending=False).head(3)

        reasons = []
        if critical_count > 0:
            reasons.append(f"{critical_count} critical-risk object(s) detected.")
        if high_count > 0:
            reasons.append(f"{high_count} high-risk object(s) detected.")
        if vulnerable_count > 0:
            reasons.append(f"{vulnerable_count} vulnerable/high-priority object(s) present.")
        if max_risk >= 0.80:
            reasons.append("At least one object has critical individual risk.")
        elif max_risk >= 0.60:
            reasons.append("At least one object has high individual risk.")
        if len(reasons) == 0:
            reasons.append("No immediate high-risk object detected.")

        top_object_summary = '; '.join([
            f"{row['class_name']}({row['risk_level']}, {row['risk_score']})"
            for _, row in top_objects.iterrows()
        ])

        return {
            "image": image_name,
            "scene_risk_score": round(score, 3),
            "scene_risk_level": level,
            "recommended_action": self.action_from_level(level),
            "total_objects": total_objects,
            "max_object_risk": round(max_risk, 3),
            "average_object_risk": round(avg_risk, 3),
            "critical_object_count": critical_count,
            "high_object_count": high_count,
            "vulnerable_object_count": vulnerable_count,
            "top_risky_objects": top_object_summary,
            "fusion_explanation": " ".join(reasons),
        }

    def run(self, risk_csv_path, output_dir):
        risk_csv_path = Path(risk_csv_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        df = pd.read_csv(risk_csv_path)

        scene_rows = []
        for image_name, group in df.groupby("image"):
            scene_rows.append(self.fuse_image_scene(image_name, group))

        scene_df = pd.DataFrame(scene_rows)
        scene_df = scene_df.sort_values(by="scene_risk_score", ascending=False)

        output_csv = output_dir / "model1_scene_fusion_outputs.csv"
        scene_df.to_csv(output_csv, index=False)

        summary = {
            "total_scenes": int(len(scene_df)),
            "scene_risk_level_counts": scene_df["scene_risk_level"].value_counts().to_dict(),
            "highest_risk_scene": scene_df.iloc[0].to_dict() if len(scene_df) > 0 else None,
            "output_csv": str(output_csv),
        }

        output_json = output_dir / "model1_scene_fusion_summary.json"
        with open(output_json, 'w') as f:
            json.dump(summary, f, indent=4)

        return scene_df, summary