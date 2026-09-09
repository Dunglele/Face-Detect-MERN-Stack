# BÁO CÁO KẾT NỐI VÀ TÍCH HỢP HỆ THỐNG
## Nhận Diện Khuôn Mặt AI (`face_detect`) & Nền Tảng Quản Trị Web (`mern`)

---

## 1. Tổng Quan & Mục Tiêu Tích Hợp

Dự án **Face-Detect-MERN-Stack** là sự kết hợp giữa hai công nghệ:
1. **Lõi Xử Lý Thị Giác Máy Tính (AI Engine)** tại thư mục `face_detect/`: Xây dựng trên nền tảng **Python**, kết hợp mạng nơ-ron **YOLOv11** (dò tìm vùng mặt siêu tốc) và **dlib ResNet** (trích xuất vector đặc trưng 128 chiều, học đa góc độ 20 khung hình).
2. **Nền Tảng Quản Trị & Điều Hành Web (MERN Stack)** tại thư mục `mern/`: Xây dựng trên nền tảng **Node.js, Express, MongoDB và React (Vite)** với thiết kế tối giản theo tiêu chuẩn **Minimalist White Swiss International Style**.

### Mục Tiêu Của Việc Kết Nối:
*   Chuyển đổi hệ thống nhận diện từ ứng dụng chạy cục bộ (chỉ ghi file `.csv` trên máy) thành một **hệ thống quản trị nhân sự tập trung, đa nền tảng và hoạt động theo thời gian thực**.
*   Khi camera AI xác thực thành công danh tính nhân viên, dữ liệu chấm công sẽ được đồng bộ ngay lập tức vào cơ sở dữ liệu **MongoDB** và hiển thị trực quan trên **Dashboard quản trị**.
*   Cho phép người dùng quản lý nhân viên, cấu hình và thử nghiệm mô hình trực tiếp trên giao diện Web trình duyệt.

---

## 2. Kiến Trúc Tích Hợp Đa Tầng (System Architecture)

Hệ thống hoạt động theo mô hình lai (Hybrid Architecture):

```
+---------------------------------------------------------------------------------+
|                                 LUỒNG CAMERA AI                                 |
|                                                                                 |
|   +------------------+         +--------------------+         +-------------+   |
|   |  Webcam / IP Cam | ------> | YOLOv11 Face Detect| ------> | dlib ResNet |   |
|   |   (30 FPS Live)  |         | (Bounding Box <10ms|         |  (128-d Emb)|   |
|   +------------------+         +--------------------+         +-------------+   |
|                                                                      |          |
|                                                         So khớp với encodings   |
|                                                         Độ tin cậy >= 90% (5s)  |
|                                                                      v          |
|                                                              +---------------+  |
|                                                              | Ghi nhận mặt  |  |
|                                                              +---------------+  |
+----------------------------------------------------------------------|----------+
                                                                       |
                                                    HTTP REST API POST | JSON Payload
                                                    (Non-blocking)     v
+---------------------------------------------------------------------------------+
|                                BACKEND MERN STACK                               |
|                                                                                 |
|                 +-----------------------------------------------+               |
|                 |       Express.js Server (Port 5000)           |               |
|                 |    Route: /api/attendance & /api/users        |               |
|                 +-----------------------------------------------+               |
|                                         |                                       |
|                                         v                                       |
|                 +-----------------------------------------------+               |
|                 |          MongoDB (face_detect_db)             |               |
|                 |    Collections: "users" & "attendances"       |               |
|                 +-----------------------------------------------+               |
+----------------------------------------------------------------------|----------+
                                                                       |
                                                    REST / JSON Stream | Fetch
                                                                       v
+---------------------------------------------------------------------------------+
|                                FRONTEND GIAO DIỆN                               |
|                                                                                 |
|       +-------------------+   +--------------------+   +--------------------+   |
|       |    Landing Page   |   |   AI Testing Demo  |   |  Admin Dashboard   |   |
|       |       (URL: /)    |   |    (URL: /demo)    |   |    (URL: /admin)   |   |
|       +-------------------+   +--------------------+   +--------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 3. Các Luồng Dữ Liệu Chi Tiết (Data Workflows)

### Luồng 1: Xác Thực & Chấm Công Tự Động (Auto Check-in Flow)
1. **Thu nhận ảnh**: Camera thu thập khung hình tại `face_detect/app.py`.
2. **Dò tìm mặt (YOLOv11)**: Phát hiện vị trí khuôn mặt, loại bỏ nhiễu nền và cắt góc ảnh chuẩn hóa.
3. **Trích xuất & So khớp (dlib)**: Tính toán vector 128 chiều, so sánh khoảng cách Euclidean với tập `encodings.pkl`.
4. **Cơ chế Khóa màn hình (Freeze Screen)**: Nếu độ trùng khớp đạt $\ge 90\%$ liên tục trong 5 giây, camera kích hoạt sự kiện điểm danh thành công.
5. **Gửi dữ liệu sang MERN**: Hàm `log_attendance()` gửi HTTP request `POST` đến `http://localhost:5000/api/attendance`:
   ```json
   {
     "userName": "Nguyễn Tiến Dũng",
     "confidence": 96.8,
     "checkInType": "Check-in",
     "status": "Present"
   }
   ```
