import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractCleanBase64,
  adaptAiPredictRequest,
  adaptCentralVerifyResponse,
  adaptLegacyPredictResponse,
  adaptFaceEnrollRequest,
  adaptNluQueryResponse,
} from '../services/aiAdapter.js';

test('extractCleanBase64: loại bỏ data URL prefix an toàn', () => {
  assert.equal(extractCleanBase64('data:image/jpeg;base64,abc123XYZ=='), 'abc123XYZ==');
  assert.equal(extractCleanBase64('data:image/png;base64,def456=='), 'def456==');
  assert.equal(extractCleanBase64('alreadyCleanBase64=='), 'alreadyCleanBase64==');
  assert.equal(extractCleanBase64(''), '');
  assert.equal(extractCleanBase64(null), '');
});

test('adaptAiPredictRequest: chuẩn bị payload song song cho cả Central AI Service và Legacy', () => {
  const reqBody = {
    image: 'data:image/jpeg;base64,sampleFrameData==',
    auto_checkin: false,
    tolerance: 0.5,
  };

  const adapted = adaptAiPredictRequest(reqBody);
  assert.equal(adapted.cleanBase64, 'sampleFrameData==');
  assert.deepEqual(adapted.verifyPayload, { imageBase64: 'sampleFrameData==' });
  assert.equal(adapted.legacyPayload.auto_checkin, false);
  assert.equal(adapted.legacyPayload.tolerance, 0.5);
});

test('adaptCentralVerifyResponse: ánh xạ đúng matched, employeeCode, fullName và KHÔNG mock liveness khi null', () => {
  const centralVerifySuccess = {
    matched: true,
    employeeCode: 'NV002',
    similarity: 0.8825,
    threshold: 0.5,
    livenessScore: null, // AI Service chưa chạy liveness hoặc không có
    detScore: 0.99,
    timingMs: 45.2,
    modelVersion: 'YOLOv11+dlibResNet',
    facesDetected: 1,
    spoofType: null,
    message: 'Matched successfully',
  };

  const mockUser = {
    employeeCode: 'NV002',
    fullName: 'Nguyễn Tiến Dũng',
  };

  const adapted = adaptCentralVerifyResponse(centralVerifySuccess, mockUser);

  assert.equal(adapted.success, true);
  assert.equal(adapted.matched, true);
  assert.equal(adapted.employeeCode, 'NV002');
  assert.equal(adapted.fullName, 'Nguyễn Tiến Dũng');
  assert.equal(adapted.name, 'Nguyễn Tiến Dũng');
  assert.equal(adapted.confidence, 88.3);
  assert.equal(adapted.similarity, 0.8825);

  // Quan trọng: KHÔNG MOCK 95/100 khi livenessScore là null!
  assert.equal(adapted.livenessScore, null);
  assert.equal(adapted.liveness, null);
  assert.equal(adapted.isLive, false);

  // KioskPage payload contract (đọc matches[0])
  assert.equal(adapted.matches.length, 1);
  assert.equal(adapted.matches[0].employeeCode, 'NV002');
  assert.equal(adapted.matches[0].name, 'Nguyễn Tiến Dũng');
  assert.equal(adapted.matches[0].confidence, 88.3);

  // DemoPage payload contract (đọc top_match)
  assert.ok(adapted.top_match);
  assert.equal(adapted.top_match.is_match, true);
  assert.equal(adapted.top_match.name, 'Nguyễn Tiến Dũng');
  assert.equal(adapted.top_match.employeeCode, 'NV002');
  assert.equal(adapted.top_match.liveness_score, null);
  assert.equal(adapted.top_match.liveness_status, 'UNKNOWN');
  assert.equal(adapted.top_match.distance, null);
  assert.equal(adapted.top_match.relative_bbox, null);
  assert.equal(adapted.top_match.spoof_type, null);
});

test('adaptCentralVerifyResponse: xử lý người thật (livenessScore >= 0.65) chính xác', () => {
  const centralWithLive = {
    matched: true,
    employeeCode: 'NV003',
    similarity: 0.91,
    threshold: 0.5,
    livenessScore: 0.942, // scale 0..1 từ AIAttendanceWeb3
    detScore: 0.99,
    timingMs: 50.0,
    modelVersion: 'MiniFASNet',
    facesDetected: 1,
    spoofType: 'real',
    message: 'OK',
  };

  const mockUser = { employeeCode: 'NV003', fullName: 'Trần Thị B' };
  const adapted = adaptCentralVerifyResponse(centralWithLive, mockUser);

  assert.equal(adapted.matched, true);
  assert.equal(adapted.isLive, true);
  assert.equal(adapted.livenessScore, 0.942);
  assert.equal(adapted.liveness.score, 94.2);
  assert.equal(adapted.liveness.isLive, true);
  assert.equal(adapted.top_match.liveness_status, 'REAL');
});

