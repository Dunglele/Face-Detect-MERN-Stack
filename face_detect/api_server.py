import sys

# Kiểm tra tương thích phiên bản Python - Thoát ngay nếu không phải Python 3.10 hoặc 3.11
if sys.version_info.major != 3 or sys.version_info.minor not in (10, 11):
    print("\n" + "=" * 70, file=sys.stderr)
    print("❌ [LỖI KHÔNG TƯƠNG THÍCH PHIÊN BẢN PYTHON - THOÁT NGAY]", file=sys.stderr)
    print(f"Hệ thống AI yêu cầu Python 3.10 hoặc Python 3.11 (khuyến nghị 3.11.x).", file=sys.stderr)
    print(f"Phiên bản Python hiện tại của bạn: {sys.version.split()[0]}", file=sys.stderr)
    print("Lý do: Các thư viện AI (dlib, face_recognition, YOLOv11) trên Windows yêu cầu Python 3.10/3.11.", file=sys.stderr)
    print("Vui lòng cài đặt Python 3.11 (64-bit) và kích hoạt môi trường ảo phù hợp.", file=sys.stderr)
    print("=" * 70 + "\n", file=sys.stderr)
    sys.exit(1)

import os
import io
import time
import base64
from pathlib import Path
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Nạp thư viện từ face_service
sys.path.append(str(Path(__file__).resolve().parent))
import importlib
import config
from face_service import FaceService
from config import (
    TOLERANCE_THRESHOLD,
    MIN_MATCH_CONFIDENCE,
    MIN_IDENTITY_DISTANCE_MARGIN,
    MAX_IDENTITY_DISTANCE_RATIO,
    FRAME_SCALE,
)

def get_current_tolerance() -> float:
    """Đọc trực tiếp ngưỡng từ config.py (hỗ trợ hot-reload khi chỉnh config.py)"""
    try:
        importlib.reload(config)
        return float(getattr(config, "TOLERANCE_THRESHOLD", 0.55))
    except Exception:
        return float(getattr(config, "TOLERANCE_THRESHOLD", 0.55))

app = FastAPI(
    title="Face Detection & Recognition AI Service",
    description="REST API cho mô hình YOLOv11 + dlib ResNet nhận diện khuôn mặt",
    version="1.0.0"
)

# Cho phép CORS cho frontend React (5173) và backend Express (5000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo FaceService duy nhất một lần
print("[*] Đang khởi tạo mô hình AI (YOLOv11 Face + dlib ResNet)...")
face_service = FaceService()
print(f"[*] Sẵn sàng! Đã nạp {len(face_service.users_meta)} người dùng: {list(face_service.users_meta.keys())}")


class PredictBase64Request(BaseModel):
    image: str  # Data URL (data:image/jpeg;base64,...) hoặc base64 thô
    tolerance: Optional[float] = TOLERANCE_THRESHOLD
    auto_checkin: Optional[bool] = False


class RegisterFaceRequest(BaseModel):
    name: str
    employeeId: Optional[str] = None
    department: Optional[str] = "General"
    email: Optional[str] = ""
    images: List[str]  # Danh sách ảnh base64 gửi từ webcam hoặc upload chùm ảnh


@app.get("/")
def root():
    return {
        "service": "Face Recognition & Anti-Spoofing AI Service",
        "engine": "YOLOv11 Face + dlib ResNet + MiniFASNet",
        "yolo_loaded": face_service.yolo_model is not None,
        "anti_spoof_active": face_service.anti_spoof_predictor is not None and face_service.anti_spoof_predictor.is_ready(),
        "mongo_connected": face_service.mongo_connected,
        "database": face_service.db.name if face_service.db is not None else "local encodings.pkl",
        "users_count": len(face_service.users_meta),
        "users": [m.get("full_name") or m.get("name") or k for k, m in face_service.users_meta.items()],
        "status": "ready"
    }


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "model": "yolov11n-face.pt",
        "anti_spoof_model": "MiniFASNetV2 + MiniFASNetV1SE",
        "yolo_active": face_service.yolo_model is not None,
        "anti_spoof_active": face_service.anti_spoof_predictor is not None and face_service.anti_spoof_predictor.is_ready(),
        "mongo_connected": face_service.mongo_connected,
        "database": face_service.db.name if face_service.db is not None else "local encodings.pkl",
        "enrolled_users": [m.get("full_name") or m.get("name") or k for k, m in face_service.users_meta.items()],
        "total_encodings": len(face_service.known_encodings),
        "tolerance_threshold": TOLERANCE_THRESHOLD,
        "min_match_confidence_threshold": MIN_MATCH_CONFIDENCE,
        "min_identity_distance_margin": MIN_IDENTITY_DISTANCE_MARGIN,
        "max_identity_distance_ratio": MAX_IDENTITY_DISTANCE_RATIO
    }



