# MODEL 2 — India-Specific Scene Classifier
**Owner: ML Engineer 2**
**This is the most important model. Your work is the core differentiator of SENTINEL.**

---

## What This Model Does

Detects and classifies objects specific to Indian roads that Western ADAS models miss.
Input: a camera frame. Output: bounding boxes + class labels + confidence scores.

This is essentially a **custom-trained object detector** — YOLOv8 fine-tuned on Indian road data.

---

## 15 Target Classes

```python
CLASS_NAMES = [
    "car",              # 0
    "truck",            # 1
    "bus",              # 2
    "motorcycle",       # 3
    "bicycle",          # 4
    "pedestrian",       # 5
    "auto_rickshaw",    # 6  ← India-specific
    "cattle",           # 7  ← India-specific (cow, buffalo, goat)
    "dog",              # 8  ← India-specific (stray dogs)
    "pothole",          # 9  ← India-specific
    "construction_debris", # 10 ← India-specific
    "speed_breaker",    # 11 ← India-specific (unmarked humps)
    "cycle_rickshaw",   # 12 ← India-specific
    "handcart",         # 13 ← India-specific
    "tractor",          # 14 ← India-specific
]
```

---

## Datasets

> **Dataset source changed:** IDD (India Driving Dataset) was the original 
> plan, but registration approval was taking 2-4 weeks and blocking the team. 
> Switched to DATS_2022 + Roboflow below — both are instant-access, and 
> between them cover more of our 15 classes natively than IDD did.

### Primary Dataset — DATS_2022
- **Download:** https://data.mendeley.com/datasets/nfc34n8svj/2 (no registration, direct download, CC BY 4.0)
- 10,000+ images, captured in Pune and surrounding areas, Maharashtra
- Native categories include rickshaw, tractor, cattle, cart, dog, goat, bus, truck, person
- Annotations provided in .xml/.txt/.json for a subset of images — not every image is labeled, filter to annotated images only
- Labels are mixed format — convert to YOLO format (script below)

### Secondary Dataset — Roboflow "Indian Roads Detection"
- **Download:** https://universe.roboflow.com/indian-road-dataset/indian-roads-detection (free account, instant approval — not a wait-list)
- 2,618 images, already exported in YOLO format natively
- Native classes include Autorickshaw, Cattle, Goat, Tractor, Cart, Dog — use to supplement underrepresented classes from DATS_2022

### Tertiary Dataset — COCO (for pretraining backbone)
- Already included in YOLOv8 pretrained weights

### Supplementary — Kaggle Indian Roads
- https://www.kaggle.com/datasets/sakshamjn/vehicle-detection-8-class-object-detection
- Smaller but has good diversity

### Self-collected (important — still needed regardless of dataset source!)
Neither DATS_2022 nor the Roboflow set reliably covers **pothole, 
construction_debris, or speed_breaker**. Scrape 200–400 frames from YouTube 
Indian dashcam videos for these specifically:
- "Indian highway driving 2024"
- "Mumbai traffic dashcam"
- "Rajasthan highway cattle"

Use **Roboflow** (free tier) to annotate: https://roboflow.com
- Use Roboflow's auto-label with CLIP for speed
- Focus on potholes, construction_debris, speed_breaker — the classes neither base dataset covers

---

## Training Pipeline

### Step 1: Environment Setup
```bash
pip install ultralytics roboflow albumentations
```

### Step 2: Convert DATS_2022 to YOLO format
```python
import json, os, shutil
from pathlib import Path

def convert_dats2022_to_yolo(dats_annotation_path, output_dir):
    """Convert DATS_2022 annotations (.xml/.txt/.json, mixed) to YOLO txt format.
    Only a subset of DATS_2022 images have annotations -- filter accordingly."""
    os.makedirs(f"{output_dir}/images", exist_ok=True)
    os.makedirs(f"{output_dir}/labels", exist_ok=True)

    DATS_TO_SENTINEL = {
        "car": 0, "truck": 1, "bus": 2, "motorcycle": 3, "bike": 3,
        "cycle": 4, "person": 5, "rickshaw": 6, "autorickshaw": 6,
        "cattle": 7, "goat": 7, "dog": 8, "tractor": 14, "cart": 13,
        # NOTE: verify this mapping against the actual category list once
        # DATS_2022 is downloaded -- category names above are based on
        # published dataset documentation, not a guaranteed exact match.
        # pothole, construction_debris, speed_breaker are NOT in DATS_2022
        # natively -- these come from the self-collected set only.
    }

    with open(dats_annotation_path) as f:
        data = json.load(f)

    for img_info in data["images"]:
        img_id = img_info["id"]
        W, H = img_info["width"], img_info["height"]
        anns = [a for a in data["annotations"] if a["image_id"] == img_id]

        lines = []
        for ann in anns:
            cat = data["categories"][ann["category_id"] - 1]["name"]
            if cat not in DATS_TO_SENTINEL:
                continue
            cls = DATS_TO_SENTINEL[cat]
            x, y, w, h = ann["bbox"]
            cx = (x + w/2) / W
            cy = (y + h/2) / H
            nw, nh = w / W, h / H
            lines.append(f"{cls} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

        label_file = f"{output_dir}/labels/{img_info['file_name'].replace('.png', '.txt')}"
        with open(label_file, "w") as f:
            f.write("\n".join(lines))

    print(f"✅ Converted {len(data['images'])} images")


def merge_roboflow_export(roboflow_yolo_dir, output_dir):
    """Roboflow exports YOLO format natively -- just remap class indices
    to our fixed 15-class order and copy into the merged dataset folder."""
    # Implementation detail: read Roboflow's data.yaml for its class order,
    # build an index remap to our DATA_CONTRACTS.md section 7 order, then
    # rewrite each label file's class indices accordingly before copying.
    pass  # see convert_roboflow_export.py for full implementation
```

