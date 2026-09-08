import os
import pickle
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

warnings.filterwarnings("ignore", category=UserWarning)

import cv2
import face_recognition
import numpy as np

from config import (
    ENCODINGS_FILE,
    FACES_DIR,
    YOLO_MODEL_PATH,
    DETECTION_BACKEND,
    YOLO_CONFIDENCE,
    TOLERANCE_THRESHOLD,
    FRAME_SCALE,
    LEGACY_PIC_DIR,
    SAMPLE_INTERVAL_SECONDS
)

# Thử import YOLO từ ultralytics
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


def distance_to_confidence_percentage(face_distance: float, face_match_threshold: float = TOLERANCE_THRESHOLD) -> float:
    """
    Quy đổi khoảng cách Euclidean của dlib (face_distance) sang tỷ lệ % tương đồng (0% - 100%).
    Công thức phi tuyến tính chuẩn xác cho dlib face recognition.
    """
    if face_distance > face_match_threshold:
        # Khoảng cách lớn hơn ngưỡng: độ trùng khớp giảm dần từ 50% về 0%
        range_val = 1.0 - face_match_threshold
        if range_val <= 0:
            return 0.0
        linear_val = (1.0 - face_distance) / (range_val * 2.0)
        confidence = max(0.0, linear_val)
    else:
        # Khoảng cách nhỏ hơn hoặc bằng ngưỡng: độ trùng khớp từ 50% đến 100%
        range_val = face_match_threshold
        if range_val <= 0:
            return 100.0
        linear_val = 1.0 - (face_distance / (range_val * 2.0))
        confidence = linear_val + ((1.0 - linear_val) * (linear_val - 0.5) * 2)
        confidence = min(1.0, max(0.5, confidence))

    return round(float(confidence * 100.0), 1)


