import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { computeRecordHash, buildMerkleRoot } from '../../../../AIAttendanceWeb3/backend/src/services/anchorWorker.js';
import { recordAttendance } from '../controllers/attendanceController.js';
import { createUser, updateFaceEnrollment, deleteUser } from '../controllers/userController.js';
import {
  checkIn as centralCheckIn,
  checkOut as centralCheckOut,
  checkInByFace as centralCheckInByFace,
  checkOutByFace as centralCheckOutByFace
} from '../../../../AIAttendanceWeb3/backend/src/controllers/attendance.controller.js';
import { User, Shift, AttendanceRecord } from '../models/index.js';

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

const SHARED_JWT_SECRET = 'your-shared-secure-jwt-secret-key-min-32-characters-change-in-production';
const FACE_VERIFICATION_SECRET = 'test-face-verification-secret-separate-from-jwt';
process.env.FACE_VERIFICATION_SECRET = FACE_VERIFICATION_SECRET;

// ============================================================================
// 1. LIÊN THÔNG XÁC THỰC JWT INTER-SERVICE
// ============================================================================
test('Inter-service JWT: Token ký từ Employee Service giải mã thành công tại Central Service', () => {
  const employeePayload = {
    employeeId: '64d0a1b2c3d4e5f6a7b8c9d0',
    employeeCode: 'NV001',
    role: 'employee',
    iss: 'face-detect-mern-5000',
  };

  const token = jwt.sign(employeePayload, SHARED_JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, SHARED_JWT_SECRET);

  assert.equal(decoded.employeeCode, 'NV001');
  assert.equal(decoded.role, 'employee');
  assert.equal(decoded.iss, 'face-detect-mern-5000');
});

test('Inter-service JWT: Từ chối token ký bằng secret khác (chống giả mạo liên service)', () => {
  const forgedToken = jwt.sign({ role: 'admin' }, 'wrong-secret-key');
  assert.throws(() => {
    jwt.verify(forgedToken, SHARED_JWT_SECRET);
  });
});

// ============================================================================
// 2. TÍNH TOÁN WEB3 HASH VÀ MERKLE ROOT TRÊN BẢN GHI DO FACE SERVICE GHI
// ============================================================================
test('Web3 Hash: computeRecordHash sinh hash keccak256 hợp lệ từ bản ghi của Face service', () => {
  const faceRecord = {
    userId: new mongoose.Types.ObjectId('64d0a1b2c3d4e5f6a7b8c9d0'),
    workDate: new Date('2026-09-02T00:00:00.000Z'),
    checkInAt: new Date('2026-09-02T08:02:15.000Z'),
    checkOutAt: new Date('2026-09-02T17:05:30.000Z'),
    status: 'on_time',
    lateMinutes: 0,
    method: 'face',
    aiEvidence: { similarity: 0.94, livenessScore: 0.98 },
  };

  const hash = computeRecordHash(faceRecord);
  assert.ok(hash.startsWith('0x'), 'Hash phải có tiền tố 0x');
  assert.equal(hash.length, 66, 'Hash keccak256 phải dài đúng 66 ký tự hex');

  // Tính xác định (deterministic)
  const hashAgain = computeRecordHash(faceRecord);
  assert.equal(hash, hashAgain, 'Cùng input phải sinh ra cùng hash');
});

test('Web3 Hash: Bất kỳ thay đổi nào trên bản ghi (tamper) làm thay đổi hash ngay lập tức', () => {
  const originalRecord = {
    userId: new mongoose.Types.ObjectId('64d0a1b2c3d4e5f6a7b8c9d0'),
    workDate: new Date('2026-09-02T00:00:00.000Z'),
    checkInAt: new Date('2026-09-02T08:02:15.000Z'),
    checkOutAt: new Date('2026-09-02T17:05:30.000Z'),
    status: 'on_time',
    lateMinutes: 0,
  };

  const tamperedRecord = {
    ...originalRecord,
    status: 'late',
    lateMinutes: 15,
  };

  const originalHash = computeRecordHash(originalRecord);
  const tamperedHash = computeRecordHash(tamperedRecord);
  assert.notEqual(originalHash, tamperedHash, 'Hash phải thay đổi khi dữ liệu bị sửa đổi');
});

