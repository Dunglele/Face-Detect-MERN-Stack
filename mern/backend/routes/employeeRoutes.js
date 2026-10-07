import { Router } from 'express';
import {
  getMyAttendance,
  checkInManual,
  checkOutManual,
  getMyLeaveRequests,
  createMyLeaveRequest,
  getMyShifts,
  getMyKpis,
} from '../controllers/employeeController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Tất cả các route nhân viên đều yêu cầu đăng nhập
router.use(authMiddleware);

// Báo cáo ngày đi làm & chấm công cá nhân
router.get('/attendance', getMyAttendance);
router.post('/attendance/checkin', checkInManual);
router.post('/attendance/checkout', checkOutManual);

// Đơn nghỉ phép
router.get('/leave-requests', getMyLeaveRequests);
router.post('/leave-requests', createMyLeaveRequest);

// Lịch ca làm việc
router.get('/shifts', getMyShifts);

// Nhiệm vụ & KPI
router.get('/kpi', getMyKpis);

export default router;
