import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Zap,
  Database,
  Star,
  ShieldCheck,
  ScanLine,
  ArrowUpRight,
  Clock,
  Layers
} from 'lucide-react';

export default function LandingPage() {
  const [emailInput, setEmailInput] = useState('');
  const navigate = useNavigate();

  const handleQuickStart = (e) => {
    e.preventDefault();
    navigate('/demo');
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {/* Background Video (Vertically flipped scaleY(-1) with white gradient overlay as specified in design.md) */}
      <div className="hero-video-container">
        <video
          className="hero-video"
          autoPlay
          loop
          muted
          playsInline
          poster="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80"
        >
          {/* Subtle slow motion cloud/water movement */}
          <source
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
            type="video/mp4"
          />
        </video>
        <div className="hero-gradient-overlay" />
      </div>

      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '240px 24px 100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Social Proof Badge */}
        <div
          className="badge-minimal"
          style={{
            marginBottom: '28px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f59e0b' }}>
            <Star size={13} fill="#f59e0b" />
            <Star size={13} fill="#f59e0b" />
            <Star size={13} fill="#f59e0b" />
            <Star size={13} fill="#f59e0b" />
            <Star size={13} fill="#f59e0b" />
          </div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '4px' }}>
            4.9/5
          </span>
          <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Hệ thống AI nhận diện 99.2% chính xác
          </span>
        </div>

        {/* Headline with Geist + Instrument Serif italic */}
        <h1
          style={{
            fontSize: 'clamp(2.6rem, 5.5vw, 4.8rem)',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.04em',
            maxWidth: '960px',
            marginBottom: '24px',
            color: 'var(--text-primary)',
          }}
        >
          Quản lý nhân sự và điểm danh{' '}
          <span
            className="font-accent-italic"
            style={{
              fontSize: '1.2em',
              fontWeight: 400,
              color: 'var(--text-secondary)',
              padding: '0 4px',
            }}
          >
            chính xác
          </span>{' '}
          bằng thị giác AI.
        </h1>

        {/* Subtitle - 18px, opacity 80%, max 72ch */}
        <p
          style={{
            fontSize: '1.125rem',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            opacity: 0.85,
            maxWidth: '68ch',
            marginBottom: '44px',
          }}
        >
          Kết hợp tốc độ dò tìm vị trí mặt của <strong>YOLOv11</strong> và thuật toán nhúng 
          vector 128 chiều <strong>dlib ResNet</strong> trên nền tảng <strong>MERN Stack</strong>. 
          Điểm danh tức thì dưới 0.01 giây, loại bỏ hoàn toàn gian lận chấm công.
        </p>

        {/* Input Pill & CTA Form (rounded 40px with soft shadow) */}
        <form onSubmit={handleQuickStart} style={{ marginBottom: '32px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="input-hero-pill">
            <input
              type="text"
              placeholder="Nhập tên nhân viên để thử nghiệm..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0, padding: '10px 24px' }}>
              Thử nghiệm AI
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Action Link to /admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/admin"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--rounded-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: '#ffffff',
            }}
          >
            Vào Trang Quản Trị (/admin)
            <ArrowUpRight size={14} />
          </Link>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Không cần cài đặt thêm &bull; Trực tiếp trên trình duyệt
          </span>
        </div>
      </section>

      {/* Key Numbers Row (Minimalist cards) */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto 80px',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          <div className="minimal-card" style={{ padding: '32px 28px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.04em' }}>
              &lt; 0.01s
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '8px' }}>
              Dò tìm khuôn mặt
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              YOLOv11 định vị khuôn mặt cực nhanh, bắt góc nghiêng cực đại và che khuất.
            </p>
          </div>

          <div className="minimal-card" style={{ padding: '32px 28px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.04em' }}>
              99.2%
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '8px' }}>
              Độ chính xác xác thực
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              Tính toán độ trùng khớp danh tính dựa trên khoảng cách Euclidean phi tuyến tính.
            </p>
          </div>

          <div className="minimal-card" style={{ padding: '32px 28px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.04em' }}>
              128-d
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '8px' }}>
              Vector đặc trưng chuẩn
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              Học 20 góc mặt của từng nhân viên, nạp dữ liệu encodings trong chớp mắt.
            </p>
          </div>

          <div className="minimal-card" style={{ padding: '32px 28px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.04em' }}>
              Realtime
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '8px' }}>
              Đồng bộ CSDL MongoDB
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Bản ghi điểm danh được Express lưu tức thời và cập nhật trên Dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Section 1: Zig-Zag Alternating Layout (Text Left, Visual Right) */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto 120px',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '60px',
            alignItems: 'center',
          }}
        >
          {/* Text Left */}
          <div>
            <div className="badge-minimal" style={{ marginBottom: '16px' }}>
              <Zap size={14} /> Giai đoạn 1: Dò tìm siêu tốc
            </div>
            <h2
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.035em',
                marginBottom: '20px',
                lineHeight: 1.15,
              }}
            >
              YOLOv11 Face &mdash; Bắt góc khuôn mặt{' '}
              <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
                hoàn hảo
              </span>
            </h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '24px' }}>
              Mô hình YOLOv11n-face chuyên dụng dò quét từng khung hình webcam ở độ phân giải gốc. 
              Thuật toán tự động tìm kiếm vị trí khuôn mặt, loại bỏ nhiễu nền và cắt chuẩn xác 
              vùng mặt ngay cả khi người dùng đeo kính, nghiêng đầu hoặc đứng xa camera.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Định vị Bounding Box chính xác trong dưới 10ms
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Khả năng thích ứng với điều kiện ánh sáng yếu hoặc ngược sáng
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Chỉ cho phép chụp mẫu khi có đúng 1 khuôn mặt rõ nét
              </li>
            </ul>
          </div>

          {/* Visual Right */}
          <div
            className="minimal-card"
            style={{
              padding: '36px',
              backgroundColor: 'var(--bg-neutral)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--rounded-card)',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#108a55' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    yolov11n-face.pt
                  </span>
                </div>
                <span className="badge-tag active">Confidence: 98.6%</span>
              </div>

              {/* Simulated Detection Box Frame */}
              <div
                style={{
                  height: '240px',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '130px',
                    height: '150px',
                    border: '2px solid #1a1a1a',
                    borderRadius: '12px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: '#1a1a1a',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      alignSelf: 'flex-start',
                    }}
                  >
                    Face #1 (98.6%)
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    128-d aligned
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>Scale: 0.5x</span>
                <span>Inference: 8.4ms</span>
                <span>IoU: 0.70</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 2: Zig-Zag Alternating Layout (Visual Left, Text Right) */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto 120px',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '60px',
            alignItems: 'center',
          }}
        >
          {/* Visual Left */}
          <div
            className="minimal-card"
            style={{
              padding: '36px',
              backgroundColor: 'var(--bg-neutral)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--rounded-card)',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '14px' }}>
                HỌC ĐA GÓC ĐỘ (20 FRAMES / NGƯỜI)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
                {['Trực diện', 'Nghiêng T', 'Nghiêng P', 'Ngửa mặt'].map((label, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 6px',
                      backgroundColor: 'var(--bg-muted)',
                      borderRadius: '10px',
                      textAlign: 'center',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>5/5</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-muted)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div>encodings.pkl &bull; 128 float64 values</div>
                <div style={{ color: '#108a55', marginTop: '4px' }}>
                  Tolerance threshold: 0.44 (Strictest)
                </div>
              </div>
            </div>
          </div>

          {/* Text Right */}
          <div>
            <div className="badge-minimal" style={{ marginBottom: '16px' }}>
              <Fingerprint size={14} /> Giai đoạn 2: Mã hóa đặc trưng 128 chiều
            </div>
            <h2
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.035em',
                marginBottom: '20px',
                lineHeight: 1.15,
              }}
            >
              Trích xuất vector nhúng{' '}
              <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
                bất biến
              </span>{' '}
              với dlib ResNet
            </h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '24px' }}>
              Mỗi khuôn mặt được chuyển đổi thành một vector toán học 128 chiều duy nhất. 
              Khi nhân viên đứng trước camera, hệ thống so sánh khoảng cách Euclidean giữa 
              khuôn mặt hiện tại và các vector đã nạp, quy đổi thành tỷ lệ phần trăm (%) trùng khớp chính xác.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Cơ chế đóng băng màn hình (Freeze Screen) xác thực điểm danh
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Chống spam: Delay thông minh giữa các lần chấm công của cùng một người
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#108a55" />
                Lưu trữ vector nén gọn nhẹ, tải vào RAM trong dưới 0.01 giây
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Editorial Architecture Pipeline */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto 120px',
          padding: '0 24px',
        }}
      >
        <div
          className="minimal-card"
          style={{
            padding: '48px 40px',
            backgroundColor: 'var(--bg-neutral)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ maxWidth: '640px', marginBottom: '40px' }}>
            <span className="badge-minimal" style={{ marginBottom: '12px' }}>
              <Database size={13} /> Kiến trúc luồng dữ liệu
            </span>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
              Từ luồng Camera đến Cơ sở dữ liệu MERN
            </h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9375rem' }}>
              Hệ thống được thiết kế theo mô hình phân tầng độc lập, đảm bảo khả năng mở rộng và tốc độ phản hồi tức thời.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '8px' }}>
                BƯỚC 01
              </div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                Webcam Stream
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Thu nhận khung hình trực tiếp với tốc độ 30 FPS qua giao thức chuẩn OpenCV / trình duyệt.
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '8px' }}>
                BƯỚC 02
              </div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                YOLOv11 Crop
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Xác định tọa độ vùng mặt, căn chỉnh góc xoay và gửi ảnh đã chuẩn hóa đến bộ trích xuất.
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '8px' }}>
                BƯỚC 03
              </div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                ResNet 128-d
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Tính toán độ tương đồng với danh bạ vector, xác thực tên người dùng và tỷ lệ tin cậy.
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '8px' }}>
                BƯỚC 04
              </div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                Express & MongoDB
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Ghi nhận lịch sử điểm danh qua REST API và cập nhật theo thời gian thực trên trang Quản trị.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Final Section */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto 120px',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          className="minimal-card"
          style={{
            padding: '64px 32px',
            backgroundColor: 'var(--text-primary)',
            color: '#ffffff',
            borderRadius: 'var(--rounded-md)',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.04em',
              marginBottom: '16px',
            }}
          >
            Trải nghiệm hệ thống ngay hôm nay
          </h2>
          <p
            style={{
              fontSize: '1.125rem',
              color: '#a1a1aa',
              maxWidth: '56ch',
              margin: '0 auto 36px',
              lineHeight: 1.6,
            }}
          >
            Khởi động camera trực tiếp trên trình duyệt để kiểm tra khả năng nhận diện hoặc xem báo cáo chấm công tại trang quản trị.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              to="/demo"
              style={{
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                padding: '14px 32px',
                borderRadius: 'var(--rounded-sm)',
                fontWeight: 600,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <ScanLine size={18} />
              Mở trang Thử nghiệm AI
            </Link>

            <Link
              to="/admin"
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.25)',
                padding: '14px 30px',
                borderRadius: 'var(--rounded-sm)',
                fontWeight: 600,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              Trang Quản trị (/admin)
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
