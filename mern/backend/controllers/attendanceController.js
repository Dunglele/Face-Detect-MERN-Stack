import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';

// Cache cục bộ tạm thời cho nhật ký điểm danh khi MongoDB chưa kết nối
let localLogsCache = [];

// Get all attendance logs (with optional date filtering)
export const getAttendanceLogs = async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    const mongoConnected = mongoose.connection.readyState === 1;

    if (mongoConnected) {
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

      return res.status(200).json({ success: true, count: logs.length, data: logs });
    }

    // Fallback: trả về cache cục bộ
    res.status(200).json({ success: true, count: localLogsCache.length, data: localLogsCache, offline: true });
  } catch (error) {
    res.status(200).json({ success: true, count: localLogsCache.length, data: localLogsCache, warning: error.message });
  }
};

// Record a new attendance entry (e.g. called when face is recognized)
export const recordAttendance = async (req, res) => {
  try {
    const { userName, confidence, checkInType, snapshotUrl } = req.body;
    const mongoConnected = mongoose.connection.readyState === 1;

    if (mongoConnected) {
      // Find linked user if available
      let matchedUser = null;
      try {
        matchedUser = await User.findOne({
          name: new RegExp(`^${userName.trim()}$`, 'i'),
        });
      } catch {
        // ignore
      }

      const attendance = await Attendance.create({
        user: matchedUser ? matchedUser._id : undefined,
        userName: userName || 'Unknown',
        confidence: confidence || 100,
        checkInType: checkInType || 'Check-in',
        status: userName && userName.toLowerCase() !== 'unknown' ? 'Present' : 'Unrecognized',
        snapshotUrl: snapshotUrl || '',
      });

      return res.status(201).json({ success: true, data: attendance });
    }

    // Fallback khi MongoDB chưa kết nối: lưu vào RAM
    const fallbackAttendance = {
      _id: `attn_${Date.now()}`,
      userName: userName || 'Unknown',
      confidence: confidence || 100,
      checkInType: checkInType || 'Check-in',
      status: userName && userName.toLowerCase() !== 'unknown' ? 'Present' : 'Unrecognized',
      snapshotUrl: snapshotUrl || '',
      timestamp: new Date().toISOString(),
    };
    localLogsCache.unshift(fallbackAttendance);
    if (localLogsCache.length > 200) localLogsCache.pop();

    res.status(201).json({ success: true, data: fallbackAttendance, note: 'Lưu tạm bộ nhớ (MongoDB Offline)' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get stats summary (today's check-ins, total users, etc.)
export const getStats = async (req, res) => {
  try {
    let totalUsers = 0;
    let enrolledUsers = 0;
    let todayCheckIns = 0;
    const mongoConnected = mongoose.connection.readyState === 1;

    if (mongoConnected) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        totalUsers = await User.countDocuments();
        enrolledUsers = await User.countDocuments({ isFaceEnrolled: true });
        todayCheckIns = await Attendance.countDocuments({
          timestamp: { $gte: today },
          status: 'Present',
        });
      } catch (dbErr) {
        console.warn('[Stats] Mongo query note:', dbErr.message);
      }
    }

    // Nếu Mongo chưa kết nối hoặc chưa có user, lấy số lượng từ Python AI
    if (totalUsers === 0) {
      try {
        const PYTHON_AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const aiRes = await fetch(`${PYTHON_AI_URL}/api/ai/users`);
        const aiData = await aiRes.json();
        if (aiData && aiData.success && Array.isArray(aiData.users)) {
          totalUsers = aiData.users.length;
          enrolledUsers = aiData.users.length;
        }
      } catch {
        // ignore
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        enrolledUsers,
        todayCheckIns: todayCheckIns || localLogsCache.length,
      },
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: {
        totalUsers: 0,
        enrolledUsers: 0,
        todayCheckIns: 0,
      },
    });
  }
};

