import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

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

// AI Engine (Python FastAPI port 8000/8001) Proxy Routes
const PYTHON_AI_URL = process.env.AI_SERVICE_URL || process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

app.get('/api/ai/status', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/health`);
    const data = await response.json();
    res.json({ success: true, ai_online: true, data });
  } catch (error) {
    res.json({
      success: false,
      ai_online: false,
      message: `Python AI server chưa chạy tại ${PYTHON_AI_URL}`,
      error: error.message,
    });
  }
});

app.post('/api/ai/predict', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine. Hãy đảm bảo ai-service hoặc api_server đang chạy.',
      error: error.message,
    });
  }
});

app.post('/api/ai/register-face', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/api/ai/register-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine.',
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Face-Detect Employee & Kiosk Backend running at http://localhost:${PORT}`);
  console.log(`  - Auth & Employee API: http://localhost:${PORT}/api/auth, /api/employee`);
  console.log(`  - Chatbot proxy to AIAttendanceWeb3: http://localhost:${PORT}/api/chat`);
  console.log(`  - Kiosk Attendance API: http://localhost:${PORT}/api/attendance`);
});
