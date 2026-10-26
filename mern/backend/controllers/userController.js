import mongoose from 'mongoose';
import { User } from '../models/User.js';

// Get all users from collection 'user' (database 'test'), with fallback to 'users' and Python AI
export const getUsers = async (req, res) => {
  try {
    let users = [];
    let source = 'MongoDB Atlas (test.user)';
    const mongoConnected = mongoose.connection.readyState === 1;

    // 1. Thử truy vấn collection 'user' trên MongoDB Atlas
    if (mongoConnected) {
      try {
        users = await User.find().sort({ createdAt: -1 }).lean();

        // 2. Nếu collection 'user' chưa có bản ghi, kiểm tra collection 'users' (dạng số nhiều)
        if (!users || users.length === 0) {
          try {
            const altColl = mongoose.connection.db.collection('users');
            const altUsers = await altColl.find().sort({ createdAt: -1 }).toArray();
            if (altUsers && altUsers.length > 0) {
              users = altUsers;
              source = 'MongoDB Atlas (test.users)';
            }
          } catch (altErr) {
            console.warn('[User] Alt collection query note:', altErr.message);
          }
        }
      } catch (dbErr) {
        console.warn('[User] MongoDB query error:', dbErr.message);
      }
    }

    // 3. Nếu MongoDB chưa có dữ liệu hoặc đang chờ cấp quyền IP whitelist trên Atlas,
    // tự động đồng bộ từ danh bạ nạp vector của Python AI Engine (port 8000)
    if (!users || users.length === 0) {
      try {
        const PYTHON_AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const aiRes = await fetch(`${PYTHON_AI_URL}/api/ai/users`);
        const aiData = await aiRes.json();
        if (aiData && aiData.success && Array.isArray(aiData.users)) {
          users = aiData.users.map((u, idx) => ({
            _id: `ai_${idx + 1}`,
            name: u.name,
            employeeId: `EMP-${String(idx + 1).padStart(3, '0')}`,
            department: 'Phòng Kỹ Thuật AI',
            isFaceEnrolled: true,
            faceSampleCount: u.sample_count || 1,
            faceDescriptors: new Array(u.sample_count || 1).fill([]),
            createdAt: u.registered_at || new Date().toISOString(),
            source: 'Python AI Engine (RAM/Encodings)',
          }));
          source = 'Python AI Cache (encodings.pkl)';
        }
      } catch (aiErr) {
        console.warn('[User] AI sync fallback note:', aiErr.message);
      }
    }

    // 4. Chuẩn hóa (Normalize) các trường dữ liệu tương thích cả schema mới và cũ
    const normalizedUsers = (users || []).map((u, idx) => {
      const fullName = u.fullName || u.name || u.username || u.fullname || u.displayName || `Nhân viên #${idx + 1}`;
      const employeeCode = u.employeeCode || u.employeeId || u.empId || u.code || (u._id ? String(u._id).slice(-6) : `NV${String(idx + 1).padStart(3, '0')}`);
      const department = u.department?.name || u.department || u.dept || u.position || 'AI & Engineering';

      const isFaceEnrolled = u.face?.enrolled !== undefined
        ? Boolean(u.face.enrolled)
        : Boolean(u.isFaceEnrolled || u.faceDescriptors?.length || u.embeddings?.length || (u.faceSampleCount && u.faceSampleCount > 0));

      const faceSampleCount = u.face?.sampleCount !== undefined
        ? u.face.sampleCount
        : (u.faceSampleCount || u.faceDescriptors?.length || (isFaceEnrolled ? 20 : 0));

      return {
        ...u,
        _id: u._id || `usr_${idx + 1}`,
        fullName,
        name: fullName, // tương thích frontend cũ
        employeeCode,
        employeeId: employeeCode, // tương thích frontend cũ
        department,
        isFaceEnrolled,
        faceSampleCount,
        face: {
          enrolled: isFaceEnrolled,
          sampleCount: faceSampleCount,
          embedding: u.face?.embedding || (u.faceDescriptors && u.faceDescriptors[0]) || undefined,
          modelVersion: u.face?.modelVersion || null,
        },
      };
    });

    res.status(200).json({
      success: true,
      count: normalizedUsers.length,
      source,
      database: 'klcn134_attendance',
      collection: 'users',
      mongoConnected,
      data: normalizedUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper loại bỏ dấu tiếng Việt để tạo searchName
function toSearchName(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

// [410 GONE] Create new user — Thao tác tạo nhân sự thuộc quyền sở hữu của AIAttendanceWeb3
export const createUser = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Chức năng tạo nhân sự mới thuộc quyền sở hữu của AIAttendanceWeb3 Admin Service (Port 4000: POST /api/users). Employee Service chỉ cung cấp truy vấn danh bạ (read-only).',
  });
};

// [410 GONE] Update user face enrollment status — Thao tác đăng ký/cập nhật khuôn mặt thuộc AIAttendanceWeb3
export const updateFaceEnrollment = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Chức năng đăng ký/cập nhật khuôn mặt thuộc quyền sở hữu của AIAttendanceWeb3 Admin Service (Port 8000: POST /api/v1/face/enroll). Employee Service không ghi đè dữ liệu sinh trắc học.',
  });
};

// [410 GONE] Delete user — Thao tác xóa nhân sự thuộc quyền sở hữu của AIAttendanceWeb3
export const deleteUser = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Chức năng xóa nhân sự thuộc quyền sở hữu của AIAttendanceWeb3 Admin Service (Port 4000: DELETE /api/users/:id). Employee Service là read-only đối với người dùng.',
  });
};

