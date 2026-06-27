# MODEL 4 — Explainable AI (XAI) Saliency Generator
**Owner: ML Engineer 1 (same as Model 1)**
**Depends on: Model 2 (Classifier) — must be trained first**

---

## What This Model Does

Generates a **saliency heatmap** over the camera frame that visually explains *why* the system flagged a hazard. The heatmap highlights which pixels caused the highest confidence detection.

This is NOT a separately trained model — it's a **GradCAM wrapper** applied to Model 2's backbone at inference time.

---

## Why This Matters for the Hackathon

Explainability is a key judging criterion. When the risk score spikes because a cow appeared, showing the heatmap glowing red over the cow makes the system trustworthy and impressive. This is also directly related to Tata's HMI requirements.

---

## Implementation

GradCAM works by:
1. Running a forward pass through Model 2's backbone (up to the last conv layer)
2. Computing gradients of the top detection score w.r.t. that layer's activations
3. Weighting activations by their gradients → heatmap

Since Model 2 is YOLOv8 (PyTorch), you can use the `pytorch-grad-cam` library.

### Setup
```bash
pip install grad-cam ultralytics
```

### XAI Inference Wrapper
```python
import torch
import numpy as np
import cv2
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from ultralytics import YOLO

class SentinelXAI:
    def __init__(self, model_path="sentinel_runs/model2_v1/weights/best.pt"):
        self.model = YOLO(model_path)
        self.pytorch_model = self.model.model   # underlying nn.Module

        # Target layer: last conv layer in YOLOv8 backbone
        # For YOLOv8m, this is model.model.model[-2]
        self.target_layer = [self.pytorch_model.model[-2]]
        self.cam = GradCAM(model=self.pytorch_model, target_layers=self.target_layer)

    def generate_saliency(self, frame_bgr: np.ndarray, target_class_id: int = None) -> np.ndarray:
        """
        Args:
            frame_bgr: np.ndarray (H, W, 3) — original BGR frame
            target_class_id: int or None — if None, targets the highest-confidence detection
        Returns:
            saliency_map: np.ndarray (H, W, 3) — heatmap as BGR image
        """
        # Preprocess
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(frame_rgb, (640, 640))
        input_tensor = torch.from_numpy(resized).permute(2, 0, 1).float() / 255.0
        input_tensor = input_tensor.unsqueeze(0)   # (1, 3, 640, 640)

        # GradCAM
        grayscale_cam = self.cam(input_tensor=input_tensor)  # (1, H, W)
        grayscale_cam = grayscale_cam[0]  # (H, W)

        # Overlay on original frame
        rgb_norm = resized.astype(np.float32) / 255.0
        cam_image = show_cam_on_image(rgb_norm, grayscale_cam, use_rgb=True)

        return cam_image   # (640, 640, 3) numpy array

    def saliency_to_base64(self, cam_image: np.ndarray) -> str:
        """Convert saliency map to base64 for API response."""
        import base64
        bgr = cv2.cvtColor(cam_image, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode(".png", bgr)
        return base64.b64encode(buffer).decode("utf-8")
```

---

## ONNX Export for XAI

GradCAM requires gradient computation, which doesn't work natively in ONNX Runtime. Two options:

### Option A (Recommended for hackathon): Keep XAI in PyTorch, skip ONNX
The backend runs Model 2 in ONNX for speed, but runs XAI separately in PyTorch when needed.
Modify `pipeline.py` to conditionally call the PyTorch XAI wrapper:

```python
# In pipeline.py — add XAI as optional PyTorch step
from ml.model4_xai.xai_wrapper import SentinelXAI

class InferencePipeline:
    def load_all_models(self):
        ...
        self.xai = SentinelXAI("models/weights/model2_best.pt")

    def _run_xai(self, frame_bgr, detections):
        # Only run XAI every 5 frames (heavy operation) or when HIGH/CRITICAL risk
        cam_image = self.xai.generate_saliency(frame_bgr)
        return self.xai.saliency_to_base64(cam_image)
```

### Option B: Export simplified attention map as ONNX
```python
import torch
import torch.nn as nn

class XAIHead(nn.Module):
    """Lightweight attention map generator — ONNX-exportable."""
    def __init__(self, yolo_backbone):
        super().__init__()
        # Use intermediate feature map from backbone as proxy for saliency
        self.backbone = yolo_backbone.model[:10]  # first 10 layers of YOLOv8m

    def forward(self, x):
        feat = self.backbone(x)           # (1, C, H', W')
        attn = feat.mean(dim=1, keepdim=True)  # average across channels
        attn = torch.nn.functional.interpolate(attn, size=(640, 640), mode="bilinear")
        return attn.squeeze(1)            # (1, 640, 640)
```

---

## Output Specification (what backend expects)

```python
# Option A (preferred):
# Function call: xai.generate_saliency(frame_bgr) → np.ndarray (640, 640, 3)
# Then: xai.saliency_to_base64(cam_image) → str (base64 PNG)

# Option B (ONNX):
# Input:  "images" → float32[1, 3, 640, 640]
# Output: "saliency" → float32[1, 640, 640]   (raw heatmap, 0–1 normalized)
# Backend applies cv2.applyColorMap() to colorize it
```

**Place output at:** `ml/weights/model4_xai.onnx` (Option B) or `ml/weights/model2_best.pt` (Option A)

---

## Integration with Frontend

The backend sends `saliency_map` as a base64 PNG string.
The frontend (`SceneView.jsx`) overlays it on the camera feed at 35% opacity.

The result: driver sees the raw scene with a warm red glow over the object that triggered the alert.

---

## Time Estimate

- Setup + first working GradCAM: 1–2 hours
- Integration with pipeline: 1 hour
- This is the fastest model to implement. Do it last after Model 2 is trained.
