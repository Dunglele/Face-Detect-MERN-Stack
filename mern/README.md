# Face Recognition & Attendance System - MERN Stack

Thư mục `mern/` là nơi triển khai toàn bộ ứng dụng web MERN stack (MongoDB, Express.js, React, Node.js) tích hợp cùng hệ thống nhận diện khuôn mặt YOLOv11 + dlib AI từ thư mục `face_detect/`.

---

## 1. Cấu Trúc Thư Mục

```
mern/
├── backend/                  # RESTful API Server (Node.js + Express + Mongoose)
│   ├── config/
│   │   └── db.js             # Cấu hình kết nối cơ sở dữ liệu MongoDB
│   ├── controllers/
│   │   ├── userController.js # Xử lý logic nhân sự & nạp trạng thái vector mặt
│   │   └── attendanceController.js # Xử lý ghi nhận và tra cứu điểm danh
│   ├── models/
│   │   ├── User.js           # Schema nhân viên (Họ tên, Mã NV, Phòng ban, Face status)
│   │   └── Attendance.js     # Schema lượt điểm danh (Confidence, Giờ, Trạng thái)
│   ├── routes/
│   │   ├── userRoutes.js     # Endpoints /api/users
│   │   └── attendanceRoutes.js # Endpoints /api/attendance
│   ├── .env.example          # Mẫu biến môi trường
│   ├── .env                  # Cấu hình môi trường (Port, Mongo URI)
│   ├── package.json
│   └── server.js             # Điểm khởi chạy server Express
│
├── frontend/                 # Giao diện điều hành (React + Vite - Glassmorphism)
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx    # Thanh điều hướng Glassmorphic & trạng thái API
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx # [Trang chủ /] Giới thiệu dự án & công nghệ AI
│   │   │   ├── DemoPage.jsx    # [Trang /demo] Thử nghiệm mô hình AI (Webcam & Upload)
│   │   │   └── AdminPage.jsx   # [Trang /admin] Quản trị nhân sự & nhật ký điểm danh
│   │   ├── App.jsx           # Cấu hình Router (/, /demo, /admin)
│   │   ├── index.css         # Hệ thống phong cách Glassmorphism (Kính mờ cao cấp)
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md                 # Tài liệu hướng dẫn sử dụng MERN Stack
```

---

## 2. Các Gói Thư Viện Phụ Thuộc (Dependencies)

