import { User } from '../models/User.js';

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { name, employeeId, email, department, isFaceEnrolled, faceSampleCount, faceDescriptors } = req.body;
    const user = await User.create({
      name,
      employeeId,
      email,
      department,
      isFaceEnrolled: isFaceEnrolled || false,
      faceSampleCount: faceSampleCount || 0,
      faceDescriptors: faceDescriptors || [],
    });
    res.status(201).json({ success: true, data: user });
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

    const user = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Đồng bộ xóa vector khỏi Python AI Engine nếu có chạy
    const PYTHON_AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    try {
      await fetch(`${PYTHON_AI_URL}/api/ai/users/${encodeURIComponent(user.name)}`, {
        method: 'DELETE',
      });
    } catch {
      // Bỏ qua nếu Python AI server chưa khởi động
    }

    res.status(200).json({ success: true, message: `Đã xóa nhân viên ${user.name} thành công`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
