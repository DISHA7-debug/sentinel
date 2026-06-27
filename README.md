# SENTINEL — Edge AI ADAS Co-Pilot
**Scene-aware, Explainable, Network-Independent ADAS for Tata Vehicles**

> Hackathon Project — Tata Technologies InnoVent | Problem Statement: 3.2.1.1 Edge AI for ADAS and Autonomous Systems

---

## Project Overview

SENTINEL is a fully offline, edge-deployable Advanced Driver Assistance System purpose-built for Indian road conditions. It fuses multi-sensor inputs, classifies India-specific road hazards, predicts collision risk 3–5 seconds ahead, explains decisions to the driver in regional languages, and improves continuously via federated learning across the Tata vehicle fleet — all without any cloud dependency.

---

## Team Structure

| Person | Responsibility |
|--------|---------------|
| **You (Backend Lead)** | FastAPI server, REST APIs, WebSocket streaming, model inference pipeline, data routing between ML models, Docker deployment |
| **ML Engineer 1** | Model 1 (Sensor Fusion) + Model 4 (XAI/GradCAM) — these are coupled |
| **ML Engineer 2** | Model 2 (India Scene Classifier) — core differentiator, most important |
| **ML Engineer 3** | Model 3 (Risk Scoring) + Model 5 (Federated Learning) — these are coupled |
| **Frontend** | React dashboard, HMI display, real-time visualization |

---

## Repository Structure

```
sentinel/
├── README.md                        ← This file
├── docker-compose.yml               ← Spin up everything together
├── .env.example
│
├── backend/                         ← YOUR DOMAIN (FastAPI)
│   ├── BACKEND_CONTEXT.md
│   ├── main.py
│   ├── requirements.txt
│   ├── api/
│   │   ├── routes/
│   │   │   ├── inference.py         ← POST /infer — main pipeline endpoint
│   │   │   ├── stream.py            ← WebSocket /ws/stream
│   │   │   ├── fleet.py             ← Federated model update endpoints
│   │   │   └── health.py
│   │   └── middleware/
│   ├── core/
│   │   ├── pipeline.py              ← Orchestrates all 5 ML models in sequence
│   │   ├── sensor_router.py         ← Routes sensor data to correct models
│   │   └── config.py
│   ├── models/                      ← ONNX model loaders (runtime)
│   │   ├── fusion_loader.py
│   │   ├── classifier_loader.py
│   │   ├── risk_loader.py
│   │   └── model_registry.py
│   └── schemas/
│       ├── sensor_input.py          ← Pydantic schemas for all inputs
│       └── inference_output.py
│
├── frontend/                        ← React HMI Dashboard
│   ├── FRONTEND_CONTEXT.md
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── SceneView.jsx        ← Live camera feed + saliency overlay
│   │   │   ├── RiskMeter.jsx        ← Animated risk score gauge
│   │   │   ├── AlertBanner.jsx      ← Voice + visual alerts (Hindi/English)
│   │   │   ├── SceneGraph.jsx       ← D3 dynamic scene graph
│   │   │   ├── SensorStatus.jsx     ← Live sensor health indicators
│   │   │   └── FleetMap.jsx         ← Optional: fleet heatmap
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useVoiceAlert.js
│   │   └── utils/
│   │       └── colorMap.js          ← Saliency heatmap color mapping
│
├── ml/
│   ├── model1_fusion/               ← ML Engineer 1
│   │   └── MODEL1_CONTEXT.md
│   ├── model2_classifier/           ← ML Engineer 2
│   │   └── MODEL2_CONTEXT.md
│   ├── model3_risk/                 ← ML Engineer 3
│   │   └── MODEL3_CONTEXT.md
│   ├── model4_xai/                  ← ML Engineer 1 (coupled with Model 2)
│   │   └── MODEL4_CONTEXT.md
│   └── model5_federated/            ← ML Engineer 3 (coupled with Model 3)
│       └── MODEL5_CONTEXT.md
│
└── docs/
    ├── API_SPEC.md                  ← Full API reference
    ├── DATA_CONTRACTS.md            ← JSON schemas between all components
    └── DEMO_SCRIPT.md               ← Hackathon demo walkthrough
```

---

## System Architecture (Data Flow)

```
[Sensors] → [Backend Pipeline] → [Model 1: Fusion] → [Model 2: Classifier]
                                                              ↓
[Frontend HMI] ← [WebSocket Stream] ← [Model 4: XAI] ← [Model 3: Risk Score]
                                              ↑
                                    [Model 5: Federated — async background]
```

**Latency target:** End-to-end < 100ms per frame
**Hardware target:** NVIDIA Jetson Orin NX (16GB) or Qualcomm Snapdragon Ride

---

## Quick Start

```bash
# Clone and setup
cp .env.example .env

# Run everything
docker-compose up --build

# Services:
# Backend API:   http://localhost:8000
# Frontend HMI:  http://localhost:3000
# API Docs:      http://localhost:8000/docs
```

---

## Key Design Decisions

1. **All ML models export to ONNX** — backend loads them via `onnxruntime`, no PyTorch/TF dependency at runtime
2. **WebSocket for real-time streaming** — frontend receives ~10 fps inference results
3. **Models run sequentially** in the pipeline (1 → 2 → 3 → 4); Model 5 runs async in background
4. **All communication via JSON** with standardized schemas defined in `docs/DATA_CONTRACTS.md`
5. **No cloud calls** — fully offline capable

---

## Demo Video Plan (Hackathon)

Feed a pre-recorded Indian dashcam video through the system. Show:
1. Scene graph building in real time
2. Risk score spiking as a cow enters frame
3. Alert banner firing in Hindi
4. Saliency heatmap highlighting the hazard object
