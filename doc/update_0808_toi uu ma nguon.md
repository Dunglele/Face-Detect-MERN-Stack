# Kế Hoạch Tối Ưu Hóa Mã Nguồn Nhận Diện Khuôn Mặt (`face_detect`)

## Bối cảnh & Vấn đề hiện tại
Thư mục `face_detect` hiện có nhiều file thử nghiệm rời rạc (`opcv.py`, `detect_face.py`, `test232.py`, `test_cu.py`), gặp các hạn chế lớn:
1. **Lưu trữ & Hiệu năng kém**: Mỗi lần khởi động lại phải duyệt qua từng file ảnh `.jpg` rồi tính toán lại vector encoding từ đầu, rất chậm khi số lượng người tăng lên. Chỉ chụp 1 ảnh đơn lẻ nên góc nghiêng, ánh sáng khác sẽ không nhận diện được.
2. **Thiếu tỷ lệ % chính xác**: Khoảng cách Euclidean (`face_distance`) chưa được quy đổi sang tỷ lệ phần trăm (`%`) trực quan và khoa học.
3. **Lỗi logic & phụ thuộc thiếu**: Có file phụ thuộc `ultralytics` nhưng môi trường chưa cài đặt, logic so khớp khuôn mặt bị lặp và so sánh sai kiểu dữ liệu.

---

## Giải pháp Đề xuất

### 1. Cơ chế Học nhiều góc & Lưu trữ tối ưu
- **Thu thập mẫu đa góc độ (Multi-angle Enrollment)**:
  - Khi người dùng nhập tên (ví dụ: `Dung`), chương trình mở webcam, hiển thị vòng đếm tiến độ trực quan (ví dụ: cần 15 - 20 mẫu khuôn mặt chất lượng).
  - Hướng dẫn người dùng trên màn hình: nhìn thẳng, nghiêng trái, nghiêng phải, hơi ngửa, hơi cúi.
  - Tự động kiểm tra chất lượng: chỉ lưu khi phát hiện đúng 1 khuôn mặt rõ nét, có độ trễ giữa các lần chụp để đa dạng hóa góc nhìn.
- **Định dạng lưu trữ tối ưu (`encodings.pkl`)**:
  - Trích xuất trực tiếp vector nhúng đặc trưng 128 chiều (`128-dimensional face encodings`).
  - Lưu vào file nhị phân nén `face_detect/data/encodings.pkl` chứa cấu trúc:
    ```python
    {
        "names": ["Dung", "Dung", ..., "Nam"],
        "encodings": [array(...), array(...), ...],
        "users": {"Dung": {"sample_count": 20, "created_at": "..."}}
    }
    ```
  - **Ưu điểm**:
    - Tốc độ tải cơ sở dữ liệu: Dưới **0.01 giây** (ngay lập tức), không cần quét lại từng file ảnh.
    - Dễ dàng thêm người mới hoặc xóa người cũ mà không làm gián đoạn hệ thống.
    - Lưu thêm ảnh đại diện / mẫu vào thư mục `face_detect/data/faces/<tên_người_dùng>/` để người dùng có thể xem lại khi cần.

### 2. Xác thực & Nhận diện thời gian thực kèm Tỷ lệ %
- **Tính toán Tỷ lệ % trùng khớp (Confidence %)**:
  - Sử dụng thuật toán so khớp khoảng cách tối thiểu (`min face_distance`) giữa khuôn mặt trên webcam với toàn bộ các mẫu góc của người dùng trong cơ sở dữ liệu.
  - Áp dụng công thức quy đổi phi tuyến tính (calibrated percentage formula) chuẩn cho dlib face recognition:
    ```python
    def distance_to_percentage(distance, threshold=0.6):
        if distance > threshold:
            # Nếu khoảng cách lớn hơn ngưỡng (không khớp), tỷ lệ giảm mạnh về < 50%
            prob = (1.0 - distance) / (1.0 - threshold) * 0.5
            return max(0.0, round(prob * 100, 2))
        else:
            # Nếu khoảng cách <= 0.6: 0.0 -> 100%, 0.4 -> ~92%, 0.6 -> 75%
            prob = 1.0 - (distance / (threshold * 2.0))
            return min(100.0, round(prob * 100, 2))
    ```
  - Nếu tỷ lệ >= 75% (tương ứng distance <= 0.6): Hiển thị Tên người dùng và Tỷ lệ % (ví dụ: `Dung (94.2%)`).
  - Nếu tỷ lệ < 75%: Hiển thị `Unknown` hoặc `Khong xac dinh`.
