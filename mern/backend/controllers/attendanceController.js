import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';

// Get all attendance logs (with optional date filtering)
export const getAttendanceLogs = async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    const query = {};

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.timestamp = { $gte: startOfDay, $lte: endOfDay };
    }

    const logs = await Attendance.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record a new attendance entry (e.g. called when face is recognized)
export const recordAttendance = async (req, res) => {
  try {
    const { userName, confidence, checkInType, snapshotUrl } = req.body;

    // Find linked user if available
    const matchedUser = await User.findOne({
      name: new RegExp(`^${userName.trim()}$`, 'i'),
    });

    const attendance = await Attendance.create({
      user: matchedUser ? matchedUser._id : undefined,
      userName: userName || 'Unknown',
      confidence: confidence || 100,
      checkInType: checkInType || 'Check-in',
      status: userName && userName.toLowerCase() !== 'unknown' ? 'Present' : 'Unrecognized',
      snapshotUrl: snapshotUrl || '',
    });

    res.status(201).json({ success: true, data: attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get stats summary (today's check-ins, total users, etc.)
export const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const enrolledUsers = await User.countDocuments({ isFaceEnrolled: true });
    const todayCheckIns = await Attendance.countDocuments({
      timestamp: { $gte: today },
      status: 'Present',
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        enrolledUsers,
        todayCheckIns,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
