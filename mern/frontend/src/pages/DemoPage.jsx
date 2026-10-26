import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  VideoOff,
  Upload,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Cpu,
  RefreshCw,
  RotateCcw,
  Activity,
  Database,
  Lock,
} from 'lucide-react';

const API_BASE = '/api';

export default function DemoPage() {
  const [activeMode, setActiveMode] = useState('webcam'); // 'webcam' | 'upload' | 'enroll'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Real Python AI Server Status
  const [aiServerOnline, setAiServerOnline] = useState(false);
  const [aiServerInfo, setAiServerInfo] = useState(null);

  // Results state
  const [detectionResult, setDetectionResult] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [toleranceVal, setToleranceVal] = useState(0.50);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // URL query params auto-filling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'upload') {
      setActiveMode('upload');
    }
  }, []);

  // Check Python AI Service Health via backend proxy
  const checkAiHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/status`).catch(() => null);
      if (res && res.ok) {
        const proxyData = await res.json();
        if (proxyData.success && proxyData.ai_online) {
          setAiServerOnline(true);
          setAiServerInfo(proxyData.data);
          return;
        }
      }
      setAiServerOnline(false);
    } catch {
      setAiServerOnline(false);
    }
  };

  useEffect(() => {
    checkAiHealth();
    const interval = setInterval(checkAiHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async () => {
    setCameraError('');
    setNoticeMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED_OR_INSECURE');
      }

      // Ưu tiên camera trước (facingMode: 'user') cho điện thoại và hỗ trợ fallback
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr) {
        // Fallback linh hoạt cho các thiết bị di động không hỗ trợ constraints độ phân giải
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      // Scan initially after camera warms up
      setTimeout(() => {
        if (activeMode === 'webcam') {
          captureAndRecognizeFace();
        }
      }, 1000);
    } catch (err) {
      console.error('Camera error:', err);
      if (!window.isSecureContext || err.message === 'NOT_SUPPORTED_OR_INSECURE') {
        setCameraError(
          'Trình duyệt điện thoại yêu cầu kết nối HTTPS để mở Camera. Vui lòng mở bằng đường dẫn https://... (thay vì http://).'
        );
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          'Quyền truy cập Camera bị từ chối! Vui lòng vào Cài đặt trình duyệt trên điện thoại (hoặc bấm vào icon ổ khóa/cài đặt cạnh thanh địa chỉ) để Cho phép truy cập Camera.'
        );
      } else {
        setCameraError(
          `Không thể mở Camera (${err.message || err.name}). Nếu đang mở qua Zalo/Messenger, hãy bấm dấu 3 chấm và chọn "Mở bằng trình duyệt" (Safari/Chrome).`
        );
      }
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
    setDetectionResult(null);
  };

  const handleResetAnalysis = () => {
    setDetectionResult(null);
    setNoticeMessage('');
    setSaveSuccess('');
  };

  const handleModeChange = (mode) => {
    if (mode !== 'webcam' && isCameraActive) {
      stopCamera();
    }
    setActiveMode(mode);
    setDetectionResult(null);
    setNoticeMessage('');
    setSaveSuccess('');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture real frame from <video> element and send to Python AI (YOLOv11 + dlib ResNet)
  const captureAndRecognizeFace = async () => {
    if (!videoRef.current || !isCameraActive) return;

    setIsScanning(true);
    setNoticeMessage('');
    setSaveSuccess('');
    setAttendanceError('');

    try {
      // Create off-screen canvas to capture current video frame
      const canvas = document.createElement('canvas');
      const vWidth = videoRef.current.videoWidth || 640;
      const vHeight = videoRef.current.videoHeight || 480;
      canvas.width = vWidth;
      canvas.height = vHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);

      // Convert to JPEG Data URL
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);

      // Send to real Python AI Server via Backend Proxy
      const targetUrl = `${API_BASE}/ai/predict`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          auto_checkin: false
        })
      });

      if (!res.ok) {
        throw new Error(`AI Server status ${res.status}`);
      }

      const aiData = await res.json();
      const hasFaces = Boolean(aiData.success && (aiData.faces_detected > 0 || aiData.facesDetected > 0 || aiData.matched));

      if (hasFaces) {
        const topFace = aiData.top_match || (aiData.faces && aiData.faces[0]) || {};
        const isMatch = Boolean(aiData.matched || topFace.is_match);
        const fullName = aiData.fullName || aiData.userName || topFace.fullName || topFace.name || aiData.employeeCode || 'Unknown';
        const empCode = aiData.employeeCode || topFace.employeeCode || topFace.employeeId || (isMatch ? fullName : 'N/A');

        const confidenceVal = typeof aiData.confidence === 'number'
          ? aiData.confidence
          : (typeof aiData.similarity === 'number' ? +(aiData.similarity * 100).toFixed(1) : (typeof topFace.confidence === 'number' ? topFace.confidence : 0));

        let liveScore = null;
        let isReal = null;
        let livenessStatus = 'UNKNOWN';

        if (typeof aiData.livenessScore === 'number' && !isNaN(aiData.livenessScore)) {
          liveScore = aiData.livenessScore <= 1.0 ? +(aiData.livenessScore * 100).toFixed(1) : +aiData.livenessScore.toFixed(1);
        } else if (aiData.liveness && typeof aiData.liveness.score === 'number') {
          liveScore = +aiData.liveness.score.toFixed(1);
        } else if (typeof topFace.liveness_score === 'number') {
          liveScore = +topFace.liveness_score.toFixed(1);
        }

        if (liveScore !== null) {
          const passThreshold = liveScore >= 65;
          const notSpoof = aiData.spoofType !== 'spoof' && topFace.spoof_type !== 'spoof';
          isReal = passThreshold && notSpoof;
          livenessStatus = isReal ? 'REAL' : 'FAKE';
        }

        const rawBbox = topFace.relative_bbox || topFace.bbox || null;
        let faceBox = null;
        if (rawBbox && typeof rawBbox.top === 'number' && typeof rawBbox.width === 'number') {
          const displayLeft = rawBbox.mirrored_left !== undefined
            ? rawBbox.mirrored_left
            : (100.0 - (rawBbox.left || 0) - (rawBbox.width || 0)).toFixed(2);
          faceBox = {
            top: `${rawBbox.top}%`,
            left: `${displayLeft}%`,
            width: `${rawBbox.width}%`,
            height: `${rawBbox.height}%`,
          };
        }

        setDetectionResult({
          name: fullName,
          confidence: confidenceVal,
          isReal,
          livenessScore: liveScore,
          livenessStatus,
          spoofType: aiData.spoofType || topFace.spoof_type || null,
          faceBox,
          inferenceTime: aiData.inference_time_ms || aiData.timingMs || 0,
          isMatch,
          distance: typeof topFace.distance === 'number' ? topFace.distance : (typeof aiData.distance === 'number' ? aiData.distance : null),
          status: isMatch ? 'Xác thực thành công (Match Verified)' : 'Không khớp (Unknown)',
          modelUsed: aiData.model_used || aiData.modelVersion || 'AI Service',
          facesDetected: aiData.faces_detected || aiData.facesDetected || 1,
          department: isMatch ? 'Hồ sơ đã đồng bộ CSDL' : 'Chưa có vector trong CSDL',
          empId: empCode,
        });
      } else {
        setDetectionResult(null);
        setNoticeMessage('Không phát hiện khuôn mặt nào trong khung hình. Vui lòng nhìn thẳng vào camera.');
      }
    } catch (err) {
      console.warn('Không thể gọi Python AI trực tiếp, fallback sang mô phỏng:', err);
      setNoticeMessage('⚠️ Không thể kết nối đến Python AI (port 8000). Vui lòng chạy lệnh: python face_detect/api_server.py để nhận diện thực tế.');
    } finally {
      setIsScanning(false);
    }
  };

  // Upload an image and send to Python AI (YOLOv11 + dlib ResNet)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        setUploadedImage(base64Data);
        setIsScanning(true);
        setDetectionResult(null);
        setNoticeMessage('');
        setSaveSuccess('');
        setAttendanceError('');

        try {
          const targetUrl = `${API_BASE}/ai/predict`;
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64Data,
              auto_checkin: false
            })
          });

          if (!res.ok) throw new Error(`Status ${res.status}`);
          const aiData = await res.json();
          const hasFaces = Boolean(aiData.success && (aiData.faces_detected > 0 || aiData.facesDetected > 0 || aiData.matched));

          if (hasFaces) {
            const topFace = aiData.top_match || (aiData.faces && aiData.faces[0]) || {};
            const isMatch = Boolean(aiData.matched || topFace.is_match);
            const fullName = aiData.fullName || aiData.userName || topFace.fullName || topFace.name || aiData.employeeCode || 'Unknown';
            const empCode = aiData.employeeCode || topFace.employeeCode || topFace.employeeId || (isMatch ? fullName : 'N/A');

            const confidenceVal = typeof aiData.confidence === 'number'
              ? aiData.confidence
              : (typeof aiData.similarity === 'number' ? +(aiData.similarity * 100).toFixed(1) : (typeof topFace.confidence === 'number' ? topFace.confidence : 0));

            let liveScore = null;
            let isReal = null;
            let livenessStatus = 'UNKNOWN';

            if (typeof aiData.livenessScore === 'number' && !isNaN(aiData.livenessScore)) {
              liveScore = aiData.livenessScore <= 1.0 ? +(aiData.livenessScore * 100).toFixed(1) : +aiData.livenessScore.toFixed(1);
            } else if (aiData.liveness && typeof aiData.liveness.score === 'number') {
              liveScore = +aiData.liveness.score.toFixed(1);
            } else if (typeof topFace.liveness_score === 'number') {
              liveScore = +topFace.liveness_score.toFixed(1);
            }

            if (liveScore !== null) {
              const passThreshold = liveScore >= 65;
              const notSpoof = aiData.spoofType !== 'spoof' && topFace.spoof_type !== 'spoof';
              isReal = passThreshold && notSpoof;
              livenessStatus = isReal ? 'REAL' : 'FAKE';
            }

            const rawBbox = topFace.relative_bbox || topFace.bbox || null;
            let faceBox = null;
            if (rawBbox && typeof rawBbox.top === 'number' && typeof rawBbox.width === 'number') {
              faceBox = {
                top: `${rawBbox.top}%`,
                left: `${rawBbox.left}%`,
                width: `${rawBbox.width}%`,
                height: `${rawBbox.height}%`,
              };
            }

            // Ảnh tĩnh tải lên không lật gương: dùng tọa độ gốc
            setDetectionResult({
              name: fullName,
              confidence: confidenceVal,
              isReal,
              livenessScore: liveScore,
              livenessStatus,
              spoofType: aiData.spoofType || topFace.spoof_type || null,
              faceBox,
              inferenceTime: aiData.inference_time_ms || aiData.timingMs || 0,
              isMatch,
              distance: typeof topFace.distance === 'number' ? topFace.distance : (typeof aiData.distance === 'number' ? aiData.distance : null),
              status: isMatch ? 'Xác thực thành công (Match Verified)' : 'Không khớp (Unknown)',
              modelUsed: aiData.model_used || aiData.modelVersion || 'AI Service',
              facesDetected: aiData.faces_detected || aiData.facesDetected || 1,
              department: isMatch ? 'Hồ sơ đã lưu trên MongoDB' : 'Chưa có trong CSDL',
              empId: empCode,
            });
          } else {
            setNoticeMessage('Không tìm thấy khuôn mặt nào trong ảnh vừa tải lên.');
          }
        } catch (err) {
          console.warn('Lỗi phân tích AI ảnh tải lên:', err);
          setNoticeMessage('⚠️ Không thể kết nối đến Python AI (port 8000). Hãy đảm bảo AI Service đang chạy.');
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRecordAttendance = async () => {
    if (!detectionResult) return;
    setNoticeMessage('');
    setSaveSuccess('');
    setAttendanceError('');

    if (detectionResult.isReal !== true) {
      setAttendanceError('Chưa xác minh sinh trắc học liveness thật. Không thể ghi nhận điểm danh.');
      return;
    }
    if (!detectionResult.isMatch) {
      setAttendanceError('Khuôn mặt chưa được nhận diện hoặc chưa khớp trong hệ thống.');
      return;
    }
    if (typeof detectionResult.confidence !== 'number' || detectionResult.confidence < 85) {
      setAttendanceError(`Độ tin cậy nhận diện (${detectionResult.confidence ?? 0}%) chưa đạt ngưỡng tối thiểu 85%.`);
      return;
    }
    const empCode = detectionResult.empId && detectionResult.empId !== 'N/A' ? detectionResult.empId : null;
    if (!empCode) {
      setAttendanceError('Không tìm thấy mã nhân viên hợp lệ để chấm công.');
      return;
    }

    setSubmittingLog(true);

    const payload = {
      userName: detectionResult.name,
      employeeCode: empCode,
      confidence: detectionResult.confidence,
      livenessScore: typeof detectionResult.livenessScore === 'number' ? detectionResult.livenessScore / 100 : null,
      checkInType: 'Check-in',
      status: 'Present',
    };

    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.success !== false) {
        setSaveSuccess(`Đã ghi nhận điểm danh cho "${detectionResult.name}" (${empCode}) vào CSDL MongoDB thành công.`);
      } else {
        setAttendanceError(resData.message || 'Lỗi ghi nhận điểm danh từ máy chủ backend.');
      }
    } catch (err) {
      setAttendanceError(`Không thể kết nối máy chủ backend: ${err.message}. Chưa lưu vào CSDL.`);
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '48px 24px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span className="badge-minimal">
            <ShieldCheck size={14} /> AI Testing &amp; Computer Vision Lab
          </span>

          {/* Real Python AI status */}
          <span className={`badge-tag ${aiServerOnline ? 'active' : 'pending'}`}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: aiServerOnline ? '#108a55' : '#b45309',
              }}
            />
            {aiServerOnline ? 'Python AI Service: Online (Cổng 8000)' : 'Python AI Service: Chưa khởi động'}
          </span>

          {aiServerInfo && (
            <span className="badge-tag neutral" title="Trạng thái kết nối cơ sở dữ liệu">
              <Database size={12} />
              CSDL: {aiServerInfo.database || 'MongoDB Atlas'} &bull; {aiServerInfo.total_encodings || 0} vectors
            </span>
          )}
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.035em',
            marginBottom: '12px',
          }}
        >
          Thử nghiệm Thị giác AI{' '}
          <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
            YOLOv11 &amp; dlib ResNet
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: '78ch', lineHeight: 1.6 }}>
          Phòng lab kiểm thử mô hình Computer Vision: Bắt trọn khuôn mặt bằng <strong>YOLOv11 Face</strong>, trích xuất <strong>vector đặc trưng 128 chiều (dlib ResNet)</strong> và xác thực độ sống chống giả mạo bằng <strong>MiniFASNet Ensemble</strong>.
        </p>
      </div>

      {/* AI Server Status Alert Banner if offline */}
      {!aiServerOnline && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
              <strong>Mô hình Python AI đang tắt:</strong> Để nhận diện khuôn mặt trực tiếp, hãy chạy lệnh:
              <code style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#fef3c7', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                uvicorn app.main:app --port 8000
              </code>
            </div>
          </div>

          <button className="btn-outline" onClick={checkAiHealth} style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
            <RefreshCw size={13} /> Thử lại
          </button>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleModeChange('webcam')}
          className={activeMode === 'webcam' ? 'btn-primary' : 'btn-outline'}
          style={{ padding: '10px 22px' }}
        >
          <Camera size={16} />
          Webcam trực tiếp (Live AI)
        </button>

        <button
          onClick={() => handleModeChange('upload')}
          className={activeMode === 'upload' ? 'btn-primary' : 'btn-outline'}
          style={{ padding: '10px 22px' }}
        >
          <Upload size={16} />
          Tải ảnh phân tích
        </button>
      </div>


      {/* ========================================================================= */}
      {/* KHUNG THỬ NGHIỆM AI: WEBCAM HOẶC UPLOAD PHÂN TÍCH */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '32px',
          alignItems: 'start',
        }}
      >
          {/* Left Column: Viewport */}
          <div
            className="minimal-card"
            style={{
              padding: '28px',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isCameraActive ? '#108a55' : '#9295a3',
                  }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {activeMode === 'webcam'
                    ? isCameraActive
                      ? 'Camera hoạt động (Tỷ lệ 16:9 chuẩn)'
                      : 'Camera đang tắt'
                    : 'Chế độ phân tích ảnh tĩnh'}
                </span>
              </div>

              {activeMode === 'webcam' && (
                <div>
                  {!isCameraActive ? (
                    <button className="btn-primary" onClick={startCamera} style={{ padding: '8px 18px', fontSize: '0.8125rem' }}>
                      <Camera size={14} /> Bật Camera
                    </button>
                  ) : (
                    <button className="btn-outline" onClick={stopCamera} style={{ padding: '8px 18px', fontSize: '0.8125rem' }}>
                      <VideoOff size={14} /> Tắt Camera
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Viewport Frame - chuẩn tỷ lệ 16:9 chống méo lệch Bounding Box */}
            <div
              style={{
                width: '100%',
                aspectRatio: '16/9',
                maxHeight: '480px',
                minHeight: '320px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-muted)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Laser scanning line */}
              {isScanning && <div className="minimal-scanner-laser" />}

              {/* Webcam video (hiệu ứng soi gương scaleX(-1)) */}
              {activeMode === 'webcam' && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: isCameraActive ? 'block' : 'none',
                      transform: 'scaleX(-1)',
                    }}
                  />

                  {!isCameraActive && (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '16px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 16px',
                        }}
                      >
                        <Camera size={26} color="var(--text-muted)" />
                      </div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Webcam chưa kích hoạt
                      </p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                        Bật camera để AI quét tọa độ khuôn mặt và so khớp danh tính trực tiếp
                      </p>
                      <button className="btn-primary" onClick={startCamera}>
                        <Camera size={15} /> Bật Camera Ngay
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Image upload preview */}
              {activeMode === 'upload' && (
                <>
                  {uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt="Face preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%',
                        padding: '24px',
                      }}
                    >
                      <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Nhấp để chọn ảnh chân dung
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Định dạng JPG, PNG (rõ nét khuôn mặt)
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </>
              )}

              {/* Bounding Box Overlay chuẩn xác - Chỉ hiển thị khi camera/ảnh đang hoạt động */}
              {((activeMode === 'webcam' && isCameraActive) || (activeMode === 'upload' && uploadedImage)) && detectionResult?.faceBox && (
                <div
                  className="minimal-face-box"
                  style={{
                    top: detectionResult.faceBox.top,
                    left: detectionResult.faceBox.left,
                    width: detectionResult.faceBox.width,
                    height: detectionResult.faceBox.height,
                    borderColor: !detectionResult.isReal
                      ? '#dc2626'
                      : detectionResult.isMatch
                        ? '#108a55'
                        : '#b45309',
                    boxShadow: !detectionResult.isReal
                      ? '0 0 0 2px rgba(220, 38, 38, 0.4), inset 0 0 12px rgba(220, 38, 38, 0.3)'
                      : detectionResult.isMatch
                        ? '0 0 0 2px rgba(16, 138, 85, 0.3), inset 0 0 12px rgba(16, 138, 85, 0.2)'
                        : '0 0 0 2px rgba(180, 83, 9, 0.3), inset 0 0 12px rgba(180, 83, 9, 0.2)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-32px',
                      left: 0,
                      backgroundColor: !detectionResult.isReal
                        ? '#dc2626'
                        : detectionResult.isMatch
                          ? '#108a55'
                          : '#b45309',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  >
                    {detectionResult.isReal === false ? (
                      <>
                        <AlertTriangle size={12} color="#ffffff" />
                        [!] GIẢ MẠO: {detectionResult.spoofType === 'print_attack' ? 'ẢNH IN' : 'MÀN HÌNH'} {detectionResult.livenessScore !== null ? `(${detectionResult.livenessScore}% Live)` : ''}
                      </>
                    ) : detectionResult.isReal === true ? (
                      <>
                        <CheckCircle2 size={12} color="#ffffff" />
                        {detectionResult.name} ({detectionResult.confidence}%) &bull; LIVE: {detectionResult.livenessScore}%
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} color="#ffffff" />
                        {detectionResult.name} ({detectionResult.confidence}%) &bull; {detectionResult.isMatch ? 'Khớp CSDL' : 'Chưa đăng ký'}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Camera error */}
              {cameraError && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '20px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#991b1b',
                    fontSize: '0.875rem',
                  }}
                >
                  <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Notice message */}
            {noticeMessage && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {noticeMessage}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              {activeMode === 'webcam' && isCameraActive && (
                <button
                  className="btn-primary"
                  onClick={captureAndRecognizeFace}
                  disabled={isScanning}
                  style={{ flex: 1 }}
                >
                  <Zap size={16} />
                  {isScanning ? 'Đang phân tích YOLOv11...' : 'Quét & Nhận diện (YOLOv11)'}
                </button>
              )}

              {activeMode === 'upload' && (
                <label className="btn-outline" style={{ cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                  <Upload size={16} /> Chọn ảnh khác
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Right Column: Telemetry & Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="minimal-card" style={{ padding: '28px 26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} color="#1a1a1a" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Thông số phân tích AI thực tế
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {detectionResult && (
                    <button
                      onClick={handleResetAnalysis}
                      title="Đặt lại kết quả phân tích"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <RotateCcw size={12} /> Đặt lại
                    </button>
                  )}
                  <span className={`badge-tag ${aiServerOnline ? 'active' : 'danger'}`} style={{ gap: '6px' }}>
                    {aiServerOnline ? (
                      <>
                        <span className="pulse-dot" />
                        AI Sẵn Sàng (Port 8000)
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} color="#dc2626" />
                        AI Chưa Kết Nối
                      </>
                    )}
                  </span>
                </div>
              </div>

              {detectionResult ? (
                <div>
                  {/* Status Banner */}
                  <div
                    style={{
                      backgroundColor: !detectionResult.isReal
                        ? 'rgba(220, 38, 38, 0.04)'
                        : detectionResult.isMatch
                          ? 'rgba(16, 138, 85, 0.04)'
                          : 'rgba(217, 119, 6, 0.04)',
                      border: `1.5px solid ${!detectionResult.isReal
                        ? 'rgba(220, 38, 38, 0.25)'
                        : detectionResult.isMatch
                          ? 'rgba(16, 138, 85, 0.25)'
                          : 'rgba(217, 119, 6, 0.25)'
                        }`,
                      borderRadius: '18px',
                      padding: '18px 20px',
                      marginBottom: '20px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: !detectionResult.isReal
                            ? '#fee2e2'
                            : detectionResult.isMatch
                              ? '#dcfce7'
                              : '#fef3c7',
                          color: !detectionResult.isReal
                            ? '#b91c1c'
                            : detectionResult.isMatch
                              ? '#15803d'
                              : '#b45309',
                        }}
                      >
                        {!detectionResult.isReal
                          ? '⚠️ CẢNH BÁO GIẢ MẠO (SPOOF ATTACK)'
                          : detectionResult.isMatch
                            ? '✓ XÁC THỰC DANH TÍNH THÀNH CÔNG'
                            : '? KHUÔN MẶT CHƯA ĐĂNG KÝ'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        dlib 128-D &amp; ResNet
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '1.65rem',
                        fontWeight: 700,
                        letterSpacing: '-0.025em',
                        color: !detectionResult.isReal
                          ? '#dc2626'
                          : detectionResult.isMatch
                            ? '#108a55'
                            : '#b45309',
                      }}
                    >
                      {detectionResult.name}
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {!detectionResult.isReal ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          Phát hiện: {detectionResult.spoofType === 'print_attack' ? 'Ảnh in giấy' : 'Màn hình điện thoại / máy tính chiếu lại'}
                        </span>
                      ) : (
                        <span>
                          Trạng thái: <strong style={{ color: 'var(--text-primary)' }}>{detectionResult.status}</strong> &bull; {detectionResult.department}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dual Confidence & Liveness Gauges */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    {/* Meter 1: Identity Confidence */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Độ trùng khớp danh tính
                        </span>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: detectionResult.isMatch ? '#108a55' : '#b45309',
                          }}
                        >
                          {detectionResult.confidence}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, detectionResult.confidence))}%`,
                            height: '100%',
                            backgroundColor: detectionResult.isMatch ? '#108a55' : '#b45309',
                            borderRadius: '999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Ngưỡng chuẩn: ≥ 80% (dlib ≤ 0.50)
                      </div>
                    </div>

                    {/* Meter 2: Liveness Score */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Độ sống sinh trắc học
                        </span>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: detectionResult.isReal === true ? '#108a55' : (detectionResult.isReal === false ? '#dc2626' : '#d97706'),
                          }}
                        >
                          {detectionResult.livenessScore !== null ? `${detectionResult.livenessScore}%` : 'Chưa kiểm tra'}
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${detectionResult.livenessScore !== null ? Math.min(100, Math.max(0, detectionResult.livenessScore)) : 0}%`,
                            height: '100%',
                            backgroundColor: detectionResult.isReal === true ? '#108a55' : '#dc2626',
                            borderRadius: '999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        MiniFASNet: ≥ 65% là Live Face (Chống ảnh in, phát video)
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      fontSize: '0.8125rem',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        <Zap size={12} color="#f59e0b" /> Thời gian suy luận AI
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                        {detectionResult.inferenceTime} ms
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {detectionResult.inferenceTime < 300 ? '⚡ Siêu tốc (Edge AI)' : '✓ Thời gian thực'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        <Activity size={12} color="#108a55" /> Khoảng cách Euclidean
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                        {typeof detectionResult.distance === 'number' ? detectionResult.distance : '--'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {typeof detectionResult.distance === 'number'
                          ? (detectionResult.distance <= 0.50 ? 'Khớp vector (≤ 0.50)' : 'Lệch vector (> 0.50)')
                          : 'Chưa có thông số khoảng cách'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        <Cpu size={12} color="#6366f1" /> Mô hình nơ-ron
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        YOLOv11 + dlib + MiniFASNet
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        Ensemble 3 tầng AI
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        <Fingerprint size={12} color="#ec4899" /> Số mặt phát hiện
                      </div>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                        {detectionResult.facesDetected || 1} khuôn mặt
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        Tọa độ chuẩn hóa 16:9
                      </div>
                    </div>
                  </div>

                  {/* Anti-Spoofing MiniFASNet Verdict Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: detectionResult.isReal === true ? 'rgba(16, 138, 85, 0.06)' : 'rgba(220, 38, 38, 0.06)',
                      border: `1px solid ${detectionResult.isReal === true ? 'rgba(16, 138, 85, 0.22)' : 'rgba(220, 38, 38, 0.22)'}`,
                      borderRadius: '14px',
                      padding: '12px 16px',
                      marginBottom: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {detectionResult.isReal === true ? (
                        <ShieldCheck size={22} color="#108a55" />
                      ) : (
                        <ShieldAlert size={22} color="#dc2626" />
                      )}
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: detectionResult.isReal === true ? '#108a55' : '#dc2626' }}>
                          {detectionResult.isReal === true ? 'Sinh trắc học hợp lệ (Live Face)' : (detectionResult.isReal === false ? 'Cảnh báo Giả mạo (Spoof Attack)' : 'Chưa kiểm tra sinh trắc học')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {detectionResult.isReal === true
                            ? 'MiniFASNet xác nhận người thật đứng trước camera'
                            : (detectionResult.isReal === false
                                ? `Phát hiện dạng: ${detectionResult.spoofType === 'print_attack' ? 'Ảnh in giấy' : (detectionResult.spoofType === 'screen_attack' || detectionResult.spoofType === 'replay_attack' ? 'Màn hình chiếu lại' : (detectionResult.spoofType || 'Nghi ngờ giả mạo'))}`
                                : 'Chưa có kết quả phân tích liveness')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          backgroundColor: detectionResult.isReal === true ? '#dcfce7' : '#fee2e2',
                          color: detectionResult.isReal === true ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {detectionResult.isReal === true ? 'Được phép điểm danh' : 'Bị khóa'}
                      </div>
                    </div>
                  </div>

                  {/* Primary Button to sync with MongoDB */}
                  {(() => {
                    const isPassedConfidence = typeof detectionResult.confidence === 'number' && detectionResult.confidence >= 85;
                    const hasValidEmp = Boolean(detectionResult.empId && detectionResult.empId !== 'N/A');
                    const canRecord = Boolean(detectionResult.isMatch === true && detectionResult.isReal === true && isPassedConfidence && hasValidEmp);

                    return (
                      <button
                        className="btn-primary"
                        onClick={handleRecordAttendance}
                        disabled={submittingLog || !canRecord}
                        style={{
                          width: '100%',
                          padding: '14px',
                          backgroundColor: !canRecord ? '#9295a3' : undefined,
                          cursor: !canRecord ? 'not-allowed' : 'pointer',
                          boxShadow: !canRecord ? 'none' : undefined,
                        }}
                      >
                        {submittingLog ? (
                          <>
                            <RefreshCw size={16} className="spin" /> Đang lưu vào MongoDB...
                          </>
                        ) : !detectionResult.isMatch ? (
                          <>
                            <Lock size={16} /> Không thể điểm danh: Chưa nhận diện được
                          </>
                        ) : detectionResult.isReal === false ? (
                          <>
                            <Lock size={16} /> Chặn điểm danh: Phát hiện giả mạo
                          </>
                        ) : detectionResult.isReal !== true ? (
                          <>
                            <Lock size={16} /> Chưa xác minh liveness thật
                          </>
                        ) : !isPassedConfidence ? (
                          <>
                            <Lock size={16} /> Độ tin cậy chưa đạt (≥ 85%)
                          </>
                        ) : !hasValidEmp ? (
                          <>
                            <Lock size={16} /> Thiếu mã nhân viên hợp lệ
                          </>
                        ) : (
                          <>
                            <UserCheck size={18} /> Ghi nhận điểm danh vào CSDL
                          </>
                        )}
                      </button>
                    );
                  })()}

                  {saveSuccess && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        backgroundColor: '#eefbf4',
                        border: '1px solid #c7f2da',
                        color: '#108a55',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <CheckCircle2 size={16} />
                        <span>{saveSuccess}</span>
                      </div>
                      <Link
                        to="/admin"
                        style={{
                          color: '#108a55',
                          fontWeight: 600,
                          textDecoration: 'underline',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Kiểm tra lượt điểm danh tại trang Quản trị (/admin) &rarr;
                      </Link>
                    </div>
                  )}

                  {attendanceError && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#b91c1c',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <AlertTriangle size={16} />
                        <span>{attendanceError}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Chưa có kết quả nhận diện
                  </p>
                  <p style={{ fontSize: '0.8125rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                    Bật camera và nhấn nút <strong>"Quét &amp; Nhận diện"</strong> để gửi khung hình sang Python AI Engine.
                  </p>
                </div>
              )}
            </div>

            {/* Enrolled Users Box */}
            <div
              className="minimal-card"
              style={{
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Khuôn mặt đã nạp trong MongoDB:
                </div>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: 'var(--accent)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none'
                  }}
                  title="Chuyển sang Cổng Quản trị để đăng ký khuôn mặt nhân viên"
                >
                  Đăng ký tại Cổng Quản trị &rarr;
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {aiServerInfo && aiServerInfo.enrolled_users && aiServerInfo.enrolled_users.length > 0 ? (
                  aiServerInfo.enrolled_users.map((name) => (
                    <span key={name} className="badge-tag active">
                      {name}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Dung, Le Do Quang Dung, Ngoc Khanh
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Dữ liệu vector được đồng bộ trực tiếp từ MongoDB Atlas collection <code>users</code>.
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
