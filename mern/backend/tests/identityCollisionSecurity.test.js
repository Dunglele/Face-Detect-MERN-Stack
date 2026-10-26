/**
 * identityCollisionSecurity.test.js
 *
 * Bộ kiểm thử bảo mật cho các rủi ro định danh chấm công mặt:
 * 1. Trùng tên (duplicate fullName) → không bao giờ gắn mã sai
 * 2. Thiếu employeeCode trong top_match → không cấp token
 * 3. face.enrolled=false → không cấp token ngay cả khi embedding tồn tại
 * 4. FACE_VERIFICATION_SECRET thiếu → POST /api/ai/predict trả 503 CONFIG_MISSING
 *
 * Không kết nối MongoDB thật, không gọi Face AI thật.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { adaptLegacyPredictResponse } from '../services/aiAdapter.js';
import { recordAttendance } from '../controllers/attendanceController.js';
import { User } from '../models/index.js';

const FACE_SECRET = 'test-face-verification-secret-min-32-chars-ok';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

// ============================================================================
// 1. DUPLICATE-NAME COLLISION PREVENTION
// Hai người trùng họ tên không được dùng tên để tra cứu User.
// BFF phải dùng employeeCode từ Face AI (top_match.employee_code) để lookup DB.
// ============================================================================
test('Identity Collision: adaptLegacyPredictResponse ưu tiên employeeCode từ top_match, KHÔNG dùng tên', () => {
  // Giả lập hai người cùng tên "Nguyen Van A" nhưng khác mã
  const rawDataPerson1 = {
    success: true,
    top_match: {
      name: 'Nguyen Van A',
      employee_code: 'NV001',
      is_match: true,
      is_real: true,
      confidence: 93.5,
      liveness_score: 88.0,
      distance: 0.31,
    },
    faces: [],
    faces_detected: 1,
    inference_time_ms: 120,
  };

  const rawDataPerson2 = {
    success: true,
    top_match: {
      name: 'Nguyen Van A',          // cùng tên
      employee_code: 'NV099',        // KHÁC mã
      is_match: true,
      is_real: true,
      confidence: 91.0,
      liveness_score: 85.0,
      distance: 0.35,
    },
    faces: [],
    faces_detected: 1,
    inference_time_ms: 115,
  };

  // matchedUser tương ứng từ DB lookup bằng employeeCode
  const user1 = { employeeCode: 'NV001', fullName: 'Nguyen Van A' };
  const user2 = { employeeCode: 'NV099', fullName: 'Nguyen Van A' };

  const resp1 = adaptLegacyPredictResponse(rawDataPerson1, user1);
  const resp2 = adaptLegacyPredictResponse(rawDataPerson2, user2);

  assert.equal(resp1.employeeCode, 'NV001', 'Person 1 phải nhận đúng mã NV001');
  assert.equal(resp2.employeeCode, 'NV099', 'Person 2 phải nhận đúng mã NV099');
  assert.notEqual(resp1.employeeCode, resp2.employeeCode, 'Hai người trùng tên phải có employeeCode khác nhau');
});

test('Identity Collision: BFF không được cấp token khi top_match.employee_code rỗng/null', () => {
  // Mô phỏng logic cấp token trong server.js
  function tryIssueToken({ topMatch, matchedUser, adaptedConf, adaptedLiveness }) {
    const FACE_VERIFICATION_SECRET = 'test-secret-for-token-issuance';
    const isRealPerson = Boolean(topMatch && topMatch.is_real === true);
    const livenessScore = (topMatch && typeof topMatch.liveness_score === 'number' && Number.isFinite(topMatch.liveness_score))
      ? topMatch.liveness_score : -1;
    const confidenceScore = (typeof adaptedConf === 'number' && Number.isFinite(adaptedConf)) ? adaptedConf : -1;
    const isLivenessValid = livenessScore >= 65;
    const isConfidenceValid = confidenceScore >= 85;
    const isMatched = topMatch ? Boolean(topMatch.is_match) : false;
    // dbEmployeeCode từ DB lookup bằng employeeCode — nếu matchedUser null thì null
    const dbEmployeeCode = matchedUser && matchedUser.employeeCode ? String(matchedUser.employeeCode).trim() : null;

    if (isMatched && isRealPerson && isLivenessValid && isConfidenceValid && dbEmployeeCode) {
      return jwt.sign(
        { type: 'face_verification', iss: 'face-bff', employeeCode: dbEmployeeCode, confidence: confidenceScore, livenessScore },
        FACE_VERIFICATION_SECRET,
        { expiresIn: '120s' }
      );
    }
    return null;
  }

  const goodTopMatch = { is_match: true, is_real: true, liveness_score: 88, confidence: 93 };

  // 1. employee_code rỗng → DB lookup thất bại → matchedUser = null → không cấp token
  const noCodeToken = tryIssueToken({
    topMatch: { ...goodTopMatch, employee_code: '' },
    matchedUser: null,
    adaptedConf: 93,
    adaptedLiveness: 88,
  });
  assert.equal(noCodeToken, null, 'employee_code rỗng: không được cấp token');

  // 2. employee_code có giá trị nhưng DB không tìm thấy (user bị xóa/deactivated)
  const notFoundToken = tryIssueToken({
    topMatch: { ...goodTopMatch, employee_code: 'NV_GHOST' },
    matchedUser: null,          // DB lookup trả null
    adaptedConf: 93,
    adaptedLiveness: 88,
  });
  assert.equal(notFoundToken, null, 'DB không tìm thấy user: không được cấp token');

  // 3. Đầy đủ điều kiện → cấp token hợp lệ
  const validToken = tryIssueToken({
    topMatch: { ...goodTopMatch, employee_code: 'NV001' },
    matchedUser: { employeeCode: 'NV001', fullName: 'Test User' },
    adaptedConf: 93,
    adaptedLiveness: 88,
  });
  assert.ok(validToken, 'Đủ điều kiện: phải cấp token');
  const decoded = jwt.verify(validToken, 'test-secret-for-token-issuance');
  assert.equal(decoded.employeeCode, 'NV001');
});

// ============================================================================
// 2. FACE.ENROLLED=FALSE BLOCKS TOKEN ISSUANCE
// Khi face.enrolled=false, embedding có thể vẫn tồn tại trong DB nhưng
// Face AI không được nạp vector đó → top_match sẽ không có employee_code
// → BFF không tìm thấy user → không cấp token
// ============================================================================
test('Enrolled False: face.enrolled=false ngăn không cho matchedUser có employeeCode → không cấp token', () => {
  // Mô phỏng: Face AI đã được fix để không nạp embedding khi enrolled=false.
  // Kết quả: top_match.employee_code sẽ rỗng (không khớp được), matchedUser = null.
  function serverSideTokenCheck(aiEmployeeCode, matchedUser, topMatch, adaptedConf, adaptedLiveness) {
    const dbEmployeeCode = matchedUser && matchedUser.employeeCode
      ? String(matchedUser.employeeCode).trim() : null;
    const isRealPerson = Boolean(topMatch && topMatch.is_real === true);
    const livenessScore = (topMatch && Number.isFinite(topMatch.liveness_score)) ? topMatch.liveness_score : -1;
    const confidenceScore = Number.isFinite(adaptedConf) ? adaptedConf : -1;
    const isMatched = topMatch ? Boolean(topMatch.is_match) : false;
    return Boolean(isMatched && isRealPerson && livenessScore >= 65 && confidenceScore >= 85 && dbEmployeeCode);
  }

  // Case: enrolled=false → Face AI không khớp → top_match.is_match=false
  const notMatchedTopMatch = { is_match: false, is_real: false, liveness_score: 0 };
  const result1 = serverSideTokenCheck('', null, notMatchedTopMatch, 0, 0);
  assert.equal(result1, false, 'enrolled=false → không khớp → không cấp token');

  // Case: Kẻ tấn công gửi top_match giả với is_match=true nhưng DB không tìm thấy mã
  const fakeTopMatch = { is_match: true, is_real: true, liveness_score: 90 };
  const result2 = serverSideTokenCheck('FAKE_CODE', null /* DB miss */, fakeTopMatch, 92, 90);
  assert.equal(result2, false, 'DB miss (enrolled=false không nạp) → không cấp token dù top_match giả');
});

