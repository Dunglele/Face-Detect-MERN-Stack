# 🚀 Hướng Dẫn Vận Hành Hệ Thống Microservices

Hệ thống đã được tái cấu trúc và phân tách hoàn toàn theo mô hình **Microservices** phục vụ Khóa luận tốt nghiệp:

1. **`Face-Detect-MERN-Stack`**: Cổng Nhân Viên, Trạm Máy Chấm Công Kiosk Sinh Trắc Học & Trình Diễn Công Nghệ AI.
2. **`AIAttendanceWeb3`**: Cổng Quản Trị & Điều Hành (Admin / Manager), Trung Tâm Xử Lý AI (PhoBERT NLU) & Blockchain Web3 Anchor.
3. **Cơ sở dữ liệu (MongoDB)**: **Xài chung 100% CSDL**, đồng bộ toàn vẹn giữa Nhân viên và Quản trị viên.

---

## 🏛️ Sơ Đồ Kiến Trúc & Cổng Mạng (Port Map)

| Thành Phần | Thư Mục | Cổng (Port) | Đối Tượng & Vai Trò |
| :--- | :--- | :--- | :--- |
| **Cổng Nhân Viên & Kiosk (Web)** | `Face-Detect-MERN-Stack/mern/frontend` | **`5173`** | **Nhân viên & Khách tham quan**: Đăng nhập, xem bảng chấm công cá nhân, nộp đơn nghỉ phép, xem ca kíp, KPI, máy chấm công Kiosk, Chatbot AI. |
| **Employee BFF Backend** | `Face-Detect-MERN-Stack/mern/backend` | **`5000`** | **Backend Nhân viên**: Xử lý Auth JWT, CRUD đơn nghỉ, tra cứu chấm công tháng, chuyển tiếp Chatbot sang Central AI Hub. |
| **Cổng Quản Trị (Admin Portal)** | `AIAttendanceWeb3/frontend` | **`3000`** | **Admin & Quản lý**: Duyệt đơn nghỉ, phân ca, giao KPI, báo cáo thống kê, quản lý thiết bị Kiosk, đăng ký khuôn mặt. |
| **Central Business Backend** | `AIAttendanceWeb3/backend` | **`4000`** | **Core Backend Doanh Nghiệp**: Điều phối nghiệp vụ công ty, cảnh báo email, quản lý thiết bị Kiosk, neo Blockchain Merkle Root. |
| **Central AI Hub Service** | `AIAttendanceWeb3/ai-service` | **`8000`** | **Bộ Xử Lý AI Tập Trung**: Mô hình **PhoBERT NLU** (15 intents tiếng Việt), nhận diện khuôn mặt và **MiniFASNet Anti-Spoofing**. |

---

## ⚙️ Thống Nhất Cấu Hình Môi Trường (.env.example)

Cả 2 dịch vụ backend đã được thống nhất 100% cấu hình môi trường kết nối dùng chung:

```ini
# BẮT BUỘC TRÙNG NHAU GIỮA CẢ 2 BACKEND:
MONGODB_URI=mongodb://localhost:27017/klcn134_attendance
JWT_SECRET=klcn134-secret-key-for-dev
AI_SERVICE_URL=http://localhost:8000
```

- **`AIAttendanceWeb3/backend/.env.example`**: Chạy cổng `PORT=4000`, chứa thêm cấu hình Web3 (`SEPOLIA_RPC_URL`), cảnh báo Gmail (`GMAIL_USER`), ngưỡng chấm công (`MIN_LIVENESS_SCORE=0.65`).
- **`Face-Detect-MERN-Stack/mern/backend/.env.example`**: Chạy cổng `PORT=5000`, liên kết sang Central Backend (`CENTRAL_BACKEND_URL=http://localhost:4000`).

---

## 🔑 Dữ Liệu Dùng Chung & Tài Khoản Kiểm Thử

Cả 2 hệ thống đều kết nối tới cùng chuỗi `MONGODB_URI`. 

Mật khẩu chung cho tất cả các tài khoản demo: **`matkhau123`**

### 1. Tài khoản Nhân viên (Đăng nhập tại `http://localhost:5173/portal`)
- `NV002` — Nhân viên xưởng sản xuất
- `NV003` — Nhân viên phòng kỹ thuật
- `NV004` — Nhân viên văn phòng
- *(Từ `NV002` đến `NV025` đều là tài khoản nhân viên hợp lệ)*

### 2. Tài khoản Quản lý & Quản trị (Đăng nhập tại `http://localhost:3000`)
- `NV000` — **Quản trị viên toàn hệ thống (Admin)**
- `NV001` — **Quản lý Phân xưởng Sản xuất (Manager)**
- `NV013` — **Quản lý Phòng Kỹ thuật (Manager)**
- `NV020` — **Quản lý Văn phòng (Manager)**

---

## 💻 Hướng Dẫn Khởi Chạy Từng Dịch Vụ

Mở các cửa sổ Terminal (PowerShell/CMD) và chạy theo thứ tự:

### 🔹 Bước 1: Khởi chạy Central AI Hub (PhoBERT NLU + Face)
```bash
cd AIAttendanceWeb3/ai-service
uvicorn app.main:app --port 8000 --reload
```

### 🔹 Bước 2: Khởi chạy Central Business Backend
```bash
cd AIAttendanceWeb3/backend
npm start
# Server chạy tại http://localhost:4000
```

### 🔹 Bước 3: Khởi chạy Cổng Quản Trị (Manager Portal)
```bash
cd AIAttendanceWeb3/frontend
npm run dev
# Giao diện quản lý tại http://localhost:3000
```

