# 🚀 HƯỚNG DẪN KIẾN TRÚC & VẬN HÀNH MICROSERVICE

Hệ thống được thiết kế và triển khai theo kiến trúc **Microservices phân tách nghiệp vụ rõ ràng** giữa hai hệ thống thành phần, dùng chung hạ tầng CSDL MongoDB vật lý với phân định quyền ghi (write separation) và liên thông xác thực JWT.

---

## 🏛️ 1. Bản Đồ Dịch Vụ & Cổng Mạng (Service & Port Map)

| STT | Dịch Vụ (Service) | Thư Mục Triển Khai | Cổng (Port) | Chủ Sở Hữu Nghiệp Vụ & Quyền Hạn |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **AIAttendanceWeb3 Central Backend** | `AIAttendanceWeb3/backend` | **`4000`** | **Quản trị doanh nghiệp & Web3**: Quản lý Nhân sự (User), Phòng ban (Department), Ca làm việc (Shift), Phân ca (ShiftAssignment), Giao KPI, Duyệt đơn nghỉ (Leave approval), Báo cáo tổng hợp ngày/tháng, Neo bằng chứng Merkle Root lên Blockchain Sepolia, RBAC và NLU proxy. |
| **2** | **AIAttendanceWeb3 Central AI Service** | `AIAttendanceWeb3/ai-service` | **`8000`** | **NLU & Đăng ký sinh trắc**: Xử lý ngôn ngữ tự nhiên tiếng Việt PhoBERT (`/api/v1/nlu/query`), Trích xuất vector & Đăng ký khuôn mặt chuẩn hóa (`/api/v1/face/enroll`). |
| **3** | **AIAttendanceWeb3 Admin Frontend** | `AIAttendanceWeb3/frontend` | **`3000`** | **Giao diện Quản trị**: Màn hình Quản lý/Admin duyệt đơn, cấu hình ca kíp, phân công KPI, quản lý thiết bị, thu thập mẫu và đăng ký khuôn mặt nhân viên (`FaceEnrollPage`). |
| **4** | **Face-Detect Employee BFF** | `Face-Detect-MERN-Stack/mern/backend` | **`5000`** | **Cổng nghiệp vụ Nhân viên & Kiosk**: Xác thực JWT nhân viên, tiếp nhận chấm công Kiosk, chấm công thủ công vào/ra ca, tạo đơn xin nghỉ phép (`LeaveRequest`), tra cứu ca/KPI cá nhân, cấp token bảo chứng AI chống giả mạo điểm số. |
| **5** | **Face-Detect Local Face AI** | `Face-Detect-MERN-Stack/face_detect` | **`8001`** | **Xác thực nhận diện & Độ sống**: Chạy cục bộ mô hình lai YOLOv11 + dlib ResNet + MiniFASNet anti-spoofing (`/predict`, `/liveness-check`), bộ đệm RAM và API làm mới danh bạ vector read-only (`/refresh`, `/sync-mongo`). |
| **6** | **Face-Detect Employee Portal & Kiosk Web** | `Face-Detect-MERN-Stack/mern/frontend` | **`5173`** | **Giao diện Nhân viên & Trạm Kiosk**: Máy chấm công nhận diện khuôn mặt tự động freeze screen, Cổng Portal cá nhân (bảng chấm công, nộp đơn nghỉ, KPI, lịch ca), Widget hỏi đáp trợ lý ảo. |

---

## 🗄️ 2. Nguyên Tắc CSDL Dùng Chung & Phân Định Quyền Ghi (Shared DB Write Separation)

Hệ thống kết nối chung 1 cụm MongoDB vật lý (không đổi DB URI hay collection name), nhưng **tách biệt quyền ghi theo chủ quyền nghiệp vụ**:

1. **AIAttendanceWeb3 Backend (Port 4000)** sở hữu quyền ghi:
   - Collection `users`: Tạo mới, cập nhật hồ sơ nhân viên, phân quyền RBAC.
   - Field `users.face.*`: Central AI (Port 8000) ghi vector đặc trưng khuôn mặt (`face.embedding`, `face.enrolled`, `face.sampleCount`).
   - Collection `departments`: Tạo và quản lý cơ cấu phòng ban.
   - Collection `shifts`, `shiftassignments`: Tạo ca và phân ca làm việc.
   - Collection `kpitasks`: Giao chỉ tiêu và cập nhật tiến độ KPI.
   - Collection `leaverequests`: Quyết định phê duyệt / từ chối đơn nghỉ phép (`status: approved | rejected`, `decidedBy`, `decidedAt`).
   - Collection `blockchainlogs`, `aireports`: Ghi nhận nhật ký neo hash Web3 Merkle Root.