- **Tối ưu hóa hiển thị & Tốc độ khung hình (FPS)**:
  - Thu nhỏ frame khi xử lý nhận diện (scale 0.25x hoặc 0.5x) và giữ nguyên độ phân giải hiển thị gốc.
  - Áp dụng kỹ thuật xử lý xen kẽ frame (`process every N frames`) để webcam đạt mượt mà 30+ FPS không bị giật lag.
  - Vẽ bounding box bo góc hiện đại, hiển thị nhãn có nền màu thẩm mỹ, dễ nhìn.

### 3. Cấu trúc thư mục tinh gọn sau tối ưu

```
c:\Users\ASUS\Desktop\Face-Detect-MERN-Stack\face_detect\
│
├── config.py           # Thiết lập cấu hình (ngưỡng nhận diện, đường dẫn lưu data, tỉ lệ khung hình)
├── face_service.py     # Lõi xử lý logic (trích xuất vector, lưu/nạp file pkl, so khớp, tính %)
├── app.py              # Ứng dụng chính (Menu tương tác: Đăng ký góc mặt, Điểm danh/Nhận diện, Quản lý)
├── data/
│   ├── encodings.pkl   # File lưu trữ toàn bộ vector đặc trưng các khuôn mặt
│   └── faces/          # Thư mục lưu ảnh mẫu của từng người dùng
└── pic/                # (Giữ lại dữ liệu ảnh cũ của bạn)
```

---

## User Review Required
> [!NOTE]
> 1. Định dạng lưu trữ chính được đề xuất là `pickle` (`encodings.pkl`), định dạng chuẩn và nhanh nhất trong Python để serialize các mảng NumPy vector 128 chiều.
> 2. Quá trình quét đăng ký khuôn mặt sẽ yêu cầu khoảng **15-20 frames** mẫu theo nhiều góc để đảm bảo nhận diện chính xác nhất ngay cả khi quay sang trái/phải.
> 3. Các file thử nghiệm cũ (`opcv.py`, `detect_face.py`, v.v.) sẽ được giữ nguyên hoặc sao lưu để bạn không lo mất mã nguồn cũ, ứng dụng tối ưu mới sẽ chạy trực tiếp qua `python app.py`.

---

## Kế hoạch triển khai chi tiết

### Phase 1: Xây dựng Module Cấu hình & Lõi Nhận diện
- [NEW] [config.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/config.py): Định nghĩa các đường dẫn, ngưỡng khoảng cách `TOLERANCE = 0.55 - 0.60`, số mẫu cần chụp cho mỗi người `NUM_SAMPLES = 20`.
- [NEW] [face_service.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/face_service.py):
  - `save_database()` / `load_database()`: Quản lý đọc/ghi file `encodings.pkl`.
  - `distance_to_percentage()`: Hàm quy đổi Euclidean distance sang `%`.
  - `register_user_faces()`: Logic thu thập chuỗi vector nhiều góc và cập nhật vào CSDL.
  - `recognize_faces_in_frame()`: Nhận diện và trả về danh sách `(name, confidence_pct, (top, right, bottom, left))`.

### Phase 2: Xây dựng Giao diện ứng dụng & Điều khiển Webcam
- [NEW] [app.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/app.py):
  - Menu tương tác tiếng Việt rõ ràng:
    - `1. Đăng ký khuôn mặt mới (Học nhiều góc độ)`: Có thanh tiến độ (Progress bar) đếm số ảnh đã thu thập, hướng dẫn trực quan trên màn hình webcam.
    - `2. Xác thực / Nhận diện người dùng qua Webcam`: Quét mặt trực tiếp, vẽ khung và hiển thị `Tên` + `Tỷ lệ %`.
    - `3. Xem danh sách & Xóa người dùng`: Tiện lợi cho quản lý.
    - `4. Nhập dữ liệu từ thư mục ảnh cũ (Import từ pic/)`: Chuyển đổi ảnh cũ hiện có vào file vector mới mà không cần chụp lại.
    - `5. Thoát`.

### Phase 3: Kiểm thử và Xác minh
- Kiểm thử tự động hàm nạp, trích xuất vector và tính % trùng khớp với ảnh có sẵn trong `pic/` (`Dung.jpg`).
- Đảm bảo tính toán % mượt mà, đúng chuẩn xác suất và không gây lỗi crash.
