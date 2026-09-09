import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  VideoOff,
  Scan,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Cpu,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Zap
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function DemoPage() {
  const [activeMode, setActiveMode] = useState('webcam'); // 'webcam' | 'upload'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  // Detection Results
  const [detectionResult, setDetectionResult] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Mock list of registered personnel in the face recognition model
  const registeredFaces = [
    { name: 'Nguyễn Tiến Dũng', dept: 'AI & Engineering', confidence: 96.8, id: 'EMP-001' },
    { name: 'Ngọc Khánh', dept: 'Product Design', confidence: 94.5, id: 'EMP-002' },
    { name: 'Trần Minh Hoàng', dept: 'Human Resources', confidence: 89.2, id: 'EMP-003' },
  ];

  // Start Webcam
  const startCamera = async () => {
    setCameraError('');
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
      triggerAutoScan();
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Không thể mở Camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt của bạn.');
      setIsCameraActive(false);
    }
  };

  // Stop Webcam
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
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Simulate scanning action
  const triggerAutoScan = () => {
    setIsScanning(true);
    setDetectionResult(null);
    setSaveSuccess('');

    setTimeout(() => {
      // Pick a match from registered faces
      const matched = registeredFaces[Math.floor(Math.random() * registeredFaces.length)];
      setDetectionResult({
        name: matched.name,
        confidence: +(matched.confidence - Math.random() * 2).toFixed(1),
        faceBox: { top: '22%', left: '30%', width: '40%', height: '56%' },
        inferenceTime: Math.floor(11 + Math.random() * 8), // ms
        status: 'Match Verified',
        angle: 'Trực diện (0°)',
        department: matched.dept,
        empId: matched.id,
      });
      setIsScanning(false);
    }, 1600);
  };

  // Handle uploaded image
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
      setIsScanning(true);
      setDetectionResult(null);
      setSaveSuccess('');

      setTimeout(() => {
        const matched = registeredFaces[0]; // Nguyen Tien Dung
        setDetectionResult({
          name: matched.name,
          confidence: 97.4,
          faceBox: { top: '18%', left: '28%', width: '44%', height: '58%' },
          inferenceTime: 14,
          status: 'Match Verified',
          angle: 'Đa góc độ hợp lệ',
          department: matched.dept,
          empId: matched.id,
        });
        setIsScanning(false);
      }, 1400);
    }
  };

  // Push detected check-in to Express Backend & MongoDB
  const handleRecordAttendance = async () => {
    if (!detectionResult) return;
    setSubmittingLog(true);
    setSaveSuccess('');

    const payload = {
      userName: detectionResult.name,
      confidence: detectionResult.confidence,
      checkInType: 'Check-in',
      status: 'Present',
    };

    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(`Đã ghi nhận điểm danh cho "${detectionResult.name}" vào CSDL MongoDB thành công!`);
      } else {
        setSaveSuccess(`Đã lưu phiên điểm danh mô phỏng cho "${detectionResult.name}".`);
      }
    } catch {
      setSaveSuccess(`Đã lưu phiên điểm danh cho "${detectionResult.name}" (Backend offline, hiển thị demo).`);
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-blue">
            <Sparkles size={14} /> AI Testing Studio
          </span>
          <span className="badge badge-purple">
            <Cpu size={14} /> YOLOv11n-face.pt
          </span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Trải Nghiệm Thử Nghiệm <span className="text-gradient-cyan-blue">Mô Hình Nhận Diện</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '750px', marginTop: '6px' }}>
          Kiểm tra khả năng tìm kiếm tọa độ mặt và so khớp vector đặc trưng 128 chiều. 
          Bạn có thể mở trực tiếp webcam hoặc tải ảnh lên để kiểm tra độ nhạy và tỷ lệ khớp.
        </p>
      </div>

      {/* Mode Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        <button
          onClick={() => {
            setActiveMode('webcam');
            setDetectionResult(null);
            setSaveSuccess('');
          }}
          className={activeMode === 'webcam' ? 'btn-glass-primary' : 'btn-glass-secondary'}
          style={{ padding: '10px 20px' }}
        >
          <Camera size={18} />
          Webcam Trực Tiếp (Live)
        </button>

        <button
          onClick={() => {
            setActiveMode('upload');
            stopCamera();
            setDetectionResult(null);
            setSaveSuccess('');
          }}
          className={activeMode === 'upload' ? 'btn-glass-primary' : 'btn-glass-secondary'}
          style={{ padding: '10px 20px' }}
        >
          <Upload size={18} />
          Tải Ảnh Khuôn Mặt Lên
        </button>
      </div>

      {/* Main Studio Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Camera / Image Viewport */}
        <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="pulse-indicator"
                style={{ background: isCameraActive ? '#10b981' : '#94a3b8' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {activeMode === 'webcam'
                  ? isCameraActive
                    ? 'Camera Hoạt Động (Live Stream)'
                    : 'Camera Đang Tắt'
                  : 'Chế độ Tải Ảnh'}
              </span>
            </div>

            {activeMode === 'webcam' && (
              <div>
                {!isCameraActive ? (
                  <button className="btn-glass-cyan" onClick={startCamera} style={{ padding: '7px 16px', fontSize: '0.85rem' }}>
                    <Camera size={15} /> Bật Camera
                  </button>
                ) : (
                  <button className="btn-glass-secondary" onClick={stopCamera} style={{ padding: '7px 16px', fontSize: '0.85rem' }}>
                    <VideoOff size={15} /> Tắt Camera
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Viewport Box */}
          <div
            style={{
              width: '100%',
              height: '420px',
              borderRadius: '14px',
              background: '#070a10',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Laser scanning bar when scanning */}
            {isScanning && <div className="scanner-laser" />}

            {/* Mode: Webcam */}
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
                    transform: 'scaleX(-1)', // mirror for natural feel
                  }}
                />

                {!isCameraActive && (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Camera size={30} color="var(--text-muted)" />
                    </div>
                    <p style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '6px' }}>
                      Camera chưa được kích hoạt
                    </p>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                      Nhấn nút bên dưới để cấp quyền webcam và bắt đầu nhận diện
                    </p>
                    <button className="btn-glass-cyan" onClick={startCamera}>
                      <Camera size={16} /> Bật Camera Ngay
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Mode: Image Upload */}
            {activeMode === 'upload' && (
              <>
                {uploadedImage ? (
                  <img
                    src={uploadedImage}
                    alt="Uploaded face sample"
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
                      padding: '30px',
                      textAlign: 'center',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <Upload size={36} color="#38bdf8" style={{ marginBottom: '12px' }} />
                    <p style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                      Nhấp để chọn ảnh chân dung
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Định dạng JPG, PNG (khuyên dùng ảnh rõ mặt)
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

            {/* Simulated YOLOv11 Bounding Box Overlay */}
            {detectionResult && (
              <div
                className="face-bounding-box"
                style={{
                  top: detectionResult.faceBox.top,
                  left: detectionResult.faceBox.left,
                  width: detectionResult.faceBox.width,
                  height: detectionResult.faceBox.height,
                  borderColor: detectionResult.confidence > 85 ? '#10b981' : '#f59e0b',
                }}
              >
                {/* Header Tag on Box */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-32px',
                    left: 0,
                    background: detectionResult.confidence > 85 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)',
                    backdropFilter: 'blur(8px)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} />
                  {detectionResult.name} ({detectionResult.confidence}%)
                </div>
              </div>
            )}

            {/* Error message */}
            {cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: '20px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{cameraError}</span>
              </div>
            )}
          </div>

          {/* Controls below viewport */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '18px',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            {activeMode === 'webcam' && isCameraActive && (
              <button
                className="btn-glass-primary"
                onClick={triggerAutoScan}
                disabled={isScanning}
                style={{ flex: 1, minWidth: '180px' }}
              >
                <Scan size={17} />
                {isScanning ? 'Đang phân tích YOLO...' : 'Quét & Nhận diện'}
              </button>
            )}

            {activeMode === 'upload' && (
              <label className="btn-glass-secondary" style={{ cursor: 'pointer', flex: 1 }}>
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

        {/* Right Column: AI Telemetry & Recognition Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Recognition Telemetry */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Cpu size={18} color="#38bdf8" />
              Chỉ Số Phân Tích Mô Hình (Telemetry)
            </h3>

            {detectionResult ? (
              <div>
                {/* Matched Name Card */}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '14px',
                    padding: '18px',
                    marginBottom: '18px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.05em' }}>
                    DANH TÍNH XÁC NHẬN
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#fff' }}>
                    {detectionResult.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Mã NV: <strong>{detectionResult.empId}</strong> • Phòng ban: {detectionResult.department}
                  </div>
                </div>

                {/* Progress bar Confidence */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Độ trùng khớp danh tính (%):</span>
                    <span style={{ fontWeight: 800, color: '#34d399' }}>{detectionResult.confidence}%</span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${detectionResult.confidence}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>

                {/* Technical stats grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    fontSize: '0.8rem',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Thời gian suy luận</div>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                      {detectionResult.inferenceTime} ms
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Góc khuôn mặt</div>
                    <div style={{ fontWeight: 700, color: '#c084fc', marginTop: '2px' }}>
                      {detectionResult.angle}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Bộ trích xuất</div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', marginTop: '2px' }}>
                      dlib ResNet 128-d
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Ngưỡng chấp nhận</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                      Tolerance: 0.44
                    </div>
                  </div>
                </div>

                {/* Direct Action: Record Attendance to MongoDB */}
                <button
                  className="btn-glass-cyan"
                  onClick={handleRecordAttendance}
                  disabled={submittingLog}
                  style={{ width: '100%', padding: '12px' }}
                >
                  <UserCheck size={18} />
                  {submittingLog ? 'Đang ghi vào MongoDB...' : 'Ghi nhận điểm danh vào CSDL'}
                </button>

                {saveSuccess && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} />
                      <span>{saveSuccess}</span>
                    </div>
                    <Link
                      to="/admin"
                      style={{
                        color: '#38bdf8',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Xem lượt điểm danh tại trang Quản trị (/admin) &rarr;
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-dim)' }}>
                <Zap size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Chưa có dữ liệu nhận diện
                </p>
                <p style={{ fontSize: '0.785rem', marginTop: '4px' }}>
                  Bật camera hoặc tải ảnh lên rồi nhấn <strong>"Quét & Nhận diện"</strong> để xem phân tích AI.
                </p>
              </div>
            )}
          </div>

          {/* Quick link to /admin */}
          <div
            className="glass-card"
            style={{
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                Trang Quản Trị Hệ Thống
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Xem toàn bộ lịch sử điểm danh và hồ sơ nhân sự
              </div>
            </div>
            <Link to="/admin" className="btn-glass-secondary" style={{ padding: '8px 16px', fontSize: '0.825rem' }}>
              Đi tới /admin &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
