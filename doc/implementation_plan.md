# Kế Hoạch Triển Khai: Chuẩn Hóa Bounding Box, Đăng Ký Khuôn Mặt & Lưu Trữ Vector Lên MongoDB

Giải quyết 3 vấn đề cốt lõi người dùng yêu cầu:
1. **Sửa lỗi vẽ khung (Bounding Box) chưa chuẩn**: Khắc phục hiện tượng khung bị lệch sang tai/nền do video webcam bị lật gương (`scaleX(-1)`) và container dùng `objectFit: cover` làm lệch tỷ lệ phần trăm tọa độ.
2. **Bổ sung tính năng Đăng ký khuôn mặt trên Web**: Cho phép chụp nhiều góc mặt qua Webcam trực tiếp hoặc tải lên chùm ảnh chân dung, hiển thị hướng dẫn chụp và thanh tiến độ.
3. **Lưu trữ Vector đặc trưng 128-d vào MongoDB**: Mở rộng schema `User` trong MongoDB để lưu trữ mảng vector nhúng `faceDescriptors: [[Number]]`, kết nối Python AI trực tiếp với MongoDB để nạp & cập nhật vector tự động thời gian thực.

---

## 1. Phân Tích Nguyên Nhân Bounding Box Bị Lệch

* **Hiện tượng trong ảnh**: Khung màu cam hiển thị ở góc trên bên phải (khu vực tai/tường), kích thước nhỏ và báo `Unknown (48%)`, trong khi khuôn mặt người dùng ở trung tâm - bên trái.
* **Nguyên nhân kỹ thuật**:
  1. Thẻ `<video>` trong giao diện React được đặt `transform: scaleX(-1)` (hiệu ứng gương soi để người dùng nhìn tự nhiên).
  2. Hàm `captureAndRecognizeFace` chụp khung hình từ `<video>` qua thẻ `<canvas>` ngầm bằng lệnh `ctx.drawImage(video, 0, 0)`. Khung hình này là **ảnh gốc chưa lật gương**.
  3. YOLOv11 phát hiện khuôn mặt ở tọa độ của ảnh gốc (ví dụ: bên phải `left: 65%`).
  4. Lớp phủ `<div>` vẽ Bounding Box được đặt `left: 65%` mà **không đảo ngược tọa độ**. Do video đã bị lật gương (mặt hiển thị ở bên trái khoảng 25%), Bounding Box rơi sang bên phải (tai/tường).
  5. Thẻ `<video>` sử dụng `objectFit: cover` trong khung cố định `height: 420px`, làm cắt bớt 2 cạnh của video 16:9 hoặc 4:3, dẫn đến tỷ lệ phần trăm pixel bị co giãn không đồng đều.
  6. Ngưỡng `tolerance` trong `DemoPage.jsx` bị gán cứng là `0.44` (quá chặt so với mức chuẩn `0.50 - 0.55` của dlib), dẫn đến khoảng cách `0.462` bị phân loại thành `Unknown`.

---

## 2. Giải Pháp Chi Tiết

### A. Chuẩn hóa Bounding Box trên Giao Diện Web
* Tính toán lại tọa độ hiển thị cho chế độ Webcam (có lật gương):
  $$\text{displayLeft} = 100\% - \text{relative\_bbox.left} - \text{relative\_bbox.width}$$
* Đối với ảnh tĩnh tải lên (không lật gương):
  $$\text{displayLeft} = \text{relative\_bbox.left}$$
* Chuẩn hóa khung chứa camera: Thiết lập tỷ lệ hiển thị khớp với luồng video thực tế (`aspectRatio: '16/9'` hoặc tỷ lệ thực từ `videoWidth / videoHeight`) để loại bỏ hoàn toàn sai lệch do `objectFit: cover`.
* Cập nhật ngưỡng nhận diện mặc định sang `0.50` (hoặc cấu hình linh hoạt) để nhận diện chính xác danh tính người dùng đã đăng ký.

---

### B. Lưu Trữ Vector Đặc Trưng 128 Chiều Lên MongoDB
* **Cập nhật Schema MongoDB** ([User.js](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/backend/models/User.js)):
  ```javascript
  faceDescriptors: {
    type: [[Number]], // Mảng các vector 128-d (dlib ResNet float values)
    default: [],
  },
  ```
* **Python AI Microservice** ([face_service.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/face_service.py) & [api_server.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/api_server.py)):
  - Tích hợp `pymongo` kết nối trực tiếp đến cơ sở dữ liệu MongoDB (`face_detect_db` hoặc MongoDB Atlas cấu hình trong `.env`).
  - Hàm `load_database_from_mongo()`: Khi khởi động hoặc khi nhận tín hiệu đồng bộ, Python AI đọc tất cả vector từ collection `users` trong MongoDB và nạp vào bộ nhớ RAM (`self.known_encodings` và `self.known_names`) để so khớp thời gian thực.
  - Vẫn giữ cơ chế lưu dự phòng ra `encodings.pkl` cục bộ để đảm bảo tốc độ và tính sẵn sàng khi mạng ngoại tuyến.