2. **Face-Detect Employee Service (Port 5000)** sở hữu quyền ghi:
   - Collection `attendancerecords`: Ghi nhận lượt chấm công từ Kiosk (`method: 'face'`) và chấm công thủ công (`method: 'manual'`).
   - Collection `leaverequests`: Tạo mới đơn xin nghỉ phép của nhân viên (`status: 'pending'`).

3. **Read Model & Báo cáo**:
   - AIAttendanceWeb3 đọc `attendancerecords` trực tiếp từ database dùng chung để kết xuất báo cáo thống kê, hiển thị bảng chấm công quản trị, và tính toán cây Merkle Root neo lên Ethereum Sepolia testnet.
   - Face-Detect đọc `users`, `shifts`, `shiftassignments`, `kpitasks` để hiển thị portal cá nhân và danh bạ trạm Kiosk.

---

## 🛡️ 3. An Toàn Xác Thực & Chống Giả Mạo Điểm AI (Anti-Spoofing & Identity Protection)

1. **Khóa các Route Quản trị trên Employee BFF (HTTP 410 Gone)**:
   - `POST /api/users` -> `410 Gone` (Chuyển sang Central Backend 4000).
   - `PATCH /api/users/:id/face` -> `410 Gone` (Chuyển sang Central AI 8000).
   - `DELETE /api/users/:id` -> `410 Gone`.
   - `POST /api/ai/register-face` -> `410 Gone`.
2. **Ngừng cung cấp POST Chấm công trên Central Backend (HTTP 410 Gone)**:
   - `POST /api/attendance/checkin`, `POST /api/attendance/checkout` -> `410 Gone`.
   - `POST /api/attendance/checkin-by-face`, `POST /api/attendance/checkout-by-face` -> `410 Gone`.
   - Giữ nguyên `GET /api/attendance`, `GET /api/attendance/history` và RBAC.
3. **Chống giả mạo điểm AI bằng payload client & Cơ chế Token Proof riêng biệt**:
   - Kiosk client gửi ảnh lên Face BFF `POST /api/ai/predict`.
   - Face BFF gọi Face AI local tại `http://localhost:8001/predict`.
   - Nếu xác thực thành công (độ khớp $\ge 85\%$, `liveness_score` $\ge 65$ và người thật `is_real === true`), Face BFF cấp một **`verificationToken`** được ký điện tử bằng biến môi trường **`FACE_VERIFICATION_SECRET`** RIÊNG BIỆT (tuyệt đối không dùng chung hay fallback sang `JWT_SECRET` đăng nhập; nếu thiếu cấu hình secret này, hệ thống áp dụng cơ chế **Fail-Closed** trả lỗi `503 CONFIG_MISSING` và không cấp token).
   - Khi Kiosk gọi `POST /api/attendance`, server giải mã token để lấy điểm số xác thực thật sự. Mọi yêu cầu tự khai báo điểm số AI từ client, header tùy ý, hoặc token giả mạo đều bị từ chối với mã lỗi `403 UNAUTHORIZED_AI_EVIDENCE`.
