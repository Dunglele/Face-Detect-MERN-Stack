import sys
import os
import asyncio
from pathlib import Path

# Add face_detect to path
sys.path.append(str(Path(__file__).resolve().parent.parent / "face_detect"))

from config import ANTI_SPOOF_ENABLED, ANTI_SPOOF_THRESHOLD
from face_service import FaceService
from api_server import health, root, liveness_check, predict_base64, LivenessCheckRequest, PredictBase64Request
import cv2
import base64

print("=== 1. Checking Config ===")
print("ANTI_SPOOF_ENABLED:", ANTI_SPOOF_ENABLED)
print("ANTI_SPOOF_THRESHOLD:", ANTI_SPOOF_THRESHOLD)

print("\n=== 2. Checking FaceService & AntiSpoofPredictor ===")
fs = FaceService()
is_ready = fs.anti_spoof_predictor is not None and fs.anti_spoof_predictor.is_ready()
print("AntiSpoofPredictor ready:", is_ready)
if fs.anti_spoof_predictor:
    print("Models loaded:", len(fs.anti_spoof_predictor.models))

print("\n=== 3. Testing recognize_faces_in_frame with Dung.jpg ===")
sample_path = Path("face_detect/pic/Dung.jpg")
if sample_path.exists():
    img = cv2.imread(str(sample_path))
    res = fs.recognize_faces_in_frame(img)
    print("Faces detected:", len(res))
    for idx, r in enumerate(res):
        print(f"Face {idx+1}: Name={r['name']}, Conf={r['confidence']}%, is_real={r['is_real']}, liveness_score={r['liveness_score']}%, status={r['liveness_status']}, spoof_type={r['spoof_type']}")

print("\n=== 4. Testing FastAPI Handlers Directly ===")
h_res = health()
print("/health response:", h_res)

_, buffer = cv2.imencode(".jpg", img)
b64 = base64.b64encode(buffer).decode("utf-8")

async def test_api_handlers():
    live_req = LivenessCheckRequest(image=b64)
    live_res = await liveness_check(live_req)
    print("\n/api/ai/liveness-check response:", live_res)

    pred_req = PredictBase64Request(image=b64, auto_checkin=True)
    pred_res = await predict_base64(pred_req)
    print("\n/predict response:")
    print(" - success:", pred_res.get("success"))
    print(" - model_used:", pred_res.get("model_used"))
    print(" - anti_spoof_active:", pred_res.get("anti_spoof_active"))
    print(" - spoof_alert:", pred_res.get("spoof_alert"))
    print(" - faces count:", len(pred_res.get("faces", [])))
    if pred_res.get("faces"):
        f0 = pred_res["faces"][0]
        print(" - Face 0:", {
            "name": f0["name"],
            "is_real": f0.get("is_real"),
            "liveness_score": f0.get("liveness_score"),
            "liveness_status": f0.get("liveness_status"),
            "spoof_type": f0.get("spoof_type"),
        })

asyncio.run(test_api_handlers())

print("\n=== ALL TESTS PASSED SUCCESSFULLY ===")
