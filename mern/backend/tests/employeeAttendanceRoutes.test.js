import test from 'node:test';
import assert from 'node:assert/strict';
import employeeRoutes from '../routes/employeeRoutes.js';
import attendanceRoutes from '../routes/attendanceRoutes.js';
import { AttendanceRecord } from '../models/index.js';

function hasRoute(router, path, method) {
  return router.stack.some(({ route }) => route?.path === path && route.methods[method]);
}

test('employee attendance is read-only; face kiosk recording remains registered', () => {
  assert.equal(hasRoute(employeeRoutes, '/attendance/checkin', 'post'), false);
  assert.equal(hasRoute(employeeRoutes, '/attendance/checkout', 'post'), false);
  assert.equal(hasRoute(employeeRoutes, '/attendance', 'get'), true);
  assert.equal(hasRoute(attendanceRoutes, '/', 'post'), true);
});

test('historical manual attendance records remain readable', () => {
  assert.ok(AttendanceRecord.schema.path('method').enumValues.includes('manual'));
});
