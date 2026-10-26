/**
 * AI Adapter: Cầu nối đồng bộ hợp đồng API giữa Face-Detect-MERN-Stack và AIAttendanceWeb3 AI Service (port 8000).
 * Đồng thời duy trì khả năng tương thích ngược với api_server.py cục bộ (port 8001 / legacy 8000).
 * 
 * Nguyên tắc:
 * - KHÔNG mock confidence / liveness mặc định để tránh xác nhận sai.
 * - Chuẩn hóa hai chiều giữa (fullName, employeeCode) và (name, employeeId).
 * - Cung cấp payload chuẩn cho cả trạm Kiosk và phòng lab DemoPage.
 */

/**
 * Chuẩn hóa ảnh base64: cắt bỏ prefix data:image/...;base64, nếu có
 */
export function extractCleanBase64(imageStr) {
  if (!imageStr || typeof imageStr !== 'string') return '';
  const commaIdx = imageStr.indexOf(',');
  return commaIdx !== -1 ? imageStr.slice(commaIdx + 1).trim() : imageStr.trim();
}

/**
 * Chuẩn hóa request predict gửi sang AI Service
 */
export function adaptAiPredictRequest(body = {}) {
  const rawImage = body.image || body.imageBase64 || '';
  const cleanBase64 = extractCleanBase64(rawImage);

  return {
    rawImage,
    cleanBase64,
    autoCheckin: Boolean(body.auto_checkin),
    tolerance: typeof body.tolerance === 'number' ? body.tolerance : undefined,
    // Payload dành cho AIAttendanceWeb3 POST /api/v1/face/verify
    verifyPayload: {
      imageBase64: cleanBase64,
    },
    // Payload tương thích ngược cho api_server.py POST /predict
    legacyPayload: {
      image: rawImage,
      auto_checkin: Boolean(body.auto_checkin),
      tolerance: body.tolerance,
    },
  };
}

/**
 * Chuyển đổi response từ AIAttendanceWeb3 (POST /api/v1/face/verify) sang format
 * thống nhất cho KioskPage và DemoPage.
 * 
 * Response của AIAttendanceWeb3:
 * {
 *   matched: boolean,
 *   employeeCode: string | null,
 *   similarity: float,
 *   threshold: float,
 *   livenessScore: float | null, // 0.0 - 1.0 (hoặc null nếu không khớp / chưa chạy)
 *   detScore: float | null,
 *   timingMs: float,
 *   modelVersion: string,
 *   facesDetected: int,
 *   spoofType: string | null, // 'real' | 'spoof' | null
 *   message: string | null
 * }
 */
export function adaptCentralVerifyResponse(data, user = null) {
  const matched = Boolean(data.matched);
  const employeeCode = data.employeeCode || (user ? user.employeeCode : null);
  const fullName = user ? (user.fullName || user.name) : (employeeCode || 'Unknown');

  const similarity = typeof data.similarity === 'number' ? data.similarity : 0.0;
  const confidence = +(similarity * 100).toFixed(1);

  // Xử lý LivenessScore trung thực - KHÔNG MOCK 95/100 khi không có dữ liệu!
  let parsedLivenessScore = null;
  let isLive = null;
  let livenessStatus = 'UNKNOWN';

  if (typeof data.livenessScore === 'number' && !isNaN(data.livenessScore)) {
    // AIAttendanceWeb3 trả về thang 0.0 - 1.0
    parsedLivenessScore = +(data.livenessScore * 100).toFixed(1);
    const passesThreshold = data.livenessScore >= 0.65;
    const notSpoof = data.spoofType !== 'spoof';
    isLive = passesThreshold && notSpoof;
    livenessStatus = isLive ? 'REAL' : 'FAKE';
  }

  const topMatch = matched
    ? {
        name: fullName,
        fullName,
        employeeCode: employeeCode || '',
        employeeId: employeeCode || '',
        confidence,
        similarity,
        is_match: true,
        distance: typeof data.distance === 'number' ? data.distance : null,
        is_real: isLive,
        liveness_score: parsedLivenessScore,
        liveness_status: livenessStatus,
        spoof_type: data.spoofType || null,
        relative_bbox: data.relative_bbox || data.bbox || null,
      }
    : null;

  return {
    success: true,
    matched,
    employeeCode: employeeCode || null,
    fullName: matched ? fullName : null,
    name: matched ? fullName : 'Unknown',
    similarity,
    confidence,
    // livenessScore thang 0.0 - 1.0 đồng bộ contract AIAttendanceWeb3
    livenessScore: typeof data.livenessScore === 'number' ? data.livenessScore : null,
    liveness: parsedLivenessScore !== null
      ? {
          score: parsedLivenessScore,
          isLive: isLive === true,
        }
      : null,
    isLive: isLive === true,
    spoofType: data.spoofType || null,
    faces_detected: data.facesDetected ?? (matched ? 1 : 0),
    facesDetected: data.facesDetected ?? (matched ? 1 : 0),
    inference_time_ms: data.timingMs || 0,
    timingMs: data.timingMs || 0,
    model_used: data.modelVersion || 'AIAttendanceWeb3 Central AI Service',
    message: data.message || (matched ? `Xác thực thành công cho ${fullName}` : 'Không nhận diện được khuôn mặt'),

    // Cho KioskPage (đọc matches[0]):
    matches: matched && employeeCode
      ? [
          {
            name: fullName,
            fullName,
            employeeCode,
            employeeId: employeeCode,
            confidence,
            similarity,
          },
        ]
      : [],

    // Cho DemoPage (đọc top_match và faces):
    top_match: topMatch,
    faces: topMatch ? [topMatch] : [],
  };
}

