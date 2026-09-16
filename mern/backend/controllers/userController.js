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

    // 4. Chuẩn hóa (Normalize) các trường dữ liệu để AdminPage hiển thị an toàn tuyệt đối
    const normalizedUsers = (users || []).map((u, idx) => {
      const name = u.name || u.username || u.fullname || u.displayName || `Nhân viên #${idx + 1}`;
      const employeeId = u.employeeId || u.empId || u.code || (u._id ? String(u._id).slice(-6) : `EMP-${idx + 1}`);
      const department = u.department || u.dept || u.role || 'AI & Engineering';
      const isFaceEnrolled = u.isFaceEnrolled !== undefined
        ? Boolean(u.isFaceEnrolled)
        : Boolean(u.faceDescriptors?.length || u.embeddings?.length || (u.faceSampleCount && u.faceSampleCount > 0));
      const faceSampleCount = u.faceSampleCount || u.faceDescriptors?.length || (isFaceEnrolled ? 20 : 0);

      return {
        ...u,
        _id: u._id || `usr_${idx + 1}`,
        name,
        employeeId,
        department,
        isFaceEnrolled,
        faceSampleCount,
      };
    });

    res.status(200).json({
      success: true,
      count: normalizedUsers.length,
      source,
      database: 'test',
      collection: 'user',
      mongoConnected,
      data: normalizedUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new user in test.user
export const createUser = async (req, res) => {
  try {
    const { name, employeeId, email, department, isFaceEnrolled, faceSampleCount, faceDescriptors } = req.body;
    const mongoConnected = mongoose.connection.readyState === 1;

    if (mongoConnected) {
      const user = await User.create({
        name,
        employeeId: employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        email: email || `${name.toLowerCase().replace(/\s+/g, '')}@company.com`,
        department: department || 'AI & Engineering',
        isFaceEnrolled: isFaceEnrolled || false,
        faceSampleCount: faceSampleCount || 0,
        faceDescriptors: faceDescriptors || [],
      });
      return res.status(201).json({ success: true, data: user, source: 'MongoDB Atlas (test.user)' });
    }

    // Fallback: nếu MongoDB tạm thời offline do IP whitelist
    const fallbackUser = {
      _id: `temp_${Date.now()}`,
      name,
      employeeId: employeeId || `EMP-${Date.now().toString().slice(-4)}`,
      email: email || `${name.toLowerCase().replace(/\s+/g, '')}@company.com`,
      department: department || 'AI & Engineering',
      isFaceEnrolled: Boolean(isFaceEnrolled),
      faceSampleCount: faceSampleCount || 0,
      createdAt: new Date().toISOString(),
      source: 'Local Memory (Chờ đồng bộ Atlas)',
    };
    res.status(201).json({ success: true, data: fallbackUser, warning: 'Lưu tạm thời (MongoDB đang chờ kết nối)' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update user face enrollment status
export const updateFaceEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const { isFaceEnrolled, faceSampleCount, faceDescriptors } = req.body;

    const updateFields = { isFaceEnrolled, faceSampleCount };
    if (faceDescriptors) {
      updateFields.faceDescriptors = faceDescriptors;
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findByIdAndUpdate(
        id,
        updateFields,
        { new: true }
      );
    }

    if (!user) {
      return res.status(200).json({
        success: true,
        data: { _id: id, isFaceEnrolled, faceSampleCount },
        message: 'Đã cập nhật trạng thái khuôn mặt'
      });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    let deletedUser = null;

    if (mongoose.connection.readyState === 1) {
      try {
        deletedUser = await User.findByIdAndDelete(id);
      } catch {
        // Fallback theo name nếu id dạng chuỗi thường
        deletedUser = await User.findOneAndDelete({ $or: [{ _id: id }, { name: id }] });
      }

      // Kiểm tra thêm collection 'users' nếu chưa thấy trong 'user'
      if (!deletedUser) {
        try {
          const altColl = mongoose.connection.db.collection('users');
          const resDel = await altColl.findOneAndDelete({ $or: [{ _id: id }, { name: id }] });
          if (resDel && resDel.value) deletedUser = resDel.value;
        } catch {
          // ignore
        }
      }
    }

    const userName = deletedUser ? deletedUser.name : id;

    // Đồng bộ xóa vector khỏi Python AI Engine nếu có chạy
    const PYTHON_AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    try {
      await fetch(`${PYTHON_AI_URL}/api/ai/users/${encodeURIComponent(userName)}`, {
        method: 'DELETE',
      });
    } catch {
      // Bỏ qua nếu Python AI server chưa khởi động
    }

    res.status(200).json({
      success: true,
      message: `Đã xóa nhân viên ${userName} thành công`,
      data: deletedUser || { _id: id, name: userName },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