class FaceService:
    def __init__(self):
        self.known_encodings: List[np.ndarray] = []
        self.known_names: List[str] = []
        self.users_meta: Dict[str, Dict[str, Any]] = {}
        self.yolo_model = None
        self._init_yolo()
        self.load_database()

    def _init_yolo(self):
        """Khởi tạo mô hình YOLO Face nếu có sẵn file mô hình và thư viện ultralytics"""
        if DETECTION_BACKEND == "yolo" and ULTRALYTICS_AVAILABLE:
            if YOLO_MODEL_PATH.exists():
                try:
                    self.yolo_model = YOLO(str(YOLO_MODEL_PATH))
                    print(f"[*] Da khoi tao bo do khuon mat YOLO thanh cong: {YOLO_MODEL_PATH.name}")
                except Exception as e:
                    print(f"[!] Khong the load model YOLO ({e}), se su dung fallback dlib HOG.")
                    self.yolo_model = None
            else:
                print(f"[!] Khong tim thay file {YOLO_MODEL_PATH}, se su dung dlib HOG.")
        else:
            self.yolo_model = None

    def detect_face_boxes(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Phát hiện vị trí các khuôn mặt trong ảnh, trả về danh sách tọa độ dạng:
        [(top, right, bottom, left), ...]
        Ưu tiên dùng YOLO nếu có, fallback sang dlib nếu cần.
        """
        if frame is None:
            return []

        h, w = frame.shape[:2]
        boxes = []

        # 1. Phát hiện bằng YOLO (cực nhạy và chính xác với góc nghiêng)
        if self.yolo_model is not None:
            try:
                results = self.yolo_model(frame, conf=YOLO_CONFIDENCE, verbose=False)
                for r in results:
                    for b in r.boxes:
                        x1, y1, x2, y2 = b.xyxy[0].cpu().numpy().astype(int)
                        # Giới hạn trong kích thước ảnh
                        top = max(0, min(h, int(y1)))
                        bottom = max(0, min(h, int(y2)))
                        left = max(0, min(w, int(x1)))
                        right = max(0, min(w, int(x2)))
                        if right > left and bottom > top:
                            boxes.append((top, right, bottom, left))
                return boxes
            except Exception as e:
                print(f"[!] Lỗi khi chạy YOLO face detect: {e}, chuyển sang fallback dlib.")

        # 2. Fallback: Phát hiện bằng dlib HOG
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        boxes = face_recognition.face_locations(rgb_frame, model="hog")
        if not boxes:
            boxes = face_recognition.face_locations(rgb_frame, number_of_times_to_upsample=2, model="hog")

        return boxes

    def load_database(self) -> bool:
        """Nạp dữ liệu vector đặc trưng từ file encodings.pkl siêu nhanh (< 10ms)"""
        if not ENCODINGS_FILE.exists():
            self.known_encodings = []
            self.known_names = []
            self.users_meta = {}
            return False

        try:
            with open(ENCODINGS_FILE, "rb") as f:
                data = pickle.load(f)
                self.known_encodings = data.get("encodings", [])
                self.known_names = data.get("names", [])
                self.users_meta = data.get("users", {})
            return True
        except Exception as e:
            print(f"[!] Lỗi khi nạp cơ sở dữ liệu khuôn mặt: {e}")
            self.known_encodings = []
            self.known_names = []
            self.users_meta = {}
            return False

    def save_database(self) -> bool:
        """Lưu toàn bộ vector đặc trưng và thông tin vào file encodings.pkl"""
        try:
            temp_file = ENCODINGS_FILE.with_suffix(".tmp")
            data = {
                "encodings": self.known_encodings,
                "names": self.known_names,
                "users": self.users_meta,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            with open(temp_file, "wb") as f:
                pickle.dump(data, f)

            if ENCODINGS_FILE.exists():
                ENCODINGS_FILE.unlink()
            temp_file.rename(ENCODINGS_FILE)
            return True
        except Exception as e:
            print(f"[!] Lỗi khi lưu cơ sở dữ liệu khuôn mặt: {e}")
            return False

    def get_users_list(self) -> List[Dict[str, Any]]:
        """Lấy danh sách người dùng đã đăng ký kèm số lượng mẫu góc"""
        user_list = []
        for name, meta in sorted(self.users_meta.items()):
            user_list.append({
                "name": name,
                "sample_count": meta.get("sample_count", 0),
                "registered_at": meta.get("registered_at", "N/A")
            })
        return user_list

    def delete_user(self, name: str) -> bool:
        """Xóa người dùng khỏi cơ sở dữ liệu và thư mục ảnh mẫu"""
        if name not in self.users_meta:
            return False

        new_encodings = []
        new_names = []
        for enc, n in zip(self.known_encodings, self.known_names):
            if n != name:
                new_encodings.append(enc)
                new_names.append(n)

        self.known_encodings = new_encodings
        self.known_names = new_names
        del self.users_meta[name]

        user_face_dir = FACES_DIR / name
        if user_face_dir.exists():
            for p in user_face_dir.glob("*"):
                try:
                    p.unlink()
                except Exception:
                    pass
            try:
                user_face_dir.rmdir()
            except Exception:
                pass

        self.save_database()
        return True

    def register_user(
        self,
        name: str,
        encodings: List[np.ndarray],
        sample_images: Optional[List[np.ndarray]] = None
    ) -> bool:
        """
        Đăng ký hoặc cập nhật người dùng với danh sách các vector mã hóa (học từ nhiều góc độ)
        """
        if not encodings:
            return False

        name = name.strip()
        if name in self.users_meta:
            self.delete_user(name)

        user_face_dir = FACES_DIR / name
        user_face_dir.mkdir(parents=True, exist_ok=True)

        if sample_images:
            for idx, img in enumerate(sample_images):
                save_path = user_face_dir / f"sample_{idx + 1:02d}.jpg"
                cv2.imwrite(str(save_path), img)

        for enc in encodings:
            self.known_encodings.append(enc)
            self.known_names.append(name)

        self.users_meta[name] = {
            "sample_count": len(encodings),
            "registered_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        return self.save_database()

    def detect_single_face_for_enrollment(
        self,
        frame: np.ndarray
    ) -> Tuple[Optional[Tuple[int, int, int, int]], Optional[np.ndarray], str]:
        """
        Kiểm tra frame trong quá trình đăng ký góc mặt.
        Sử dụng YOLO để bắt các góc nghiêng tốt nhất.
        Trả về: (face_box, face_encoding, status_message)
        """
        if frame is None:
            return None, None, "Khong doc duoc frame!"

        # Dùng bộ phát hiện mặt (YOLO)
        face_boxes = self.detect_face_boxes(frame)

        if len(face_boxes) == 0:
            return None, None, "Khong tim thay khuon mat"
        elif len(face_boxes) > 1:
            return None, None, "Phat hien nhieu khuon mat! Chi de 1 nguoi trong khung hinh"

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(rgb_frame, face_boxes)
        if not encodings:
            return None, None, "Dang can chinh khuon mat..."

        return face_boxes[0], encodings[0], "Hop le"

    def recognize_faces_in_frame(
        self,
        frame: np.ndarray,
        tolerance: float = TOLERANCE_THRESHOLD,
        scale: float = FRAME_SCALE
    ) -> List[Dict[str, Any]]:
        """
        Mô hình lai kết hợp:
        1. YOLO Face: Dò tìm vị trí khuôn mặt với độ chính xác và góc nhìn đa dạng.
        2. dlib ResNet: Trích xuất 128-d vector nhúng, so khớp danh tính và tính % tương đồng.
        """
        results = []
        if frame is None:
            return results

        # Thu nhỏ khung hình nếu cần tăng tốc
        if scale != 1.0:
            small_frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
            multiplier = 1.0 / scale
        else:
            small_frame = frame
            multiplier = 1.0

        # Bước 1: Dò tìm vị trí khuôn mặt bằng YOLO
        face_locations_small = self.detect_face_boxes(small_frame)
        if not face_locations_small:
            return results

        # Bước 2: Trích xuất vector nhận dạng 128 chiều
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations_small)

        for face_encoding, face_loc in zip(face_encodings, face_locations_small):
            # Quy đổi tọa độ về kích thước gốc
            top, right, bottom, left = face_loc
            top = int(round(top * multiplier))
            right = int(round(right * multiplier))
            bottom = int(round(bottom * multiplier))
            left = int(round(left * multiplier))

            name = "Unknown"
            confidence = 0.0
            is_match = False
            min_distance = 1.0

            # Bước 3: So khớp với cơ sở dữ liệu đã học đa góc độ
            if len(self.known_encodings) > 0:
                face_distances = face_recognition.face_distance(self.known_encodings, face_encoding)
                best_match_index = int(np.argmin(face_distances))
                min_distance = float(face_distances[best_match_index])

                # Tính tỷ lệ % khớp
                confidence = distance_to_confidence_percentage(min_distance, tolerance)

                if min_distance <= tolerance:
                    name = self.known_names[best_match_index]
                    is_match = True

            results.append({
                "name": name,
                "confidence": confidence,
                "is_match": is_match,
                "distance": round(min_distance, 3),
                "box": (top, right, bottom, left)
            })

        return results

    def import_legacy_pic_folder(self) -> int:
        """
        Quét các ảnh hiện có trong thư mục pic/ để tự động nạp vào database
        """
        if not LEGACY_PIC_DIR.exists():
            return 0

        imported_count = 0
        for file_path in LEGACY_PIC_DIR.glob("*.*"):
            if file_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
                continue

            person_name = file_path.stem
            img = cv2.imread(str(file_path))
            if img is None:
                continue

            boxes = self.detect_face_boxes(img)
            if not boxes:
                continue

            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            encodings = face_recognition.face_encodings(rgb_img, boxes)
            if encodings:
                if person_name not in self.users_meta:
                    self.register_user(person_name, [encodings[0]], [img])
                    imported_count += 1

        return imported_count
