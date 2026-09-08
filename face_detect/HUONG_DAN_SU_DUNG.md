# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG NHẬN DIỆN KHUÔN MẶT KẾT HỢP (YOLO + FACE RECOGNITION)

Hệ thống kết hợp 2 giai đoạn công nghệ mạnh mẽ nhất hiện nay:
1. **YOLOv11 Face**: Dò tìm vị trí khuôn mặt siêu tốc, bắt chính xác các góc nghiêng cực đại, che khuất hoặc khoảng cách xa.
2. **Face Recognition (dlib ResNet)**: Trích xuất vector nhúng 128 chiều, học đa góc độ và tính toán độ trùng khớp danh tính theo tỷ lệ phần trăm (%).

---

## 1. Cấu Trúc Thư Mục
```
face_detect/
│
├── config.py             # Thiết lập cấu hình (ngưỡng tolerance, camera, scale, YOLO confidence)
├── face_service.py       # Lõi xử lý AI lai (YOLO Detector + Face Recognition nhúng 128-d)
├── app.py                # Ứng dụng chính (Giao diện menu & cửa sổ nhận diện Webcam)
├── HUONG_DAN_SU_DUNG.md    # Hướng dẫn chi tiết
├── models/
│   └── yolov11n-face.pt  # Trọng số mô hình YOLOv11 Face
├── data/
│   ├── encodings.pkl     # CSDL vector đặc trưng các khuôn mặt (nạp trong < 0.01 giây)
│   └── faces/            # Thư mục lưu các ảnh mẫu góc chụp của từng người dùng
└── pic/                  # Dữ liệu ảnh gốc (có thể import tự động)
```

---

## 2. Cách Chạy Chương Trình

Kích hoạt môi trường ảo (nếu chưa kích hoạt):
```bash
cd c:\Users\ASUS\Desktop\Face-Detect-MERN-Stack
.\env\Scripts\activate
```

Chạy ứng dụng:
```bash
python face_detect/app.py
```
*(Hoặc `python face_detect/opcv.py`)*

---

## 3. Các Chức Năng Chính

### 1. Đăng ký khuôn mặt mới (Học nhiều góc độ)
- Nhập họ và tên người dùng (ví dụ: `Dung`).
- Màn hình camera sẽ hiển thị thanh tiến trình `0/20 (0%)` và chỉ dẫn trực quan từng bước:
  - **Giai đoạn 1**: Nhìn thẳng trực diện vào camera.
  - **Giai đoạn 2**: Nghiêng nhẹ mặt sang trái.
  - **Giai đoạn 3**: Nghiêng nhẹ mặt sang phải.
  - **Giai đoạn 4**: Hơi ngửa lên / cúi nhẹ / biểu cảm tự nhiên.
- Hệ thống tự động kiểm tra điều kiện khuôn mặt (chỉ chụp khi có đúng 1 khuôn mặt rõ nét, có độ trễ giữa các lần chụp để đa dạng hóa góc nhìn).
- Toàn bộ vector đặc trưng sẽ được lưu vào file `data/encodings.pkl` và các ảnh mẫu lưu vào `data/faces/<tên>/`.

### 2. Xác thực & Điểm danh chấm công tự động qua Webcam
- Mở webcam nhận diện người dùng trong thời gian thực.
- Khung nhận diện hiển thị:
  - Nếu trùng khớp: Khung viền xanh lá, hiển thị `[Tên người dùng] (Tỷ lệ %)`.
  - Nếu không xác định: Khung viền màu cam/đỏ, hiển thị `Unknown (Tỷ lệ %)`.
- **Cơ chế Tự động Điểm danh Chấm công (Freeze Screen)**:
  - Khi một người giữ khuôn mặt với tỷ lệ xác thực **>= 90% liên tục trong 5 giây**:
    - Màn hình hiển thị thanh đếm thời gian thực `DANG XAC THUC: [Tên] | 3.2s / 5.0s (94.5%)`.
    - Khi đủ 5 giây, hệ thống **tự động ngắt camera và giữ nguyên màn hình tại khoảnh khắc đó** (Freeze Frame).
    - Hiển thị bảng thông báo trung tâm: `[V] CHẤM CÔNG THÀNH CÔNG!` kèm tên nhân viên, thời gian chính xác và độ tin cậy.
    - Tự động ghi nhật ký vào file `data/attendance.csv` và lưu ảnh minh chứng vào `data/checkins/`.
    - Màn hình giữ nguyên để nhân viên xem xác nhận; bấm phím bất kỳ trên bàn phím để quay lại menu.
- Tối ưu hóa:
  - Xử lý xen kẽ frame và giảm tỷ lệ `FRAME_SCALE = 0.5` giúp tốc độ khung hình đạt **30+ FPS** mượt mà.
  - Nhấn `Q` hoặc `ESC` trên cửa sổ camera để trở về menu bất kỳ lúc nào.
  - Nhấn `S` để chụp ảnh lưu lại frame hiện tại.

### 3. Xem danh sách người dùng
- Hiển thị bảng chi tiết: Tên, số lượng góc mẫu đã học, ngày giờ đăng ký.

### 4. Xóa người dùng
- Nhập tên người dùng cần xóa để loại bỏ khỏi database và thư mục ảnh mẫu.

### 5. Import dữ liệu từ thư mục `pic/` cũ
- Tự động quét các file ảnh có sẵn trong `pic/` (như `Dung.jpg`), trích xuất vector và nạp vào database mà không cần chụp lại.

---

## 4. Công Thức Tính Tỷ Lệ Trùng Khớp (%)
Hệ thống sử dụng hàm ánh xạ phi tuyến tính chuẩn mực từ khoảng cách Euclidean (`face_distance` của dlib) sang tỷ lệ phần trăm:
- Khoảng cách `0.00` -> **100%** (khớp tuyệt đối)
- Khoảng cách `0.20` -> **~93%** (rất giống)
- Khoảng cách `0.36` -> **~78%** (giống tốt)
- Khoảng cách `0.55` (ngưỡng threshold) -> **50%**
- Khoảng cách `> 0.60` -> **< 45%** (Unknown - không trùng khớp)
