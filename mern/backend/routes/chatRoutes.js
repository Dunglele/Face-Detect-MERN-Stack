import { Router } from 'express';
import { handleChat } from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Hỗ trợ chat (có token người dùng nếu đã đăng nhập để cá nhân hóa)
router.post('/', (req, res, next) => {
  // Cho phép chat cả khi chưa đăng nhập (kiosk guest mode) hoặc đã đăng nhập
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }
  next();
}, handleChat);

export default router;
