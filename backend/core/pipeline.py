import time
import json
import logging
from collections import deque
import numpy as np
from core.config import settings
from core import sensor_router
from models.model_registry import ModelRegistry

logger = logging.getLogger("sentinel.pipeline")

# Hindi translations for class names to display/speak high-quality regional alerts
HINDI_CLASS_MAP = {
    "car": "गाड़ी",
    "truck": "ट्रक",
    "bus": "बस",
    "motorcycle": "मोटरसाइकिल",
    "bicycle": "साइकिल",
    "pedestrian": "पैदल यात्री",
    "rider": "राइडर",
    "auto_rickshaw": "ऑटो रिक्शा",
    "animal": "जानवर",
    "traffic_sign": "यातायात संकेत",
    "traffic_light": "यातायात बत्ती",
    "vehicle_fallback": "वाहन",
    "pothole": "गड्ढा",
    "crack": "दरार"
}

class InferencePipeline:
    def __init__(self):
        self.registry = ModelRegistry()
        self.buffers = {}          # session_id -> deque of length 5 (each element is np.ndarray of shape (542,))
        self.frame_counters = {}   # session_id -> int
        
        try:
            from core.scene_fusion_engine import SceneFusionEngine
            self.fusion_engine = SceneFusionEngine()
            logger.info("Successfully initialized real SceneFusionEngine")
        except Exception as e:
            logger.warning(f"Failed to import/initialize SceneFusionEngine: {e}. Falling back to mock scene fusion.")
            self.fusion_engine = None

    def load_all_models(self):
        self.registry.load_all()

    def cleanup_session(self, session_id: str):
        """Clears memory allocated for a specific client session."""
        if session_id in self.buffers:
            del self.buffers[session_id]
        if session_id in self.frame_counters:
            del self.frame_counters[session_id]
        logger.info(f"Cleaned up session data for: {session_id}")

    def run(self, sensor_payload: dict, session_id: str = "default") -> dict:
        """
        Orchestrates the 4-step ADAS pipeline:
        Fusion -> Classifier -> Risk Scoring -> XAI
        """
        t0 = time.time()

        # Update frame counter
        self.frame_counters[session_id] = self.frame_counters.get(session_id, 0) + 1
        frame_num = self.frame_counters[session_id]

        try:
            # 1. Preprocess and run Model 1 (Sensor Fusion)
            camera_b64 = sensor_payload.get("camera_frame")
            if not camera_b64:
                raise ValueError("Payload missing required 'camera_frame' field.")

            img_bgr = sensor_router.decode_camera_frame(camera_b64)
            
            fusion_cam = sensor_router.prepare_fusion_image(img_bgr)
            fusion_lidar = sensor_router.prepare_lidar(sensor_payload.get("lidar_points"))
            fusion_radar = sensor_router.prepare_radar(sensor_payload.get("radar_targets"))
            fusion_imu_gps = sensor_router.prepare_imu_gps(sensor_payload.get("imu"), sensor_payload.get("gps"))

            fusion_loader = self.registry.get("fusion")
            scene_embedding, scene_graph_json = fusion_loader.run(
                camera=fusion_cam,
                lidar=fusion_lidar,
                radar=fusion_radar,
                imu_gps=fusion_imu_gps
            )

            try:
                scene_graph = json.loads(scene_graph_json)
            except Exception as e:
                logger.error(f"Failed to parse scene graph JSON: {e}")
                scene_graph = {"nodes": [], "edges": []}

            # 2. Preprocess and run Model 2 (Classifier)
            classifier_img = sensor_router.prepare_classifier_image(img_bgr)
            classifier_loader = self.registry.get("classifier")
            detections = classifier_loader.run(classifier_img)

            # 3. Prepare sequence and run Model 3 (Risk Scoring)
            # Create the 30-dim detection vector (top-5 detections, zero padded)
            det_vector = np.zeros(30, dtype=np.float32)
            for i, det in enumerate(detections[:5]):
                det_vector[i * 6 : (i + 1) * 6] = [
                    det["class_id"] / 14.0,
                    det["confidence"],
                    det["bbox"][0],
                    det["bbox"][1],
                    det["bbox"][2],
                    det["bbox"][3]
                ]

            # Flatten scene embedding to (512,)
            emb_flat = scene_embedding.flatten()
            
            # Combine to form current frame vector (542 dims)
            frame_vector = np.concatenate([emb_flat, det_vector])  # shape (542,)

            # Manage session-aware rolling buffer
            if session_id not in self.buffers:
                self.buffers[session_id] = deque(maxlen=5)
                # Initialize with 5 copies of the first frame's data (or zero vectors)
                # We initialize with zero vectors as per standard zero-padding
                for _ in range(5):
                    self.buffers[session_id].append(np.zeros(542, dtype=np.float32))

            # Push current frame's vector
            self.buffers[session_id].append(frame_vector)

            # Form input sequence [1, 5, 542]
            sequence_tensor = np.array(self.buffers[session_id], dtype=np.float32)  # (5, 542)
            sequence_tensor = np.expand_dims(sequence_tensor, axis=0)                # (1, 5, 542)

            risk_loader = self.registry.get("risk")
            risk_score = risk_loader.run(sequence_tensor, detections)

            # Scene Fusion
            recommended_action = None
            fusion_explanation = None
            top_risky_objects = None
            total_objects = 0
            max_object_risk = 0.0
            average_object_risk = 0.0
            critical_object_count = 0
            high_object_count = 0
            vulnerable_object_count = 0

            if self.fusion_engine is not None and detections:
                try:
                    import pandas as pd
                    rows = []
                    for det in detections:
                        rows.append({
                            "class_name": det.get("class_name"),
                            "risk_score": det.get("risk_score", 0.0),
                            "risk_level": det.get("risk_level", "Low")
                        })
                    df_group = pd.DataFrame(rows)
                    fusion_res = self.fusion_engine.fuse_image_scene("frame", df_group)
                    
                    # Override the overall risk score/label from SceneFusionEngine
                    risk_score = fusion_res["scene_risk_score"]
                    risk_label = fusion_res["scene_risk_level"].upper()
                    
                    recommended_action = fusion_res.get("recommended_action")
                    fusion_explanation = fusion_res.get("fusion_explanation")
                    top_risky_objects = fusion_res.get("top_risky_objects")
                    total_objects = fusion_res.get("total_objects", 0)
                    max_object_risk = fusion_res.get("max_object_risk", 0.0)
                    average_object_risk = fusion_res.get("average_object_risk", 0.0)
                    critical_object_count = fusion_res.get("critical_object_count", 0)
                    high_object_count = fusion_res.get("high_object_count", 0)
                    vulnerable_object_count = fusion_res.get("vulnerable_object_count", 0)
                except Exception as e:
                    logger.error(f"Error executing real SceneFusionEngine: {e}")
                    if risk_score >= settings.risk_threshold_critical:
                        risk_label = "CRITICAL"
                    elif risk_score >= settings.risk_threshold_high:
                        risk_label = "HIGH"
                    elif risk_score >= 0.3:
                        risk_label = "MEDIUM"
                    else:
                        risk_label = "LOW"
            else:
                if risk_score >= settings.risk_threshold_critical:
                    risk_label = "CRITICAL"
                elif risk_score >= settings.risk_threshold_high:
                    risk_label = "HIGH"
                elif risk_score >= 0.3:
                    risk_label = "MEDIUM"
                else:
                    risk_label = "LOW"

            # 4. Conditionally run Model 4 (XAI)
            # Run if there is at least one detection, AND:
            # - risk is HIGH or CRITICAL (immediate alert explanation needed), OR
            # - frame falls on the throttle rate interval (to manage CPU load)
            saliency_map = None
            if detections:
                run_xai_this_frame = (risk_label in ("HIGH", "CRITICAL")) or (frame_num % settings.xai_throttle_rate == 0)
                if run_xai_this_frame:
                    xai_loader = self.registry.get("xai")
                    saliency_map = xai_loader.run(img_bgr, detections)

            # Build regional Alert Payload
            alert = self._build_alert(risk_label, detections)

            latency_ms = (time.time() - t0) * 1000

            return {
                "scene_graph": scene_graph,
                "detections": detections,
                "risk_score": round(risk_score, 4),
                "risk_label": risk_label,
                "saliency_map": saliency_map,
                "alert": alert,
                "latency_ms": round(latency_ms, 2),
                "timestamp": time.time(),
                "recommended_action": recommended_action,
                "fusion_explanation": fusion_explanation,
                "top_risky_objects": top_risky_objects,
                "total_objects": total_objects,
                "max_object_risk": max_object_risk,
                "average_object_risk": average_object_risk,
                "critical_object_count": critical_object_count,
                "high_object_count": high_object_count,
                "vulnerable_object_count": vulnerable_object_count
            }

        except Exception as e:
            logger.error(f"Pipeline execution failure: {e}", exc_info=True)
            latency_ms = (time.time() - t0) * 1000
            # Safe degraded fallback response to prevent API crashes
            return {
                "scene_graph": {"nodes": [], "edges": []},
                "detections": [],
                "risk_score": 0.0,
                "risk_label": "LOW",
                "saliency_map": None,
                "alert": {"fire": False},
                "latency_ms": round(latency_ms, 2),
                "timestamp": time.time(),
                "recommended_action": None,
                "fusion_explanation": None,
                "top_risky_objects": None,
                "total_objects": 0,
                "max_object_risk": 0.0,
                "average_object_risk": 0.0,
                "critical_object_count": 0,
                "high_object_count": 0,
                "vulnerable_object_count": 0
            }

    def _build_alert(self, risk_label: str, detections: list) -> dict:
        """
        Builds translation-rich visual + voice alerts for HIGH/CRITICAL situations.
        """
        if risk_label in ("HIGH", "CRITICAL"):
            top_class = detections[0]["class_name"] if detections else "hazard"
            top_hindi = HINDI_CLASS_MAP.get(top_class, "खतरा")
            
            english_text = f"WARNING: {top_class} detected ahead. Brake assist active."
            hindi_text = f"चेतावनी: आगे {top_hindi} है। ब्रेक असिस्ट सक्रिय है।"

            return {
                "fire": True,
                "english": english_text,
                "hindi": hindi_text,
                "level": risk_label
            }
        return {"fire": False}

    def cleanup(self):
        """Releases pipeline resources."""
        self.buffers.clear()
        self.frame_counters.clear()
        if hasattr(self, "registry") and self.registry:
            self.registry.models.clear()
        logger.info("Pipeline cleanup completed.")
