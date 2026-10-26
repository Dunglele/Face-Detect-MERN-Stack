import os
import pickle
import time
import warnings
from datetime import datetime, timezone
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
    MIN_MATCH_CONFIDENCE,
    MIN_IDENTITY_DISTANCE_MARGIN,
    MAX_IDENTITY_DISTANCE_RATIO,
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


import unicodedata

def normalize_search_name(text: str) -> str:
    """Loại bỏ dấu tiếng Việt và chuyển sang chữ thường (chuẩn User.searchName của CSDL)"""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    ascii_text = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    return ascii_text.lower().replace('đ', 'd').replace('Đ', 'd').strip()


def safe_l2_normalize(vec: Any) -> Optional[np.ndarray]:
    """
    Chuẩn hóa L2 an toàn cho vector đặc trưng 128 chiều.
    - Hỗ trợ list hoặc np.ndarray.
    - Kiểm tra độ dài đúng 128.
    - Loại bỏ vector chứa giá trị NaN, Inf hoặc không hữu hạn.
    - Loại bỏ zero vector / norm gần bằng 0 (< 1e-12) hoặc norm không hữu hạn.
    - Loại bỏ trường hợp vector có thành phần quá lớn gây overflow/norm không hữu hạn hoặc kết quả không hữu hạn.
    Trả về numpy array float64 đã chuẩn hóa L2 (norm == 1.0) hoặc None nếu không hợp lệ.
    """
    if vec is None:
        return None
    try:
        arr = np.array(vec, dtype=np.float64).flatten()
        if arr.shape != (128,):
            return None
        if not np.all(np.isfinite(arr)):
            return None
        norm = np.linalg.norm(arr)
        if not np.isfinite(norm) or norm < 1e-12:
            return None
        normalized = arr / norm
        if not np.all(np.isfinite(normalized)):
            return None
        return normalized
    except Exception:
        return None