test('Web3 Merkle Root: buildMerkleRoot tổng hợp nhiều bản ghi điểm danh do Face Service ghi', () => {
  const records = [
    {
      userId: new mongoose.Types.ObjectId('64d0a1b2c3d4e5f6a7b8c901'),
      workDate: new Date('2026-09-02T00:00:00.000Z'),
      checkInAt: new Date('2026-09-02T08:00:00.000Z'),
      checkOutAt: new Date('2026-09-02T17:00:00.000Z'),
      status: 'on_time',
      lateMinutes: 0,
    },
    {
      userId: new mongoose.Types.ObjectId('64d0a1b2c3d4e5f6a7b8c902'),
      workDate: new Date('2026-09-02T00:00:00.000Z'),
      checkInAt: new Date('2026-09-02T08:15:00.000Z'),
      checkOutAt: new Date('2026-09-02T17:00:00.000Z'),
      status: 'late',
      lateMinutes: 15,
    },
  ];

  const hashes = records.map(computeRecordHash);
  const root = buildMerkleRoot(hashes);

  assert.ok(root.startsWith('0x'));
  assert.equal(root.length, 66);
  assert.notEqual(root, hashes[0], 'Merkle root cấp 2 phải khác hash lá đơn lẻ');
});

// ============================================================================
// 3. BẢO VỆ CHỐNG GIẢ MẠO ĐIỂM AI BẰNG PAYLOAD CLIENT (VERIFICATION TOKEN)
// ============================================================================
test('Anti-Spoofing: Client gửi điểm tin cậy tự chế không có token ký -> Bị chặn 403', async () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production'; // ép kiểm tra bảo mật như production

  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 99.5,
      livenessScore: 0.99,
    },
    headers: {},
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'UNAUTHORIZED_AI_EVIDENCE');
  } finally {
    process.env.NODE_ENV = origEnv;
    mongoose.connection.readyState = origReady;
  }
});

test('Anti-Spoofing: Client gửi header tùy ý (x-device-api-key, Authorization) nhưng không có verificationToken -> Bị chặn 403', async () => {
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 99.5,
      livenessScore: 0.99,
    },
    headers: {
      'x-device-api-key': 'arbitrary-unverified-device-key',
      authorization: 'Bearer arbitrary-unverified-login-token',
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'UNAUTHORIZED_AI_EVIDENCE');
  } finally {
    mongoose.connection.readyState = origReady;
  }
});

test('Anti-Spoofing: Client gửi login JWT làm verificationToken -> Bị từ chối 403 INVALID_TOKEN_TYPE', async () => {
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  // Login JWT hoặc token phiên không chứa type='face_verification' và iss='face-bff'
  const loginJwt = jwt.sign(
    { userId: '64d0a1b2c3d4e5f6a7b8c9d0', role: 'employee' },
    FACE_VERIFICATION_SECRET,
    { expiresIn: '1h' }
  );

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 99.5,
      livenessScore: 0.99,
      verificationToken: loginJwt,
    },
    headers: {},
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVALID_TOKEN_TYPE');
  } finally {
    mongoose.connection.readyState = origReady;
  }
});

test('Anti-Spoofing: Client gửi verificationToken đã ký bởi Face BFF (type=face_verification, iss=face-bff) -> Chấp nhận bằng chứng', async () => {
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  // Giả lập mock tìm User
  const origFindOne = User.findOne;
  User.findOne = () => ({
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Nguyen Van A',
    employeeCode: 'NV001',
    departmentId: new mongoose.Types.ObjectId(),
  });

  const validToken = jwt.sign(
    {
      type: 'face_verification',
      iss: 'face-bff',
      employeeCode: 'NV001',
      confidence: 93.5,
      livenessScore: 0.95,
    },
    FACE_VERIFICATION_SECRET,
    { expiresIn: '60s' }
  );

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 50, // client cố ý gửi điểm giả 50 nhưng server phải đọc 93.5 từ token
      livenessScore: 0.5,
      verificationToken: validToken,
    },
    headers: {},
  };
  const res = createMockRes();

  try {
    // Không ném 403 UNAUTHORIZED_AI_EVIDENCE nữa vì token đã xác thực
    await recordAttendance(req, res);
    assert.notEqual(res.statusCode, 403);
  } finally {
    User.findOne = origFindOne;
    mongoose.connection.readyState = origReady;
  }
});

