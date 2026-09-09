import os
import sys
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
from face_service import FaceService
from config import TOLERANCE_THRESHOLD, FRAME_SCALE
from app import log_attendance

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
        "service": "Face Recognition AI Service",
        "engine": "YOLOv11 Face + dlib ResNet",
        "yolo_loaded": face_service.yolo_model is not None,
        "mongo_connected": face_service.mongo_connected,
        "database": face_service.db.name if face_service.db is not None else "local encodings.pkl",
        "users_count": len(face_service.users_meta),
        "users": list(face_service.users_meta.keys()),
        "status": "ready"
    }


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "model": "yolov11n-face.pt",
        "yolo_active": face_service.yolo_model is not None,
        "mongo_connected": face_service.mongo_connected,
        "database": face_service.db.name if face_service.db is not None else "local encodings.pkl",
        "enrolled_users": list(face_service.users_meta.keys()),
        "total_encodings": len(face_service.known_encodings)
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
    """Xóa nhân sự và vector khuôn mặt khỏi AI Engine và MongoDB"""
    decoded_name = name.strip()
    deleted = face_service.delete_user(decoded_name)
    return {
        "success": deleted,
        "name": decoded_name,
        "enrolled_users": list(face_service.users_meta.keys()),
        "total_encodings": len(face_service.known_encodings),
        "message": f"Đã xóa nhân sự '{decoded_name}' thành công" if deleted else f"Không tìm thấy nhân sự '{decoded_name}'"
    }


@app.post("/api/ai/sync-mongo")
@app.post("/sync-mongo")
def sync_mongo():
    """Tải lại toàn bộ vector đặc trưng từ MongoDB vào RAM của AI service"""
    success = face_service.load_database_from_mongo()
    return {
        "success": success,
        "mongo_connected": face_service.mongo_connected,
        "users_count": len(face_service.users_meta),
        "users": list(face_service.users_meta.keys()),
        "total_encodings": len(face_service.known_encodings),
        "message": "Đã đồng bộ vector từ MongoDB thành công" if success else "Không thể đồng bộ từ MongoDB"
    }


@app.post("/api/ai/register-face")
@app.post("/register-face")
async def register_face(req: RegisterFaceRequest):
    """
    Đăng ký khuôn mặt mới từ danh sách ảnh base64:
    1. Dò tìm khuôn mặt bằng YOLOv11 + dlib
    2. Trích xuất vector 128-d ResNet
    3. Lưu trực tiếp vào MongoDB collection 'users'
    4. Nạp tức thì vào RAM để nhận diện ngay mà không cần restart server
    """
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp họ và tên người dùng!")

    if not req.images or len(req.images) == 0:
        raise HTTPException(status_code=400, detail="Vui lòng gửi ít nhất 1 ảnh khuôn mặt!")

    extracted_encodings = []
    saved_images = []

    import face_recognition

    for idx, img_b64 in enumerate(req.images):
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        try:
            img_bytes = base64.b64decode(img_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            # Phát hiện mặt bằng YOLO
            boxes = face_service.detect_face_boxes(frame)
            if not boxes:
                # Thử phóng to tìm mặt
                rgb_test = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                boxes = face_recognition.face_locations(rgb_test, number_of_times_to_upsample=1, model="hog")

            if boxes:
                # Lấy khuôn mặt lớn nhất / rõ nhất
                best_box = boxes[0]
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                encs = face_recognition.face_encodings(rgb_frame, [best_box])
                if encs:
                    extracted_encodings.append(encs[0])
                    saved_images.append(frame)
        except Exception as e:
            print(f"[!] Lỗi khi xử lý ảnh mẫu {idx}: {e}")

    if len(extracted_encodings) == 0:
        raise HTTPException(
            status_code=400,
            detail="Không trích xuất được vector từ các ảnh gửi lên! Vui lòng chụp rõ mặt, đủ ánh sáng và nhìn thẳng camera."
        )

    # Lưu vào MongoDB và cập nhật RAM
    success = face_service.register_user_mongo(
        name=clean_name,
        encodings=extracted_encodings,
        sample_images=saved_images,
        employee_id=req.employeeId,
        department=req.department,
        email=req.email
    )

    if not success:
        raise HTTPException(status_code=500, detail="Không thể lưu trữ vector vào cơ sở dữ liệu!")

    return {
        "success": True,
        "name": clean_name,
        "samples_enrolled": len(extracted_encodings),
        "total_images_processed": len(req.images),
        "mongo_saved": face_service.mongo_connected,
        "message": f"Đã đăng ký thành công {len(extracted_encodings)} vector đặc trưng cho '{clean_name}' vào MongoDB!"
    }


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
            "confidence": item["confidence"],
            "is_match": item["is_match"],
            "distance": item["distance"],
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

        if item["is_match"] and (top_match is None or item["confidence"] > top_match["confidence"]):
            top_match = face_data

    # Tự động ghi log điểm danh nếu được yêu cầu và có mặt khớp
    if auto_checkin and top_match and top_match["is_match"]:
        time_str = time.strftime("%Y-%m-%d %H:%M:%S")
        log_attendance(top_match["name"], top_match["confidence"], time_str, frame)

    return {
        "success": True,
        "faces_detected": len(formatted_faces),
        "faces": formatted_faces,
        "top_match": top_match,
        "image_size": {"width": w, "height": h},
        "inference_time_ms": inference_ms,
        "model_used": "YOLOv11 Face + dlib ResNet" if face_service.yolo_model is not None else "dlib HOG + ResNet"
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

    return _process_image_array(frame, req.tolerance or TOLERANCE_THRESHOLD, req.auto_checkin or False)


@app.post("/predict-binary")
async def predict_binary(request: Request, tolerance: float = TOLERANCE_THRESHOLD, auto_checkin: bool = False):
    """Nhận diện khuôn mặt từ raw binary bytes (không cần python-multipart)"""
    body = await request.body()
    nparr = np.frombuffer(body, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return _process_image_array(frame, tolerance, auto_checkin)


if __name__ == "__main__":
    import uvicorn
    print("[*] Đang khởi chạy Face Recognition API Server trên cổng 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
