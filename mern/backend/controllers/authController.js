import bcrypt from 'bcryptjs';
import { User, Department } from '../models/index.js';
import { signAuthToken } from '../middleware/authMiddleware.js';

export async function login(req, res) {
  try {
    const { employeeCode, password } = req.body;
    if (!employeeCode || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã nhân viên và mật khẩu' });
    }

    // Cho phép nhập employeeCode (VD "NV001") hoặc email
    const query = employeeCode.includes('@')
      ? { email: employeeCode.toLowerCase().trim() }
      : { employeeCode: employeeCode.trim().toUpperCase() };

    const user = await User.findOne(query)
      .select('+passwordHash')
      .populate('departmentId', 'code name');

    if (!user) {
      return res.status(401).json({ error: 'Mã nhân viên hoặc mật khẩu không chính xác' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản nhân viên đã bị vô hiệu hóa' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mã nhân viên hoặc mật khẩu không chính xác' });
    }

    const token = signAuthToken(
      { employeeId: user._id.toString(), role: user.role },
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        position: user.position,
        department: user.departmentId ? {
          _id: user.departmentId._id,
          code: user.departmentId.code,
          name: user.departmentId.name,
        } : null,
        leave: user.leave,
        faceEnrolled: user.face?.enrolled || false,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .populate('departmentId', 'code name')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên' });
    }

    return res.json({
      success: true,
      user: {
        _id: user._id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        position: user.position,
        department: user.departmentId,
        leave: user.leave,
        faceEnrolled: user.face?.enrolled || false,
        joinedAt: user.joinedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi máy chủ: ' + err.message });
  }
}
