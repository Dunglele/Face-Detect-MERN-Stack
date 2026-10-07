import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'klcn134-secret-key-for-dev';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập (thiếu Bearer token)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.employeeId).select('-passwordHash');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
    }

    req.user = {
      _id: user._id,
      employeeId: user._id.toString(),
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId,
      email: user.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên làm việc hết hạn hoặc token không hợp lệ' });
  }
}
