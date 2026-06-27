# DATA CONTRACTS — SENTINEL
**The single source of truth for all JSON/tensor interfaces between components.**
**Every engineer must follow this exactly. No deviations.**

---

## 1. Frontend → Backend (WebSocket frame)

```json
{
  "camera_frame": "<base64 encoded JPEG string>",
  "frame_id": 1718000000123,
  "lidar_points": [[1.2, 0.5, 0.1, 0.9], [2.1, -0.3, 0.0, 0.7]],
  "radar_targets": [{"range_m": 15.2, "velocity_mps": -8.3, "azimuth_deg": 5.1}],
  "imu": {"accel_x": 0.1, "accel_y": -0.2, "accel_z": 9.8, "gyro_x": 0.01, "gyro_y": 0.0, "gyro_z": -0.02},
  "gps": {"lat": 28.6139, "lon": 77.2090, "speed_kmh": 45.2, "heading_deg": 180.0},
  "timestamp": 1718000000.123
}
```

**Minimum required field:** `camera_frame` only. All others are optional — backend handles missing sensors gracefully.

---

## 2. Backend → Frontend (WebSocket response)

```json
{
  "detections": [
    {
      "class_id": 7,
      "class_name": "cattle",
      "confidence": 0.912,
      "bbox": [0.31, 0.44, 0.62, 0.79]
    },
    {
      "class_id": 6,
      "class_name": "auto_rickshaw",
      "confidence": 0.834,
      "bbox": [0.10, 0.50, 0.35, 0.80]
    }
  ],
  "risk_score": 0.83,
  "risk_label": "CRITICAL",
  "saliency_map": "<base64 PNG string or null>",
  "scene_graph": {
    "nodes": [
      {"id": "ego", "label": "ego vehicle", "type": "ego", "x": 320, "y": 400},
      {"id": "obj_0", "label": "cattle", "type": "hazard", "x": 280, "y": 180},
      {"id": "obj_1", "label": "auto_rickshaw", "type": "vehicle", "x": 150, "y": 250}
    ],
    "edges": [
      {"source": "ego", "target": "obj_0", "relation": "approaching", "distance_m": 8.4},
      {"source": "ego", "target": "obj_1", "relation": "following", "distance_m": 22.1}
    ]
  },
  "alert": {
    "fire": true,
    "english": "WARNING: cattle detected ahead. Brake assist active.",
    "hindi": "चेतावनी: आगे गाय है। ब्रेक असिस्ट सक्रिय है।",
    "level": "CRITICAL"
  },
  "latency_ms": 47.3,
  "timestamp": 1718000000.189
}
```

---

## 3. Model 1 (Fusion) ONNX Tensor Spec

| Name | Shape | Dtype | Notes |
|------|-------|-------|-------|
| `camera` | [1, 3, 640, 640] | float32 | Normalized: mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225] |
| `lidar` | [1, 2000, 4] | float32 | x, y, z, intensity; zero-padded to 2000 pts |
| `radar` | [1, 50, 3] | float32 | range_m, velocity_mps, azimuth_deg; zero-padded to 50 |
| `imu_gps` | [1, 12] | float32 | [accel_x/y/z, gyro_x/y/z, lat, lon, speed, heading, 0, 0] |
| **`scene_embedding`** | [1, 512] | float32 | **OUTPUT** — goes to Model 3 |
| **`scene_graph_json`** | [1] | string | **OUTPUT** — JSON string per schema above |

---

## 4. Model 2 (Classifier) ONNX Tensor Spec

| Name | Shape | Dtype | Notes |
|------|-------|-------|-------|
| `images` | [1, 3, 640, 640] | float32 | Normalized 0–1, RGB, NCHW |
| **`output0`** | [1, 19, 8400] | float32 | **OUTPUT** — YOLOv8 standard output |

Post-processing (done in `pipeline._parse_detections()`):
- `output0[0, 0:4, :]` = box coords (cx, cy, w, h normalized)
- `output0[0, 4:19, :]` = class scores for 15 classes (no objectness score in v8)
- Apply NMS with conf_threshold=0.4, iou_threshold=0.45

---

## 5. Model 3 (Risk) ONNX Tensor Spec

| Name | Shape | Dtype | Notes |
|------|-------|-------|-------|
| `sequence` | [1, 5, 542] | float32 | 5 frames × (512 scene_emb + 30 det_vec) |
| **`risk_score`** | [1] | float32 | **OUTPUT** — value 0.0–1.0 |

Detection vector (30 dims) = top-5 detections × 6 features:
`[class_id/15, confidence, x1/640, y1/640, x2/640, y2/640]`

---

## 6. Model 4 (XAI) Output

Option A (PyTorch, preferred): `np.ndarray` shape `(640, 640, 3)` BGR image → base64 PNG
Option B (ONNX): `float32[1, 640, 640]` normalized heatmap → backend colorizes with JET colormap

---

## 7. Class ID Reference

```
0=car, 1=truck, 2=bus, 3=motorcycle, 4=bicycle, 5=pedestrian,
6=auto_rickshaw, 7=cattle, 8=dog, 9=pothole, 10=construction_debris,
11=speed_breaker, 12=cycle_rickshaw, 13=handcart, 14=tractor
```

**Classes 6–14 are India-specific — unique to SENTINEL.**

---

## 8. Risk Label Thresholds

```
risk_score >= 0.8  → CRITICAL  (immediate brake assist, voice alert)
risk_score >= 0.6  → HIGH      (visual alert, prepare brake)
risk_score >= 0.3  → MEDIUM    (dashboard warning)
risk_score <  0.3  → LOW       (no alert)
```

---

## 9. ONNX Weight Files — Naming Convention

All engineers place their exported `.onnx` files in `ml/weights/`:

```
ml/weights/
├── model1_fusion.onnx       ← ML Engineer 1
├── model2_classifier.onnx   ← ML Engineer 2  ← MOST CRITICAL
├── model2_best.pt           ← ML Engineer 2  (PyTorch, for XAI)
├── model3_risk.onnx         ← ML Engineer 3
└── model4_xai.onnx          ← ML Engineer 1  (optional if using PyTorch XAI)
```

Backend mounts this folder at startup. **Do not rename files.**
