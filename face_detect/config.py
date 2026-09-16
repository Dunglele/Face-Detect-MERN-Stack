from pathlib import Path

# Thư mục gốc của module face_detect
BASE_DIR = Path(__file__).resolve().parent

# Thư mục chứa dữ liệu
DATA_DIR = BASE_DIR / "data"
FACES_DIR = DATA_DIR / "faces"
ENCODINGS_FILE = DATA_DIR / "encodings.pkl"
ATTENDANCE_FILE = DATA_DIR / "attendance.csv"
CHECKIN_DIR = DATA_DIR / "checkins"

# Thư mục chứa model YOLO
MODELS_DIR = BASE_DIR / "models"
YOLO_MODEL_PATH = MODELS_DIR / "yolov11n-face.pt"

# Thư mục ảnh cũ (để import tương thích ngược)
LEGACY_PIC_DIR = BASE_DIR / "pic"

# Cấu hình Camera
CAMERA_INDEX = 0

# Bộ dò khuôn mặt (Face Detection Backend):
# 'yolo': Sử dụng YOLOv11 Face (cực nhạy với góc nghiêng, tốc độ cao)
# 'hog': Sử dụng dlib HOG truyền thống (dự phòng)
DETECTION_BACKEND = "yolo"

# Độ tin cậy tối thiểu để YOLO chấp nhận một vùng là khuôn mặt
YOLO_CONFIDENCE = 0.50

# Ngưỡng khoảng cách chuẩn của dlib Euclidean distance (thông thường 0.50 - 0.55)
# Khoảng cách <= TOLERANCE_THRESHOLD được coi là trùng khớp danh tính
TOLERANCE_THRESHOLD = 0.55

# Tỉ lệ thu nhỏ frame khi nhận diện (0.5 = 1/2 kích thước: cân bằng tốc độ và độ nhạy)
FRAME_SCALE = 0.5

# Số lượng mẫu khuôn mặt cần quét khi đăng ký (thu thập đa góc độ)
REGISTRATION_SAMPLES_COUNT = 20

# Khoảng thời gian nghỉ tối thiểu giữa các lần lấy mẫu (giây) để người dùng kịp đổi góc mặt
SAMPLE_INTERVAL_SECONDS = 0.35

# Cấu hình Tự động Chấm công / Điểm danh
CHECKIN_CONFIDENCE_THRESHOLD = 90.0  # Tỷ lệ % tối thiểu để bắt đầu giữ trạng thái
CHECKIN_HOLD_SECONDS = 5.0          # Thời gian giữ liên tục (giây) để tự động dừng và chốt thành công

# Cấu hình Chống giả mạo khuôn mặt (Anti-Spoofing / Liveness Detection MiniFASNet)
ANTI_SPOOF_DIR = MODELS_DIR / "anti_spoof"
ANTI_SPOOF_ENABLED = True
ANTI_SPOOF_THRESHOLD = 0.65  # Tỷ lệ % người thật tối thiểu (0.65 = 65%) để xác thực LIVE

# Tự động tạo thư mục nếu chưa có
DATA_DIR.mkdir(parents=True, exist_ok=True)
FACES_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
ANTI_SPOOF_DIR.mkdir(parents=True, exist_ok=True)
CHECKIN_DIR.mkdir(parents=True, exist_ok=True)