test('adaptCentralVerifyResponse: phát hiện giả mạo khuôn mặt (livenessScore < 0.65 hoặc spoofType=spoof)', () => {
  const centralSpoof = {
    matched: true,
    employeeCode: 'NV004',
    similarity: 0.89,
    threshold: 0.5,
    livenessScore: 0.35, // Giả mạo màn hình
    detScore: 0.95,
    timingMs: 42.0,
    modelVersion: 'MiniFASNet',
    facesDetected: 1,
    spoofType: 'spoof',
    message: 'Spoof detected',
  };

  const mockUser = { employeeCode: 'NV004', fullName: 'Lê Văn C' };
  const adapted = adaptCentralVerifyResponse(centralSpoof, mockUser);

  assert.equal(adapted.matched, true);
  assert.equal(adapted.isLive, false);
  assert.equal(adapted.liveness.score, 35.0);
  assert.equal(adapted.liveness.isLive, false);
  assert.equal(adapted.top_match.liveness_status, 'FAKE');
  assert.equal(adapted.top_match.spoof_type, 'spoof');
});

test('adaptCentralVerifyResponse: trường hợp không nhận diện được ai (matched = false)', () => {
  const noMatch = {
    matched: false,
    employeeCode: null,
    similarity: 0.2,
    threshold: 0.5,
    livenessScore: null,
    timingMs: 25.0,
    modelVersion: 'dlib',
    facesDetected: 1,
  };

  const adapted = adaptCentralVerifyResponse(noMatch, null);
  assert.equal(adapted.matched, false);
  assert.equal(adapted.employeeCode, null);
  assert.equal(adapted.matches.length, 0);
  assert.equal(adapted.top_match, null);
});

test('adaptLegacyPredictResponse: chuẩn hóa format api_server.py cũ sang contract thống nhất', () => {
  const legacyData = {
    success: true,
    faces_detected: 1,
    top_match: {
      name: 'Nguyen Tien Dung',
      confidence: 93.4,
      is_match: true,
      distance: 0.28,
      is_real: true,
      liveness_score: 97.5,
      liveness_status: 'REAL',
      spoof_type: 'real',
    },
    inference_time_ms: 120.5,
  };

  const mockUser = {
    employeeCode: 'NV002',
    fullName: 'Nguyen Tien Dung',
  };

  const adapted = adaptLegacyPredictResponse(legacyData, mockUser);
  assert.equal(adapted.matched, true);
  assert.equal(adapted.employeeCode, 'NV002');
  assert.equal(adapted.fullName, 'Nguyen Tien Dung');
  assert.equal(adapted.confidence, 93.4);
  assert.equal(adapted.livenessScore, 0.975); // quy đổi chuẩn scale 0..1
  assert.equal(adapted.isLive, true);
  assert.equal(adapted.matches.length, 1);
  assert.equal(adapted.matches[0].employeeCode, 'NV002');
});

test('adaptFaceEnrollRequest: trích xuất employeeCode và làm sạch ảnh base64', () => {
  const enrollBody = {
    name: 'Phạm Văn D',
    employeeId: 'NV005',
    images: [
      'data:image/jpeg;base64,img1Data==',
      'data:image/png;base64,img2Data==',
    ],
  };

  const adapted = adaptFaceEnrollRequest(enrollBody, null);
  assert.equal(adapted.employeeCode, 'NV005');
  assert.deepEqual(adapted.images, ['img1Data==', 'img2Data==']);
  assert.equal(adapted.legacyPayload.name, 'Phạm Văn D');
});

test('adaptNluQueryResponse: đọc đúng intentConfidence của AIAttendanceWeb3, không bị NaN', () => {
  const aiServiceNlu = {
    intent: 'my_leave_status',
    intentConfidence: 0.965, // Trường chuẩn của AIAttendanceWeb3
    slots: { date: 'today' },
    modelVersion: 'phobert-intent-v14',
  };

  const adapted = adaptNluQueryResponse(aiServiceNlu, 'tôi còn bao nhiêu ngày phép');
  assert.equal(adapted.success, true);
  assert.equal(adapted.intent, 'my_leave_status');
  assert.equal(adapted.intentConfidence, 0.965);
  assert.equal(adapted.confidence, 0.965); // backward-compatible
  assert.ok(adapted.answer.includes('96.5%'));
  assert.ok(adapted.answer.includes('Đơn Nghỉ Phép'));
  assert.deepEqual(adapted.slots, { date: 'today' });
});