---

### C. Xây Dựng Tính Năng Đăng Ký Khuôn Mặt Trên Giao Diện Web
* Bổ sung Tab / Modal **"Đăng Ký Khuôn Mặt (Face Enrollment)"** trên Web:
  1. Nhập thông tin nhân viên: Họ và tên, Mã nhân viên, Phòng ban, Email (hoặc chọn nhân viên sẵn có từ danh sách MongoDB).
  2. Chọn phương thức chụp:
     - **Webcam trực tiếp**: Nút "Chụp mẫu" cho phép chụp từ 3 đến 10 góc mặt (nhìn thẳng, nghiêng trái, nghiêng phải, hơi ngửa, mỉm cười) kèm thanh đếm mẫu trực quan.
     - **Tải ảnh lên**: Chọn 1 hoặc nhiều ảnh chân dung rõ nét từ máy tính.
  3. Khi nhấn "Lưu khuôn mặt vào MongoDB":
     - Gửi danh sách ảnh mẫu sang Python AI API (`/api/ai/register-face`).
     - Python AI dùng YOLOv11 tìm mặt, dlib trích xuất các vector 128 chiều.
     - Lưu trực tiếp mảng vector vào MongoDB và cập nhật ngay vào mô hình AI mà không cần khởi động lại server.

---

## 3. Các Tệp Cần Chỉnh Sửa & Bổ Sung

### Backend & AI
1. **[mern/backend/models/User.js](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/backend/models/User.js)**:
   - Thêm trường `faceDescriptors: { type: [[Number]], default: [] }`.
2. **[face_detect/face_service.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/face_service.py)**:
   - Thêm kết nối MongoDB qua `pymongo`.
   - Hàm `load_database_from_mongo()`.
   - Hàm `register_user_mongo(name, employee_id, encodings, user_id)`.
3. **[face_detect/api_server.py](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/face_detect/api_server.py)**:
   - Endpoint `POST /api/ai/register-face`: Trích xuất vector từ danh sách ảnh base64 và lưu vào MongoDB.
   - Endpoint `POST /api/ai/sync-mongo`: Tự động nạp lại vector từ MongoDB.
   - Sửa logic trả về tọa độ `relative_bbox` và hỗ trợ cờ `is_mirrored`.
4. **[mern/backend/server.js](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/backend/server.js)** & **[mern/backend/controllers/userController.js](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/backend/controllers/userController.js)**:
   - Proxy tuyến đường đăng ký khuôn mặt `/api/ai/register-face`.
   - Cập nhật API lấy danh sách user trả về trạng thái vector.

### Frontend
5. **[mern/frontend/src/pages/DemoPage.jsx](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/frontend/src/pages/DemoPage.jsx)**:
   - Sửa tọa độ hiển thị Bounding Box: lật trục hoành `100 - left - width` khi camera hoạt động.
   - Đặt aspect ratio container đồng bộ với camera để chống méo/lệch khung hình.
   - Thêm Tab **"Đăng ký khuôn mặt"**: Giao diện chụp nhiều góc mẫu, nhập tên và lưu trực tiếp lên MongoDB.
6. **[mern/frontend/src/pages/AdminPage.jsx](file:///c:/Users/ASUS/Desktop/Face-Detect-MERN-Stack/mern/frontend/src/pages/AdminPage.jsx)**:
   - Hiển thị số lượng vector thực tế đã lưu trong MongoDB cho từng nhân viên.
   - Bổ sung nút bấm mở modal chụp/đăng ký khuôn mặt trực tiếp cho nhân viên đó.

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### Kiểm Thử Bounding Box
1. Mở webcam trên `http://localhost:5173/demo`.
2. Đứng ở các vị trí (trái, phải, trung tâm, gần, xa) và quan sát Bounding Box. Khung màu cam/xanh phải ôm khít đúng khuôn mặt trên màn hình.

### Kiểm Thử Đăng Ký Khuôn Mặt Lên MongoDB
1. Vào tab Đăng ký trên Web, nhập tên người dùng mới (ví dụ: `Test User MERN`).
2. Chụp 5 ảnh mẫu qua webcam hoặc upload ảnh chân dung.
3. Nhấn nút "Đăng ký & Lưu vào MongoDB".
4. Kiểm tra trong MongoDB Atlas/Local: Bản ghi user phải có trường `faceDescriptors` với 5 vector 128 phần tử.
5. Chuyển sang tab "Webcam trực tiếp", đưa mặt vào camera: Hệ thống phải nhận diện được ngay tên `Test User MERN` với độ tin cậy $\ge 90\%$.