> **Lưu ý:** Nếu bạn đang ở trên máy này ngay sau khi khởi tạo, toàn bộ thư viện `node_modules` đã được cài đặt sẵn. Nếu chuyển sang máy mới hoặc clone từ Git, hãy xem mục [Cài đặt khi clone sang máy mới](#cai-dat-khi-clone-sang-may-moi).

### 2.1. Backend (`mern/backend`)
*   **`express`** (`^4.21.2`): Framework Web nhẹ và mạnh mẽ để xây dựng hệ thống RESTful API endpoints.
*   **`mongoose`** (`^8.9.5`): Thư viện ODM (Object Data Modeling) kết nối, tạo Schema và truy vấn cơ sở dữ liệu MongoDB.
*   **`cors`** (`^2.8.5`): Middleware Cross-Origin Resource Sharing, cho phép Frontend React (port 5173) gửi request an toàn đến Backend (port 5000).
*   **`dotenv`** (`^16.4.7`): Nạp các biến môi trường cấu hình bí mật từ file `.env` vào `process.env`.
*   **`multer`** (`^1.4.5`): Middleware hỗ trợ tiếp nhận và lưu trữ file ảnh chụp từ camera hoặc multipart/form-data.
*   **`axios`** (`^1.7.9`): Client HTTP dùng để Backend giao tiếp nội bộ hoặc gọi sang Python AI Microservice.
*   **`morgan`** (`^1.10.0`): Logger tự động ghi lại toàn bộ lịch sử request/response ra terminal trong quá trình phát triển.
*   **`nodemon`** *(devDependencies - `^3.1.9`)*: Giám sát thay đổi file mã nguồn và tự động reload server Backend mà không cần restart thủ công.

### 2.2. Frontend (`mern/frontend`)
*   **`react` & `react-dom`** (`^19.x`): Thư viện lõi xây dựng giao diện người dùng theo Component-driven.
*   **`vite`** (`^6.x / ^9.x`): Build tool và Hot Module Replacement (HMR) cực nhanh cho môi trường phát triển.
*   **`lucide-react`**: Bộ biểu tượng SVG hiện đại, sắc nét và nhẹ cho Dashboard.

---

## 3. Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu cầu môi trường
*   **Node.js**: Phiên bản 18 trở lên (Khuyến nghị 20.x hoặc 24.x). Kiểm tra bằng lệnh: `node -v`
*   **MongoDB**: Dịch vụ cục bộ hoặc cụm Cloud Atlas.

<a id="cai-dat-khi-clone-sang-may-moi"></a>
### Bước 0: Cài đặt Dependencies (Khi clone mới hoặc sang máy khác)
Nếu thư mục chưa có `node_modules`, hãy chạy lệnh cài đặt:
```bash
# Cài đặt thư viện cho Backend:
cd mern/backend
npm install

# Cài đặt thư viện cho Frontend:
cd ../frontend
npm install
```

### Bước 1: Cấu hình Cơ sở dữ liệu (MongoDB)
Backend cần kết nối tới MongoDB để lưu trữ dữ liệu nhân viên và lịch sử điểm danh. Bạn có thể chọn 1 trong 2 cách:

*   **Cách 1 - MongoDB Atlas (Khuyên dùng, miễn phí và không cần cài phần mềm nặng máy):**
    1. Đăng ký tài khoản miễn phí tại [mongodb.com/atlas](https://www.mongodb.com/atlas).
    2. Tạo một Database Deployment (Cluster M0 miễn phí).
    3. Lấy chuỗi kết nối (Connection String) dạng:
       `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/face_detect_db?retryWrites=true&w=majority`
    4. Mở file `mern/backend/.env` và cập nhật dòng `MONGO_URI` với chuỗi trên.

*   **Cách 2 - MongoDB Cục bộ (Local Community Server):**
    1. Cài đặt [MongoDB Community Server](https://www.mongodb.com/try/download/community) cho Windows.
    2. Đảm bảo dịch vụ MongoDB service đang chạy. Chuỗi kết nối mặc định trong file `.env`:
       `MONGO_URI=mongodb://localhost:27017/face_detect_db`

### Bước 2: Khởi động Backend (Express Server)
```bash
cd mern/backend
npm run dev
```
*Server sẽ chạy tại: `http://localhost:5000`*
*Kiểm tra sức khỏe hệ thống: `http://localhost:5000/api/health`*

### Bước 3: Khởi động Frontend (React / Vite)
Mở một cửa sổ Terminal mới:
```bash
cd mern/frontend
npm run dev
```
*Truy cập giao diện tại: `http://localhost:5173`*

### 3.1. Các Trang Giao Diện (Phong Cách Glassmorphism)

Ứng dụng Frontend được xây dựng theo phong cách **Glassmorphism (Kính mờ cao cấp)** với 3 trang chuyên biệt:

1. **`http://localhost:5173/` (Landing Page)**:
   - Giới thiệu tổng quan dự án, kiến trúc tích hợp giữa AI và MERN Stack.
   - Trình diễn các chỉ số công nghệ cốt lõi: YOLOv11 Face (&lt; 0.01s), dlib ResNet 128-d (99.2%), MongoDB Realtime.
   - Biểu đồ luồng dữ liệu 4 bước từ Camera tới CSDL.

2. **`http://localhost:5173/demo` (Trang Thử Nghiệm Mô Hình AI)**:
   - **Chế độ Webcam Live**: Mở camera trực tiếp trên trình duyệt, quét laser và hiển thị Bounding Box nhận diện.
   - **Chế độ Tải ảnh**: Kéo thả ảnh khuôn mặt để kiểm tra phân tích độ nhạy.
   - Hiển thị đầy đủ Telemetry: Danh tính phát hiện, độ trùng khớp %, thời gian suy luận (ms), góc nghiêng khuôn mặt.
   - Nút **"Ghi nhận điểm danh vào CSDL"** cho phép gửi dữ liệu trực tiếp vào MongoDB qua API backend.

3. **`http://localhost:5173/admin` (Trang Quản Trị Hệ Thống)**:
   - Trung tâm quản trị toàn diện truy cập tại đường dẫn `/admin`.
   - Giám sát nhật ký điểm danh thời gian thực, tìm kiếm theo tên, phân loại Present/Unrecognized.
   - Quản lý danh mục nhân viên, theo dõi tình trạng nạp 20 góc mặt, modal thêm hồ sơ nhân sự mới.
   - Kiểm tra kết nối đa tầng: Express API (Port 5000) & MongoDB Database.

> **Mẹo UX:** Giao diện Frontend được tích hợp sẵn cơ chế fallback thông minh. Ngay cả khi chưa kết nối CSDL MongoDB, bạn vẫn có thể trải nghiệm giao diện trực quan với dữ liệu mẫu và tính năng thử nghiệm check-in mô phỏng.

---

## 4. Các API Endpoints Chính

| Phương thức | Đường dẫn | Chức năng | Body / Params |
|---|---|---|---|
| `GET` | `/api/health` | Kiểm tra trạng thái hoạt động của backend | Không |
| `GET` | `/api/users` | Lấy danh sách toàn bộ hồ sơ nhân sự | Không |
| `POST` | `/api/users` | Thêm nhân sự mới vào hệ thống | `{ name, employeeId, department, email }` |
| `PATCH`| `/api/users/:id/face` | Cập nhật trạng thái đã nạp vector khuôn mặt | `{ isFaceEnrolled, faceSampleCount }` |
| `DELETE`| `/api/users/:id` | Xóa hồ sơ nhân sự | `id` (Param) |
| `GET` | `/api/attendance` | Lấy danh sách lịch sử điểm danh | Query: `?date=YYYY-MM-DD&limit=50` |
| `POST`| `/api/attendance` | Ghi nhận lượt điểm danh mới từ camera AI | `{ userName, confidence, checkInType, snapshotUrl }` |
| `GET` | `/api/attendance/stats` | Thống kê số lượng nhân sự, lượt điểm danh hôm nay | Không |

---

## 5. Tích Hợp Cùng Mô Hình Nhận Diện Khuôn Mặt (Python AI)

Khi hệ thống camera Python (`face_detect/app.py` hoặc luồng quét webcam) xác thực thành công danh tính nhân viên:

Gửi request HTTP POST tự động đến Backend để ghi nhận lượt chấm công:

```python
import requests

API_URL = "http://localhost:5000/api/attendance"

def log_attendance_to_mern(name, match_percentage):
    payload = {
        "userName": name,
        "confidence": round(match_percentage, 1),
        "checkInType": "Check-in"
    }
    try:
        response = requests.post(API_URL, json=payload, timeout=2)
        if response.status_code == 201:
            print(f"[MERN Sync] Điểm danh thành công cho {name}")
    except Exception as e:
        print(f"[MERN Sync Error] Không thể kết nối Backend MERN: {e}")
```

Dữ liệu sẽ được lưu tức thời vào MongoDB và tự động hiển thị trên Dashboard giám sát của Frontend!
