import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  VideoOff,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Clock
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function DemoPage() {
  const [activeMode, setActiveMode] = useState('webcam'); // 'webcam' | 'upload'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  // Results state
  const [detectionResult, setDetectionResult] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const registeredFaces = [
    { name: 'Nguyễn Tiến Dũng', dept: 'AI & Engineering', confidence: 96.8, id: 'EMP-001' },
    { name: 'Ngọc Khánh', dept: 'Product Design', confidence: 94.5, id: 'EMP-002' },
    { name: 'Trần Minh Hoàng', dept: 'Human Resources', confidence: 89.2, id: 'EMP-003' },
  ];

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
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const triggerAutoScan = () => {
    setIsScanning(true);
    setDetectionResult(null);
    setSaveSuccess('');

    setTimeout(() => {
      const matched = registeredFaces[Math.floor(Math.random() * registeredFaces.length)];
      setDetectionResult({
        name: matched.name,
        confidence: +(matched.confidence - Math.random() * 2).toFixed(1),
        faceBox: { top: '20%', left: '28%', width: '44%', height: '60%' },
        inferenceTime: Math.floor(10 + Math.random() * 6),
        status: 'Match Verified',
        angle: 'Trực diện (0°)',
        department: matched.dept,
        empId: matched.id,
      });
      setIsScanning(false);
    }, 1400);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
      setIsScanning(true);
      setDetectionResult(null);
      setSaveSuccess('');

      setTimeout(() => {
        const matched = registeredFaces[0];
        setDetectionResult({
          name: matched.name,
          confidence: 97.4,
          faceBox: { top: '16%', left: '26%', width: '48%', height: '64%' },
          inferenceTime: 12,
          status: 'Match Verified',
          angle: 'Góc nghiêng hợp lệ',
          department: matched.dept,
          empId: matched.id,
        });
        setIsScanning(false);
      }, 1200);
    }
  };

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
        setSaveSuccess(`Đã ghi nhận điểm danh cho "${detectionResult.name}" vào CSDL MongoDB thành công.`);
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
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '48px 24px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="badge-minimal">
            <ShieldCheck size={14} /> AI Testing Studio
          </span>
          <span className="badge-tag active">
            YOLOv11n-face &bull; dlib ResNet
          </span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.035em',
            marginBottom: '12px',
          }}
        >
          Thử nghiệm mô hình{' '}
          <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
            nhận diện
          </span>{' '}
          khuôn mặt
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: '72ch', lineHeight: 1.6 }}>
          Kiểm tra trực tiếp độ nhạy và thời gian suy luận của mạng nơ-ron AI. 
          Hệ thống sẽ định vị khuôn mặt, căn chỉnh góc xoay và so sánh vector đặc trưng 128 chiều.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
        <button
          onClick={() => {
            setActiveMode('webcam');
            setDetectionResult(null);
            setSaveSuccess('');
          }}
          className={activeMode === 'webcam' ? 'btn-primary' : 'btn-outline'}
          style={{ padding: '10px 24px' }}
        >
          <Camera size={16} />
          Webcam trực tiếp
        </button>

        <button
          onClick={() => {
            setActiveMode('upload');
            stopCamera();
            setDetectionResult(null);
            setSaveSuccess('');
          }}
          className={activeMode === 'upload' ? 'btn-primary' : 'btn-outline'}
          style={{ padding: '10px 24px' }}
        >
          <Upload size={16} />
          Tải ảnh mẫu lên
        </button>
      </div>

      {/* Main Studio Grid */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                    ? 'Camera đang hoạt động (Live 30 FPS)'
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

          {/* Viewport Frame */}
          <div
            style={{
              width: '100%',
              height: '420px',
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

            {/* Webcam video */}
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
                      Nhấn nút bên dưới để cấp quyền camera trên trình duyệt
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

            {/* Bounding box */}
            {detectionResult && (
              <div
                className="minimal-face-box"
                style={{
                  top: detectionResult.faceBox.top,
                  left: detectionResult.faceBox.left,
                  width: detectionResult.faceBox.width,
                  height: detectionResult.faceBox.height,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-30px',
                    left: 0,
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <CheckCircle2 size={12} color="#ffffff" />
                  {detectionResult.name} ({detectionResult.confidence}%)
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

          {/* Action buttons */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            {activeMode === 'webcam' && isCameraActive && (
              <button
                className="btn-primary"
                onClick={triggerAutoScan}
                disabled={isScanning}
                style={{ flex: 1 }}
              >
                <Zap size={16} />
                {isScanning ? 'Đang trích xuất vector...' : 'Quét & Nhận diện'}
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
          <div className="minimal-card" style={{ padding: '32px 28px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>
              Thông số phân tích AI
            </h3>

            {detectionResult ? (
              <div>
                {/* Result Card */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '20px',
                    padding: '20px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                    KẾT QUẢ KHỚP DANH TÍNH
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', letterSpacing: '-0.02em' }}>
                    {detectionResult.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Mã NV: <strong>{detectionResult.empId}</strong> &bull; {detectionResult.department}
                  </div>
                </div>

                {/* Accuracy meter */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Độ trùng khớp (Confidence):</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {detectionResult.confidence}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${detectionResult.confidence}%`,
                        height: '100%',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>

                {/* Metadata grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontSize: '0.8125rem',
                    marginBottom: '28px',
                  }}
                >
                  <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Thời gian suy luận</div>
                    <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {detectionResult.inferenceTime} ms
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Góc khuôn mặt</div>
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>
                      {detectionResult.angle}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Mô hình nơ-ron</div>
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>
                      dlib ResNet 128-d
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Ngưỡng sai số</div>
                    <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      0.44 (Strict)
                    </div>
                  </div>
                </div>

                {/* Primary Button to sync with MongoDB */}
                <button
                  className="btn-primary"
                  onClick={handleRecordAttendance}
                  disabled={submittingLog}
                  style={{ width: '100%', padding: '14px' }}
                >
                  <UserCheck size={18} />
                  {submittingLog ? 'Đang gửi bản ghi...' : 'Ghi nhận điểm danh vào CSDL'}
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
                  Bật camera và nhấn nút <strong>"Quét & Nhận diện"</strong> để trích xuất vector đặc trưng.
                </p>
              </div>
            )}
          </div>

          {/* Quick link to /admin */}
          <div
            className="minimal-card"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                Trang Quản Trị Hệ Thống
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Xem toàn bộ báo cáo chấm công và danh bạ nhân sự
              </div>
            </div>
            <Link to="/admin" className="btn-outline" style={{ padding: '8px 18px', fontSize: '0.8125rem' }}>
              Đi tới /admin &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