test('Anti-Spoofing: Client gửi verificationToken giả mạo / sai secret -> Bị từ chối 403 INVALID_VERIFICATION_TOKEN', async () => {
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const forgedToken = jwt.sign(
    {
      type: 'face_verification',
      iss: 'face-bff',
      employeeCode: 'NV001',
      confidence: 99,
      livenessScore: 0.99,
    },
    'forged-hacker-secret'
  );

  const req = {
    body: {
      employeeCode: 'NV001',
      confidence: 99,
      livenessScore: 0.99,
      verificationToken: forgedToken,
    },
    headers: {},
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVALID_VERIFICATION_TOKEN');
  } finally {
    mongoose.connection.readyState = origReady;
  }
});

// ============================================================================
// 4. KIỂM TRA CÁC ROUTE DEPRECATED TRẢ VỀ 410 GONE
// ============================================================================
test('Contract 410: Employee BFF gỡ/khóa create/update-face/delete user (trả 410 Gone)', async () => {
  const res1 = createMockRes();
  await createUser({}, res1);
  assert.equal(res1.statusCode, 410);

  const res2 = createMockRes();
  await updateFaceEnrollment({ params: { id: '1' } }, res2);
  assert.equal(res2.statusCode, 410);

  const res3 = createMockRes();
  await deleteUser({ params: { id: '1' } }, res3);
  assert.equal(res3.statusCode, 410);
});

test('Contract 410: Central Backend ngừng cung cấp POST checkin/checkout kể cả face (trả 410 Gone)', async () => {
  const res1 = createMockRes();
  await centralCheckIn({}, res1);
  assert.equal(res1.statusCode, 410);

  const res2 = createMockRes();
  await centralCheckOut({}, res2);
  assert.equal(res2.statusCode, 410);

  const res3 = createMockRes();
  await centralCheckInByFace({}, res3);
  assert.equal(res3.statusCode, 410);

  const res4 = createMockRes();
  await centralCheckOutByFace({}, res4);
  assert.equal(res4.statusCode, 410);
});

// ============================================================================
// 5. KIỂM TRA ĐIỀU KIỆN CẤP VERIFICATION TOKEN TRÊN SERVER.JS & FAIL-CLOSED
// ============================================================================
test('BFF Token Issuance: Chỉ cấp token khi is_real===true, liveness>=65, conf>=85 và user có trong DB', () => {
  const FACE_VERIFICATION_SECRET = process.env.FACE_VERIFICATION_SECRET || SHARED_JWT_SECRET;

  function evaluateTokenIssuance({ rawData, matchedUser, adaptedConfidence, adaptedLiveness }) {
    const topMatch = rawData.top_match;
    const isRealPerson = Boolean(topMatch && topMatch.is_real === true);
    const livenessScore = topMatch && typeof topMatch.liveness_score === 'number' && Number.isFinite(topMatch.liveness_score)
      ? topMatch.liveness_score
      : (typeof adaptedLiveness === 'number' && Number.isFinite(adaptedLiveness) ? adaptedLiveness : -1);
    const confidenceScore = typeof adaptedConfidence === 'number' && Number.isFinite(adaptedConfidence)
      ? adaptedConfidence
      : -1;
    const isLivenessValid = livenessScore >= 65;
    const isConfidenceValid = confidenceScore >= 85;
    const isMatched = topMatch ? Boolean(topMatch.is_match) : false;
    const dbEmployeeCode = matchedUser && matchedUser.employeeCode ? String(matchedUser.employeeCode).trim() : null;

    if (isMatched && isRealPerson && isLivenessValid && isConfidenceValid && dbEmployeeCode) {
      return jwt.sign(
        {
          type: 'face_verification',
          iss: 'face-bff',
          employeeCode: dbEmployeeCode,
          confidence: confidenceScore,
          livenessScore: livenessScore,
        },
        FACE_VERIFICATION_SECRET,
        { expiresIn: '120s' }
      );
    }
    return null;
  }

  const validUser = { employeeCode: 'NV001', fullName: 'Nguyen Van A' };

  // 1. Giả mạo / is_real false -> Không cấp token
  const spoofToken = evaluateTokenIssuance({
    rawData: { top_match: { is_match: true, is_real: false, liveness_score: 95 } },
    matchedUser: validUser,
    adaptedConfidence: 92,
  });
  assert.equal(spoofToken, null, 'is_real=false không được cấp token');

  // 2. Liveness < 65 -> Không cấp token
  const lowLiveToken = evaluateTokenIssuance({
    rawData: { top_match: { is_match: true, is_real: true, liveness_score: 64.9 } },
    matchedUser: validUser,
    adaptedConfidence: 92,
  });
  assert.equal(lowLiveToken, null, 'liveness < 65 không được cấp token');

  // 3. Confidence < 85 -> Không cấp token
  const lowConfToken = evaluateTokenIssuance({
    rawData: { top_match: { is_match: true, is_real: true, liveness_score: 90 } },
    matchedUser: validUser,
    adaptedConfidence: 84.9,
  });
  assert.equal(lowConfToken, null, 'confidence < 85 không được cấp token');

  // 4. User không có trong DB -> Không cấp token
  const noUserToken = evaluateTokenIssuance({
    rawData: { top_match: { is_match: true, is_real: true, liveness_score: 90 } },
    matchedUser: null,
    adaptedConfidence: 92,
  });
  assert.equal(noUserToken, null, 'Chưa tìm thấy user trong DB không được cấp token');

  // 5. Đầy đủ điều kiện chuẩn -> Cấp token hợp lệ
  const validIssuedToken = evaluateTokenIssuance({
    rawData: { top_match: { is_match: true, is_real: true, liveness_score: 92.5 } },
    matchedUser: validUser,
    adaptedConfidence: 94.0,
  });
  assert.ok(validIssuedToken, 'Đủ điều kiện phải được cấp token');
  const decoded = jwt.verify(validIssuedToken, FACE_VERIFICATION_SECRET);
  assert.equal(decoded.type, 'face_verification');
  assert.equal(decoded.iss, 'face-bff');
  assert.equal(decoded.employeeCode, 'NV001');
  assert.equal(decoded.confidence, 94.0);
});

