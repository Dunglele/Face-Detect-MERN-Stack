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

try:
    import pymongo
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

from config import (
    BASE_DIR,
    ENCODINGS_FILE,
    FACES_DIR,
    YOLO_MODEL_PATH,
    DETECTION_BACKEND,
    YOLO_CONFIDENCE,
    TOLERANCE_THRESHOLD,
    FRAME_SCALE,
    LEGACY_PIC_DIR,
    SAMPLE_INTERVAL_SECONDS,
    ANTI_SPOOF_DIR,
    ANTI_SPOOF_ENABLED,
    ANTI_SPOOF_THRESHOLD
)

try:
    from anti_spoof import AntiSpoofPredictor
    ANTI_SPOOF_AVAILABLE = True
except ImportError:
    ANTI_SPOOF_AVAILABLE = False


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
        self.anti_spoof_predictor = None

        # Kết nối MongoDB
        self.mongo_client = None
        self.db = None
        self.users_collection = None
        self.mongo_connected = False

        self._init_yolo()
        self._init_anti_spoof()
        self._init_mongo()

        # Nạp dữ liệu: Ưu tiên nạp từ MongoDB, fallback sang file encodings.pkl
        loaded_from_mongo = self.load_database_from_mongo()
        if not loaded_from_mongo:
            self.load_database()

    def _get_mongo_uri(self) -> str:
        """Tìm chuỗi kết nối MongoDB từ biến môi trường hoặc file mern/backend/.env"""
        uri = os.environ.get("MONGO_URI")
        if uri:
            return uri
        backend_env = BASE_DIR.parent / "mern" / "backend" / ".env"
        if backend_env.exists():
            try:
                for line in backend_env.read_text(encoding="utf-8").splitlines():
                    clean_line = line.strip()
                    if clean_line.startswith("MONGO_URI="):
                        return clean_line.split("=", 1)[1].strip()
            except Exception:
                pass
        return "mongodb://localhost:27017/test"

    def _init_mongo(self):
        """Khởi tạo kết nối MongoDB để lưu trữ & nạp vector đặc trưng 128-d"""
        if not PYMONGO_AVAILABLE:
            print("[!] PyMongo chua duoc cai dat. Se su dung che do luu tru encodings.pkl cuc bo.")
            return

        try:
            uri = self._get_mongo_uri()
            self.mongo_client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
            try:
                self.db = self.mongo_client.get_default_database()
            except Exception:
                self.db = self.mongo_client["test"]
            self.db.command("ping")
            cols = self.db.list_collection_names()
            if "user" in cols:
                self.users_collection = self.db["user"]
                coll_name = "user"
            elif "users" in cols:
                self.users_collection = self.db["users"]
                coll_name = "users"
            else:
                self.users_collection = self.db["user"]
                coll_name = "user"
            self.mongo_connected = True
            print(f"[*] Ket noi MongoDB thanh cong den DB '{self.db.name}', collection '{coll_name}'")
        except Exception as e:
            self.mongo_connected = False
            self.mongo_client = None
            self.db = None
            self.users_collection = None
            print(f"[!] Khong the ket noi MongoDB ({e}), se su dung che do luu tru encodings.pkl cuc bo.")

    def load_database_from_mongo(self) -> bool:
        """
        Nạp toàn bộ vector đặc trưng từ MongoDB collection 'users'.
        Nếu MongoDB chưa có vector nào nhưng encodings.pkl có dữ liệu,
        tự động đẩy vector từ encodings.pkl lên MongoDB.
        """
        if not self.mongo_connected or self.users_collection is None:
            return False

        try:
            cursor = self.users_collection.find({
                "$or": [
                    {"faceDescriptors.0": {"$exists": True}},
                    {"isFaceEnrolled": True}
                ]
            })
            user_docs = list(cursor)

            if not user_docs:
                print("[*] MongoDB chua co vector khuon mat nao. Kiem tra file encodings.pkl cuc bo...")
                if ENCODINGS_FILE.exists():
                    self.load_database()
                    if len(self.known_encodings) > 0:
                        print(f"[*] Dang tu dong dong bo {len(self.known_encodings)} vectors cua {len(self.users_meta)} nguoi tu encodings.pkl len MongoDB...")
                        self.sync_local_to_mongo()
                        return True
                return False

            new_encodings = []
            new_names = []
            new_meta = {}

            for doc in user_docs:
                name = doc.get("name", "").strip()
                if not name:
                    continue
                descriptors = doc.get("faceDescriptors", [])
                if not descriptors:
                    continue

                for desc in descriptors:
                    if len(desc) == 128:
                        new_encodings.append(np.array(desc, dtype=np.float64))
                        new_names.append(name)

                new_meta[name] = {
                    "sample_count": len(descriptors),
                    "employee_id": doc.get("employeeId", ""),
                    "department": doc.get("department", "General"),
                    "email": doc.get("email", ""),
                    "mongo_id": str(doc.get("_id", "")),
                    "registered_at": str(doc.get("updatedAt", doc.get("createdAt", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))))
                }

            self.known_encodings = new_encodings
            self.known_names = new_names
            self.users_meta = new_meta
            print(f"[*] Da nap thanh cong {len(self.known_encodings)} vectors cua {len(self.users_meta)} nguoi dung tu MongoDB!")

            # Cập nhật sao lưu vào encodings.pkl
            self.save_database()
            return True

        except Exception as e:
            print(f"[!] Loi khi doc vector tu MongoDB: {e}")
            return False

    def sync_local_to_mongo(self) -> bool:
        """Đồng bộ toàn bộ vector đang có trong RAM / encodings.pkl lên MongoDB"""
        if not self.mongo_connected or self.users_collection is None:
            return False

        try:
            grouped: Dict[str, List[List[float]]] = {}
            for name, enc in zip(self.known_names, self.known_encodings):
                if name not in grouped:
                    grouped[name] = []
                grouped[name].append(enc.tolist() if isinstance(enc, np.ndarray) else [float(x) for x in enc])

            for idx, (name, descs) in enumerate(grouped.items()):
                meta = self.users_meta.get(name, {})
                emp_id = meta.get("employee_id") or f"EMP-{idx+1:03d}"
                dept = meta.get("department") or "AI & Engineering"
                email = meta.get("email") or f"{name.lower().replace(' ', '')}@company.com"

                self.users_collection.update_one(
                    {"name": name},
                    {
                        "$set": {
                            "name": name,
                            "employeeId": emp_id,
                            "department": dept,
                            "email": email,
                            "isFaceEnrolled": True,
                            "faceSampleCount": len(descs),
                            "faceDescriptors": descs,
                            "updatedAt": datetime.now()
                        },
                        "$setOnInsert": {
                            "createdAt": datetime.now()
                        }
                    },
                    upsert=True
                )
            print(f"[*] Da dong bo {len(grouped)} nguoi dung len MongoDB collection 'users' thanh cong!")
            return True
        except Exception as e:
            print(f"[!] Loi khi dong bo vector len MongoDB: {e}")
            return False

    def register_user_mongo(
        self,
        name: str,
        encodings: List[np.ndarray],
        sample_images: Optional[List[np.ndarray]] = None,
        employee_id: Optional[str] = None,
        department: Optional[str] = None,
        email: Optional[str] = None
    ) -> bool:
        """
        Đăng ký người dùng mới:
        1. Lưu mảng vector 128-d vào MongoDB collection 'users'
        2. Nạp ngay vào bộ nhớ RAM (self.known_encodings)
        3. Lưu bản sao vào encodings.pkl và lưu ảnh mẫu vào data/faces/
        """
        if not encodings:
            return False

        name = name.strip()
        descs = [enc.tolist() if isinstance(enc, np.ndarray) else [float(x) for x in enc] for enc in encodings]

        # Cập nhật trên MongoDB nếu có kết nối
        if self.mongo_connected and self.users_collection is not None:
            try:
                set_data = {
                    "name": name,
                    "isFaceEnrolled": True,
                    "faceSampleCount": len(descs),
                    "faceDescriptors": descs,
                    "updatedAt": datetime.now(),
                    "employeeId": employee_id or f"EMP-{int(time.time()) % 10000:04d}",
                    "department": department or "AI & Engineering",
                    "email": email or f"{name.lower().replace(' ', '')}@company.com"
                }

                self.users_collection.update_one(
                    {"name": name},
                    {
                        "$set": set_data,
                        "$setOnInsert": {
                            "createdAt": datetime.now()
                        }
                    },
                    upsert=True
                )
                print(f"[*] Da luu {len(descs)} vector cua '{name}' vao MongoDB thanh cong!")
            except Exception as e:
                print(f"[!] Loi luu MongoDB cho '{name}': {e}")

        # Cập nhật bộ nhớ cục bộ và file encodings.pkl
        return self.register_user(name, encodings, sample_images)

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

    def _init_anti_spoof(self):
        """Khởi tạo mô hình chống giả mạo MiniFASNet (Silent-Face-Anti-Spoofing)"""
        if not ANTI_SPOOF_ENABLED:
            print("[*] Tính năng Anti-Spoofing MiniFASNet đã bị tắt trong config.")
            return

        if not ANTI_SPOOF_AVAILABLE:
            print("[!] Không tìm thấy module anti_spoof. Bỏ qua khởi tạo Anti-Spoofing.")
            return

        try:
            self.anti_spoof_predictor = AntiSpoofPredictor(
                models_dir=ANTI_SPOOF_DIR,
                threshold=ANTI_SPOOF_THRESHOLD,
                auto_download=True
            )
            if self.anti_spoof_predictor.is_ready():
                print(f"[*] Đã khởi tạo Anti-Spoofing MiniFASNet thành công ({len(self.anti_spoof_predictor.models)} models, ngưỡng {ANTI_SPOOF_THRESHOLD*100:.0f}%)")
            else:
                print("[!] Chưa nạp được trọng số MiniFASNet nào.")
        except Exception as e:
            print(f"[!] Lỗi khi khởi tạo AntiSpoofPredictor: {e}")
            self.anti_spoof_predictor = None

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

        # Xóa khỏi MongoDB nếu có kết nối
        if self.mongo_connected and self.users_collection is not None:
            try:
                self.users_collection.delete_one({"name": name})
                print(f"[*] Da xoa nguoi dung '{name}' khoi MongoDB collection 'users'")
            except Exception as e:
                print(f"[!] Loi khi xoa '{name}' khoi MongoDB: {e}")

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

            # Bước 4: Kiểm tra chống giả mạo khuôn mặt (MiniFASNet Liveness Detection)
            is_real = True
            liveness_score = 100.0
            liveness_status = "REAL"
            spoof_type = "real"

            if ANTI_SPOOF_ENABLED and self.anti_spoof_predictor is not None and self.anti_spoof_predictor.is_ready():
                try:
                    spoof_res = self.anti_spoof_predictor.predict(
                        frame,
                        (top, right, bottom, left),
                        bbox_format="top_right_bottom_left"
                    )
                    is_real = spoof_res.get("is_real", True)
                    liveness_score = spoof_res.get("liveness_score", 100.0)
                    liveness_status = spoof_res.get("liveness_status", "REAL")
                    spoof_type = spoof_res.get("spoof_type", "real")
                except Exception as e:
                    print(f"[!] Lỗi khi chạy Anti-Spoofing: {e}")

            results.append({
                "name": name,
                "confidence": confidence,
                "is_match": is_match,
                "distance": round(min_distance, 3),
                "box": (top, right, bottom, left),
                "is_real": is_real,
                "liveness_score": liveness_score,
                "liveness_status": liveness_status,
                "spoof_type": spoof_type,
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