@app.get("/api/users")
@app.get("/api/ai/users")
def get_users():
    return {
        "success": True,
        "mongo_connected": face_service.mongo_connected,
        "users": face_service.get_users_list()
    }


@app.delete("/api/ai/users/{name}")
@app.delete("/api/users/{name}")
def delete_user_endpoint(name: str):
    """[410 GONE] Quản trị nhân sự và vector khuôn mặt đã chuyển sang AIAttendanceWeb3 Admin Service (Port 4000)"""
    raise HTTPException(
        status_code=410,
        detail="Chức năng quản trị người dùng thuộc quyền sở hữu của AIAttendanceWeb3 Admin Service (Port 4000). Face AI là read-only."
    )


def _verify_internal_refresh_token(request: Request):
    expected = os.environ.get("FACE_AI_INTERNAL_TOKEN") or os.environ.get("INTERNAL_REFRESH_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="CONFIG_MISSING: FACE_AI_INTERNAL_TOKEN chưa được cấu hình trên Face AI Service (fail-closed, không fallback không an toàn)."
        )
    token = request.headers.get("x-internal-token") or request.headers.get("x-service-key")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Thiếu internal token xác thực để gọi refresh endpoint")
    if token != expected:
        raise HTTPException(status_code=403, detail="Internal token không hợp lệ")


@app.post("/api/ai/refresh")
@app.post("/refresh")
@app.post("/api/ai/sync-mongo")
@app.post("/sync-mongo")
def sync_mongo(request: Request):
    """Tải lại toàn bộ vector đặc trưng từ MongoDB vào RAM của AI service (Read-only refresh, không ghi DB)"""
    _verify_internal_refresh_token(request)
    success = face_service.load_database_from_mongo()
    return {
        "success": success,
        "mongo_connected": face_service.mongo_connected,
        "users_count": len(face_service.users_meta),
        "users": list(face_service.users_meta.keys()),
        "total_encodings": len(face_service.known_encodings),
        "message": "Đã làm mới (refresh) bộ đệm vector từ MongoDB thành công" if success else "Không thể đồng bộ từ MongoDB"
    }


@app.post("/api/ai/register-face")
@app.post("/register-face")
async def register_face(req: RegisterFaceRequest):
    """
    [410 GONE] Đăng ký khuôn mặt đã chuyển sang AIAttendanceWeb3 Admin Service (Port 8000 /api/v1/face/enroll).
    Face AI là service chuyên biệt cho verification & anti-spoofing, không thực hiện ghi DB / enrollment.
    """
    raise HTTPException(
        status_code=410,
        detail="Chức năng đăng ký khuôn mặt đã chuyển sang AIAttendanceWeb3 Admin Service (Port 8000 /api/v1/face/enroll). Face AI chỉ cung cấp xác thực (verify) và liveness."
    )


