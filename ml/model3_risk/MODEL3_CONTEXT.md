# MODEL 3 — Predictive Risk Scoring (PRS)
**Owner: ML Engineer 3**
**Coupled with: Model 5 (Federated Learning) — same engineer**

---

## What This Model Does

Takes the scene embedding (from Model 1) + detected objects (from Model 2) and predicts:
- **Collision probability score** — float 0.0 to 1.0
- Predicted over a **3–5 second horizon**

This is a temporal model — it uses a short history of past frames to predict near-future risk.

---

## Architecture

**LSTM-based Trajectory + Context Risk Model**

```
[scene_embedding_t-4 ... scene_embedding_t]  (5 frames × 512 dim)
           +
[detections_vector_t-4 ... detections_vector_t]  (5 frames × 30 dim)
           ↓
    Concatenate → [5, 542]
           ↓
    LSTM (hidden=256, layers=2)
           ↓
    FC(256→128) → ReLU → Dropout(0.3)
           ↓
    FC(128→1) → Sigmoid
           ↓
    risk_score ∈ [0, 1]
```

**Why LSTM?** The risk score depends on *trajectory* — a car approaching fast for 3 frames is more dangerous than a static car. LSTM captures this temporal pattern efficiently and is small enough for edge deployment.

---

## Dataset

### Primary: INTERACTION Dataset
- **Download:** https://interaction-dataset.com/ (free with registration)
- Contains vehicle trajectories with labels for collision/near-miss events
- 40,000+ scenario hours from USA, China, Germany

### Secondary: HighD Dataset
- **Download:** https://www.highd-dataset.com/ (free for research)
- Highway drone footage with precise trajectory data

### Synthetic labels (create yourself)
For India-specific scenarios not in INTERACTION:
```python
# Label generation logic
# If ANY detected object is within 5m AND closing velocity > 5 m/s → HIGH RISK (0.8+)
# If cattle/pedestrian within 10m → HIGH RISK regardless of velocity
# Otherwise → interpolate based on distance and closing speed

def compute_risk_label(detections, ego_speed_mps):
    max_risk = 0.0
    for det in detections:
        dist = det.get("distance_m", 50)
        closing_v = det.get("closing_velocity_mps", 0)
        danger_multiplier = 1.5 if det["class_name"] in ["cattle", "pedestrian", "dog"] else 1.0
        ttc = dist / max(closing_v, 0.1)   # time to collision in seconds
        risk = danger_multiplier * (1 / (1 + 0.3 * ttc))
        max_risk = max(max_risk, min(risk, 1.0))
    return max_risk
```

---

## Training Pipeline

### Step 1: Setup
```bash
pip install torch torchvision numpy pandas scikit-learn onnx
```

### Step 2: Data preparation
```python
import torch
import numpy as np
from torch.utils.data import Dataset, DataLoader

class RiskDataset(Dataset):
    """
    Each sample: 5 consecutive frames of [scene_embedding + detection_vector]
    Label: risk_score at frame t+1 (or t+3, t+5 for longer horizon)
    """
    def __init__(self, embeddings, detections, labels, seq_len=5):
        self.seq_len = seq_len
        self.X = []
        self.y = []
        for i in range(len(labels) - seq_len):
            emb_seq = embeddings[i:i+seq_len]        # (5, 512)
            det_seq = detections[i:i+seq_len]         # (5, 30)
            combined = np.concatenate([emb_seq, det_seq], axis=-1)  # (5, 542)
            self.X.append(combined)
            self.y.append(labels[i + seq_len])
        self.X = torch.tensor(np.array(self.X), dtype=torch.float32)
        self.y = torch.tensor(np.array(self.y), dtype=torch.float32)

    def __len__(self): return len(self.X)
    def __getitem__(self, i): return self.X[i], self.y[i]
```

### Step 3: Model definition
```python
import torch.nn as nn

class RiskScoringLSTM(nn.Module):
    def __init__(self, input_dim=542, hidden_dim=256, num_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.3)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x: (batch, seq_len=5, features=542)
        out, _ = self.lstm(x)
        last = out[:, -1, :]   # take output at last timestep
        return self.head(last).squeeze(-1)
```

### Step 4: Training
```python
model = RiskScoringLSTM()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
criterion = nn.BCELoss()

# Class weighting — high-risk events are rare, oversample them
from torch.utils.data import WeightedRandomSampler
risk_labels = dataset.y.numpy()
weights = np.where(risk_labels > 0.6, 3.0, 1.0)   # oversample high-risk 3x
sampler = WeightedRandomSampler(weights, len(weights))

loader = DataLoader(dataset, batch_size=64, sampler=sampler)

for epoch in range(50):
    model.train()
    total_loss = 0
    for X_batch, y_batch in loader:
        optimizer.zero_grad()
        pred = model(X_batch)
        loss = criterion(pred, y_batch)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch+1}: loss={total_loss/len(loader):.4f}")

torch.save(model.state_dict(), "model3_risk.pth")
print("✅ Model 3 trained")
```

---

## ONNX Export

```python
model = RiskScoringLSTM()
model.load_state_dict(torch.load("model3_risk.pth"))
model.eval()

# Input: 5 frames × 542 features
dummy_input = torch.randn(1, 5, 542)

torch.onnx.export(
    model,
    dummy_input,
    "model3_risk.onnx",
    input_names=["sequence"],
    output_names=["risk_score"],
    opset_version=17,
    dynamic_axes={"sequence": {0: "batch"}},
)
print("✅ Model 3 exported")
```

**Place output at:** `ml/weights/model3_risk.onnx`

---

## Output Specification (what backend expects)

```python
# Input:
#   "sequence": float32[1, 5, 542]
#   → 5 frames of (scene_embedding[512] + detection_vector[30]) concatenated

# Output:
#   "risk_score": float32[1]   → value between 0.0 and 1.0
#
# Backend maps to labels:
#   >= 0.8  → CRITICAL
#   >= 0.6  → HIGH
#   >= 0.3  → MEDIUM
#   < 0.3   → LOW
```

---

## Detection Vector Format (30 dims)
The backend converts Model 2 detections into a 30-dim vector for your model:
```
[class_id/15, confidence, x1/640, y1/640, x2/640, y2/640]  × 5 objects (top 5 by confidence)
= 5 × 6 = 30 dimensions
```

---

## Validation Targets

| Metric | Target |
|--------|--------|
| AUC-ROC | > 0.88 |
| Precision (HIGH+CRITICAL) | > 0.80 |
| Recall (HIGH+CRITICAL) | > 0.85 |
| False Critical Rate | < 5% |
| Inference latency | < 10ms |

---

## What to Hand Off to ML Engineer 3 (Federated)

- Trained `model3_risk.pth` weights file
- `RiskScoringLSTM` model class definition
- Input/output specifications above
- Training data loader implementation

The federated model (Model 5) will wrap your trained model and add FL capabilities on top.
