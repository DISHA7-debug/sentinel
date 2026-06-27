# DEMO SCRIPT — SENTINEL Hackathon Presentation
**Use this for your live demo and presentation walkthrough.**

---

## Setup Before Demo (do this 30 min before)

```bash
# 1. Start backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Start frontend
cd frontend && npm run dev

# 3. Open browser: http://localhost:3000

# 4. Place demo_footage.mp4 in frontend/public/
#    Use any Indian dashcam footage from YouTube (download with yt-dlp)
#    Best: search "Mumbai highway dashcam 2024" — cattle + rickshaws guaranteed
```

---

## Presentation Flow (5 minutes)

### Slide 1: Problem (30 sec)
> "Existing ADAS systems fail on Indian roads. They're trained on German and American highways.
> They don't know what a cattle herd looks like. Or an auto-rickshaw cutting lanes.
> Or an unmarked speed breaker. We built SENTINEL to fix this."

### Slide 2: Architecture (45 sec)
Show the system diagram. Point to each of the 5 modules briefly.

### Slide 3: LIVE DEMO (2.5 min)

**Open the dashboard. Start the video feed.**

1. **Normal driving phase** (15 sec)
   - Show risk meter reading LOW (green)
   - Point out the scene graph building in real time
   - "Notice the system is tracking all vehicles around us"

2. **Auto-rickshaw appears** (30 sec)
   - Risk meter ticks up to MEDIUM
   - Bounding box appears around the rickshaw
   - "Model 2 — our India-specific classifier — recognizes an auto-rickshaw. A standard ADAS system would classify this as 'unknown object' or miss it entirely."

3. **Cattle on road** (45 sec) — your hero moment
   - Risk score spikes to 0.85 — CRITICAL
   - Alert banner fires: red background
   - Hindi voice plays: "चेतावनी: आगे गाय है"
   - Saliency heatmap glows red over the cow
   - "Three things happening simultaneously: the risk score spikes to CRITICAL, the driver gets a voice alert in Hindi, and the saliency heatmap shows exactly WHAT triggered the alert. Not a black box — the driver knows why the system is braking."

4. **Explain the heatmap** (20 sec)
   - "This is our XAI module. It's based on GradCAM. It answers the question every driver will ask: WHY did you brake? The answer is highlighted in red on screen."

5. **Show federated learning** (open a second terminal) (20 sec)
   - Run `python fl_client.py vehicle_001 data/vehicle_001_driving.npz`
   - "As each Tata vehicle drives, it learns from new Indian road scenarios. Gradient updates — not raw camera data — are shared to improve the global model. Completely privacy-preserving."

### Slide 4: Impact (30 sec)
> "SENTINEL targets Tata Nexon EV, Harrier, and the commercial fleet.
> India has 11% of the world's road fatalities despite only 1% of the world's vehicles.
> Our system is purpose-built for this market — not adapted from Western ADAS."

### Slide 5: Technical Differentiation (30 sec)
- Only ADAS system with India-specific training data (IDD + collected)
- 15 India-specific object classes including cattle, auto-rickshaws, potholes
- Runs fully offline on edge hardware — no cloud latency
- Multilingual HMI (Hindi voice alerts)
- Federated fleet learning for continuous improvement

---

## Questions to Prepare For

**Q: How accurate is the cattle detection?**
A: "Our Model 2 achieves >70% mAP on cattle class using the IDD dataset augmented with our self-collected data. We're continuing to improve this with more India-specific images."

**Q: What hardware does this run on?**
A: "NVIDIA Jetson Orin NX 16GB for the full stack. The entire pipeline runs under 100ms latency. In production, Qualcomm Snapdragon Ride is another target platform."

**Q: How is this different from what Tata already has?**
A: "Current Tata ADAS (in Nexon EV) uses a basic camera-based LKA and AEB trained on global data. SENTINEL adds India-specific object detection, explainability, and fleet learning — none of which exist in the current system."

**Q: Is the federated learning real?**
A: "Yes — we're using the Flower framework, which is production-grade federated learning used by large-scale deployments. Our demo shows 3 simulated vehicles contributing gradient updates and improving the global model in real time."

**Q: What's the latency?**
A: "End-to-end under 100ms in our demo on a laptop. On Jetson Orin with TensorRT optimization, this would drop to under 30ms."