4. **Phân quyền Server-Side & Bảo vệ API Enroll / Refresh (Fail-Closed)**:
   - **Face Enrollment (Đăng ký khuôn mặt)**: Thuộc quyền quản trị độc quyền của Admin. `FaceEnrollPage` gọi Central Backend `POST /api/users/:employeeCode/face-enroll` (có `authMiddleware` + `requireRole(['admin'])`). Central Backend chuyển tiếp sang Central AI Service qua header `x-service-key: process.env.AI_SERVICE_SECRET`. AI Service từ chối (401/403) mọi truy cập trực tiếp nếu thiếu hoặc sai secret.
   - **Face AI Read-Only & Fail-Closed**:
     - Face AI (`8001`) là Read-Only consumer của MongoDB collection `users`. Tuyệt đối KHÔNG ghi MongoDB, không tự sync local lên CSDL, và không xóa user (`delete_one`).
     - Khi MongoDB rỗng hoặc mất kết nối MongoDB: Face AI **Fail-Closed** (danh bạ nhận diện trống, KHÔNG fallback sang `encodings.pkl` cục bộ cho API/Kiosk).
     - **Refresh Endpoint (`/api/ai/refresh`, `/sync-mongo`)**: Được bảo vệ bằng `FACE_AI_INTERNAL_TOKEN` (yêu cầu header `x-internal-token`). Nếu thiếu cấu hình token trên Face AI, trả `503 CONFIG_MISSING` (fail-closed, không fallback mở cửa tự do).
     - **MiniFASNet Liveness**: Khi mô hình chưa tải hoặc lỗi, mặc định `is_real = false`, `liveness_score = 0.0` (fail-closed).

---

## ⛓️ 4. Tính Toàn Vẹn Blockchain Web3 (Merkle Root Hash)

Bản ghi chấm công do Face-Detect ghi nhận chứa đầy đủ các trường: `userId`, `workDate`, `checkInAt`, `checkOutAt`, `status`, `lateMinutes`.

Thuật toán `computeRecordHash` trong Central Backend (`AIAttendanceWeb3/backend/src/services/anchorWorker.js`):
$$\text{RecordHash} = \text{keccak256}(\text{JSON.stringify}(\{ \text{employeeId}, \text{workDate}, \text{checkInAt}, \text{checkOutAt}, \text{status}, \text{lateMinutes} \}))$$

Thuật toán đã được kiểm thử và xác nhận tương thích 100% với bản ghi do Face Service ghi, hỗ trợ tổng hợp cây Merkle theo ngày và neo lên Sepolia testnet không thể bị chối bỏ.

---

## 💻 5. Hướng Dẫn Khởi Chạy Các Dịch Vụ

Mở 4 cửa sổ terminal riêng biệt và khởi chạy:

### 🔹 Terminal 1: Face AI Verification Engine (Port 8001)
```bash
cd Face-Detect-MERN-Stack/face_detect
# Kích hoạt môi trường Python 3.11
python api_server.py
# Server chạy tại http://localhost:8001
```

### 🔹 Terminal 2: Central AI Hub Service (Port 8000)
```bash
cd AIAttendanceWeb3/ai-service
# Kích hoạt môi trường Python 3.11
uvicorn app.main:app --port 8000
# Server chạy tại http://localhost:8000
```

### 🔹 Terminal 3: Central Business Backend (Port 4000)
```bash
cd AIAttendanceWeb3/backend
npm start
# Server chạy tại http://localhost:4000
```

### 🔹 Terminal 4: Face Employee BFF & Kiosk Backend (Port 5000)
```bash
cd Face-Detect-MERN-Stack/mern/backend
npm start
# Server chạy tại http://localhost:5000
```

### 🔹 Frontend Development Servers:
- **Admin Portal**: `cd AIAttendanceWeb3/frontend && npm run dev` (Port 3000)
- **Employee Portal & Kiosk**: `cd Face-Detect-MERN-Stack/mern/frontend && npm run dev` (Port 5173)

---

## 🧪 6. Kết Quả Kiểm Thử (Test Suite Verification)

Hệ thống đã bổ sung và chạy kiểm thử tự động trên cả 2 repo:
1. **Kiểm thử hợp đồng & liên dịch vụ (`tests/microserviceContractAndWeb3.test.js`)**: **10/10 PASS**.
   - Inter-service JWT compatibility.
   - Web3 Keccak256 hash và Merkle root tính toán từ bản ghi do Face Service ghi.
   - Chặn đứng giả mạo điểm AI bằng payload client khi thiếu verificationToken (403).
   - Kiểm tra mã lỗi 410 Gone trên các route chuyển giao của cả 2 dịch vụ.
2. **Kiểm thử Fail-Closed Kiosk Backend (`tests/attendanceFailClosed.test.js`)**: **17/17 PASS**.
3. **Kiểm thử Quản trị & RBAC Central Backend (`tests/attendanceByFace.test.js`, `tests/noAuthRoutes.test.js`, `tests/leaveApprovalRbac.test.js`)**: **17/17 PASS**.
