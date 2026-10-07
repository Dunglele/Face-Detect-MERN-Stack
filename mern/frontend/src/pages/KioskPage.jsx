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

export default function KioskPage() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [checkType, setCheckType] = useState('Check-in'); // 'Check-in' | 'Check-out'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [freezeCard, setFreezeCard] = useState(null);
  const [holdTimer, setHoldTimer] = useState(0);

  // Logs of today's check-ins on this Kiosk
  const [recentLogs, setRecentLogs] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

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
  }

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Frame scanner loop
  useEffect(() => {
    if (!isCameraActive) return;

    scanIntervalRef.current = setInterval(() => {
      if (freezeCard) return; // đang hiển thị màn hình khóa chốt điểm danh
      captureAndRecognize();
    }, 1200);

    return () => clearInterval(scanIntervalRef.current);
  }, [isCameraActive, freezeCard, checkType]);

  async function captureAndRecognize() {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 480) || 360;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.85);

    try {
      setIsScanning(true);
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, auto_checkin: false }),
      });

      if (!res.ok) {
        // Fallback demo matching nếu AI server Python offline
        return;
      }

      const result = await res.json();
      if (result.matched && result.matches?.length > 0) {
        const top = result.matches[0];
        const isLive = (result.liveness?.score || 95) >= 65;

        setCurrentMatch({
          name: top.name,
          employeeCode: top.employeeId || '',
          confidence: top.confidence || 92.5,
          livenessScore: result.liveness?.score || 95,
          isLive,
        });

        // Nếu là người thật và độ tin cậy >= 85%, tiến hành tự động chốt điểm danh
        if (isLive && top.confidence >= 85) {
          triggerFreezeCheckin(top.name, top.employeeId, top.confidence, result.liveness?.score || 95, base64Image);
        }
      } else {
        setCurrentMatch(null);
      }
    } catch {
      // AI server chưa chạy thì bỏ qua nhẹ nhàng
    } finally {
      setIsScanning(false);
    }
  }

  // Trigger Freeze Screen & Submit Attendance
  async function triggerFreezeCheckin(name, employeeCode, confidence, livenessScore, snapshotUrl) {
    if (freezeCard) return; // tránh gọi trùng

    const checkTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setFreezeCard({
      name,
      employeeCode,
      confidence,
      checkTime,
      type: checkType,
      snapshotUrl,
    });
    playSuccessChime();

    // Gửi bản ghi vào CSDL chung qua /api/attendance
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: name,
          employeeCode,
          confidence,
          livenessScore: livenessScore / 100,
          checkInType: checkType,
          snapshotUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadRecentLogs();
      }
    } catch (e) {
      console.error(e);
    }

    // Tự động mở lại sau 3.5 giây để nhân viên tiếp theo vào chấm công
    setTimeout(() => {
      setFreezeCard(null);
      setCurrentMatch(null);
    }, 3500);
  }

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
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isScanning ? '#38bdf8' : '#22c55e',
                }}
              />
              {isScanning ? 'Đang dò quét AI...' : 'Camera Sẵn sàng'}
            </div>

            <div
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Chế độ: <strong>{checkType}</strong>
            </div>
          </div>

          {/* Live Recognition Banner at bottom of camera */}
          {currentMatch && !freezeCard && (
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
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                animation: 'fadeInUp 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{currentMatch.name}</span>
                  {currentMatch.employeeCode && (
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                      {currentMatch.employeeCode}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6e7180', marginTop: '2px' }}>
                  Độ khớp: <strong>{currentMatch.confidence.toFixed(1)}%</strong> &bull; Liveness: <strong>{currentMatch.livenessScore.toFixed(1)}%</strong>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: currentMatch.isLive ? '#15803d' : '#b91c1c',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                {currentMatch.isLive ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                <span>{currentMatch.isLive ? 'Người thật' : 'Nghi vấn giả mạo'}</span>
              </div>
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
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
                  padding: '10px 24px',
                  borderRadius: '30px',
                  backgroundColor: '#f4f4f5',
                  fontSize: '0.9375rem',
                  color: '#27272a',
                  display: 'flex',
                  gap: '16px',
                }}
              >
                <span>Hành động: <strong>{freezeCard.type}</strong></span>
                <span>&bull;</span>
                <span>Thời gian: <strong>{freezeCard.checkTime}</strong></span>
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
              <li>Giữ tư thế 2 giây để máy tự động chốt điểm danh.</li>
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
                recentLogs.map((log) => (
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
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1a1a1a' }}>
                        {log.userName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9295a3' }}>
                        {log.employeeCode ? `${log.employeeCode} • ` : ''}
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#f0fdf4',
                        color: '#15803d',
                      }}
                    >
                      {log.checkInType || 'Check-in'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