6. **Lưu trữ CSDL**: Express Server tiếp nhận, kiểm tra liên kết với tài khoản nhân viên trong bảng `users` và ghi vào bảng `attendances` của MongoDB.
7. **Hiển thị tức thời**: Trang Quản trị `/admin` tự động cập nhật nhật ký điểm danh mới nhất.

---

### Luồng 2: Đồng Bộ Hồ Sơ Nhân Viên (User Enrollment Sync Flow)
1. Quản trị viên có thể tạo trước hồ sơ nhân viên trên trang `/admin` (Họ tên, Mã nhân viên, Phòng ban).
2. Khi khởi chạy menu đăng ký khuôn mặt trên Python (`face_detect/app.py` - Chức năng 1):
   * Người dùng nhập tên nhân viên (ví dụ: `Dung`).
   * Hệ thống hướng dẫn người dùng quay 4 giai đoạn góc mặt (Trực diện, Nghiêng trái, Nghiêng phải, Ngửa/Cúi) để chụp đủ 20 ảnh mẫu.
   * Vector được trích xuất và nạp vào `face_detect/data/encodings.pkl`.
3. Đồng thời, Python gửi tín hiệu cập nhật trạng thái `PATCH /api/users/:id/face`:
   ```json
   {
     "isFaceEnrolled": true,
     "faceSampleCount": 20
   }
   ```
4. Trên giao diện Web, trạng thái nhân viên lập tức chuyển từ nhãn màu vàng *"Chưa nạp"* sang nhãn màu xanh *"Đã học mặt"*.

---

### Luồng 3: Thử Nghiệm Mô Hình Trực Tiếp Trên Trình Duyệt (`/demo`)
*   Người dùng không cần mở terminal Python mà vẫn có thể bật webcam ngay trên trình duyệt hoặc tải ảnh lên tại trang `/demo`.
*   Trình duyệt mô phỏng luồng quét laser, khung nhận diện Bounding Box và bảng thông số phân tích AI (độ khớp %, thời gian xử lý ms, góc mặt).
*   Người dùng có thể nhấn nút **"Ghi nhận điểm danh vào CSDL"** để đẩy thẳng dữ liệu vào MongoDB và kiểm tra ngay trên trang `/admin`.

---

## 4. Đặc Tả Các API Endpoints Của MERN Backend

Express Server (`mern/backend/server.js`) cung cấp các REST API chuẩn hóa:

| Phương thức | Đường dẫn API | Mục đích sử dụng | Dữ liệu đầu vào (Body) |
|---|---|---|---|
| `GET` | `/api/health` | Kiểm tra trạng thái máy chủ Backend | Không |
| `GET` | `/api/attendance` | Lấy danh sách lịch sử điểm danh | Query: `?date=YYYY-MM-DD&limit=50` |
| `POST`| `/api/attendance` | Ghi nhận lượt điểm danh mới (từ Python AI) | `{ userName, confidence, checkInType, snapshotUrl }` |
| `GET` | `/api/attendance/stats` | Lấy số liệu thống kê tổng hợp hôm nay | Không |
| `GET` | `/api/users` | Lấy danh sách toàn bộ nhân sự | Không |
| `POST`| `/api/users` | Thêm mới nhân sự | `{ name, employeeId, department, email }` |
| `PATCH`| `/api/users/:id/face` | Cập nhật số mẫu vector khuôn mặt đã học | `{ isFaceEnrolled, faceSampleCount }` |
| `DELETE`| `/api/users/:id` | Xóa hồ sơ nhân sự | Param: `id` |

---

## 5. Hướng Dẫn Tích Hợp Mã Nguồn Vào `face_detect/app.py`

Để camera Python tự động đẩy dữ liệu sang MERN Stack mỗi khi điểm danh, cập nhật hàm `log_attendance()` trong file [face_detect/app.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/app.py) như sau:

```python
import threading
import requests

MERN_API_URL = "http://localhost:5000/api/attendance"

def send_attendance_to_mern(name: str, confidence: float, snap_path: str = ""):
    """Gửi dữ liệu điểm danh sang Express Server trong một luồng riêng (non-blocking)"""
    payload = {
        "userName": name,
        "confidence": round(confidence, 1),
        "checkInType": "Check-in",
        "snapshotUrl": snap_path
    }
    try:
        response = requests.post(MERN_API_URL, json=payload, timeout=2.0)
        if response.status_code == 201:
            print(f"[MERN Sync] >> Dong bo diem danh thanh cong cho {name} ({confidence:.1f}%)")
        else:
            print(f"[MERN Sync] >> Server phan hoi ma loi: {response.status_code}")
    except Exception as e:
        # Nếu Backend chưa bật, in cảnh báo nhẹ, không làm gián đoạn camera
        print(f"[MERN Sync Warning] >> Khong the ket noi den Express API ({e})")

def log_attendance(name: str, confidence: float, time_str: str, frame: Optional[np.ndarray] = None):
    """Ghi log cuc bo vao CSV va dong thoi gui sang MERN Stack"""
    # 1. Ghi cuc bo vao file CSV truyen thong
    is_new = not ATTENDANCE_FILE.exists()
    try:
        with open(ATTENDANCE_FILE, "a", encoding="utf-8") as f:
            if is_new:
                f.write("Thoi gian,Ten nhan vien,Do tin cay (%)\n")
            f.write(f"{time_str},{name},{confidence:.1f}%\n")
    except Exception as e:
        print(f"[!] Loi ghi CSV: {e}")

    # 2. Luu anh chup bang chung
    snap_path_str = ""
    if frame is not None:
        try:
            safe_name = name.replace(" ", "_")
            snap_time = datetime.now().strftime("%Y%m%d_%H%M%S")
            snap_path = CHECKIN_DIR / f"{safe_name}_{snap_time}.jpg"
            cv2.imwrite(str(snap_path), frame)
            snap_path_str = str(snap_path)
        except Exception:
            pass

    # 3. Kích hoạt Thread gửi sang MERN API (khong lam giat lag webcam)
    threading.Thread(
        target=send_attendance_to_mern,
        args=(name, confidence, snap_path_str),
        daemon=True
    ).start()
```

> **Lợi ích của giải pháp Threading**:
> Việc bọc request mạng trong `threading.Thread(..., daemon=True)` đảm bảo khung hình webcam vẫn duy trì **30 FPS mượt mà**, không bị khựng lại ngay cả khi đường truyền mạng có độ trễ.

---

## 6. Cơ Chế Dự Phòng & Bền Vững Dữ Liệu (Fault Tolerance)

1. **Khả năng hoạt động khi mất kết nối mạng (Offline Fallback)**:
   * Nếu Backend Express hoặc MongoDB chưa khởi động, module Python vẫn tự động lưu trữ bản ghi vào `face_detect/data/attendance.csv` và ảnh chụp tại `face_detect/data/checkins/`.
   * Giao diện Frontend có sẵn dữ liệu mẫu dự phòng để người dùng có thể xem cấu trúc trước khi kết nối CSDL thực tế.
2. **Chống trùng lặp & Spam điểm danh (Debounce Mechanism)**:
   * Thuật toán trong `face_detect/app.py` yêu cầu giữ khuôn mặt có độ tin cậy $\ge 90\%$ liên tục trong 5 giây mới kích hoạt điểm danh một lần.
   * Sau khi điểm danh, hệ thống tự động thiết lập thời gian đóng băng (cooldown) để tránh việc cùng một người đứng trước camera bị gửi bản ghi liên tục nhiều lần trong một phút.

---

## 7. Hướng Dẫn Quy Trình Vận Hành Toàn Bộ Hệ Thống

Để toàn bộ hệ thống hoạt động đồng bộ, hãy thực hiện theo thứ tự 3 bước sau:

### Bước 1: Khởi động Backend MERN (Express & MongoDB)
Mở cửa sổ Terminal thứ nhất:
```bash
cd c:\Users\ASUS\Desktop\Face-Detect-MERN-Stack\mern\backend
npm run dev
```
*Kiểm tra kết nối: Mở trình duyệt vào `http://localhost:5000/api/health`, nếu nhận được `{"status":"online"}` là thành công.*

### Bước 2: Khởi động Giao diện Web (React / Vite)
Mở cửa sổ Terminal thứ hai:
```bash
cd c:\Users\ASUS\Desktop\Face-Detect-MERN-Stack\mern\frontend
npm run dev
```
*Truy cập giao diện tại: `http://localhost:5173/` (Landing Page) hoặc `http://localhost:5173/admin` (Trang Quản trị).*

### Bước 3: Khởi động Camera AI (Python)
Mở cửa sổ Terminal thứ ba:
```bash
cd c:\Users\ASUS\Desktop\Face-Detect-MERN-Stack
.\env\Scripts\activate
python face_detect/app.py
```
*Chọn chức năng `2` (Xác thực & Điểm danh webcam). Khi có người đứng trước camera, dữ liệu sẽ tự động đẩy về Backend và hiển thị ngay lập tức trên trang Web `/admin`!*

---

## 8. Kết Luận & Đánh Giá

Việc kết nối giữa **AI Python (`face_detect`)** và **MERN Stack (`mern`)** đã giải quyết trọn vẹn bài toán từ **xử lý thuật toán thông minh ở tầng biên (Edge AI)** đến **lưu trữ và trực quan hóa dữ liệu ở tầng máy chủ (Cloud/Web App)**. 

Hệ thống vừa giữ được tốc độ xử lý phần cứng cực đại của OpenCV/YOLO, vừa mang lại trải nghiệm quản trị hiện đại, tinh gọn và chuyên nghiệp theo tiêu chuẩn quốc tế.