def _process_image_array(frame: np.ndarray, tolerance: float = TOLERANCE_THRESHOLD, auto_checkin: bool = False) -> Dict[str, Any]:
    """Hàm xử lý lõi: nhận ảnh numpy, chạy YOLOv11 và so khớp dlib"""
    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="Không thể đọc dữ liệu ảnh!")

    h, w = frame.shape[:2]
    start_time = time.time()

    # Nhận diện khuôn mặt bằng mô hình lai YOLOv11 + dlib ResNet
    raw_results = face_service.recognize_faces_in_frame(frame, tolerance=tolerance, scale=FRAME_SCALE)
    inference_ms = round((time.time() - start_time) * 1000, 1)

    formatted_faces = []
    top_match = None

    for item in raw_results:
        top, right, bottom, left = item.get("box") or item.get("bbox")

        # Tính toán tọa độ tỉ lệ %:
        # relative_bbox: tọa độ gốc của ảnh
        # mirrored_left: tọa độ đã lật gương cho màn hình webcam (100% - left% - width%)
        rel_top = round((top / h) * 100, 2)
        rel_left = round((left / w) * 100, 2)
        rel_width = round(((right - left) / w) * 100, 2)
        rel_height = round(((bottom - top) / h) * 100, 2)
        mirrored_left = round(100.0 - rel_left - rel_width, 2)

        face_data = {
            "name": item["name"],
            "employee_code": item.get("employee_code", ""),  # từ users_meta — định danh chính xác
            "full_name": item.get("full_name", item["name"]),  # tên đầy đủ từ metadata
            "confidence": item["confidence"],
            "is_match": bool(item.get("is_match", False)),
            "distance": item["distance"],
            "second_best_distance": item.get("second_best_distance"),
            "distance_margin": item.get("distance_margin"),
            "distance_ratio": item.get("distance_ratio"),
            "is_ambiguous": bool(item.get("is_ambiguous", False)),
            "is_real": bool(item.get("is_real", False)),
            "liveness_score": float(item.get("liveness_score", 0.0)),
            "liveness_status": str(item.get("liveness_status", "UNKNOWN")),
            "spoof_type": str(item.get("spoof_type", "unknown")),
            "bbox": {
                "top": int(top),
                "right": int(right),
                "bottom": int(bottom),
                "left": int(left)
            },
            # Tọa độ phần trăm (0% -> 100%) để frontend vẽ khung chính xác
            "relative_bbox": {
                "top": rel_top,
                "left": rel_left,
                "mirrored_left": mirrored_left,
                "width": rel_width,
                "height": rel_height
            }
        }
        formatted_faces.append(face_data)

        # CHỈ chọn top_match khi is_match là True
        if item.get("is_match") and (top_match is None or item["confidence"] > top_match["confidence"]):
            top_match = face_data

    # Face AI chỉ phụ trách nhận diện & xác thực người thật (verify/liveness), KHÔNG tự tiện ghi file CSV điểm danh.
    # Toàn bộ việc ghi nhận chấm công do Face BFF (Port 5000) quản lý và ghi vào MongoDB AttendanceRecord.
    spoof_alert = False
    if top_match and top_match.get("is_match"):
        if not top_match.get("is_real", False):
            spoof_alert = True
            print(f"[!] CẢNH BÁO: Phát hiện giả mạo khuôn mặt cho '{top_match.get('name')}' (Liveness: {top_match.get('liveness_score')}%)! Từ chối.")

    return {
        "success": True,
        "faces_detected": len(formatted_faces),
        "faces": formatted_faces,
        "top_match": top_match,
        "spoof_alert": spoof_alert,
        "anti_spoof_active": face_service.anti_spoof_predictor is not None and face_service.anti_spoof_predictor.is_ready(),
        "tolerance_threshold": tolerance,
        "min_match_confidence_threshold": MIN_MATCH_CONFIDENCE,
        "min_identity_distance_margin": MIN_IDENTITY_DISTANCE_MARGIN,
        "max_identity_distance_ratio": MAX_IDENTITY_DISTANCE_RATIO,
        "image_size": {"width": w, "height": h},
        "inference_time_ms": inference_ms,
        "model_used": "YOLOv11 Face + dlib ResNet + MiniFASNet" if face_service.yolo_model is not None else "dlib HOG + ResNet"
    }


class LivenessCheckRequest(BaseModel):
    image: str  # Base64 image string


@app.post("/api/ai/liveness-check")
@app.post("/liveness-check")
async def liveness_check(req: LivenessCheckRequest):
    """Kiểm tra chuyên dụng tính xác thực người thật (Face Anti-Spoofing / MiniFASNet)"""
    image_str = req.image
    if "," in image_str:
        image_str = image_str.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_str)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Không thể giải mã ảnh")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã ảnh Base64: {e}")

    # Phát hiện khuôn mặt
    boxes = face_service.detect_face_boxes(frame)
    if not boxes:
        return {
            "success": False,
            "message": "Không tìm thấy khuôn mặt nào trong ảnh",
            "faces_count": 0
        }

    results = []
    for box in boxes:
        top, right, bottom, left = box
        if face_service.anti_spoof_predictor is not None and face_service.anti_spoof_predictor.is_ready():
            res = face_service.anti_spoof_predictor.predict(
                frame,
                (top, right, bottom, left),
                bbox_format="top_right_bottom_left"
            )
        else:
            res = {
                "is_real": False,
                "liveness_score": 0.0,
                "liveness_status": "MODEL_UNAVAILABLE",
                "spoof_type": "model_missing"
            }

        results.append({
            "box": {"top": int(top), "right": int(right), "bottom": int(bottom), "left": int(left)},
            "is_real": res["is_real"],
            "liveness_score": res["liveness_score"],
            "liveness_status": res["liveness_status"],
            "spoof_type": res.get("spoof_type", "real")
        })

    return {
        "success": True,
        "faces_count": len(results),
        "results": results
    }



@app.post("/predict")
@app.post("/predict-base64")
@app.post("/api/predict")
async def predict_base64(req: PredictBase64Request):
    """Nhận diện khuôn mặt từ ảnh webcam gửi lên dưới dạng Base64 JSON"""
    image_str = req.image
    if "," in image_str:
        image_str = image_str.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_str)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã Base64: {e}")

    # Luôn ưu tiên cấu hình trong config.py
    current_tolerance = get_current_tolerance()
    return _process_image_array(frame, current_tolerance, req.auto_checkin or False)


@app.post("/predict-binary")
async def predict_binary(request: Request, auto_checkin: bool = False):
    """Nhận diện khuôn mặt từ raw binary bytes (không cần python-multipart)"""
    body = await request.body()
    nparr = np.frombuffer(body, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return _process_image_array(frame, get_current_tolerance(), auto_checkin)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    print(f"[*] Đang khởi chạy Face Recognition API Server trên cổng {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
