import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);

// AI Engine (Python FastAPI port 8000) Proxy Routes
const PYTHON_AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

app.get('/api/ai/status', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/health`);
    const data = await response.json();
    res.json({ success: true, ai_online: true, data });
  } catch (error) {
    res.json({
      success: false,
      ai_online: false,
      message: 'Python AI server (api_server.py) chưa chạy tại port 8000',
      error: error.message
    });
  }
});

app.post('/api/ai/predict', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine (port 8000). Hãy chạy: python face_detect/api_server.py',
      error: error.message
    });
  }
});

// Proxy route đăng ký khuôn mặt trực tiếp sang Python AI
app.post('/api/ai/register-face', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/api/ai/register-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine (port 8000). Hãy chạy: python face_detect/api_server.py',
      error: error.message
    });
  }
});

// Proxy route đồng bộ vector từ MongoDB vào AI RAM
app.post('/api/ai/sync-mongo', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/api/ai/sync-mongo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine (port 8000).',
      error: error.message
    });
  }
});

// Proxy route lấy danh sách người dùng đã nạp vector từ Python AI
app.get('/api/ai/users', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/api/ai/users`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine (port 8000).',
      error: error.message
    });
  }
});

// Proxy route xóa nhân sự khỏi Python AI Engine
app.delete('/api/ai/users/:name', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/api/ai/users/${encodeURIComponent(req.params.name)}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến Python AI Engine (port 8000).',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Face Detect MERN Stack API is running',
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Face Detect MERN Stack API Server is running.');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] Server listening on http://localhost:${PORT}`);
});
