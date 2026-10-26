import {
  AttendanceRecord,
  LeaveRequest,
  ShiftAssignment,
  Shift,
  KpiTask,
  User,
} from '../models/index.js';
import { localYMD, localHHMM, toWorkDate, atLocalTime } from '../lib/time.js';

// ==========================================
// 1. BÁO CÁO CHẤM CÔNG CÁ NHÂN (DẠNG BẢNG)
// ==========================================
export async function getMyAttendance(req, res) {
  try {
    const userId = req.user._id;
    const now = new Date();
    const currentMonth = localYMD(now).slice(0, 7); // "YYYY-MM"
    const month = req.query.month || currentMonth;

    const [y, m] = month.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Định dạng tháng không hợp lệ (cần YYYY-MM)' });
    }

    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const fromYmd = `${month}-01`;
    const toYmd = `${month}-${String(lastDay).padStart(2, '0')}`;

    const records = await AttendanceRecord.find({
      userId,
      workDate: { $gte: toWorkDate(fromYmd), $lte: toWorkDate(toYmd) },
    })
      .populate('shiftId', 'code name startTime endTime')
      .sort({ workDate: -1, checkInAt: -1 });

    // Tính toán số liệu thống kê tổng kết tháng
    let totalWorkDays = 0;
    let onTimeDays = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;
    let totalLateMinutes = 0;
    let totalWorkedMinutes = 0;

    const formattedRecords = records.map((r) => {
      const ymd = localYMD(r.workDate);
      const isPresent = Boolean(r.checkInAt);
      if (isPresent) totalWorkDays++;
      if (r.status === 'on_time') onTimeDays++;
      if (r.status === 'late') lateDays++;
      if (r.status === 'early_leave') earlyLeaveDays++;
      totalLateMinutes += r.lateMinutes || 0;
      totalWorkedMinutes += r.workedMinutes || 0;

      return {
        _id: r._id,
        workDate: ymd,
        checkInAt: r.checkInAt ? r.checkInAt.toISOString() : null,
        checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
        checkInTime: r.checkInAt ? localHHMM(r.checkInAt) : null,
        checkOutTime: r.checkOutAt ? localHHMM(r.checkOutAt) : null,
        status: r.status,
        lateMinutes: r.lateMinutes || 0,
        earlyLeaveMinutes: r.earlyLeaveMinutes || 0,
        workedHours: r.workedMinutes ? +(r.workedMinutes / 60).toFixed(1) : 0,
        method: r.method, // 'face' | 'manual'
        shift: r.shiftId
          ? {
              code: r.shiftId.code,
              name: r.shiftId.name,
              time: `${r.shiftId.startTime} - ${r.shiftId.endTime}`,
              startTime: r.shiftId.startTime,
              endTime: r.shiftId.endTime,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      month,
      stats: {
        totalWorkDays,
        onTimeDays,
        lateDays,
        earlyLeaveDays,
        totalLateMinutes,
        totalWorkedHours: +(totalWorkedMinutes / 60).toFixed(1),
        onTimeRate: totalWorkDays > 0 ? +((onTimeDays / totalWorkDays) * 100).toFixed(1) : 0,
      },
      data: formattedRecords,
    });
  } catch (err) {
    console.error('getMyAttendance error:', err);
    return res.status(500).json({ error: 'Lỗi khi tải lịch sử chấm công: ' + err.message });
  }
}

// Chấm công vào thủ công
export async function checkInManual(req, res) {
  try {
    const userId = req.user._id;
    const todayYmd = localYMD(new Date());
    const workDate = toWorkDate(todayYmd);

    // Kiểm tra đã check-in hôm nay chưa
    const existing = await AttendanceRecord.findOne({ userId, workDate });
    if (existing?.checkInAt) {
      return res.status(409).json({
        error: `Bạn đã chấm công vào hôm nay lúc ${localHHMM(existing.checkInAt)}.`,
      });
    }

    // Tìm phân ca của nhân viên
    const assignment = await ShiftAssignment.findOne({ userId, workDate }).populate('shiftId');
    let shift = assignment?.shiftId;

    if (!shift) {
      // Nếu chưa phân ca cụ thể, lấy ca mặc định CA_SANG
      shift = await Shift.findOne({ code: 'CA_SANG' });
    }

    const now = new Date();
    const startTimeStr = shift?.startTime || '08:00';
    const graceMin = shift?.graceMinutes ?? 5;
    const deadline = atLocalTime(todayYmd, startTimeStr, graceMin);
    const lateMinutes = Math.max(0, Math.round((now.getTime() - deadline.getTime()) / 60000));
    const status = lateMinutes > 0 ? 'late' : 'on_time';

    const record = await AttendanceRecord.findOneAndUpdate(
      { userId, workDate },
      {
        userId,
        departmentId: req.user.departmentId,
        shiftId: shift?._id,
        workDate,
        checkInAt: now,
        status,
        lateMinutes,
        method: 'manual',
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(201).json({
      success: true,
      data: record,
      message:
        lateMinutes > 0
          ? `Đã chấm công vào lúc ${localHHMM(now)}, đi muộn ${lateMinutes} phút.`
          : `Đã chấm công vào lúc ${localHHMM(now)}, đúng giờ. Chúc bạn ngày làm việc vui vẻ!`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi chấm công vào: ' + err.message });
  }
}

// Chấm công ra thủ công
export async function checkOutManual(req, res) {
  try {
    const userId = req.user._id;
    const todayYmd = localYMD(new Date());
    const workDate = toWorkDate(todayYmd);

    const record = await AttendanceRecord.findOne({ userId, workDate }).populate('shiftId');
    if (!record || !record.checkInAt) {
      return res.status(400).json({ error: 'Bạn chưa chấm công vào hôm nay, không thể chấm công ra.' });
    }
    if (record.checkOutAt) {
      return res.status(409).json({
        error: `Bạn đã chấm công ra hôm nay lúc ${localHHMM(record.checkOutAt)}.`,
      });
    }

    const shift = record.shiftId || (await Shift.findOne({ code: 'CA_SANG' }));
    const now = new Date();
    const endTimeStr = shift?.endTime || '17:00';
    const earlyThreshold = shift?.earlyLeaveThresholdMin ?? 15;
    const earlyDeadline = atLocalTime(todayYmd, endTimeStr, -earlyThreshold);
    const earlyLeaveMinutes = Math.max(0, Math.round((earlyDeadline.getTime() - now.getTime()) / 60000));

    let status = record.status;
    if (earlyLeaveMinutes > 0) {
      status = 'early_leave';
    }

    const breakMin = shift?.breakMinutes || 60;
    const workedMinutes = Math.max(
      0,
      Math.round((now.getTime() - record.checkInAt.getTime()) / 60000) - breakMin
    );

    record.checkOutAt = now;
    record.earlyLeaveMinutes = earlyLeaveMinutes;
    record.workedMinutes = workedMinutes;
    record.status = status;
    await record.save();

    return res.json({
      success: true,
      data: record,
      message:
        earlyLeaveMinutes > 0
          ? `Đã chấm công ra lúc ${localHHMM(now)}, về sớm ${earlyLeaveMinutes} phút.`
          : `Đã chấm công ra lúc ${localHHMM(now)}, đủ giờ làm việc. Tạm biệt bạn!`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi chấm công ra: ' + err.message });
  }
}

// ==========================================
// 2. QUẢN LÝ ĐƠN NGHỈ PHÉP CỦA TÔI
// ==========================================
export async function getMyLeaveRequests(req, res) {
  try {
    const requests = await LeaveRequest.find({ userId: req.user._id })
      .populate('decidedBy', 'fullName employeeCode')
      .sort({ createdAt: -1 });

    const user = await User.findById(req.user._id).select('leave');

    return res.json({
      success: true,
      leaveQuota: user?.leave || { quota: 12, used: 0, remaining: 12 },
      data: requests.map((r) => ({
        _id: r._id,
        type: r.type,
        fromDate: localYMD(r.fromDate),
        toDate: localYMD(r.toDate),
        numDays: r.numDays,
        reasonText: r.reasonText,
        status: r.status, // 'pending' | 'approved' | 'rejected' | 'cancelled'
        createdAt: localYMD(r.createdAt),
        decidedBy: r.decidedBy ? r.decidedBy.fullName : null,
        decisionNote: r.decisionNote,
        decidedAt: r.decidedAt ? localYMD(r.decidedAt) : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi tải danh sách đơn nghỉ: ' + err.message });
  }
}

export async function createMyLeaveRequest(req, res) {
  try {
    const { type = 'annual', fromDate, toDate, reasonText } = req.body;
    if (!fromDate || !toDate || !reasonText) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày bắt đầu, ngày kết thúc và lý do nghỉ' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (end < start) {
      return res.status(400).json({ error: 'Ngày kết thúc không thể trước ngày bắt đầu' });
    }

    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await LeaveRequest.create({
      userId: req.user._id,
      departmentId: req.user.departmentId,
      type,
      fromDate: start,
      toDate: end,
      numDays: diffDays,
      reasonText: reasonText.trim(),
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Đã gửi đơn xin nghỉ phép thành công. Vui lòng chờ quản lý phê duyệt.',
      data: leave,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi nộp đơn nghỉ phép: ' + err.message });
  }
}

// ==========================================
// 3. LỊCH PHÂN CA LÀM VIỆC CỦA TÔI
// ==========================================
export async function getMyShifts(req, res) {
  try {
    const now = new Date();
    const currentMonth = localYMD(now).slice(0, 7);
    const month = req.query.month || currentMonth;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const fromDate = toWorkDate(`${month}-01`);
    const toDate = toWorkDate(`${month}-${String(lastDay).padStart(2, '0')}`);

    const assignments = await ShiftAssignment.find({
      userId: req.user._id,
      workDate: { $gte: fromDate, $lte: toDate },
    })
      .populate('shiftId')
      .sort({ workDate: 1 });

    const shifts = await Shift.find({ active: true });

    return res.json({
      success: true,
      month,
      availableShifts: shifts,
      data: assignments.map((a) => ({
        _id: a._id,
        workDate: localYMD(a.workDate),
        isDayOff: a.isDayOff,
        note: a.note,
        shift: a.shiftId
          ? {
              code: a.shiftId.code,
              name: a.shiftId.name,
              startTime: a.shiftId.startTime,
              endTime: a.shiftId.endTime,
            }
          : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi lấy lịch ca: ' + err.message });
  }
}

// ==========================================
// 4. NHIỆM VỤ & KPI CỦA TÔI
// ==========================================
export async function getMyKpis(req, res) {
  try {
    const tasks = await KpiTask.find({ userId: req.user._id }).sort({ deadline: 1 });

    const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    const completedScore = tasks.reduce((sum, t) => sum + ((t.progress || 0) * (t.weight || 1)), 0);
    const overallProgress = totalWeight > 0 ? +(completedScore / totalWeight).toFixed(1) : 0;

    return res.json({
      success: true,
      overallProgress,
      data: tasks.map((t) => ({
        _id: t._id,
        title: t.title,
        deadline: localYMD(t.deadline),
        weight: t.weight,
        progress: t.progress,
        evaluatorNote: t.evaluatorNote,
        status: t.status,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách KPI: ' + err.message });
  }
}