def compute_representative_embedding(encodings: List[Any]) -> Optional[List[float]]:
    """
    Tính vector đặc trưng 128 chiều trung bình và chuẩn hóa L2
    (chuẩn users.face.embedding của AIAttendanceWeb3 dlib ResNet-34:
     mean các vector raw hợp lệ rồi chuẩn hóa L2 một lần duy nhất).
    """
    if not encodings:
        return None
    valid_raw_arrs = []
    for e in encodings:
        if e is None:
            continue
        try:
            arr = np.array(e, dtype=np.float64).flatten()
            if arr.shape != (128,):
                continue
            if not np.all(np.isfinite(arr)):
                continue
            # Kiểm tra vector không phải zero vector hay norm không hợp lệ
            norm = np.linalg.norm(arr)
            if not np.isfinite(norm) or norm < 1e-12:
                continue
            valid_raw_arrs.append(arr)
        except Exception:
            continue

    if not valid_raw_arrs:
        return None

    mean_vec = np.mean(valid_raw_arrs, axis=0)
    norm_mean = safe_l2_normalize(mean_vec)
    if norm_mean is None:
        return None
    return [round(float(x), 6) for x in norm_mean.tolist()]


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

        # Nạp dữ liệu: CHỈ nạp từ MongoDB do Admin enroll (AIAttendanceWeb3).
        # FAIL-CLOSED: Tuyệt đối không fallback sang encodings.pkl cục bộ cho API/kiosk!
        loaded_from_mongo = self.load_database_from_mongo()
        if not loaded_from_mongo:
            print("[!] FAIL-CLOSED: Khong the ket noi MongoDB hoac loi khi doc. Danh ba nhan dien trong!")
            self.known_encodings = []
            self.known_names = []
            self.users_meta = {}

    def _get_mongo_uri(self) -> str:
        """Tìm chuỗi kết nối MongoDB từ biến môi trường hoặc file mern/backend/.env"""
        uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
        if uri:
            return uri
        backend_env = BASE_DIR.parent / "mern" / "backend" / ".env"
        if backend_env.exists():
            try:
                for line in backend_env.read_text(encoding="utf-8").splitlines():
                    clean_line = line.strip()
                    if clean_line.startswith("MONGODB_URI="):
                        return clean_line.split("=", 1)[1].strip()
                    if clean_line.startswith("MONGO_URI="):
                        return clean_line.split("=", 1)[1].strip()
            except Exception:
                pass
        return "mongodb://localhost:27017/klcn134_attendance"

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
                self.db = self.mongo_client["klcn134_attendance"]
            self.db.command("ping")
            cols = self.db.list_collection_names()
            if "users" in cols:
                self.users_collection = self.db["users"]
                coll_name = "users"
            elif "user" in cols:
                self.users_collection = self.db["user"]
                coll_name = "user"
            else:
                self.users_collection = self.db["users"]
                coll_name = "users"
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
        Nạp vector đặc trưng từ MongoDB collection 'users'.
        Hỗ trợ đọc song song schema mới (face.embedding/fullName/employeeCode)
        và fallback schema cũ (faceDescriptors/isFaceEnrolled/name/employeeId) để không mất dữ liệu.
        Face AI là Read-Only consumer, FAIL-CLOSED:
        - Nếu mất kết nối Mongo: danh bạ rỗng, không fallback sang encodings.pkl.
        - Nếu DB rỗng (chưa có ai enroll): danh bạ rỗng, không fallback và tuyệt đối không tự ý sync local lên Mongo.
        - face.enrolled=false (explicit) thắng tuyệt đối: KHÔNG nạp embedding dù field embedding còn tồn tại.
        - Key nội bộ là mongo_id (duy nhất), không phải tên — tránh collision khi trùng tên.
        """
        if not self.mongo_connected or self.users_collection is None:
            self.known_encodings = []
            self.known_names = []
            self.users_meta = {}
            return False

        try:
            # Truy vấn: lấy tài liệu CÓ khả năng đã enrolled (để lọc tiếp ở Python).
            # KHÔNG dựa vào $or với face.embedding vì cần đảm bảo face.enrolled=false thắng.
            cursor = self.users_collection.find({
                "$or": [
                    {"face.enrolled": True},
                    {"faceDescriptors.0": {"$exists": True}},
                    {"isFaceEnrolled": True}
                ]
            })
            user_docs = list(cursor)

            if not user_docs:
                self.known_encodings = []
                self.known_names = []
                self.users_meta = {}
                print("[*] MongoDB chưa có vector khuôn mặt nào do Admin enroll. FAIL-CLOSED: Danh bạ nhận diện trống!")
                return True

            new_encodings = []
            new_names = []     # parallel với new_encodings, lưu meta_key (mongo_id)
            new_meta = {}      # key = mongo_id (duy nhất, tránh collision trùng tên)

            for doc in user_docs:
                mongo_id = str(doc.get("_id", ""))
                full_name = (doc.get("fullName") or doc.get("name") or "").strip()
                emp_code = (doc.get("employeeCode") or doc.get("employeeId") or "").strip()
                display_name = full_name or emp_code
                if not display_name:
                    continue

                # === KIỂM TRA ENROLLED STATUS ===
                face_obj = doc.get("face") or {}
                face_enrolled = face_obj.get("enrolled")  # có thể là True / False / None / missing

                # face.enrolled=False (explicit) → BỎ QUA hoàn toàn, ngay cả khi embedding còn tồn tại
                if face_enrolled is False:
                    continue

                # Schema cũ: isFaceEnrolled=False (explicit) → cũng bỏ qua
                is_face_enrolled_old = doc.get("isFaceEnrolled")
                if is_face_enrolled_old is False and face_enrolled is not True:
                    continue

                user_encs = []

                # 1. Ưu tiên nạp theo schema mới: doc.face.embedding (128-d float array)
                # Chỉ thực hiện khi face.enrolled không phải False (đã lọc ở trên)
                new_emb = face_obj.get("embedding")
                if isinstance(new_emb, list) and len(new_emb) == 128:
                    norm_vec = safe_l2_normalize(new_emb)
                    if norm_vec is not None:
                        user_encs.append(norm_vec)
                elif isinstance(new_emb, list) and len(new_emb) > 0 and isinstance(new_emb[0], (list, np.ndarray)):
                    for v in new_emb:
                        if len(v) == 128:
                            norm_vec = safe_l2_normalize(v)
                            if norm_vec is not None:
                                user_encs.append(norm_vec)

                # 2. Fallback sang schema cũ nếu schema mới chưa có vector (tránh mất dữ liệu người dùng cũ)
                if not user_encs:
                    old_descriptors = doc.get("faceDescriptors", [])
                    for desc in old_descriptors:
                        if len(desc) == 128:
                            norm_vec = safe_l2_normalize(desc)
                            if norm_vec is not None:
                                user_encs.append(norm_vec)

                if not user_encs:
                    continue

                # Dùng mongo_id làm khóa định danh nội bộ (duy nhất) để tránh collision trùng tên.
                # known_names lưu mongo_id thay vì display_name để tra ngược ra employeeCode.
                meta_key = mongo_id if mongo_id else (emp_code if emp_code else display_name)

                for enc in user_encs:
                    new_encodings.append(enc)
                    new_names.append(meta_key)

                new_meta[meta_key] = {
                    "sample_count": len(user_encs),
                    "employee_code": emp_code,
                    "employee_id": emp_code,  # backward compatibility
                    "full_name": full_name or display_name,
                    "name": display_name,      # human-readable, backward compatibility
                    "department": doc.get("department") or str(doc.get("departmentId", "General")),
                    "email": doc.get("email", ""),
                    "mongo_id": mongo_id,
                    "registered_at": str(doc.get("updatedAt", doc.get("createdAt", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))))
                }

            self.known_encodings = new_encodings
            self.known_names = new_names
            self.users_meta = new_meta
            print(f"[*] Đã nạp thành công {len(self.known_encodings)} vectors của {len(self.users_meta)} người dùng từ MongoDB (Admin enrolled)!")
            return True

        except Exception as e:
            print(f"[!] Lỗi khi đọc vector từ MongoDB: {e}. FAIL-CLOSED: Danh bạ nhận diện trống.")
            self.known_encodings = []
            self.known_names = []
            self.users_meta = {}
            return False

    def sync_local_to_mongo(self) -> bool:
        """
        [VÔ HIỆU HÓA] Face AI là Read-Only consumer, tuyệt đối KHÔNG ghi vào MongoDB users.
        Mọi quyền ghi User và Face Embedding thuộc sở hữu độc quyền của AIAttendanceWeb3 Admin Service.
        """
        print("[!] CẢNH BÁO: Face AI không có quyền ghi MongoDB. sync_local_to_mongo bị vô hiệu hóa theo kiến trúc microservice.")
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
        [VÔ HIỆU HÓA] Face AI tuyệt đối KHÔNG ghi CSDL MongoDB users.
        Quyền enroll thuộc AIAttendanceWeb3 Admin Service (Port 8000 /api/v1/face/enroll).
        """
        print(f"[!] CẢNH BÁO: Face AI không có quyền ghi MongoDB users cho '{name}'. Chức năng bị vô hiệu hóa.")
        return False

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
        """Lấy danh sách người dùng đã đăng ký kèm số lượng mẫu góc.
        Hiển thị full_name từ metadata, giữ mongo_id làm khóa nội bộ."""
        user_list = []
        for key, meta in sorted(self.users_meta.items()):
            display_name = meta.get("full_name") or meta.get("name") or key
            user_list.append({
                "id": key,
                "name": display_name,
                "full_name": display_name,
                "employee_code": meta.get("employee_code", ""),
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

        # Face AI là Read-Only consumer: TUYỆT ĐỐI KHÔNG xóa MongoDB users document!
        # Việc xóa nhân sự do AIAttendanceWeb3 Admin Service đảm nhiệm.
        print(f"[*] Đã xóa người dùng '{name}' khỏi bộ nhớ đệm RAM cục bộ của Face AI (không tác động MongoDB).")
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

            meta_key = None
            name = "Unknown"
            employee_code = ""
            full_name = "Unknown"
            confidence = 0.0
            is_match = False
            min_distance = 1.0
            second_best_distance = None
            distance_margin = None
            distance_ratio = None
            is_ambiguous = False

            # Bước 3: So khớp với cơ sở dữ liệu đã học đa góc độ (Identity grouping & Ambiguity gate)
            norm_query_enc = safe_l2_normalize(face_encoding)
            if norm_query_enc is not None and len(self.known_encodings) > 0:
                face_distances = face_recognition.face_distance(self.known_encodings, norm_query_enc)

                # Gộp khoảng cách theo identity meta_key (lấy min distance cho mỗi identity)
                # Nhiều sample cùng một identity không bị coi là đối thủ cạnh tranh của nhau
                identity_min_distances: Dict[str, float] = {}
                for idx, dist in enumerate(face_distances):
                    id_key = self.known_names[idx]
                    d_val = float(dist)
                    if id_key not in identity_min_distances or d_val < identity_min_distances[id_key]:
                        identity_min_distances[id_key] = d_val

                # Sắp xếp các identity theo khoảng cách tăng dần
                sorted_identities = sorted(identity_min_distances.items(), key=lambda x: x[1])

                if sorted_identities:
                    best_id, best_dist = sorted_identities[0]
                    min_distance = best_dist
                    confidence = distance_to_confidence_percentage(best_dist, tolerance)

                    num_identities = len(sorted_identities)
                    if num_identities >= 2:
                        second_id, second_dist = sorted_identities[1]
                        second_best_distance = round(second_dist, 4)

                        # Kiểm tra tính hữu hạn và điều kiện toán học (fail-closed)
                        if (
                            np.isfinite(best_dist)
                            and np.isfinite(second_dist)
                            and second_dist > 1e-12
                            and best_dist >= 0.0
                        ):
                            margin = second_dist - best_dist
                            ratio = best_dist / second_dist
                            distance_margin = round(margin, 4)
                            distance_ratio = round(ratio, 4)

                            # Thỏa mãn ambiguity gate: margin >= MIN_IDENTITY_DISTANCE_MARGIN VÀ ratio <= MAX_IDENTITY_DISTANCE_RATIO
                            passes_ambiguity = (
                                margin >= MIN_IDENTITY_DISTANCE_MARGIN
                                and ratio <= MAX_IDENTITY_DISTANCE_RATIO
                            )
                        else:
                            # Khoảng cách zero/nonfinite -> fail-closed
                            passes_ambiguity = False
                            distance_margin = None
                            distance_ratio = None

                        if not passes_ambiguity:
                            is_ambiguous = True
                    else:
                        # Chỉ có 1 identity duy nhất trong DB: không có đối thủ
                        passes_ambiguity = True

                    # Match gate: best đạt confidence >= MIN_MATCH_CONFIDENCE VÀ vượt qua ambiguity gate (nếu >= 2 identities)
                    if (
                        np.isfinite(confidence)
                        and confidence >= MIN_MATCH_CONFIDENCE
                        and passes_ambiguity
                    ):
                        meta_key = best_id
                        is_match = True
                        meta = self.users_meta.get(meta_key) or {}
                        employee_code = meta.get("employee_code", "")
                        full_name = meta.get("full_name", "") or meta.get("name", meta_key)
                        name = full_name
                    else:
                        # Ambiguous hoặc không đạt confidence: fail-closed, giấu danh tính tuyệt đối
                        is_match = False
                        meta_key = None
                        name = "Unknown"
                        employee_code = ""
                        full_name = "Unknown"

            # Bước 4: Kiểm tra chống giả mạo khuôn mặt (MiniFASNet Liveness Detection) - FAIL CLOSED
            is_real = False
            liveness_score = 0.0
            liveness_status = "MODEL_UNAVAILABLE"
            spoof_type = "unverified"

            if ANTI_SPOOF_ENABLED and self.anti_spoof_predictor is not None and self.anti_spoof_predictor.is_ready():
                try:
                    spoof_res = self.anti_spoof_predictor.predict(
                        frame,
                        (top, right, bottom, left),
                        bbox_format="top_right_bottom_left"
                    )
                    is_real = bool(spoof_res.get("is_real", False))
                    liveness_score = float(spoof_res.get("liveness_score", 0.0))
                    liveness_status = str(spoof_res.get("liveness_status", "SPOOF"))
                    spoof_type = str(spoof_res.get("spoof_type", "unknown"))
                except Exception as e:
                    print(f"[!] Lỗi khi chạy Anti-Spoofing: {e}")
                    is_real = False
                    liveness_score = 0.0
                    liveness_status = "ERROR"
                    spoof_type = "error"

            results.append({
                "name": name,
                "employee_code": employee_code,  # từ users_meta qua mongo_id — BFF dùng để tra User
                "full_name": full_name,           # tên đầy đủ từ metadata, không dùng làm khóa định danh
                "confidence": confidence,
                "is_match": is_match,
                "distance": round(min_distance, 3),
                "second_best_distance": second_best_distance,
                "distance_margin": distance_margin,
                "distance_ratio": distance_ratio,
                "is_ambiguous": is_ambiguous,
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