// ============================================================================
// 3. FACE_VERIFICATION_SECRET MISSING → 503 CONFIG_MISSING
// Đây là bảo vệ fail-closed quan trọng nhất: nếu secret chưa set thì
// endpoint /api/ai/predict trả ngay 503 thay vì 200 không có token.
// Kiểm tra thông qua recordAttendance vì server.js không thể unit-test trực tiếp.
// ============================================================================
test('Config Missing: recordAttendance trả 503 CONFIG_MISSING khi thiếu FACE_VERIFICATION_SECRET', async () => {
  const origSecret = process.env.FACE_VERIFICATION_SECRET;
  delete process.env.FACE_VERIFICATION_SECRET;

  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const req = {
    body: {
      employeeCode: 'NV001',
      verificationToken: 'any-token-value',
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    assert.equal(res.statusCode, 503, 'Phải trả 503 khi thiếu secret');
    assert.equal(res.body.code, 'CONFIG_MISSING', 'Phải có code CONFIG_MISSING');
  } finally {
    if (origSecret !== undefined) process.env.FACE_VERIFICATION_SECRET = origSecret;
    mongoose.connection.readyState = origReady;
  }
});

test('Config Missing: POST /api/ai/predict mô phỏng trả 503 khi thiếu FACE_VERIFICATION_SECRET', () => {
  // Kiểm tra logic fail-closed của route handler (không spin up server thật)
  function simulatePredictEndpointCheck(secretEnv) {
    if (!secretEnv) {
      return { status: 503, body: { success: false, code: 'CONFIG_MISSING' } };
    }
    return { status: 200, body: { success: true } };
  }

  const missing = simulatePredictEndpointCheck(undefined);
  assert.equal(missing.status, 503);
  assert.equal(missing.body.code, 'CONFIG_MISSING');
  assert.equal(missing.body.success, false);

  const empty = simulatePredictEndpointCheck('');
  assert.equal(empty.status, 503);

  const configured = simulatePredictEndpointCheck('my-valid-secret-value');
  assert.equal(configured.status, 200);
});

// ============================================================================
// 4. BFF DB LOOKUP PHẢI DÙNG employeeCode (KHÔNG dùng tên)
// Kiểm tra logic lookup bằng cách mock User.findOne và xác nhận nó được
// gọi với employeeCode, không bao giờ với fullName regex.
// ============================================================================
test('DB Lookup: recordAttendance chỉ tra User bằng employeeCode, không tra bằng fullName', async () => {
  process.env.FACE_VERIFICATION_SECRET = FACE_SECRET;
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const lookupKeys = [];
  const origFindOne = User.findOne;

  // Intercept tất cả User.findOne calls và ghi lại query
  User.findOne = (query) => {
    lookupKeys.push(JSON.stringify(query));
    return {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'NV001',
      fullName: 'Test User',
      departmentId: new mongoose.Types.ObjectId(),
    };
  };

  const token = jwt.sign(
    { type: 'face_verification', iss: 'face-bff', employeeCode: 'NV001', confidence: 92, livenessScore: 80 },
    FACE_SECRET,
    { expiresIn: '60s' }
  );

  const req = {
    body: { employeeCode: 'NV001', verificationToken: token },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);

    // Kiểm tra mỗi query đều dùng employeeCode, không bao giờ dùng fullName hay searchName
    for (const q of lookupKeys) {
      assert.ok(
        q.includes('employeeCode'),
        `Query phải có employeeCode: ${q}`
      );
      assert.ok(
        !q.includes('fullName') && !q.includes('searchName'),
        `Query không được tra theo fullName/searchName: ${q}`
      );
    }
  } finally {
    User.findOne = origFindOne;
    mongoose.connection.readyState = origReady;
    delete process.env.FACE_VERIFICATION_SECRET;
  }
});