### Step 3: Data Augmentation (critical for Indian roads)
```python
import albumentations as A

augment = A.Compose([
    A.RandomFog(fog_coef_lower=0.1, fog_coef_upper=0.5, p=0.3),      # monsoon/dust
    A.RandomRain(slant_lower=-10, slant_upper=10, drop_length=20, p=0.2),  # rain
    A.RandomBrightnessContrast(brightness_limit=0.3, p=0.4),           # night / bright sun
    A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),                       # sensor noise
    A.MotionBlur(blur_limit=7, p=0.2),                                  # fast movement
    A.HorizontalFlip(p=0.5),
    A.Resize(640, 640),
], bbox_params=A.BboxParams(format="yolo", label_fields=["class_labels"]))
```

### Step 4: YAML config
```yaml
# sentinel_dataset.yaml
path: ./data/sentinel_dataset
train: images/train
val: images/val
test: images/test

nc: 15
names:
  0: car
  1: truck
  2: bus
  3: motorcycle
  4: bicycle
  5: pedestrian
  6: auto_rickshaw
  7: cattle
  8: dog
  9: pothole
  10: construction_debris
  11: speed_breaker
  12: cycle_rickshaw
  13: handcart
  14: tractor
```

### Step 5: Training
```python
from ultralytics import YOLO

# Start from YOLOv8m pretrained on COCO (medium model — good balance of speed/accuracy)
model = YOLO("yolov8m.pt")

results = model.train(
    data="sentinel_dataset.yaml",
    epochs=80,
    imgsz=640,
    batch=16,
    lr0=0.001,
    lrf=0.01,
    momentum=0.937,
    weight_decay=0.0005,
    warmup_epochs=3,
    device="cuda",        # use Colab T4 / A100
    project="sentinel_runs",
    name="model2_v1",
    augment=True,         # YOLOv8 built-in augmentation
    patience=20,          # early stopping
)
```

**Expected training time:**
- Colab T4 (free): ~3–4 hours for 80 epochs on 10K images
- Colab A100 (Pro): ~45 minutes

---

## ONNX Export

```python
from ultralytics import YOLO

model = YOLO("sentinel_runs/model2_v1/weights/best.pt")

# Export to ONNX
model.export(
    format="onnx",
    imgsz=640,
    opset=17,
    simplify=True,
    dynamic=False,
)

# Rename output
import os
os.rename("sentinel_runs/model2_v1/weights/best.onnx", "model2_classifier.onnx")
print("✅ Model 2 exported")
```

**Place output at:** `ml/weights/model2_classifier.onnx`

---

## Output Specification (what backend expects)

```python
# Input:  "images" — float32[1, 3, 640, 640]  (normalized 0–1, RGB, NCHW)
# Output: YOLOv8 standard ONNX outputs:
#   output0: float32[1, 19, 8400]
#   where 19 = 4 (bbox) + 15 (class scores)
#   and 8400 = number of anchor boxes
#
# Backend's pipeline.py already handles parsing this format.
# Just ensure your model exports with the exact input name "images".
```

---

## Validation Targets

| Metric | Target |
|--------|--------|
| mAP@0.5 overall | > 0.65 |
| mAP for cattle | > 0.70 |
| mAP for auto_rickshaw | > 0.75 |
| mAP for pothole | > 0.55 |
| Inference speed (CPU) | < 40ms per frame |

---

## Useful Links

- DATS_2022 Dataset: https://data.mendeley.com/datasets/nfc34n8svj/2
- Roboflow "Indian Roads Detection": https://universe.roboflow.com/indian-road-dataset/indian-roads-detection
- YOLOv8 docs: https://docs.ultralytics.com
- Roboflow annotation (for self-collected pothole/speed_breaker/debris data): https://roboflow.com
- Albumentations: https://albumentations.ai
- Google Colab for training: https://colab.research.google.com

---

## Colab Notebook Outline

```
1. Mount Google Drive
2. pip install ultralytics roboflow albumentations
3. Download DATS_2022 directly (no auth) + download Roboflow export (free account)
4. Run convert_dats2022_to_yolo() and merge_roboflow_export()
5. Run augmentation pipeline
6. Train YOLOv8m
7. Export to ONNX
8. Download model2_classifier.onnx to Drive
```
