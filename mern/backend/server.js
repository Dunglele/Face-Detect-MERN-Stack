// Nạp .env trước khi đánh giá các module route/controller. Các module này đọc
// cấu hình xác thực và địa chỉ service ngay khi được import.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { getJwtSecret } from './middleware/authMiddleware.js';

// Dừng khởi động nếu thiếu secret dùng chung; không phát hành token bằng
// fallback vì Central Backend phải xác minh đúng cùng một chữ ký.
getJwtSecret();

// Kết nối CSDL MongoDB dùng chung
connectDB();

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Api-Key'],
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Face-Detect Employee BFF & Kiosk Backend',
    port: process.env.PORT || 5000,
    timestamp: new Date().toISOString(),
  });
});

// Mounted Routes
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', userRoutes);

import jwt from 'jsonwebtoken';
import { User } from './models/index.js';
import {
  adaptAiPredictRequest,
  adaptLegacyPredictResponse,
} from './services/aiAdapter.js';


// Microservice Ports & URL Configuration
// 1. Face AI local (Port 8001) — chuyên trách Face Verification & Anti-Spoofing
const FACE_AI_URL = process.env.FACE_AI_URL || 'http://localhost:8001';
// 2. Central AI Hub (Port 8000) — chuyên trách PhoBERT NLU & Face Enrollment
const CENTRAL_AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
// 3. Central Business Backend (Port 4000) — chuyên trách Admin & Web3
const CENTRAL_BACKEND_URL = process.env.CENTRAL_BACKEND_URL || 'http://localhost:4000';

app.get('/api/ai/status', async (req, res) => {
  try {
    const response = await fetch(`${FACE_AI_URL}/health`);
    const data = await response.json();
    res.json({
      success: true,
      ai_online: true,
      service_type: 'Face AI Verification Engine (Port 8001)',
      endpoint_url: FACE_AI_URL,
      central_ai_url: CENTRAL_AI_URL,
      central_backend_url: CENTRAL_BACKEND_URL,
      data,
    });
  } catch (error) {
    res.json({
      success: false,
      ai_online: false,
      message: `Local Face AI engine chưa chạy tại ${FACE_AI_URL}`,
      error: error.message,
    });
  }
});

