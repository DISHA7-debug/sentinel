# BACKEND CONTEXT — SENTINEL
**Owner: Backend Lead**
**Stack: Python · FastAPI · ONNX Runtime · WebSocket · Docker**

---

## Your Responsibility

You own everything in `backend/`. Your job is to:
1. Load all 5 ONNX model files at startup
2. Expose REST + WebSocket endpoints
3. Orchestrate the inference pipeline (call models in correct order)
4. Stream results to the frontend in real time
5. Handle federated model update uploads from fleet devices

You do NOT train models. ML engineers give you `.onnx` files and you run them.

---

## File-by-File Implementation Guide

### `main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import inference, stream, fleet, health
from core.pipeline import InferencePipeline
from contextlib import asynccontextmanager

pipeline = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    pipeline = InferencePipeline()
    pipeline.load_all_models()   # loads all 5 ONNX models at startup
    yield
    pipeline.cleanup()

app = FastAPI(title="SENTINEL API", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(health.router, prefix="/health")
app.include_router(inference.router, prefix="/api")
app.include_router(stream.router, prefix="/ws")
app.include_router(fleet.router, prefix="/api/fleet")
```

---

### `core/pipeline.py` — THE MOST IMPORTANT FILE
```python
import onnxruntime as ort
import numpy as np
import time

class InferencePipeline:
    def __init__(self):
        self.sessions = {}   # model_name → onnxruntime.InferenceSession

    def load_all_models(self):
        model_paths = {
            "fusion":     "models/weights/model1_fusion.onnx",
            "classifier": "models/weights/model2_classifier.onnx",
            "risk":       "models/weights/model3_risk.onnx",
            "xai":        "models/weights/model4_xai.onnx",
        }
        for name, path in model_paths.items():
            self.sessions[name] = ort.InferenceSession(
                path,
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
            )
        print("✅ All models loaded")

    def run(self, sensor_payload: dict) -> dict:
        t0 = time.time()

        # Step 1: Fusion — combine all sensor inputs into scene embedding
        fusion_input = self._prepare_fusion_input(sensor_payload)
        scene_embedding, scene_graph = self._run_fusion(fusion_input)

        # Step 2: Classifier — identify India-specific objects/hazards
        classifier_input = self._prepare_classifier_input(sensor_payload["camera_frame"])
        detections = self._run_classifier(classifier_input)

        # Step 3: Risk Scoring — predict collision probability
        risk_input = self._prepare_risk_input(scene_embedding, detections)
        risk_score, risk_label = self._run_risk(risk_input)

        # Step 4: XAI — generate saliency map for top hazard
        saliency_map = self._run_xai(classifier_input, detections)

        latency_ms = (time.time() - t0) * 1000

        return {
            "scene_graph": scene_graph,
            "detections": detections,
            "risk_score": float(risk_score),
            "risk_label": risk_label,         # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
            "saliency_map": saliency_map,     # base64 PNG overlay
            "alert": self._build_alert(risk_label, detections),
            "latency_ms": round(latency_ms, 2),
            "timestamp": time.time()
        }

    def _run_fusion(self, inputs):
        session = self.sessions["fusion"]
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: inputs})
        # outputs[0] = scene_embedding (float32 vector)
        # outputs[1] = scene_graph nodes (JSON-serializable dict from model)
        return outputs[0], outputs[1]

    def _run_classifier(self, frame):
        session = self.sessions["classifier"]
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: frame})
        # outputs[0] = boxes, outputs[1] = scores, outputs[2] = class_ids
        return self._parse_detections(outputs)

    def _run_risk(self, embedding, detections):
        session = self.sessions["risk"]
        inputs = np.concatenate([embedding, self._detections_to_vector(detections)])
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: inputs[np.newaxis, :]})
        score = float(outputs[0][0])
        label = "CRITICAL" if score > 0.8 else "HIGH" if score > 0.6 else "MEDIUM" if score > 0.3 else "LOW"
        return score, label

    def _run_xai(self, frame, detections):
        if not detections:
            return None
        session = self.sessions["xai"]
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: frame})
        # outputs[0] = saliency map as (H, W) float32 array
        return self._saliency_to_base64(outputs[0])

    def _build_alert(self, risk_label, detections):
        if risk_label in ("HIGH", "CRITICAL"):
            top = detections[0]["class_name"] if detections else "hazard"
            return {
                "fire": True,
                "english": f"WARNING: {top} detected ahead. Brake assist active.",
                "hindi":   f"चेतावनी: आगे {top} है। ब्रेक असिस्ट सक्रिय है।",
                "level": risk_label
            }
        return {"fire": False}

    def _parse_detections(self, outputs):
        boxes, scores, class_ids = outputs
        CLASS_NAMES = [
            "car","truck","bus","motorcycle","bicycle","pedestrian",
            "auto_rickshaw","cattle","dog","pothole","construction_debris",
            "speed_breaker","cycle_rickshaw","handcart","tractor"
        ]
        results = []
        for i in range(len(scores[0])):
            if scores[0][i] > 0.4:
                results.append({
                    "class_id": int(class_ids[0][i]),
                    "class_name": CLASS_NAMES[int(class_ids[0][i])],
                    "confidence": float(scores[0][i]),
                    "bbox": boxes[0][i].tolist()  # [x1, y1, x2, y2]
                })
        return sorted(results, key=lambda x: -x["confidence"])

    def _saliency_to_base64(self, saliency_array):
        import cv2, base64
        normed = cv2.normalize(saliency_array, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        heatmap = cv2.applyColorMap(normed, cv2.COLORMAP_JET)
        _, buffer = cv2.imencode(".png", heatmap)
        return base64.b64encode(buffer).decode("utf-8")

    def _prepare_fusion_input(self, payload):
        # Normalize and concatenate sensor inputs
        # Shape expected by Model 1: (1, C, H, W) for camera; separate arrays for others
        # See DATA_CONTRACTS.md for exact tensor shapes
        pass  # implement based on Model 1 engineer's ONNX input spec

    def _prepare_classifier_input(self, frame_b64):
        import base64, cv2
        img_bytes = base64.b64decode(frame_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        img = cv2.resize(img, (640, 640))
        img = img.astype(np.float32) / 255.0
        return img.transpose(2, 0, 1)[np.newaxis, :]  # NCHW

    def _detections_to_vector(self, detections):
        # Flatten top-5 detections into fixed-size vector for risk model
        vec = np.zeros(5 * 6, dtype=np.float32)  # 5 objects × 6 features
        for i, det in enumerate(detections[:5]):
            vec[i*6:(i+1)*6] = [
                det["class_id"] / 15.0,
                det["confidence"],
                *[b / 640.0 for b in det["bbox"]]
            ]
        return vec

    def cleanup(self):
        self.sessions.clear()
```

---

### `api/routes/inference.py`
```python
from fastapi import APIRouter, Depends
from schemas.sensor_input import SensorPayload
from schemas.inference_output import InferenceResult
from core.pipeline import InferencePipeline

router = APIRouter()

def get_pipeline() -> InferencePipeline:
    from main import pipeline
    return pipeline

@router.post("/infer", response_model=InferenceResult)
async def run_inference(payload: SensorPayload, pipeline: InferencePipeline = Depends(get_pipeline)):
    """
    Main inference endpoint. Accepts multi-sensor data, returns full ADAS output.
    Called by frontend OR by edge device at up to 10 fps.
    """
    result = pipeline.run(payload.dict())
    return result
```

---

### `api/routes/stream.py`
```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.pipeline import InferencePipeline
import asyncio, json

router = APIRouter()

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Frontend connects here. Backend pushes inference results ~10fps.
    Frontend sends frames as base64 JSON; backend responds with full ADAS output.
    """
    from main import pipeline
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            result = pipeline.run(payload)
            await websocket.send_text(json.dumps(result))
    except WebSocketDisconnect:
        pass
```

---

### `api/routes/fleet.py`
```python
from fastapi import APIRouter, UploadFile, File
import shutil, os

router = APIRouter()

@router.post("/upload-gradients")
async def upload_gradients(vehicle_id: str, file: UploadFile = File(...)):
    """
    Fleet vehicles POST their local gradient updates here (Model 5 federated learning).
    Backend aggregates and triggers global model update.
    """
    save_path = f"fl_updates/{vehicle_id}_gradients.npz"
    os.makedirs("fl_updates", exist_ok=True)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    # TODO: trigger aggregation when N vehicles have submitted
    return {"status": "received", "vehicle_id": vehicle_id}

@router.get("/global-model/{model_name}")
async def get_global_model(model_name: str):
    """Fleet devices pull updated global model weights after aggregation."""
    from fastapi.responses import FileResponse
    return FileResponse(f"models/weights/{model_name}_global.onnx")
```

---

### `schemas/sensor_input.py`
```python
from pydantic import BaseModel
from typing import Optional, List

class IMUData(BaseModel):
    accel_x: float; accel_y: float; accel_z: float
    gyro_x: float;  gyro_y: float;  gyro_z: float

class GPSData(BaseModel):
    lat: float; lon: float; speed_kmh: float; heading_deg: float

class SensorPayload(BaseModel):
    camera_frame: str           # base64 encoded JPEG/PNG (640x640)
    lidar_points: Optional[List[List[float]]] = None   # list of [x,y,z,intensity]
    radar_targets: Optional[List[dict]] = None          # [{range_m, velocity_mps, azimuth_deg}]
    imu: Optional[IMUData] = None
    gps: Optional[GPSData] = None
    frame_id: int = 0
    timestamp: float = 0.0
```

---

### `schemas/inference_output.py`
```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]       # [x1, y1, x2, y2] normalized 0-1

class AlertPayload(BaseModel):
    fire: bool
    english: Optional[str] = None
    hindi: Optional[str] = None
    level: Optional[str] = None   # LOW | MEDIUM | HIGH | CRITICAL

class InferenceResult(BaseModel):
    scene_graph: Optional[Dict[str, Any]] = None
    detections: List[Detection] = []
    risk_score: float               # 0.0 – 1.0
    risk_label: str                 # LOW | MEDIUM | HIGH | CRITICAL
    saliency_map: Optional[str] = None   # base64 PNG
    alert: AlertPayload
    latency_ms: float
    timestamp: float
```

---

### `requirements.txt`
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
onnxruntime-gpu==1.18.0
numpy==1.26.4
opencv-python-headless==4.9.0.80
pydantic==2.7.1
python-multipart==0.0.9
websockets==12.0
```

---

### `docker-compose.yml` (root level)
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./ml/weights:/app/models/weights   # mount trained ONNX files here
    environment:
      - MODEL_DIR=/app/models/weights
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000/ws/stream
    depends_on:
      - backend
```

---

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + model load status |
| POST | `/api/infer` | Single frame inference (REST) |
| WS | `/ws/stream` | Real-time bidirectional stream |
| POST | `/api/fleet/upload-gradients` | Federated learning update upload |
| GET | `/api/fleet/global-model/{name}` | Download updated global model |

---

## Environment Variables (`.env`)
```
MODEL_DIR=./models/weights
INFERENCE_FPS=10
RISK_THRESHOLD_HIGH=0.6
RISK_THRESHOLD_CRITICAL=0.8
ENABLE_GPU=true
LOG_LEVEL=info
```

---

## What You Need From ML Engineers

Ask each ML engineer for:
1. Their `.onnx` exported model file
2. Input tensor name, shape, and dtype (e.g. `input: float32[1,3,640,640]`)
3. Output tensor names and shapes
4. Any preprocessing steps (mean/std normalization values)

Place all `.onnx` files in `ml/weights/` and they get mounted into the backend container.
