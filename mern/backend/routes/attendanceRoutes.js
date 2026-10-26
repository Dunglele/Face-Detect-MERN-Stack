import express from 'express';
import {
  getAttendanceLogs,
  recordAttendance,
  getStats,
} from '../controllers/attendanceController.js';

const router = express.Router();

router.route('/')
  .get(getAttendanceLogs)
  .post(recordAttendance);

router.route('/stats')
  .get(getStats);

export default router;
