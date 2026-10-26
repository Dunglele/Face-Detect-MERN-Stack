import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import { recordAttendance, getAttendanceLogs } from '../controllers/attendanceController.js';
import { User, AttendanceRecord, Shift, ShiftAssignment } from '../models/index.js';

process.env.FACE_VERIFICATION_SECRET = process.env.FACE_VERIFICATION_SECRET || 'test-face-verification-secret-min-32-chars';
const TEST_SECRET = process.env.FACE_VERIFICATION_SECRET;

function makeToken(payload = {}) {
  return jwt.sign({
    type: 'face_verification',
    iss: 'face-bff',
    employeeCode: 'NV001',
    confidence: 95,
    livenessScore: 0.9,
    ...payload,
  }, TEST_SECRET, { expiresIn: '60s' });
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test('recordAttendance FAIL-CLOSED: Từ chối 503 CONFIG_MISSING khi thiếu FACE_VERIFICATION_SECRET trong env', async () => {
  const originalSecret = process.env.FACE_VERIFICATION_SECRET;
  delete process.env.FACE_VERIFICATION_SECRET;

  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const req = {
    body: {
      employeeCode: 'NV001',
      verificationToken: makeToken(),
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'CONFIG_MISSING');
  } finally {
    process.env.FACE_VERIFICATION_SECRET = originalSecret;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Từ chối 503 DB_UNAVAILABLE khi MongoDB offline', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 0; // offline

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 95,
      livenessScore: 0.9,
      verificationToken: makeToken(),
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'DB_UNAVAILABLE');
  } finally {
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Từ chối 403 UNAUTHORIZED_AI_EVIDENCE khi thiếu verificationToken', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 95,
      livenessScore: 0.85,
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'UNAUTHORIZED_AI_EVIDENCE');
  } finally {
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Từ chối 403 INVALID_TOKEN_TYPE khi dùng login JWT làm verificationToken', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  // Giả lập token đăng nhập bình thường (không có type='face_verification' và iss='face-bff')
  const loginToken = jwt.sign(
    { userId: '64d0a1b2c3d4e5f6a7b8c901', role: 'employee' },
    TEST_SECRET,
    { expiresIn: '1h' }
  );

  const req = {
    body: {
      employeeCode: 'NV001',
      verificationToken: loginToken,
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVALID_TOKEN_TYPE');
  } finally {
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Validate confidence từ token bắt buộc số hữu hạn và miền giá trị (BFF/FaceAI quyết định match 60%, controller không gate 85%)', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  try {
    // 1. Thiếu/null/NaN confidence trong token -> 400 INVALID_CONFIDENCE
    for (const badConf of [null, undefined, '95', NaN, Infinity]) {
      const res = createMockRes();
      await recordAttendance({
        body: { verificationToken: makeToken({ confidence: badConf }) },
      }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'INVALID_CONFIDENCE');
    }

    // 2. Ngoài miền giá trị hợp lệ ([0, 1] hoặc [0, 100]) -> 400 CONFIDENCE_OUT_OF_RANGE
    for (const outConf of [-5, 105, -0.01, 100.1]) {
      const res = createMockRes();
      await recordAttendance({
        body: { verificationToken: makeToken({ confidence: outConf }) },
      }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'CONFIDENCE_OUT_OF_RANGE');
    }
  } finally {
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Validate livenessScore từ token bắt buộc số hữu hạn, miền giá trị và ngưỡng >= 65%', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  try {
    // 1. Thiếu/null/NaN livenessScore trong token -> 400 INVALID_LIVENESS
    for (const badLive of [null, undefined, '0.9', NaN, -Infinity]) {
      const res = createMockRes();
      await recordAttendance({
        body: { verificationToken: makeToken({ livenessScore: badLive }) },
      }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'INVALID_LIVENESS');
    }

    // 2. Ngoài miền giá trị hợp lệ ([0, 1] hoặc [0, 100]) -> 400 LIVENESS_OUT_OF_RANGE
    for (const outLive of [-0.1, 101, -5, 100.5]) {
      const res = createMockRes();
      await recordAttendance({
        body: { verificationToken: makeToken({ livenessScore: outLive }) },
      }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'LIVENESS_OUT_OF_RANGE');
    }

    // 3. Dưới ngưỡng 65% (Anti-Spoofing alert: 403)
    for (const lowLive of [0.64, 64.9, 30, 1.2]) {
      const res = createMockRes();
      await recordAttendance({
        body: { verificationToken: makeToken({ livenessScore: lowLive }) },
      }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'LIVENESS_BELOW_THRESHOLD');
      assert.equal(res.body.spoof_alert, true);
    }
  } finally {
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance FAIL-CLOSED: Từ chối 404 USER_NOT_FOUND khi user không tồn tại trong MongoDB (không tạo record giả)', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalFindOne = User.findOne;
  User.findOne = async () => null;

  try {
    const req = {
      body: {
        employeeCode: 'NV999_NOT_EXIST',
        confidence: 95,
        livenessScore: 0.9,
        verificationToken: makeToken({ employeeCode: 'NV999_NOT_EXIST' }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'USER_NOT_FOUND');
  } finally {
    User.findOne = originalFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance SUCCESS: Chấp nhận 201 khi dữ liệu hợp lệ và ghi vào MongoDB với đầy đủ explicit fields', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalShiftFindOne = Shift.findOne;
  const originalAssignmentFindOne = ShiftAssignment.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;
  const originalAttendanceCreate = AttendanceRecord.create;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Lê Văn B',
    employeeCode: 'NV003',
    departmentId: new mongoose.Types.ObjectId(),
  };

  const mockShift = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Ca Sáng',
    code: 'CA_SANG',
    startTime: '08:00',
    graceMinutes: 15,
  };

  const mockRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: mockUser._id,
    workDate: new Date(),
    status: 'on_time',
    checkInAt: new Date(),
    lateMinutes: 0,
  };

  User.findOne = async () => mockUser;
  Shift.findOne = async () => mockShift;
  ShiftAssignment.findOne = () => ({
    populate: async () => null,
  });
  AttendanceRecord.findOne = async () => null;
  AttendanceRecord.create = async () => mockRecord;

  try {
    const req = {
      body: {
        employeeCode: 'NV003',
        confidence: 91.5,
        livenessScore: 0.88,
        checkInType: 'Check-in',
        verificationToken: makeToken({
          employeeCode: 'NV003',
          confidence: 91.5,
          livenessScore: 0.88,
          fullName: 'Lê Văn B',
        }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.employeeCode, 'NV003');
    assert.equal(res.body.userName, 'Lê Văn B');
    assert.equal(typeof res.body.checkInAt, 'string');
    assert.match(res.body.workDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof res.body.lateMinutes, 'number');
    assert.ok(['on_time', 'late'].includes(res.body.status));
    assert.equal(res.body.shiftName, 'Ca Sáng');
  } finally {
    User.findOne = originalUserFindOne;
    Shift.findOne = originalShiftFindOne;
    ShiftAssignment.findOne = originalAssignmentFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    AttendanceRecord.create = originalAttendanceCreate;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-IN: Ưu tiên ShiftAssignment nếu có và không phải isDayOff', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalShiftFindOne = Shift.findOne;
  const originalAssignmentFindOne = ShiftAssignment.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;
  const originalAttendanceCreate = AttendanceRecord.create;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Hoàng Văn D',
    employeeCode: 'NV010',
    departmentId: new mongoose.Types.ObjectId(),
  };

  const assignedShift = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Ca Chiều Đặc Biệt',
    code: 'CA_CHIEU',
    startTime: '13:00',
    graceMinutes: 10,
  };

  let createdPayload = null;
  User.findOne = async () => mockUser;
  Shift.findOne = async () => {
    throw new Error('Should not fallback to Shift CA_SANG when ShiftAssignment exists');
  };
  ShiftAssignment.findOne = () => ({
    populate: async () => ({
      shiftId: assignedShift,
      isDayOff: false,
    }),
  });
  AttendanceRecord.findOne = async () => null;
  AttendanceRecord.create = async (data) => {
    createdPayload = data;
    return { ...data, _id: new mongoose.Types.ObjectId() };
  };

  try {
    const req = {
      body: {
        employeeCode: 'NV010',
        confidence: 92,
        livenessScore: 0.86,
        checkInType: 'Check-in',
        verificationToken: makeToken({
          employeeCode: 'NV010',
          confidence: 92,
          livenessScore: 0.86,
          fullName: 'Hoàng Văn D',
        }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.shiftName, 'Ca Chiều Đặc Biệt');
    assert.equal(createdPayload.shiftId, assignedShift._id);
  } finally {
    User.findOne = originalUserFindOne;
    Shift.findOne = originalShiftFindOne;
    ShiftAssignment.findOne = originalAssignmentFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    AttendanceRecord.create = originalAttendanceCreate;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-IN: Trả 409 ALREADY_CHECKED_IN khi đã có checkInAt và chưa checkOutAt', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Lê Văn B',
    employeeCode: 'NV003',
  };

  const existingRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: mockUser._id,
    workDate: new Date(),
    checkInAt: new Date('2026-10-16T08:00:00Z'),
    checkOutAt: null,
    lateMinutes: 5,
    status: 'late',
  };

  User.findOne = async () => mockUser;
  AttendanceRecord.findOne = async () => existingRecord;

  try {
    const req = {
      body: {
        employeeCode: 'NV003',
        verificationToken: makeToken({ employeeCode: 'NV003' }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'ALREADY_CHECKED_IN');
    assert.equal(res.body.canCheckOut, true);
    assert.equal(res.body.data.lateMinutes, 5);
    assert.equal(res.body.data.status, 'late');
    assert.equal(res.body.data.checkInAt, new Date('2026-10-16T08:00:00Z').toISOString());
    assert.match(res.body.data.workDate, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    User.findOne = originalUserFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-IN: Trả 409 ATTENDANCE_COMPLETED khi đã có cả checkInAt và checkOutAt', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Lê Văn B',
    employeeCode: 'NV003',
  };

  const existingRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: mockUser._id,
    workDate: new Date(),
    checkInAt: new Date('2026-10-16T08:00:00Z'),
    checkOutAt: new Date('2026-10-16T17:00:00Z'),
    lateMinutes: 0,
    status: 'on_time',
  };

  User.findOne = async () => mockUser;
  AttendanceRecord.findOne = async () => existingRecord;

  try {
    const req = {
      body: {
        employeeCode: 'NV003',
        verificationToken: makeToken({ employeeCode: 'NV003' }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'ATTENDANCE_COMPLETED');
    assert.equal(res.body.canCheckOut, false);
    assert.equal(res.body.data.lateMinutes, 0);
    assert.equal(res.body.data.status, 'on_time');
    assert.equal(res.body.data.checkInAt, new Date('2026-10-16T08:00:00Z').toISOString());
  } finally {
    User.findOne = originalUserFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-OUT: Từ chối 400 NO_CHECK_IN_RECORD khi chưa có check-in trong ngày', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;
  const originalShiftFindOne = Shift.findOne;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Trần Văn C',
    employeeCode: 'NV004',
    departmentId: new mongoose.Types.ObjectId(),
  };

  User.findOne = async () => mockUser;
  Shift.findOne = async () => null;
  // Chưa có bản ghi điểm danh nào trong ngày
  AttendanceRecord.findOne = async () => null;

  try {
    const req = {
      body: {
        employeeCode: 'NV004',
        confidence: 90,
        livenessScore: 0.85,
        checkInType: 'Check-out',
        verificationToken: makeToken({
          employeeCode: 'NV004',
          confidence: 90,
          livenessScore: 0.85,
          fullName: 'Trần Văn C',
        }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'NO_CHECK_IN_RECORD');
  } finally {
    User.findOne = originalUserFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    Shift.findOne = originalShiftFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-OUT: Trả 409 ALREADY_CHECKED_OUT và không mutate checkOutAt khi đã check-out trước đó', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Trần Văn C',
    employeeCode: 'NV004',
  };

  const originalCheckOutTime = new Date('2026-10-16T17:00:00Z');
  let saveCalled = false;
  const existingRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: mockUser._id,
    workDate: new Date(),
    checkInAt: new Date('2026-10-16T08:00:00Z'),
    checkOutAt: originalCheckOutTime,
    workedMinutes: 540,
    lateMinutes: 0,
    status: 'on_time',
    save: async function () {
      saveCalled = true;
      return this;
    },
  };

  User.findOne = async () => mockUser;
  AttendanceRecord.findOne = async () => existingRecord;

  try {
    const req = {
      body: {
        employeeCode: 'NV004',
        checkInType: 'Check-out',
        verificationToken: makeToken({
          employeeCode: 'NV004',
          fullName: 'Trần Văn C',
        }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'ALREADY_CHECKED_OUT');
    assert.equal(saveCalled, false);
    assert.equal(existingRecord.checkOutAt, originalCheckOutTime);
    assert.equal(res.body.data.checkOutAt, originalCheckOutTime.toISOString());
    assert.equal(res.body.data.workedMinutes, 540);
  } finally {
    User.findOne = originalUserFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('recordAttendance CHECK-OUT: Chấp nhận 200, cập nhật checkOutAt và trả explicit response fields', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalUserFindOne = User.findOne;
  const originalAttendanceFindOne = AttendanceRecord.findOne;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Trần Văn C',
    employeeCode: 'NV004',
    departmentId: new mongoose.Types.ObjectId(),
  };

  const existingRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: mockUser._id,
    workDate: new Date(),
    checkInAt: new Date(Date.now() - 8 * 3600000), // Check in cách đây 8 tiếng
    status: 'on_time',
    checkOutAt: null,
    workedMinutes: 0,
    aiEvidence: {},
    save: async function () {
      return this;
    },
  };

  User.findOne = async () => mockUser;
  AttendanceRecord.findOne = async () => existingRecord;

  try {
    const req = {
      body: {
        employeeCode: 'NV004',
        confidence: 93,
        livenessScore: 0.9,
        checkInType: 'Check-out',
        verificationToken: makeToken({
          employeeCode: 'NV004',
          confidence: 93,
          livenessScore: 0.9,
          fullName: 'Trần Văn C',
        }),
      },
    };
    const res = createMockRes();
    await recordAttendance(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(existingRecord.checkOutAt instanceof Date);
    assert.ok(existingRecord.workedMinutes > 0);
    assert.equal(typeof res.body.checkOutAt, 'string');
    assert.match(res.body.workDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(res.body.workedMinutes, existingRecord.workedMinutes);
    assert.equal(res.body.status, 'on_time');
  } finally {
    User.findOne = originalUserFindOne;
    AttendanceRecord.findOne = originalAttendanceFindOne;
    mongoose.connection.readyState = originalState;
  }
});

test('getAttendanceLogs: Bao gồm lateMinutes, workDate và timestamp ưu tiên checkOutAt', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const originalRecordFind = AttendanceRecord.find;

  const mockRecords = [
    {
      _id: new mongoose.Types.ObjectId(),
      userId: { fullName: 'User 1', employeeCode: 'NV001' },
      shiftId: { name: 'Ca Sáng' },
      workDate: new Date('2026-10-16T00:00:00Z'),
      checkInAt: new Date('2026-10-16T08:00:00Z'),
      checkOutAt: new Date('2026-10-16T17:00:00Z'),
      status: 'on_time',
      lateMinutes: 0,
      method: 'face',
      aiEvidence: { similarity: 0.95, livenessScore: 0.92 },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: { fullName: 'User 2', employeeCode: 'NV002' },
      shiftId: { name: 'Ca Sáng' },
      workDate: new Date('2026-10-16T00:00:00Z'),
      checkInAt: new Date('2026-10-16T08:20:00Z'),
      checkOutAt: null,
      status: 'late',
      lateMinutes: 15,
      method: 'face',
      aiEvidence: { similarity: 0.88, livenessScore: 0.85 },
    },
  ];

  AttendanceRecord.find = () => ({
    populate: () => ({
      populate: () => ({
        sort: () => ({
          limit: async () => mockRecords,
        }),
      }),
    }),
  });

  try {
    const res = createMockRes();
    await getAttendanceLogs({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 2);

    // Record 1: Check-out record -> timestamp là checkOutAt
    assert.equal(res.body.data[0].timestamp, mockRecords[0].checkOutAt);
    assert.equal(res.body.data[0].checkInType, 'Check-out');
    assert.match(res.body.data[0].workDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(res.body.data[0].lateMinutes, 0);

    // Record 2: Check-in record -> timestamp là checkInAt
    assert.equal(res.body.data[1].timestamp, mockRecords[1].checkInAt);
    assert.equal(res.body.data[1].checkInType, 'Check-in');
    assert.match(res.body.data[1].workDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(res.body.data[1].lateMinutes, 15);
  } finally {
    AttendanceRecord.find = originalRecordFind;
    mongoose.connection.readyState = originalState;
  }
});