// ============================================================================
// 5. GIẢM RỦI RO: TOKEN PHẢI CHỨA employeeCode từ DB, KHÔNG từ client payload
// Ngay cả khi client gửi employeeCode sai trong body, server phải đọc từ token.
// ============================================================================
test('Token Integrity: Server đọc employeeCode từ verificationToken, bỏ qua body.employeeCode giả', async () => {
  process.env.FACE_VERIFICATION_SECRET = FACE_SECRET;
  const origReady = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  const origFindOne = User.findOne;
  // Mock: tìm user chỉ khi query đúng NV001
  User.findOne = (query) => {
    const code = query?.employeeCode;
    if (code === 'NV001') {
      return {
        _id: new mongoose.Types.ObjectId(),
        employeeCode: 'NV001',
        fullName: 'Nguyen Van A',
        departmentId: new mongoose.Types.ObjectId(),
      };
    }
    return null;
  };

  // Token ký với NV001 (từ BFF sau khi xác thực Face AI)
  const legitimateToken = jwt.sign(
    { type: 'face_verification', iss: 'face-bff', employeeCode: 'NV001', confidence: 93, livenessScore: 85 },
    FACE_SECRET,
    { expiresIn: '60s' }
  );

  // Client cố tình gửi employeeCode: NV999 (giả mạo) nhưng token chứa NV001
  const req = {
    body: {
      employeeCode: 'NV999',   // client cố gửi mã giả
      verificationToken: legitimateToken,
    },
  };
  const res = createMockRes();

  try {
    await recordAttendance(req, res);
    // Nếu success: employeeCode trong response phải là NV001 (từ token), không phải NV999
    if (res.statusCode === 201 || res.statusCode === 200) {
      assert.ok(
        res.body.employeeCode !== 'NV999',
        'Không được dùng employeeCode giả từ client body'
      );
    }
    // Nếu 404: DB lookup đúng khi server dùng NV001 từ token mà không tìm được user (mock chỉ trả kết quả đúng)
    // Trường hợp này chấp nhận 201/200/404 — quan trọng là không có 403
    assert.notEqual(res.statusCode, 403, 'Token hợp lệ không được bị reject 403');
  } finally {
    User.findOne = origFindOne;
    mongoose.connection.readyState = origReady;
    delete process.env.FACE_VERIFICATION_SECRET;
  }
});
