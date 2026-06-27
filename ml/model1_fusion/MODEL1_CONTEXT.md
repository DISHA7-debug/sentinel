# MODEL 1 — Adaptive Sensor Fusion Engine
**Owner: ML Engineer 1**
**Coupled with: Model 4 (XAI) — same engineer**

---

## What This Model Does

Takes raw inputs from all sensors and produces:
1. A **scene embedding** — a 512-dim float vector representing the full scene state
2. A **scene graph** — JSON describing detected objects and their spatial relationships

This runs first in the pipeline. Its output feeds directly into Model 3 (risk scoring).

---

## Architecture

Use **BEVFusion** (Bird's Eye View Fusion) — pretrained on nuScenes, fine-tune on DATS_2022 + Roboflow "Indian Roads Detection" (see Model 2's context doc — same dataset swap applies here; IDD registration was taking too long, dropped in favor of these two, no signup wait).

```
Camera (RGB 640×640) ─────┐
LiDAR (N×4 point cloud) ──┤→ BEV Encoder → Fusion Transformer → [scene_embedding, scene_graph]
Radar (M×3 targets) ──────┤
IMU + GPS (12 floats) ─────┘
```

**Simplified alternative for hackathon** (if full BEVFusion is too heavy):
- Run a MobileNetV3 on camera image → 256-dim embedding
- Project LiDAR points to camera plane, concatenate features
- Pass combined vector through 3-layer MLP → 512-dim scene embedding
- Scene graph = output of the classifier (Model 2) formatted as nodes/edges

---

## Pretrained Backbone

```bash
pip install mmdet3d
# Download BEVFusion pretrained weights
wget https://download.openmmlab.com/mmdet3d/v1.0.0_models/bevfusion/bevfusion_lc_voxel0075_second_secfpn_8xb4-cyclic-20e_nus-3d-5239b1af.pth
```

---

## Training (Fine-tuning)

**Dataset:** nuScenes (for pretraining backbone) + DATS_2022 + Roboflow "Indian Roads Detection" for domain adaptation

```python
# Fine-tuning script outline
import torch
from mmdet3d.apis import train_model
from mmdet3d.datasets import build_dataset
from mmdet3d.models import build_model

# Use nuScenes-pretrained BEVFusion, fine-tune on DATS_2022 + Roboflow data
# Neither DATS_2022 nor the Roboflow set has LiDAR, so freeze LiDAR branch; only train camera branch + fusion head

config = {
    "model": "bevfusion",
    "pretrained": "path/to/bevfusion_pretrained.pth",
    "freeze_lidar_branch": True,
    "output_dim": 512,
    "scene_graph_heads": 15,   # 15 object classes (see class list below)
}
```

**Free Colab approach:** Use just camera → MobileNetV3 → scene embedding. Skip LiDAR fine-tuning if GPU time is short.

---

## Output Specification (what backend expects)

```python
# ONNX export — backend will call this
# Input:
#   "camera":  float32[1, 3, 640, 640]   normalized (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])
#   "lidar":   float32[1, 2000, 4]        x, y, z, intensity (pad/truncate to 2000 pts)
#   "radar":   float32[1, 50, 3]          range_m, velocity_mps, azimuth_deg (pad to 50)
#   "imu_gps": float32[1, 12]             accel(3) + gyro(3) + lat,lon,speed,heading + 2 padding

# Output:
#   "scene_embedding": float32[1, 512]
#   "scene_graph_json": str (JSON string)

# Scene graph JSON format:
# {
#   "nodes": [{"id": "obj_0", "label": "cattle", "type": "hazard", "x": 320, "y": 240}],
#   "edges": [{"source": "ego", "target": "obj_0", "relation": "approaching", "distance_m": 12.4}]
# }
```

---

## ONNX Export

```python
import torch

model.eval()
dummy_camera = torch.randn(1, 3, 640, 640)
dummy_lidar  = torch.randn(1, 2000, 4)
dummy_radar  = torch.randn(1, 50, 3)
dummy_imu    = torch.randn(1, 12)

torch.onnx.export(
    model,
    (dummy_camera, dummy_lidar, dummy_radar, dummy_imu),
    "model1_fusion.onnx",
    input_names=["camera", "lidar", "radar", "imu_gps"],
    output_names=["scene_embedding", "scene_graph_json"],
    opset_version=17,
    dynamic_axes={"camera": {0: "batch"}, "lidar": {0: "batch"}},
)
print("✅ Model 1 exported")
```

**Place output at:** `ml/weights/model1_fusion.onnx`

---

## Latency Target

< 25ms on Jetson Orin NX (TensorRT INT8)
< 50ms on CPU (ONNX Runtime, for demo)

---

## Hackathon Shortcut

If you're short on time, skip actual training and:
1. Use a pretrained YOLOv8 to get detections
2. Format detections as a scene graph (each detected object = a node)
3. Use a MobileNetV3 image embedding as the "scene_embedding"
4. Export both as one ONNX model

This gives a fully working demo pipeline even without BEVFusion training.
