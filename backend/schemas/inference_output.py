from pydantic import BaseModel
from typing import Optional, List, Any

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalized 0-1
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    box_area_ratio: Optional[float] = None
    center_x_norm: Optional[float] = None
    center_y_norm: Optional[float] = None

class AlertPayload(BaseModel):
    fire: bool
    english: Optional[str] = None
    hindi: Optional[str] = None
    level: Optional[str] = None  # LOW | MEDIUM | HIGH | CRITICAL

class SceneNode(BaseModel):
    id: str
    label: str
    type: str
    x: float
    y: float

class SceneEdge(BaseModel):
    source: str
    target: str
    relation: str
    distance_m: float

class SceneGraph(BaseModel):
    nodes: List[SceneNode] = []
    edges: List[SceneEdge] = []

class InferenceResult(BaseModel):
    scene_graph: Optional[SceneGraph] = None
    detections: List[Detection] = []
    risk_score: float  # 0.0 - 1.0
    risk_label: str  # LOW | MEDIUM | HIGH | CRITICAL
    saliency_map: Optional[str] = None  # base64 PNG string or null
    alert: AlertPayload
    latency_ms: float
    timestamp: float
    recommended_action: Optional[str] = None
    fusion_explanation: Optional[str] = None
    top_risky_objects: Optional[str] = None
    total_objects: Optional[int] = None
    max_object_risk: Optional[float] = None
    average_object_risk: Optional[float] = None
    critical_object_count: Optional[int] = None
    high_object_count: Optional[int] = None
    vulnerable_object_count: Optional[int] = None