### 🔹 Bước 4: Khởi chạy Employee BFF Backend
```bash
cd Face-Detect-MERN-Stack/mern/backend
npm start
# Server chạy tại http://localhost:5000
```

### 🔹 Bước 5: Khởi chạy Cổng Nhân Viên & Kiosk
```bash
cd Face-Detect-MERN-Stack/mern/frontend
npm run dev
# Giao diện Kiosk & Nhân viên tại http://localhost:5173
```

---

## 🔄 Các Kịch Bản Thử Nghiệm Liên Thông (Cross-Service Demo)

### 📌 Kịch bản 1: Nhân viên xem Báo Cáo Chấm Công dạng Bảng
1. Truy cập `http://localhost:5173/portal`.
2. Đăng nhập bằng `NV002` / `matkhau123` (hoặc click nút gợi ý tài khoản mẫu).
3. Tại tab **Bảng Chấm Công**:
   - Chọn tháng báo cáo (ví dụ: tháng hiện tại).
   - Xem 4 thẻ thống kê: Tổng ngày đi làm, Số ngày đúng giờ, Số lần đi muộn, Tổng giờ làm tích lũy.
   - Xem bảng chi tiết từng ngày làm việc (Giờ vào, Giờ ra, Số phút trễ, Trạng thái, Phương thức chấm công).
   - Bấm nút **Check-in vào ca** hoặc **Check-out ra ca** để thử tính năng chấm công nhanh.

### 📌 Kịch bản 2: Nhân viên Nộp Đơn Nghỉ Phép & Quản Lý Phê Duyệt
1. Tại cổng nhân viên `http://localhost:5173/portal`, chuyển sang tab **Đơn Nghỉ Phép**.
2. Xem thống kê quota ngày phép năm còn lại.
3. Bấm **"+ Tạo đơn xin nghỉ phép"**, chọn loại nghỉ (Nghỉ ốm, Phép năm...), chọn ngày và nhập lý do -> Bấm **Nộp đơn ngay**. Đơn xuất hiện ở trạng thái `⏳ Đang chờ duyệt`.
4. Mở tab mới truy cập Cổng Quản Trị: `http://localhost:3000`. Đăng nhập tài khoản Quản lý `NV001` (hoặc Admin `NV000`) / `matkhau123`.
5. Vào mục **"Duyệt đơn nghỉ"**: Đơn của nhân viên `NV002` vừa nộp lập tức xuất hiện. Bấm **"Duyệt"**.
6. Quay lại Cổng nhân viên `http://localhost:5173/portal` -> Trạng thái đơn tự động chuyển thành `✓ Đã phê duyệt`.

### 📌 Kịch bản 3: Máy Chấm Công Kiosk Sinh Trắc Học Tự Động
1. Tại `http://localhost:5173`, chọn mục **"Máy chấm công Kiosk"** (`/kiosk`).
2. Đứng trước Webcam: Hệ thống kích hoạt YOLOv11 Face Detector + MiniFASNet Anti-Spoofing (kiểm tra độ sống sinh trắc học người thật).
3. Khi nhận diện người thật giữ $\ge 85\%$ độ khớp, màn hình tự động kích hoạt **Freeze Screen**: Đóng băng 1 giây, phát chuông báo, hiển thị card chúc mừng nhân viên chấm công thành công.
4. Bản ghi điểm danh này lập tức được lưu vào CSDL MongoDB và hiển thị ở cả:
   - Cổng Nhân Viên (`http://localhost:5173/portal` - tab Bảng chấm công)
   - Cổng Quản Trị (`http://localhost:3000` - mục Chấm công & Dashboard)

### 📌 Kịch bản 4: Trợ Lý Ảo AI PhoBERT NLU
1. Tại góc dưới bên phải màn hình `http://localhost:5173`, bấm vào nút nổi **"Trợ lý AI PhoBERT"**.
2. Bấm vào câu hỏi mẫu hoặc gõ: *"Tháng này tôi còn bao nhiêu ngày phép?"* hoặc *"Hôm nay tôi vào ca mấy giờ?"*.
3. Request được gửi sang Central AI Hub (Port 4000/8000), phân loại ý định qua PhoBERT tiếng Việt và truy vấn số liệu thực tế từ database trả về cho nhân viên.

### 📌 Kịch bản 5: Đăng Ký Khuôn Mặt Nhân Viên (Tập trung tại AIAttendanceWeb3)
1. Đăng ký khuôn mặt là nghiệp vụ bảo mật sinh trắc học cấp Quản trị, đã được di dời toàn bộ từ `Face-Detect-MERN-Stack` sang `AIAttendanceWeb3`:
   - Truy cập Cổng Quản Trị: `http://localhost:3000/?tab=faceEnroll` (Đăng nhập `NV000` hoặc Quản lý `NV001`).
   - Chọn tab **"Đăng ký khuôn mặt"**.
2. Chọn nhân viên từ danh sách đồng bộ CSDL MongoDB chung.
3. Thu thập 5 góc khuôn mặt chuẩn hóa (Trực diện, Nghiêng trái 15°-20°, Nghiêng phải 15°-20°, Ngẩng cằm, Biểu cảm mỉm cười) qua Webcam hoặc tải ảnh chân dung lên.
4. Bấm **"Gửi đăng ký khuôn mặt"**: Vector đặc trưng 128 chiều (dlib ResNet) được trích xuất và nạp trực tiếp vào collection `users` trong MongoDB Atlas.
5. Ngay lập tức, máy chấm công Kiosk tại `Face-Detect-MERN-Stack` (`http://localhost:5173/kiosk`) có thể nhận diện và điểm danh nhân viên này mà không cần khởi động lại hệ thống!
