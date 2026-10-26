import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET chưa được cấu hình');
  }
  return secret;
}

export function signAuthToken(payload, options) {
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập (thiếu Bearer token)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAuthToken(token);
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
