import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/face_detect_db';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.warn('[MongoDB] ⚠️ CẢNH BÁO: Không thể kết nối MongoDB (Kiểm tra lại tài khoản/mật khẩu trong .env).');
    console.warn('[MongoDB] ℹ️ Backend vẫn tiếp tục chạy để làm AI Proxy & phục vụ Frontend.');
    // Không gọi process.exit(1) để tránh làm sập toàn bộ backend Express
  }
};

