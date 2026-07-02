from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class Detection:
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float
    image_width: float
    image_height: float


class RiskScorer:
    def __init__(self):
        self.class_base_risk = {
            "car": 0.25,
            "truck": 0.45,
            "bus": 0.45,
            "motorcycle": 0.40,
            "bicycle": 0.45,
            "pedestrian": 0.80,
            "rider": 0.65,
            "auto_rickshaw": 0.55,
            "animal": 0.85,
            "traffic_sign": 0.20,
            "traffic_light": 0.20,
            "vehicle_fallback": 0.30,
            "pothole": 0.75,
            "crack": 0.45,
        }

    def score_detection(self, det: Detection) -> Dict[str, Any]:
        base = self.class_base_risk.get(det.class_name, 0.30)

        width = max(det.x2 - det.x1, 1)
        height = max(det.y2 - det.y1, 1)
        box_area_ratio = (width * height) / max(det.image_width * det.image_height, 1)

        cx = (det.x1 + det.x2) / 2
        cy = (det.y1 + det.y2) / 2

        cx_norm = cx / det.image_width
        cy_norm = cy / det.image_height

        score = base

        # Object close to horizontal center of driving path
        if 0.35 <= cx_norm <= 0.65:
            score += 0.15

        # Object near lower part of frame usually means closer to vehicle
        if cy_norm >= 0.60:
            score += 0.15

        # Large bounding box means object is close or visually dominant
        if box_area_ratio >= 0.08:
            score += 0.20
        elif box_area_ratio >= 0.04:
            score += 0.10

        # Low confidence penalty
        if det.confidence < 0.40:
            score -= 0.10

        score = max(0.0, min(score, 1.0))
        level = self.score_to_level(score)

        return {
            "class_name": det.class_name,
            "confidence": det.confidence,
            "risk_score": round(score, 3),
            "risk_level": level,
            "box_area_ratio": round(box_area_ratio, 4),
            "center_x_norm": round(cx_norm, 3),
            "center_y_norm": round(cy_norm, 3),
        }

    @staticmethod
    def score_to_level(score: float) -> str:
        if score >= 0.80:
            return "Critical"
        elif score >= 0.60:
            return "High"
        elif score >= 0.30:
            return "Medium"
        return "Low"
