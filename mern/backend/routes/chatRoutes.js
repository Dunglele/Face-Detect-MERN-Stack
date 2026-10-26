import { Router } from 'express';
import { handleChat } from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Chat route: Yêu cầu đăng nhập bắt buộc để xác thực người dùng và proxy tới Central
router.post('/', authMiddleware, handleChat);

export default router;
