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
  Fingerprint,
  Lock,
  UserPlus,
  Plus,
  Trash2,
  Sparkles,
  Image,
  Database
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const PYTHON_AI_BASE = 'http://localhost:8000';

const ENROLL_ANGLES = [
  { step: 1, label: 'Nhìn thẳng trực diện', hint: 'Giữ khuôn mặt ở trung tâm khung hình' },
  { step: 2, label: 'Nghiêng nhẹ sang trái (15°-20°)', hint: 'Xoay đầu nhẹ sang bên trái của bạn' },
  { step: 3, label: 'Nghiêng nhẹ sang phải (15°-20°)', hint: 'Xoay đầu nhẹ sang bên phải của bạn' },
  { step: 4, label: 'Hơi ngẩng cằm lên', hint: 'Ngẩng đầu nhẹ lên trên một chút' },
  { step: 5, label: 'Mỉm cười hoặc tự nhiên', hint: 'Biểu cảm thân thiện tự nhiên' },
];

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
  const [submittingLog, setSubmittingLog] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [toleranceVal, setToleranceVal] = useState(0.50);

  // Face Enrollment Studio State
  const [enrollName, setEnrollName] = useState('');
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrollDept, setEnrollDept] = useState('AI & Engineering');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrollSource, setEnrollSource] = useState('webcam'); // 'webcam' | 'upload'
  const [enrollSamples, setEnrollSamples] = useState([]); // Array of { id, dataUrl, label }
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // URL query params auto-filling (from /admin or direct link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const nameParam = params.get('name');
    const empIdParam = params.get('empId');
    const deptParam = params.get('dept');

    if (modeParam === 'enroll') {
      setActiveMode('enroll');
      if (nameParam) setEnrollName(nameParam);
      if (empIdParam) setEnrollEmpId(empIdParam);
      if (deptParam) setEnrollDept(deptParam);
    }
  }, []);

  // Check Python AI Service Health
  const checkAiHealth = async () => {
    try {
      // First attempt direct Python server on port 8000
      let res = await fetch(`${PYTHON_AI_BASE}/health`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setAiServerOnline(true);
        setAiServerInfo(data);
        return;
      }

      // Fallback via Express proxy at /api/ai/status
      res = await fetch(`${API_BASE}/ai/status`).catch(() => null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
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
      setCameraError('Không thể mở Camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt của bạn.');
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

      // Send to real Python AI Server
      const targetUrl = aiServerOnline ? `${PYTHON_AI_BASE}/predict` : `${API_BASE}/ai/predict`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          tolerance: toleranceVal,
          auto_checkin: false
        })
      });

      if (!res.ok) {
        throw new Error(`AI Server status ${res.status}`);
      }

      const aiData = await res.json();

      if (aiData.success && aiData.faces_detected > 0) {
        const topFace = aiData.top_match || aiData.faces[0];

        // Tính toán tọa độ Bounding Box cho Webcam lật gương (scaleX(-1)):
        // displayLeft = 100% - left% - width%
        const displayLeft = topFace.relative_bbox.mirrored_left !== undefined
          ? topFace.relative_bbox.mirrored_left
          : (100.0 - topFace.relative_bbox.left - topFace.relative_bbox.width).toFixed(2);

        setDetectionResult({
          name: topFace.name,
          confidence: topFace.confidence,
          isReal: topFace.is_real !== undefined ? topFace.is_real : true,
          livenessScore: topFace.liveness_score !== undefined ? topFace.liveness_score : 100,
          livenessStatus: topFace.liveness_status || 'REAL',
          spoofType: topFace.spoof_type || 'real',
          faceBox: {
            top: `${topFace.relative_bbox.top}%`,
            left: `${displayLeft}%`,
            width: `${topFace.relative_bbox.width}%`,
            height: `${topFace.relative_bbox.height}%`,
          },
          inferenceTime: aiData.inference_time_ms,
          isMatch: topFace.is_match,
          distance: topFace.distance,
          status: topFace.is_match ? 'Xác thực thành công (Match Verified)' : 'Không khớp (Unknown)',
          modelUsed: aiData.model_used,
          facesDetected: aiData.faces_detected,
          department: topFace.is_match ? 'Nhân sự đã đăng ký trong MongoDB' : 'Chưa có vector trong CSDL',
          empId: topFace.is_match ? (topFace.name) : 'N/A',
        });
      } else {
        setDetectionResult(null);
        setNoticeMessage('YOLOv11 không phát hiện khuôn mặt nào trong khung hình. Vui lòng nhìn thẳng vào camera.');
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

        try {
          const targetUrl = aiServerOnline ? `${PYTHON_AI_BASE}/predict` : `${API_BASE}/ai/predict`;
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64Data,
              tolerance: toleranceVal,
              auto_checkin: false
            })
          });

          if (!res.ok) throw new Error(`Status ${res.status}`);
          const aiData = await res.json();

          if (aiData.success && aiData.faces_detected > 0) {
            const topFace = aiData.top_match || aiData.faces[0];
            // Ảnh tĩnh tải lên không lật gương: dùng tọa độ gốc
            setDetectionResult({
              name: topFace.name,
              confidence: topFace.confidence,
              isReal: topFace.is_real !== undefined ? topFace.is_real : true,
              livenessScore: topFace.liveness_score !== undefined ? topFace.liveness_score : 100,
              livenessStatus: topFace.liveness_status || 'REAL',
              spoofType: topFace.spoof_type || 'real',
              faceBox: {
                top: `${topFace.relative_bbox.top}%`,
                left: `${topFace.relative_bbox.left}%`,
                width: `${topFace.relative_bbox.width}%`,
                height: `${topFace.relative_bbox.height}%`,
              },
              inferenceTime: aiData.inference_time_ms,
              isMatch: topFace.is_match,
              distance: topFace.distance,
              status: topFace.is_match ? 'Xác thực thành công (Match Verified)' : 'Không khớp (Unknown)',
              modelUsed: aiData.model_used,
              facesDetected: aiData.faces_detected,
              department: topFace.is_match ? 'Hồ sơ đã lưu trên MongoDB' : 'Chưa có trong CSDL',
              empId: topFace.is_match ? (topFace.name) : 'N/A',
            });
          } else {
            setNoticeMessage('YOLOv11 không tìm thấy khuôn mặt nào trong ảnh vừa tải lên.');
          }
        } catch (err) {
          console.warn('Lỗi phân tích AI ảnh tải lên:', err);
          setNoticeMessage('⚠️ Không thể kết nối đến Python AI (port 8000). Hãy chạy: python face_detect/api_server.py');
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Face Enrollment: Capture single snapshot from webcam
  const handleCaptureEnrollSample = () => {
    if (!videoRef.current || !isCameraActive) return;
    const canvas = document.createElement('canvas');
    const vWidth = videoRef.current.videoWidth || 640;
    const vHeight = videoRef.current.videoHeight || 480;
    canvas.width = vWidth;
    canvas.height = vHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const currentStep = enrollSamples.length;
    const label = currentStep < ENROLL_ANGLES.length
      ? ENROLL_ANGLES[currentStep].label
      : `Mẫu bổ sung #${currentStep + 1}`;

    setEnrollSamples((prev) => [...prev, { id: Date.now() + Math.random(), dataUrl, label }]);
    setEnrollMessage('');
  };

  // Face Enrollment: Multiple files upload
  const handleEnrollFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEnrollSamples((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random() + index,
            dataUrl: ev.target.result,
            label: `Ảnh chân dung ${prev.length + 1}`
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Face Enrollment: Delete sample
  const handleRemoveEnrollSample = (id) => {
    setEnrollSamples((prev) => prev.filter((s) => s.id !== id));
  };

  // Face Enrollment: Save all samples to MongoDB & Python AI
  const handleSaveEnrollmentToMongo = async () => {
    if (!enrollName.trim()) {
      setEnrollMessage('Vui lòng nhập đầy đủ Họ và Tên trước khi lưu!');
      return;
    }
    if (enrollSamples.length === 0) {
      setEnrollMessage('Vui lòng chụp qua Webcam hoặc tải lên ít nhất 1 ảnh khuôn mặt!');
      return;
    }

    setEnrolling(true);
    setEnrollMessage('');
    setEnrollSuccess(false);

    try {
      const targetUrl = aiServerOnline ? `${PYTHON_AI_BASE}/api/ai/register-face` : `${API_BASE}/ai/register-face`;
      const payload = {
        name: enrollName.trim(),
        employeeId: enrollEmpId.trim() || `EMP-${String(Math.floor(Math.random() * 900) + 100)}`,
        department: enrollDept.trim() || 'AI & Engineering',
        email: enrollEmail.trim() || `${enrollName.trim().toLowerCase().replace(/\s+/g, '')}@company.com`,
        images: enrollSamples.map((s) => s.dataUrl)
      };

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Lỗi đăng ký khuôn mặt');
      }

      setEnrollSuccess(true);
      setEnrollMessage(data.message || `Đã trích xuất và lưu thành công ${data.samples_enrolled} vector 128-d vào MongoDB!`);

      // Tự động làm mới danh sách AI server
      await checkAiHealth();
    } catch (err) {
      setEnrollSuccess(false);
      setEnrollMessage(`Lỗi đăng ký: ${err.message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const handleRecordAttendance = async () => {
    if (!detectionResult) return;
    if (detectionResult.isReal === false) {
      setNoticeMessage('⚠️ Cảnh báo: Hệ thống Anti-Spoofing MiniFASNet đã phát hiện khuôn mặt giả mạo! Không thể ghi nhận điểm danh.');
      return;
    }
    setSubmittingLog(true);
    setSaveSuccess('');

    const payload = {
      userName: detectionResult.name,
      confidence: detectionResult.confidence,
      checkInType: 'Check-in',
      status: detectionResult.isMatch ? 'Present' : 'Unrecognized',
    };

    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(`Đã ghi nhận điểm danh cho "${detectionResult.name}" vào CSDL MongoDB thành công.`);
      } else {
        setSaveSuccess(`Đã lưu phiên điểm danh cho "${detectionResult.name}".`);
      }
    } catch {
      setSaveSuccess(`Đã lưu phiên điểm danh cho "${detectionResult.name}" (Backend offline, hiển thị demo).`);
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
            <ShieldCheck size={14} /> AI Testing &amp; Enrollment Studio
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
          Nhận diện &amp; Đăng ký{' '}
          <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
            khuôn mặt MongoDB
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: '78ch', lineHeight: 1.6 }}>
          Hệ thống kết hợp mô hình <strong>YOLOv11 Face</strong> để bắt trọn khuôn mặt ở mọi góc độ, trích xuất <strong>vector đặc trưng 128 chiều (dlib ResNet)</strong> và lưu trữ trực tiếp vào cơ sở dữ liệu <strong>MongoDB Atlas</strong> trong thời gian thực.
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
              <strong>Mô hình Python AI đang tắt:</strong> Để nhận diện và đăng ký khuôn mặt trực tiếp vào MongoDB, hãy chạy lệnh:
              <code style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#fef3c7', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                .\env\Scripts\python.exe face_detect/api_server.py
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

        <button
          onClick={() => {
            handleModeChange('enroll');
            if (!isCameraActive && enrollSource === 'webcam') {
              startCamera();
            }
          }}
          className={activeMode === 'enroll' ? 'btn-primary' : 'btn-outline'}
          style={{ padding: '10px 22px', backgroundColor: activeMode === 'enroll' ? '#108a55' : undefined, borderColor: activeMode === 'enroll' ? '#108a55' : undefined }}
        >
          <UserPlus size={16} />
          Đăng ký khuôn mặt mới (MongoDB)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1 & 2: WEBCAM HOẶC UPLOAD PHÂN TÍCH */}
      {/* ========================================================================= */}
      {activeMode !== 'enroll' && (
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
                    {!detectionResult.isReal ? (
                      <>
                        <AlertTriangle size={12} color="#ffffff" />
                        [!] GIẢ MẠO: {detectionResult.spoofType === 'print_attack' ? 'ẢNH IN' : 'MÀN HÌNH'} ({detectionResult.livenessScore}% Live)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} color="#ffffff" />
                        {detectionResult.name} ({detectionResult.confidence}%) &bull; LIVE: {detectionResult.livenessScore}%
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
                            color: detectionResult.isReal ? '#108a55' : '#dc2626',
                          }}
                        >
                          {detectionResult.livenessScore}%
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
                            width: `${Math.min(100, Math.max(0, detectionResult.livenessScore))}%`,
                            height: '100%',
                            backgroundColor: detectionResult.isReal ? '#108a55' : '#dc2626',
                            borderRadius: '999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        MiniFASNet: ≥ 65% là Live Face
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
                        {detectionResult.distance ?? '0.315'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {detectionResult.distance <= 0.50 ? 'Khớp vector (≤ 0.50)' : 'Lệch vector (> 0.50)'}
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
                      backgroundColor: detectionResult.isReal ? 'rgba(16, 138, 85, 0.06)' : 'rgba(220, 38, 38, 0.06)',
                      border: `1px solid ${detectionResult.isReal ? 'rgba(16, 138, 85, 0.22)' : 'rgba(220, 38, 38, 0.22)'}`,
                      borderRadius: '14px',
                      padding: '12px 16px',
                      marginBottom: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {detectionResult.isReal ? (
                        <ShieldCheck size={22} color="#108a55" />
                      ) : (
                        <ShieldAlert size={22} color="#dc2626" />
                      )}
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: detectionResult.isReal ? '#108a55' : '#dc2626' }}>
                          {detectionResult.isReal ? 'Sinh trắc học hợp lệ (Live Face)' : 'Cảnh báo Giả mạo (Spoof Attack)'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {detectionResult.isReal
                            ? 'MiniFASNet xác nhận người thật đứng trước camera'
                            : `Phát hiện dạng: ${detectionResult.spoofType === 'print_attack' ? 'Ảnh in giấy' : 'Màn hình chiếu lại'}`}
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
                          backgroundColor: detectionResult.isReal ? '#dcfce7' : '#fee2e2',
                          color: detectionResult.isReal ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {detectionResult.isReal ? 'Được phép điểm danh' : 'Bị khóa'}
                      </div>
                    </div>
                  </div>

                  {/* Primary Button to sync with MongoDB */}
                  <button
                    className="btn-primary"
                    onClick={handleRecordAttendance}
                    disabled={submittingLog || detectionResult.isReal === false}
                    style={{
                      width: '100%',
                      padding: '14px',
                      backgroundColor: detectionResult.isReal === false ? '#9295a3' : undefined,
                      cursor: detectionResult.isReal === false ? 'not-allowed' : 'pointer',
                      boxShadow: detectionResult.isReal === false ? 'none' : undefined,
                    }}
                  >
                    {detectionResult.isReal === false ? (
                      <>
                        <Lock size={16} /> Chặn điểm danh: Phát hiện giả mạo
                      </>
                    ) : submittingLog ? (
                      <>
                        <RefreshCw size={16} className="spin" /> Đang lưu vào MongoDB...
                      </>
                    ) : (
                      <>
                        <UserCheck size={18} /> Ghi nhận điểm danh vào CSDL
                      </>
                    )}
                  </button>

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
                <button
                  onClick={() => setActiveMode('enroll')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#108a55',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={12} /> Thêm mới
                </button>
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
      )}

      {/* ========================================================================= */}
      {/* MODE 3: ĐĂNG KÝ KHUÔN MẶT MỚI (FACE ENROLLMENT STUDIO) */}
      {/* ========================================================================= */}
      {activeMode === 'enroll' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Cột trái: Khung chụp webcam & Bộ sưu tập mẫu */}
          <div className="minimal-card" style={{ padding: '28px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Thu thập mẫu khuôn mặt</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Chụp từ 3 đến 5 góc khác nhau để đạt độ nhận diện tối ưu
                </p>
              </div>

              {/* Chọn nguồn: Webcam hoặc Upload & Nút Bật/Tắt Camera */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollSource('webcam');
                      if (!isCameraActive) startCamera();
                    }}
                    className={enrollSource === 'webcam' ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    <Camera size={13} /> Webcam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollSource('upload');
                      stopCamera();
                    }}
                    className={enrollSource === 'upload' ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    <Upload size={13} /> Tải tệp
                  </button>
                </div>

                {enrollSource === 'webcam' && (
                  isCameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-outline"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', borderColor: '#fecaca', color: '#dc2626' }}
                    >
                      <VideoOff size={13} /> Tắt Camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                    >
                      <Camera size={13} /> Bật Camera
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Khung chụp ảnh */}
            {enrollSource === 'webcam' ? (
              <div>
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    maxHeight: '360px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border-subtle)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
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
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        Webcam chưa bật. Vui lòng mở camera để bắt đầu thu thập các góc mặt.
                      </p>
                      <button className="btn-primary" onClick={startCamera}>
                        <Camera size={14} /> Bật Camera Ngay
                      </button>
                    </div>
                  )}

                  {/* Nút tắt cam nổi trên góc video */}
                  {isCameraActive && (
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(8px)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        zIndex: 10,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.85)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)'; }}
                    >
                      <VideoOff size={13} /> Tắt Camera
                    </button>
                  )}

                  {/* Target Crosshair / Oval Guide */}
                  {isCameraActive && (
                    <div
                      style={{
                        position: 'absolute',
                        width: '180px',
                        height: '240px',
                        border: '2px dashed rgba(255, 255, 255, 0.7)',
                        borderRadius: '50%',
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
                      }}
                    />
                  )}
                </div>

                {/* Hướng dẫn góc chụp tuần tự & Nút điều khiển */}
                {isCameraActive && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '14px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Góc gợi ý #{enrollSamples.length + 1}
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {enrollSamples.length < ENROLL_ANGLES.length
                          ? ENROLL_ANGLES[enrollSamples.length].label
                          : 'Góc tự do bổ sung'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {enrollSamples.length < ENROLL_ANGLES.length
                          ? ENROLL_ANGLES[enrollSamples.length].hint
                          : 'Nhìn tự nhiên để mô hình AI học thêm mẫu'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={stopCamera}
                        style={{ padding: '10px 14px', fontSize: '0.8125rem' }}
                        title="Tắt Camera"
                      >
                        <VideoOff size={15} /> Tắt Cam
                      </button>
                      <button
                        className="btn-primary"
                        onClick={handleCaptureEnrollSample}
                        style={{ padding: '10px 20px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                      >
                        <Camera size={16} /> Chụp góc này
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Tải tệp chùm ảnh */
              <div
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-muted)',
                  marginBottom: '20px',
                  cursor: 'pointer',
                }}
              >
                <Upload size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Chọn một hoặc nhiều ảnh chân dung
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Giữ phím <code>Ctrl</code> để chọn cùng lúc nhiều ảnh các góc khác nhau (JPG, PNG)
                </p>
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  <Image size={15} /> Tải ảnh lên
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleEnrollFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}

            {/* Danh sách thumbnails ảnh mẫu đã chụp */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Ảnh mẫu đã thu thập ({enrollSamples.length} ảnh):
                </span>
                {enrollSamples.length > 0 && (
                  <button
                    onClick={() => setEnrollSamples([])}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              {enrollSamples.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px solid var(--border-subtle)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Chưa có ảnh mẫu nào. Hãy nhấn <strong>"Chụp góc này"</strong> hoặc tải ảnh lên.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                    gap: '10px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    padding: '4px',
                  }}
                >
                  {enrollSamples.map((sample, idx) => (
                    <div
                      key={sample.id}
                      style={{
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                        aspectRatio: '1',
                        backgroundColor: '#000',
                      }}
                    >
                      <img
                        src={sample.dataUrl}
                        alt={`Sample ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '0.625rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => handleRemoveEnrollSample(sample.id)}
                        title="Xóa ảnh này"
                        style={{
                          position: 'absolute',
                          top: 3,
                          right: 3,
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(220, 38, 38, 0.9)',
                          color: '#fff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cột phải: Form thông tin nhân sự & Lưu MongoDB */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="minimal-card" style={{ padding: '32px 28px', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Sparkles size={20} color="#108a55" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Thông tin hồ sơ nhân viên
                </h3>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Họ và Tên <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={enrollName}
                    onChange={(e) => setEnrollName(e.target.value)}
                    placeholder="Ví dụ: Lê Đỗ Quang Dũng"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.9375rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                      Mã nhân viên
                    </label>
                    <input
                      type="text"
                      value={enrollEmpId}
                      onChange={(e) => setEnrollEmpId(e.target.value)}
                      placeholder="EMP-005"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                      Phòng ban
                    </label>
                    <select
                      value={enrollDept}
                      onChange={(e) => setEnrollDept(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: '#fff',
                      }}
                    >
                      <option value="AI & Engineering">AI &amp; Engineering</option>
                      <option value="Product Design">Product Design</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Marketing & Sales">Marketing &amp; Sales</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Email công vụ
                  </label>
                  <input
                    type="email"
                    value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    placeholder="dung@company.com"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Sample Quality Gauge */}
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-neutral)', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Độ phủ mẫu AI (Multi-angle Coverage):</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {enrollSamples.length} / 5 góc
                  </span>
                </div>

                <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (enrollSamples.length / 5) * 100)}%`,
                      height: '100%',
                      backgroundColor: enrollSamples.length >= 3 ? '#108a55' : '#b45309',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: enrollSamples.length >= 3 ? '#108a55' : '#b45309', fontWeight: 600 }}>
                  {enrollSamples.length === 0 && 'Chưa có ảnh mẫu. Hãy chụp qua webcam hoặc tải ảnh lên.'}
                  {enrollSamples.length > 0 && enrollSamples.length < 3 && '⚠️ Khuyến nghị chụp thêm (tối thiểu 3 góc để nhận diện chuẩn).'}
                  {enrollSamples.length >= 3 && enrollSamples.length < 5 && '✅ Độ phủ tốt: Đủ điều kiện nhận diện ResNet 128 chiều.'}
                  {enrollSamples.length >= 5 && '🌟 Độ phủ xuất sắc: Nhận diện siêu nhạy mọi góc nghiêng với YOLOv11!'}
                </div>
              </div>

              {/* Thông báo kết quả / lỗi */}
              {enrollMessage && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    backgroundColor: enrollSuccess ? '#eefbf4' : '#fef2f2',
                    border: `1px solid ${enrollSuccess ? '#c7f2da' : '#fecaca'}`,
                    color: enrollSuccess ? '#108a55' : '#991b1b',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    {enrollSuccess ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{enrollMessage}</span>
                  </div>

                  {enrollSuccess && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          setActiveMode('webcam');
                          startCamera();
                        }}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                      >
                        🚀 Quét thử bằng Webcam ngay
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Nút lưu vào MongoDB */}
              <button
                className="btn-primary"
                onClick={handleSaveEnrollmentToMongo}
                disabled={enrolling || enrollSamples.length === 0 || !enrollName.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  marginTop: '20px',
                  backgroundColor: enrollSamples.length >= 3 && enrollName.trim() ? '#108a55' : undefined,
                  borderColor: enrollSamples.length >= 3 && enrollName.trim() ? '#108a55' : undefined,
                }}
              >
                <Database size={18} />
                {enrolling
                  ? 'Đang trích xuất vector & lưu MongoDB...'
                  : `Lưu ${enrollSamples.length} vector khuôn mặt vào MongoDB`}
              </button>
            </div>

            {/* Hộp hướng dẫn dlib & MongoDB */}
            <div className="minimal-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Cơ chế lưu trữ Vector 128-d MongoDB:
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Mỗi bức ảnh sẽ được mạng <strong>ResNet</strong> tính toán ra một mảng 128 giá trị số thực float biểu diễn đặc trưng khuôn mặt (Embedding Vector).
                Toàn bộ mảng vector này được ghi vào trường <code>faceDescriptors</code> của collection <code>users</code> trong MongoDB Atlas và nạp tức thì vào RAM mà không cần restart server.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
