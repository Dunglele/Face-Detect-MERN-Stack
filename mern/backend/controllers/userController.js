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
    const { name, employeeId, email, department } = req.body;
    const user = await User.create({
      name,
      employeeId,
      email,
      department,
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
    const { isFaceEnrolled, faceSampleCount } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isFaceEnrolled, faceSampleCount },
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
    res.status(200).json({ success: true, message: 'User removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
