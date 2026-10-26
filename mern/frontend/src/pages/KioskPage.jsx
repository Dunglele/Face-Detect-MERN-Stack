import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  VideoOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  UserCheck,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { calculateKioskCrop, drawOvalCroppedFrame } from '../utils/kioskCrop';

const FACE_HOLD_MS = 3000;
const SUCCESS_DISPLAY_MS = 5000;
const PROMPT_TIMEOUT_MS = 5000;

export default function KioskPage() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [checkType, setCheckType] = useState('Check-in'); // 'Check-in' | 'Check-out'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [freezeCard, setFreezeCard] = useState(null);
  const [attendanceError, setAttendanceError] = useState('');

  // AI Service & System Health Status: checking | ok | error
  const [aiServiceStatus, setAiServiceStatus] = useState({
    state: 'checking',
    reason: 'Đang kiểm tra kết nối hệ thống AI...',
  });

  // Prompt hỏi xác nhận check-out khi gặp ALREADY_CHECKED_IN
  const [checkoutPrompt, setCheckoutPrompt] = useState(null);
  const [promptRemainingSec, setPromptRemainingSec] = useState(5);

  // Logs of today's check-ins on this Kiosk
  const [recentLogs, setRecentLogs] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const reticleRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const scanInFlightRef = useRef(false);
  const errorTimeoutRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const freezeTimeoutRef = useRef(null);
  const checkoutPromptTimeoutRef = useRef(null);
  const checkoutPromptCountdownRef = useRef(null);

  // Hold stability state ref: tracks the currently holding identity and start timestamp
  const faceHoldRef = useRef({
    identityKey: null,
    startTime: 0,
    lastSeenTime: 0,
  });

  function resetFaceHold() {
    faceHoldRef.current = {
      identityKey: null,
      startTime: 0,
      lastSeenTime: 0,
    };
  }

  function clearPromptTimers() {
    if (checkoutPromptTimeoutRef.current) {
      clearTimeout(checkoutPromptTimeoutRef.current);
      checkoutPromptTimeoutRef.current = null;
    }
    if (checkoutPromptCountdownRef.current) {
      clearInterval(checkoutPromptCountdownRef.current);
      checkoutPromptCountdownRef.current = null;
    }
  }

  // Helper định dạng giờ & ngày theo Asia/Ho_Chi_Minh & vi-VN
  function formatKioskTime(isoStringOrDate) {
    if (!isoStringOrDate) return '';
    try {
      const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return '';
    }
  }

  function formatKioskDate(isoStringOrDateOrYmd) {
    if (!isoStringOrDateOrYmd) return '';
    try {
      if (typeof isoStringOrDateOrYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoStringOrDateOrYmd)) {
        const [year, month, day] = isoStringOrDateOrYmd.split('-');
        return `${day}/${month}/${year}`;
      }
      const d = typeof isoStringOrDateOrYmd === 'string' ? new Date(isoStringOrDateOrYmd) : isoStringOrDateOrYmd;
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return '';
    }
  }

  function formatWorkedDuration(workedMinutes) {
    if (typeof workedMinutes !== 'number' || isNaN(workedMinutes) || workedMinutes < 0) return null;
    const hours = Math.floor(workedMinutes / 60);
    const mins = workedMinutes % 60;
    if (hours > 0) {
      return `${hours} giờ ${mins} phút`;
    }
    return `${mins} phút`;
  }

  function showKioskError(msg, durationMs = 3500) {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setAttendanceError(msg);
    pauseUntilRef.current = Date.now() + durationMs;
    errorTimeoutRef.current = setTimeout(() => {
      setAttendanceError('');
    }, durationMs);
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
      clearPromptTimers();
    };
  }, []);

  // Reset face hold & currentMatch khi checkType thay đổi
  useEffect(() => {
    resetFaceHold();
    setCurrentMatch(null);
  }, [checkType]);

  // Poll GET /api/ai/status khi mount & camera active mỗi 12 giây, cleanup
  useEffect(() => {
    let isCancelled = false;

    async function checkAiHealth() {
      try {
        const res = await fetch('/api/ai/status');
        if (!res.ok) {
          if (!isCancelled) {
            setAiServiceStatus({
              state: 'error',
              reason: `Máy chủ AI trả về mã lỗi HTTP ${res.status}`,
            });
          }
          return;
        }
        const data = await res.json();
        if (!isCancelled) {
          if (data && data.ai_online) {
            setAiServiceStatus({
              state: 'ok',
              reason: data.service_type || 'Face AI Engine hoạt động bình thường',
            });
          } else {
            setAiServiceStatus({
              state: 'error',
              reason: data?.message || 'Local Face AI engine chưa sẵn sàng',
            });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setAiServiceStatus({
            state: 'error',
            reason: `Không thể kết nối đến máy chủ AI: ${err.message || 'Mất kết nối'}`,
          });
        }
      }
    }

    checkAiHealth();
    const interval = setInterval(checkAiHealth, 12000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Play pleasant chime on check-in
  function playSuccessChime() {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  }

  // Load recent logs from API
  async function loadRecentLogs() {
    try {
      const res = await fetch('/api/attendance');
      const data = await res.json();
      if (data.success && data.data) {
        setRecentLogs(data.data.slice(0, 10));
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadRecentLogs();
  }, []);

  // Camera start / stop
  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      setCameraError('Không thể mở webcam: ' + err.message);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setIsCameraActive(false);
    setCurrentMatch(null);
    resetFaceHold();
  }

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Frame scanner loop (tạm dừng khi modal prompt mở, freezeCard, submitting, hoặc pause)
  useEffect(() => {
    if (!isCameraActive) return;

    scanIntervalRef.current = setInterval(() => {
      if (checkoutPrompt || freezeCard || isSubmittingRef.current || scanInFlightRef.current || Date.now() < pauseUntilRef.current) return;
      captureAndRecognize();
    }, 800);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isCameraActive, freezeCard, checkoutPrompt, checkType]);

  async function captureAndRecognize() {
    if (!videoRef.current || !canvasRef.current || !reticleRef.current || videoRef.current.readyState < 2) return;
    if (checkoutPrompt || isSubmittingRef.current || scanInFlightRef.current || freezeCard || Date.now() < pauseUntilRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const reticle = reticleRef.current;

    const videoRect = video.getBoundingClientRect();
    const reticleRect = reticle.getBoundingClientRect();

    const crop = calculateKioskCrop({
      videoRect,
      reticleRect,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });

    // Nếu rect/crop không hợp lệ thì bỏ frame im lặng
    if (!crop) return;

    const drawn = drawOvalCroppedFrame(video, canvas, crop, 480);
    if (!drawn) return;

    const base64Image = canvas.toDataURL('image/jpeg', 0.85);

    try {
      scanInFlightRef.current = true;
      setIsScanning(true);
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, auto_checkin: false }),
      });

      if (!res.ok) {
        resetFaceHold();
        setAiServiceStatus({
          state: 'error',
          reason: `Dịch vụ AI phản hồi lỗi HTTP ${res.status}`,
        });
        showKioskError('Dịch vụ nhận diện khuôn mặt tạm thời gián đoạn. Vui lòng thử lại sau.');
        return;
      }

      const result = await res.json();

      // Predict thành công kể cả không khớp: cập nhật AI status ok
      setAiServiceStatus((prev) => ({
        state: 'ok',
        reason: prev.state === 'ok' ? prev.reason : 'Face AI Engine hoạt động bình thường',
      }));

      // Kiểm tra có phát hiện khuôn mặt không
      const hasFace = result.faces_detected !== undefined
        ? Boolean(result.faces_detected)
        : (result.facesDetected !== undefined
          ? Boolean(result.facesDetected)
          : (result.face_detected !== undefined
            ? Boolean(result.face_detected)
            : (Array.isArray(result.faces)
              ? result.faces.length > 0
              : (result.faces_count !== undefined ? result.faces_count > 0 : true))));

      // 1) Khi ảnh crop không có khuôn mặt: chỉ setCurrentMatch(null) và tiếp tục quét im lặng, reset hold
      if (!hasFace) {
        resetFaceHold();
        setCurrentMatch(null);
        return;
      }

      const isMatched = Boolean(result.matched || (result.top_match && result.top_match.is_match));

      if (isMatched) {
        const top = (result.matches && result.matches.length > 0) ? result.matches[0] : (result.top_match || {});
        const fullName = result.fullName || result.userName || top.fullName || top.name || result.employeeCode || 'Nhân viên';
        const empCode = result.employeeCode || top.employeeCode || top.employeeId || '';

        // Đọc confidence/similarity thực tế từ server
        let confidenceVal = null;
        if (typeof result.confidence === 'number' && !isNaN(result.confidence)) {
          confidenceVal = result.confidence;
        } else if (typeof result.similarity === 'number' && !isNaN(result.similarity)) {
          confidenceVal = +(result.similarity * 100).toFixed(1);
        } else if (typeof top.confidence === 'number' && !isNaN(top.confidence)) {
          confidenceVal = top.confidence;
        }

        // Đọc livenessScore thực tế
        let liveScore = null;
        let isLive = false;

        if (typeof result.livenessScore === 'number' && !isNaN(result.livenessScore)) {
          liveScore = result.livenessScore <= 1.0 ? +(result.livenessScore * 100).toFixed(1) : +result.livenessScore.toFixed(1);
        } else if (result.liveness && typeof result.liveness.score === 'number') {
          liveScore = +result.liveness.score.toFixed(1);
        } else if (top && typeof top.liveness_score === 'number') {
          liveScore = +top.liveness_score.toFixed(1);
        }

        if (liveScore !== null) {
          const passThreshold = liveScore >= 65;
          const notSpoof = result.spoofType !== 'spoof' && top.spoof_type !== 'spoof';
          isLive = passThreshold && notSpoof;
        }

        // Kiểm tra điều kiện xác minh: liveness và verificationToken
        if (!isLive) {
          resetFaceHold();
          setCurrentMatch(null);
          showKioskError('Xác thực người thật chưa đạt yêu cầu. Vui lòng không che mặt và thử lại.');
          return;
        }

        if (!result.verificationToken) {
          resetFaceHold();
          setCurrentMatch(null);
          showKioskError('Chưa đủ điều kiện xác minh nhân viên hoặc khuôn mặt');
          return;
        }

        // Theo dõi cùng một identity bằng employeeCode (fallback fullName chỉ nếu code trống)
        const identityKey = (empCode && empCode.trim()) ? empCode.trim() : (fullName || '').trim();
        const now = Date.now();

        let elapsed = 0;
        if (faceHoldRef.current.identityKey === identityKey && faceHoldRef.current.startTime > 0) {
          elapsed = now - faceHoldRef.current.startTime;
          faceHoldRef.current.lastSeenTime = now;
        } else {
          // Lần match hợp lệ đầu tiên bắt đầu tính thời gian
          faceHoldRef.current = {
            identityKey,
            startTime: now,
            lastSeenTime: now,
          };
          elapsed = 0;
        }

        const holdProgress = Math.min(100, Math.round((elapsed / FACE_HOLD_MS) * 100));

        setCurrentMatch({
          name: fullName,
          employeeCode: empCode,
          confidence: confidenceVal,
          livenessScore: liveScore,
          isLive: true,
          elapsedHoldMs: elapsed,
          holdProgress,
        });

        // Chỉ khi cùng identity tiếp tục match và elapsed >= FACE_HOLD_MS (3000ms) mới gọi submitAttendance
        if (elapsed >= FACE_HOLD_MS) {
          resetFaceHold();
          submitAttendance({
            name: fullName,
            employeeCode: empCode,
            confidence: confidenceVal,
            livenessScore: liveScore,
            snapshotUrl: base64Image,
            verificationToken: result.verificationToken,
            actionType: checkType,
          });
        }
      } else {
        // Có khuôn mặt nhưng không khớp danh tính: im lặng quét tiếp, reset hold
        resetFaceHold();
        setCurrentMatch(null);
      }
    } catch (err) {
      resetFaceHold();
      setAiServiceStatus({
        state: 'error',
        reason: `Mất kết nối máy chủ nhận diện: ${err.message || 'Lỗi mạng'}`,
      });
      showKioskError('Không thể kết nối máy chủ nhận diện. Vui lòng kiểm tra mạng hoặc thử lại.');
    } finally {
      setIsScanning(false);
      scanInFlightRef.current = false;
    }
  }

  // Quản lý timeout 5000ms và countdown cho checkoutPrompt
  useEffect(() => {
    if (!checkoutPrompt) {
      clearPromptTimers();
      return;
    }

    setPromptRemainingSec(5);
    const startTs = Date.now();

    checkoutPromptCountdownRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTs) / 1000);
      const remain = Math.max(0, 5 - elapsedSec);
      setPromptRemainingSec(remain);
    }, 250);

    checkoutPromptTimeoutRef.current = setTimeout(() => {
      handleCancelCheckoutPrompt();
    }, PROMPT_TIMEOUT_MS);

    return () => {
      clearPromptTimers();
    };
  }, [checkoutPrompt]);

  // Refactored Submit Attendance với actionType tường minh
  async function submitAttendance({
    name,
    employeeCode,
    confidence,
    livenessScore,
    snapshotUrl,
    verificationToken,
    actionType,
  }) {
    if (isSubmittingRef.current || freezeCard) return;

    if (!verificationToken) {
      resetFaceHold();
      showKioskError('Chưa đủ điều kiện xác minh nhân viên hoặc khuôn mặt');
      return;
    }

    isSubmittingRef.current = true;
    setAttendanceError('');

    const targetActionType = actionType || checkType;

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: name,
          employeeCode,
          confidence,
          livenessScore: typeof livenessScore === 'number' ? livenessScore / 100 : null,
          checkInType: targetActionType,
          snapshotUrl,
          verificationToken,
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // Xử lý ALREADY_CHECKED_IN khi POST Check-in: Mở modal hỏi check-out, không showKioskError
      if (res.status === 409 && data.code === 'ALREADY_CHECKED_IN') {
        isSubmittingRef.current = false;
        resetFaceHold();
        setCheckoutPrompt({
          pendingContext: {
            name,
            employeeCode,
            confidence,
            livenessScore,
            snapshotUrl,
            verificationToken,
          },
          checkInAt: data.data?.checkInAt,
          workDate: data.data?.workDate,
          lateMinutes: data.data?.lateMinutes ?? 0,
        });
        return;
      }

      // Xử lý ATTENDANCE_COMPLETED hoặc ALREADY_CHECKED_OUT: Hiện thông báo caution rõ ràng, không prompt
      if (res.status === 409 && (data.code === 'ATTENDANCE_COMPLETED' || data.code === 'ALREADY_CHECKED_OUT')) {
        isSubmittingRef.current = false;
        resetFaceHold();
        setCurrentMatch(null);
        const warningMsg = data.code === 'ATTENDANCE_COMPLETED'
          ? (data.message || `Nhân viên '${name}' đã hoàn thành chấm công trong ngày.`)
          : (data.message || `Nhân viên '${name}' đã hoàn tất Check-out cho ngày hôm nay.`);
        showKioskError(warningMsg, 4000);
        return;
      }

      if (res.ok && data.success) {
        // Check-in thành công 201 hoặc Check-out thành công 200
        const serverTimestamp = targetActionType === 'Check-out' ? data.checkOutAt : data.checkInAt;
        const serverWorkDate = data.workDate;
        const serverLateMinutes = data.lateMinutes;
        const serverWorkedMinutes = data.workedMinutes;
        const serverStatus = data.status;

        const checkTimeFormatted = formatKioskTime(serverTimestamp || new Date());
        const workDateFormatted = formatKioskDate(serverWorkDate || new Date());

        setFreezeCard({
          name: data.userName || name,
          employeeCode: data.employeeCode || employeeCode,
          confidence,
          checkTime: checkTimeFormatted,
          workDate: workDateFormatted,
          type: targetActionType,
          snapshotUrl,
          lateMinutes: serverLateMinutes,
          workedMinutes: serverWorkedMinutes,
          status: serverStatus,
        });

        playSuccessChime();
        loadRecentLogs();

        // Tự động mở lại sau 5000ms để nhân viên tiếp theo vào chấm công
        if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
        freezeTimeoutRef.current = setTimeout(() => {
          setFreezeCard(null);
          setCurrentMatch(null);
          resetFaceHold();
          isSubmittingRef.current = false;
        }, SUCCESS_DISPLAY_MS);
      } else {
        const errorMsg = data.message || (data.code ? `Lỗi hệ thống (${data.code})` : `Điểm danh thất bại (HTTP ${res.status}). Vui lòng quét lại.`);
        isSubmittingRef.current = false;
        resetFaceHold();
        showKioskError(errorMsg, 4000);
      }
    } catch (e) {
      console.error(e);
      isSubmittingRef.current = false;
      resetFaceHold();
      showKioskError('Lỗi kết nối mạng: Không thể gửi dữ liệu điểm danh. Vui lòng thử lại.', 4000);
    }
  }

  // Xử lý nút "Check-out ngay" trong Modal prompt
  function handleConfirmCheckoutNow() {
    clearPromptTimers();
    if (!checkoutPrompt) return;
    const { pendingContext } = checkoutPrompt;
    setCheckoutPrompt(null);
    resetFaceHold();
    submitAttendance({
      ...pendingContext,
      actionType: 'Check-out',
    });
  }

  // Xử lý nút "Không" hoặc timeout trong Modal prompt
  function handleCancelCheckoutPrompt() {
    clearPromptTimers();
    setCheckoutPrompt(null);
    setCurrentMatch(null);
    resetFaceHold();
    isSubmittingRef.current = false;
    pauseUntilRef.current = Date.now() + 3000;
  }

  // Xác định nhãn & màu trạng thái hệ thống camera/AI
  function getCameraStatusInfo() {
    if (!isCameraActive || cameraError) {
      return {
        label: 'Hệ thống gặp lỗi',
        dotColor: '#ef4444',
        reason: cameraError || 'Camera chưa được kích hoạt hoặc không thể truy cập.',
      };
    }
    if (aiServiceStatus.state === 'error') {
      return {
        label: 'Hệ thống gặp lỗi',
        dotColor: '#ef4444',
        reason: aiServiceStatus.reason,
      };
    }
    if (aiServiceStatus.state === 'checking') {
      return {
        label: 'Đang kiểm tra hệ thống',
        dotColor: '#f59e0b',
        reason: aiServiceStatus.reason,
      };
    }
    if (isScanning) {
      return {
        label: 'Đang nhận diện...',
        dotColor: '#38bdf8',
        reason: 'Đang xử lý hình ảnh qua Face AI Verification Engine',
      };
    }
    return {
      label: 'Hệ thống hoạt động tốt',
      dotColor: '#22c55e',
      reason: aiServiceStatus.reason || 'Camera & AI Service sẵn sàng',
    };
  }

  const cameraStatus = getCameraStatusInfo();

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
      {/* Kiosk Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.03em' }}>
              Máy Chấm Công & Điểm Danh Sinh Trắc Học
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '20px',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                border: '1px solid #bbf7d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
              Kiosk Station Active
            </span>
          </div>
          <p style={{ color: '#6e7180', fontSize: '0.875rem', marginTop: '4px' }}>
            Tự động nhận diện khuôn mặt qua YOLOv11 + dlib ResNet và xác thực chống giả mạo MiniFASNet.
          </p>
        </div>

        {/* Kiosk Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mode Switch: Check-in / Check-out */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f4f4f5',
              padding: '3px',
              borderRadius: '30px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <button
              onClick={() => setCheckType('Check-in')}
              style={{
                padding: '6px 16px',
                borderRadius: '24px',
                border: 'none',
                backgroundColor: checkType === 'Check-in' ? '#1a1a1a' : 'transparent',
                color: checkType === 'Check-in' ? '#ffffff' : '#52525b',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Vào ca (Check-in)
            </button>
            <button
              onClick={() => setCheckType('Check-out')}
              style={{
                padding: '6px 16px',
                borderRadius: '24px',
                border: 'none',
                backgroundColor: checkType === 'Check-out' ? '#1a1a1a' : 'transparent',
                color: checkType === 'Check-out' ? '#ffffff' : '#52525b',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Ra ca (Check-out)
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '8px 12px',
              borderRadius: '24px',
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#ffffff',
              color: soundEnabled ? '#1a1a1a' : '#a1a1aa',
              cursor: 'pointer',
            }}
            title={soundEnabled ? 'Bật âm báo' : 'Tắt âm báo'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {cameraError && (
        <div style={{ padding: '14px', borderRadius: '16px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', marginBottom: '20px' }}>
          {cameraError}
        </div>
      )}

      {attendanceError && (
        <div style={{ padding: '14px 18px', borderRadius: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', fontWeight: 600 }}>
          <AlertTriangle size={20} />
          <span>{attendanceError}</span>
        </div>
      )}

      {/* Main Kiosk Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '24px', alignItems: 'start' }}>
        {/* Left: Interactive Camera Viewfinder */}
        <div
          style={{
            position: 'relative',
            borderRadius: '28px',
            backgroundColor: '#000000',
            overflow: 'hidden',
            aspectRatio: '16 / 10',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Mirrored Webcam Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirrored effect
              filter: freezeCard ? 'brightness(0.85) blur(1px)' : 'none',
              transition: 'filter 0.3s ease',
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scanning Reticle & Face Guide Overlay */}
          <div
            ref={reticleRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '260px',
              height: '320px',
              border: '2px dashed rgba(255, 255, 255, 0.4)',
              borderRadius: '130px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
            }}
          />

          {/* Top Status Indicators inside Camera */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              right: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <div
              title={cameraStatus.reason}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                pointerEvents: 'auto',
                cursor: 'help',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: cameraStatus.dotColor,
                  display: 'inline-block',
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${cameraStatus.dotColor}`,
                }}
              />
              <span>{cameraStatus.label}</span>
            </div>

            <div
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Chế độ: <strong>{checkType}</strong>
            </div>
          </div>

          {/* Modal / Overlay xác nhận Check-out khi gặp ALREADY_CHECKED_IN */}
          {checkoutPrompt && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.82)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px',
                animation: 'fadeIn 0.2s ease',
                textAlign: 'center',
                zIndex: 20,
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  boxShadow: '0 0 20px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Clock size={34} strokeWidth={2.2} />
              </div>

              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Xác nhận chuyển lượt chấm công
              </div>

              <h3 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#ffffff', margin: '8px 0 6px' }}>
                {checkoutPrompt.pendingContext.name}
              </h3>

              {checkoutPrompt.pendingContext.employeeCode && (
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#bfdbfe', marginBottom: '14px' }}>
                  Mã NV: {checkoutPrompt.pendingContext.employeeCode}
                </div>
              )}

              <p style={{ fontSize: '0.9375rem', color: '#e2e8f0', maxWidth: '380px', lineHeight: '1.5', margin: '0 0 20px' }}>
                Bạn đã check-in lúc <strong>{formatKioskTime(checkoutPrompt.checkInAt) || 'trước đó'}</strong> ngày <strong>{formatKioskDate(checkoutPrompt.workDate || checkoutPrompt.checkInAt)}</strong>.
                <br />
                Bạn có muốn <strong>Check-out</strong> không?
              </p>

              <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '340px' }}>
                <button
                  onClick={handleConfirmCheckoutNow}
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Check-out ngay
                </button>
                <button
                  onClick={handleCancelCheckoutPrompt}
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Không
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: '14px', opacity: 0.9 }}>
                Tự đóng sau {promptRemainingSec} giây...
              </div>
            </div>
          )}

          {/* Live Recognition Banner at bottom of camera */}
          {currentMatch && !freezeCard && !checkoutPrompt && (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                right: '24px',
                padding: '16px 20px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(12px)',
                color: '#1a1a1a',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                animation: 'fadeInUp 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Đang xác minh danh tính...</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6e7180', marginTop: '2px' }}>
                    Độ khớp: <strong>{typeof currentMatch.confidence === 'number' ? `${currentMatch.confidence.toFixed(1)}%` : '--'}</strong> &bull; Liveness: <strong>{typeof currentMatch.livenessScore === 'number' ? `${currentMatch.livenessScore.toFixed(1)}%` : 'Chưa kiểm tra'}</strong>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: currentMatch.isLive ? '#15803d' : (currentMatch.livenessScore !== null ? '#b91c1c' : '#d97706'),
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  {currentMatch.isLive ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                  <span>{currentMatch.isLive ? 'Người thật' : (currentMatch.livenessScore !== null ? 'Nghi vấn giả mạo' : 'Chờ xác thực độ sống')}</span>
                </div>
              </div>

              {/* Progress bar and hold timer */}
              {currentMatch.isLive && (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: '#4b5563', fontWeight: 600 }}>
                      Giữ khuôn mặt ổn định: {(Math.min(FACE_HOLD_MS, currentMatch.elapsedHoldMs || 0) / 1000).toFixed(1)} / 3.0 giây
                    </span>
                    <span style={{ color: currentMatch.holdProgress >= 100 ? '#16a34a' : '#2563eb', fontWeight: 700 }}>
                      {currentMatch.holdProgress || 0}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${currentMatch.holdProgress || 0}%`,
                        backgroundColor: currentMatch.holdProgress >= 100 ? '#16a34a' : '#2563eb',
                        borderRadius: '3px',
                        transition: 'width 0.2s ease-out',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FULL SCREEN FREEZE SUCCESS OVERLAY */}
          {freezeCard && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                animation: 'fadeIn 0.25s ease',
                textAlign: 'center',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  boxShadow: '0 0 24px rgba(22, 163, 74, 0.25)',
                }}
              >
                <CheckCircle2 size={42} strokeWidth={2.4} />
              </div>

              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Xác thực danh tính thành công
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', margin: '6px 0 2px' }}>
                {freezeCard.name}
              </h2>
              {freezeCard.employeeCode && (
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#4f46e5', marginBottom: '14px' }}>
                  Mã nhân viên: {freezeCard.employeeCode}
                </div>
              )}

              <div
                style={{
                  padding: '12px 24px',
                  borderRadius: '24px',
                  backgroundColor: '#f4f4f5',
                  fontSize: '0.9375rem',
                  color: '#27272a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center',
                  maxWidth: '460px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span>
                    <strong>{freezeCard.type === 'Check-out' ? 'Check-out lúc' : 'Check-in lúc'}</strong> {freezeCard.checkTime}
                  </span>
                  <span>&bull;</span>
                  <span>
                    <strong>Ngày</strong> {freezeCard.workDate}
                  </span>
                </div>

                {/* Badge trạng thái Check-in (Đúng giờ / Đi trễ) */}
                {freezeCard.type === 'Check-in' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    {typeof freezeCard.lateMinutes === 'number' && freezeCard.lateMinutes > 0 ? (
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          padding: '3px 12px',
                          borderRadius: '12px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                        }}
                      >
                        Đi trễ {freezeCard.lateMinutes} phút
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          padding: '3px 12px',
                          borderRadius: '12px',
                          backgroundColor: '#f0fdf4',
                          color: '#16a34a',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        Đúng giờ
                      </span>
                    )}
                  </div>
                )}

                {/* Tổng thời gian làm việc khi Check-out */}
                {freezeCard.type === 'Check-out' && typeof freezeCard.workedMinutes === 'number' && (
                  <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '2px' }}>
                    Thời gian làm việc: <strong style={{ color: '#1a1a1a' }}>{formatWorkedDuration(freezeCard.workedMinutes)}</strong>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.8125rem', color: '#9295a3', marginTop: '20px' }}>
                Hệ thống tự động sẵn sàng cho lượt chấm công tiếp theo...
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent Kiosk Logs & Guide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Instructions Box */}
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#fcfcfc',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px' }}>
              Hướng dẫn chấm công nhanh:
            </h3>
            <ul style={{ fontSize: '0.8125rem', color: '#6e7180', lineHeight: '1.7', paddingLeft: '18px' }}>
              <li>Đứng thẳng, giữ khuôn mặt ở trung tâm khung tròn.</li>
              <li>Không đeo khẩu trang hoặc kính râm tối màu.</li>
              <li>Giữ khuôn mặt ổn định tối thiểu 3 giây để máy tự động chốt điểm danh.</li>
              <li>Dữ liệu sẽ đồng bộ ngay lập tức vào MongoDB và Merkle Root Web3.</li>
            </ul>
          </div>

          {/* Today's Kiosk Activity Feed */}
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1a1a1a' }}>
                Lượt điểm danh gần nhất
              </div>
              <button
                onClick={loadRecentLogs}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#6e7180',
                  cursor: 'pointer',
                }}
                title="Tải lại"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
              {recentLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9295a3', fontSize: '0.8125rem' }}>
                  Chưa có lượt điểm danh nào hôm nay.
                </div>
              ) : (
                recentLogs.map((log) => {
                  const isCheckIn = (log.checkInType || 'Check-in') === 'Check-in';
                  const timeStr = formatKioskTime(log.timestamp);
                  const dateStr = formatKioskDate(log.workDate || log.timestamp);
                  const timeDateDisplay = [timeStr, dateStr].filter(Boolean).join(' • ') || 'Vừa xong';
                  const lateMins = typeof log.lateMinutes === 'number' ? log.lateMinutes : 0;

                  return (
                    <div
                      key={log._id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '16px',
                        backgroundColor: '#fcfcfc',
                        border: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.userName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9295a3', marginTop: '2px' }}>
                          {log.employeeCode ? `${log.employeeCode} • ` : ''}
                          {timeDateDisplay}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isCheckIn && (
                          lateMins > 0 ? (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: '10px',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                              }}
                            >
                              Trễ {lateMins} phút
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: '10px',
                                backgroundColor: '#f0fdf4',
                                color: '#16a34a',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              Đúng giờ
                            </span>
                          )
                        )}

                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: isCheckIn ? '#f0fdf4' : '#eff6ff',
                            color: isCheckIn ? '#15803d' : '#1d4ed8',
                          }}
                        >
                          {log.checkInType || 'Check-in'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