/**
 * Chuẩn hóa response từ api_server.py cũ (POST /predict) sang format đồng bộ
 */
export function adaptLegacyPredictResponse(data, user = null) {
  const topMatch = data.top_match;
  const isMatch = Boolean(topMatch && topMatch.is_match);

  const rawName = topMatch ? topMatch.name : '';
  const employeeCode = user?.employeeCode || topMatch?.employeeCode || topMatch?.employeeId || (isMatch ? rawName : null);
  const fullName = user?.fullName || (isMatch ? rawName : 'Unknown');

  // Liveness từ legacy api_server.py thường là thang 0..100
  let parsedLivenessScore = null;
  let liveness0to1 = null;
  let isLive = null;

  if (topMatch && typeof topMatch.liveness_score === 'number') {
    parsedLivenessScore = +topMatch.liveness_score.toFixed(1);
    liveness0to1 = +(parsedLivenessScore / 100).toFixed(4);
    isLive = Boolean(topMatch.is_real && parsedLivenessScore >= 65);
  }

  const confidence = topMatch && typeof topMatch.confidence === 'number'
    ? topMatch.confidence
    : (isMatch ? 0 : 0);
  const similarity = +(confidence / 100).toFixed(4);

  return {
    ...data,
    success: Boolean(data.success),
    matched: isMatch,
    employeeCode,
    fullName: isMatch ? fullName : null,
    name: isMatch ? fullName : 'Unknown',
    similarity,
    confidence,
    livenessScore: liveness0to1,
    liveness: parsedLivenessScore !== null
      ? {
          score: parsedLivenessScore,
          isLive: isLive === true,
        }
      : null,
    isLive: isLive === true,
    spoofType: topMatch?.spoof_type || null,
    faces_detected: data.faces_detected || (data.faces ? data.faces.length : 0),
    facesDetected: data.faces_detected || (data.faces ? data.faces.length : 0),
    timingMs: data.inference_time_ms || 0,
    matches: isMatch
      ? [
          {
            name: fullName,
            fullName,
            employeeCode: employeeCode || '',
            employeeId: employeeCode || '',
            confidence,
            similarity,
          },
        ]
      : [],
    top_match: topMatch
      ? {
          ...topMatch,
          name: fullName,
          fullName,
          employeeCode: employeeCode || '',
          employeeId: employeeCode || '',
        }
      : null,
  };
}

/**
 * Chuẩn hóa request đăng ký khuôn mặt: chuyển sang AIAttendanceWeb3 FaceEnrollRequest
 */
export function adaptFaceEnrollRequest(body = {}, user = null) {
  const employeeCode = (
    body.employeeCode ||
    body.employeeId ||
    user?.employeeCode ||
    ''
  ).trim();

  const rawImages = Array.isArray(body.images) ? body.images : [];
  const cleanImages = rawImages
    .map(extractCleanBase64)
    .filter((img) => img.length > 0);

  return {
    employeeCode,
    images: cleanImages,
    // Cho legacy api_server.py
    legacyPayload: {
      name: body.name || user?.fullName || employeeCode,
      employeeId: employeeCode,
      department: body.department || user?.department || 'General',
      email: body.email || user?.email || '',
      images: rawImages,
    },
  };
}

/**
 * Chuẩn hóa kết quả NLU từ AIAttendanceWeb3 (POST /api/v1/nlu/query)
 */
export function adaptNluQueryResponse(data, originalMessage = '') {
  const intent = data?.intent || 'unknown';
  // AIAttendanceWeb3 trả về intentConfidence, legacy có thể trả về confidence
  const intentConfidence = typeof data?.intentConfidence === 'number'
    ? data.intentConfidence
    : (typeof data?.confidence === 'number' ? data.confidence : 0.0);

  const slots = data?.slots || {};
  const modelVersion = data?.modelVersion || 'phobert-intent-v14';

  let confidencePct = (intentConfidence * 100).toFixed(1);
  let fallbackAnswer = `[AI PhoBERT] Dự đoán ý định: ${intent} (Độ tin cậy: ${confidencePct}%).`;

  if (intent === 'greeting') {
    fallbackAnswer = `Xin chào bạn! (${confidencePct}%). Mình là Trợ lý ảo AI của hệ thống chấm công. Bạn cần hỗ trợ gì hôm nay?`;
  } else if (intent === 'my_leave_status') {
    fallbackAnswer = `[AI PhoBERT: ${confidencePct}%] Bạn có thể xem chi tiết số ngày phép còn lại tại tab "Đơn Nghỉ Phép" ở Cổng nhân viên nhé!`;
  } else if (intent === 'check_attendance_status') {
    fallbackAnswer = `[AI PhoBERT: ${confidencePct}%] Bạn có thể theo dõi chi tiết giờ vào/ra tại tab "Bảng Chấm Công" bên cạnh.`;
  } else if (intent === 'ask_company_policy') {
    fallbackAnswer = `[AI PhoBERT: ${confidencePct}%] Quy định công ty: Giờ vào ca sáng là 08:00, ân hạn 5 phút. Vui lòng chấm công đúng giờ tại máy Kiosk!`;
  }

  return {
    success: true,
    intent,
    intentConfidence,
    confidence: intentConfidence, // Backward-compatible field
    slots,
    modelVersion,
    answer: fallbackAnswer,
  };
}