// POST /api/ai/predict — Gọi Face AI local (Port 8001 /predict), KHÔNG gọi A AI verify 8000
app.post('/api/ai/predict', async (req, res) => {
  // Fail-closed: từ chối ngay nếu chưa cấu hình FACE_VERIFICATION_SECRET
  if (!process.env.FACE_VERIFICATION_SECRET) {
    console.error('[Face BFF] FAIL-CLOSED: FACE_VERIFICATION_SECRET chưa được cấu hình. Từ chối /api/ai/predict.');
    return res.status(503).json({
      success: false,
      code: 'CONFIG_MISSING',
      message: 'Face verification secret chưa được cấu hình trên server. Liên hệ quản trị viên.',
    });
  }

  try {
    const { legacyPayload } = adaptAiPredictRequest(req.body);

    let aiResponse = null;
    try {
      aiResponse = await fetch(`${FACE_AI_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyPayload),
      });
    } catch (localErr) {
      // Fallback thử endpoint /predict-base64 nếu server chỉ mount route base64
      try {
        aiResponse = await fetch(`${FACE_AI_URL}/predict-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(legacyPayload),
        });
      } catch {
        throw new Error(`Không thể kết nối đến Face AI Service tại ${FACE_AI_URL}: ${localErr.message}`);
      }
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return res.status(aiResponse.status).json({
        success: false,
        message: `Face AI Service trả về lỗi mã ${aiResponse.status}`,
        detail: errText,
      });
    }

    const rawData = await aiResponse.json();

    // Tra cứu thông tin người dùng từ CSDL DUY NHẤT bằng employeeCode (từ Face AI result).
    // TUYỆT ĐỐI không tra theo fullName (tên có thể trùng → gắn mã sai người).
    let matchedUser = null;
    const aiEmployeeCode = rawData.top_match?.employee_code;
    if (aiEmployeeCode && typeof aiEmployeeCode === 'string' && aiEmployeeCode.trim()) {
      try {
        matchedUser = await User.findOne({
          employeeCode: aiEmployeeCode.trim().toUpperCase(),
        }).lean();
        if (!matchedUser) {
          // Thử lại không upper-case (schema cho phép mixed case)
          matchedUser = await User.findOne({
            employeeCode: aiEmployeeCode.trim(),
          }).lean();
        }
      } catch {
        // ignore DB lookup error — matchedUser remains null → token sẽ không được cấp
      }
    }

    // Chuẩn hóa dữ liệu trả về theo format Kiosk/Portal
    const adaptedResponse = adaptLegacyPredictResponse(rawData, matchedUser);

    // Ký verificationToken chống giả mạo điểm AI từ payload client:
    // Để FaceAI is_match quyết định danh tính, BFF chỉ cấp verificationToken khi:
    // 1. FACE_VERIFICATION_SECRET đã được cấu hình
    // 2. isMatched === true (quyết định bởi FaceAI ngưỡng confidence >= 60%, pivot tolerance 0.40)
    // 3. top_match.is_real === true (strict equality)
    // 4. liveness_score là số finite >= 65
    // 5. employeeCode tra cứu thành công từ DB (matchedUser.employeeCode) — KHÔNG dùng tên
    // Không dùng điểm tự khai báo từ client để cấp token, chỉ dùng kết quả bảo chứng từ Face AI.
    const FACE_VERIFICATION_SECRET = process.env.FACE_VERIFICATION_SECRET;
    const topMatch = rawData.top_match;
    const isRealPerson = Boolean(topMatch && topMatch.is_real === true);
    const livenessScore = topMatch && typeof topMatch.liveness_score === 'number' && Number.isFinite(topMatch.liveness_score)
      ? topMatch.liveness_score
      : (typeof adaptedResponse.livenessScore === 'number' && Number.isFinite(adaptedResponse.livenessScore) ? adaptedResponse.livenessScore : -1);
    const confidenceScore = typeof adaptedResponse.confidence === 'number' && Number.isFinite(adaptedResponse.confidence)
      ? adaptedResponse.confidence
      : (typeof topMatch?.confidence === 'number' && Number.isFinite(topMatch.confidence) ? topMatch.confidence : 0);
    const isLivenessValid = livenessScore >= 65;
    const isMatched = topMatch ? Boolean(topMatch.is_match) : false;
    // dbEmployeeCode PHẢI đến từ DB lookup bằng employeeCode — KHÔNG fallback sang tên
    const dbEmployeeCode = matchedUser && matchedUser.employeeCode ? String(matchedUser.employeeCode).trim() : null;

    if (isMatched && isRealPerson && isLivenessValid && dbEmployeeCode) {
      const tokenPayload = {
        type: 'face_verification',
        iss: 'face-bff',
        employeeCode: dbEmployeeCode,
        fullName: matchedUser.fullName || adaptedResponse.fullName,
        confidence: confidenceScore,
        livenessScore: livenessScore,
        timingMs: adaptedResponse.timingMs || rawData.inference_time_ms,
        issuedAt: Date.now(),
      };
      const verificationToken = jwt.sign(tokenPayload, FACE_VERIFICATION_SECRET, { expiresIn: '120s' });
      adaptedResponse.verificationToken = verificationToken;
    }

    return res.status(200).json(adaptedResponse);
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: `Không thể kết nối đến Face AI Engine tại ${FACE_AI_URL}.`,
      error: error.message,
    });
  }
});

// [410 GONE] POST /api/ai/register-face — Đăng ký khuôn mặt đã chuyển sang AIAttendanceWeb3 Admin Service
app.post('/api/ai/register-face', (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Chức năng đăng ký khuôn mặt (Face Enrollment) thuộc quyền sở hữu của AIAttendanceWeb3 Admin Service (Port 8000 /api/v1/face/enroll). Hãy thực hiện đăng ký tại Cổng Quản Trị Admin.',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Face-Detect Employee & Kiosk Backend running at http://localhost:${PORT}`);
  console.log(`  - Auth & Employee API: http://localhost:${PORT}/api/auth, /api/employee`);
  console.log(`  - Chatbot proxy to AIAttendanceWeb3: http://localhost:${PORT}/api/chat`);
  console.log(`  - Kiosk Attendance API: http://localhost:${PORT}/api/attendance`);
});