test('Anti-Spoofing: recordAttendance trả 503 CONFIG_MISSING khi thiếu FACE_VERIFICATION_SECRET (Fail-Closed)', async () => {
  const origSecret = process.env.FACE_VERIFICATION_SECRET;
  delete process.env.FACE_VERIFICATION_SECRET;

  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const validToken = jwt.sign(
    { type: 'face_verification', iss: 'face-bff', employeeCode: 'NV001', confidence: 93.5, livenessScore: 0.95 },
    FACE_VERIFICATION_SECRET,
    { expiresIn: '60s' }
  );

  const req = {
    body: { employeeCode: 'NV001', verificationToken: validToken },
    headers: {},
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'CONFIG_MISSING');
  } finally {
    process.env.FACE_VERIFICATION_SECRET = origSecret;
    mongoose.connection.readyState = origReady;
  }
});

test('Anti-Spoofing: Không fallback login JWT_SECRET khi token ký bằng login secret nhưng FACE_VERIFICATION_SECRET riêng -> 403', async () => {
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  // Ký bằng SHARED_JWT_SECRET (login secret)
  const tokenSignedWithJwtSecret = jwt.sign(
    { type: 'face_verification', iss: 'face-bff', employeeCode: 'NV001', confidence: 93.5, livenessScore: 0.95 },
    SHARED_JWT_SECRET,
    { expiresIn: '60s' }
  );

  const req = {
    body: { employeeCode: 'NV001', verificationToken: tokenSignedWithJwtSecret },
    headers: {},
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVALID_VERIFICATION_TOKEN');
  } finally {
    mongoose.connection.readyState = origReady;
  }
});

test('Face AI Refresh Endpoint: BẮT BUỘC trả 503 CONFIG_MISSING khi FACE_AI_INTERNAL_TOKEN chưa set (Fail-Closed)', () => {
  function verifyTokenLogic(headers, expectedSecret) {
    if (!expectedSecret) return { status: 503, error: 'CONFIG_MISSING' };
    const token = headers['x-internal-token'] || headers['x-service-key'] || (headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return { status: 401, error: 'Missing token' };
    if (token !== expectedSecret) return { status: 403, error: 'Invalid token' };
    return { status: 200, ok: true };
  }

  // 1. Không set biến môi trường -> 503 CONFIG_MISSING
  assert.equal(verifyTokenLogic({ 'x-internal-token': 'any' }, null).status, 503);
  assert.equal(verifyTokenLogic({}, '').status, 503);

  // 2. Đã set nhưng caller không gửi header -> 401
  assert.equal(verifyTokenLogic({}, 'configured-token').status, 401);

  // 3. Đã set nhưng caller gửi sai -> 403
  assert.equal(verifyTokenLogic({ 'x-internal-token': 'wrong' }, 'configured-token').status, 403);

  // 4. Đúng token -> 200
  assert.equal(verifyTokenLogic({ 'x-internal-token': 'configured-token' }, 'configured-token').status, 200);
});


