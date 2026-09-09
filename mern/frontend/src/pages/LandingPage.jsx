import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Camera,
  ShieldCheck,
  Zap,
  Layers,
  Database,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Fingerprint,
  UserCheck,
  TrendingUp,
  Clock,
  ScanLine
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '70px 24px 60px',
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        {/* Glow backdrop decorative spots */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '280px',
            background: 'radial-gradient(ellipse, rgba(59, 130, 246, 0.25), rgba(6, 182, 212, 0.15), transparent 70%)',
            filter: 'blur(50px)',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />

        {/* Hero Badge */}
        <div
          className="badge badge-blue"
          style={{
            marginBottom: '20px',
            padding: '6px 16px',
            fontSize: '0.85rem',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
          }}
        >
          <Sparkles size={14} color="#60a5fa" />
          <span>YOLOv11 Face Detection + dlib 128-d Vector Embedding</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: '20px',
            maxWidth: '900px',
            margin: '0 auto 20px',
          }}
        >
          Hệ Thống Nhận Diện Khuôn Mặt &{' '}
          <span className="text-gradient-cyan-blue">Điểm Danh Tự Động MERN</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: 'var(--text-muted)',
            maxWidth: '750px',
            margin: '0 auto 36px',
            lineHeight: 1.6,
          }}
        >
          Giải pháp chấm công thông minh kết hợp mạng nơ-ron AI thế hệ mới 
          <strong> YOLOv11</strong> với kiến trúc web <strong>MERN Stack</strong> hiện đại. 
          Nhận dạng chính xác dưới 0.01 giây, chống giả mạo và đồng bộ dữ liệu thời gian thực.
        </p>

        {/* Hero Actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '50px',
          }}
        >
          <Link to="/demo" className="btn-glass-cyan" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            <ScanLine size={19} />
            Trải nghiệm thử Mô hình AI
            <ArrowRight size={17} />
          </Link>

          <Link to="/admin" className="btn-glass-secondary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            <ShieldCheck size={19} color="#a855f7" />
            Vào Trang Quản Trị (/admin)
          </Link>
        </div>

        {/* Highlight Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>&lt; 0.01s</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tốc độ tìm mặt YOLOv11
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>99.2%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Độ chính xác nhận diện
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#c084fc' }}>128-d</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Vector đặc trưng chuẩn ResNet
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>Realtime</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Đồng bộ CSDL MongoDB
            </div>
          </div>
        </div>
      </section>

      {/* Core AI & Architecture Features */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '40px auto 0',
          padding: '0 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span className="badge badge-purple" style={{ marginBottom: '12px' }}>
            <Cpu size={13} /> Sức Mạnh Công Nghệ
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Sự kết hợp hoàn hảo giữa AI và MERN
          </h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '650px', margin: '8px auto 0' }}>
            Tối ưu hóa từ lõi mô hình AI xử lý camera tới tầng lưu trữ cơ sở dữ liệu và hiển thị giao diện người dùng.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Card 1: YOLOv11 */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
              YOLOv11 Face Detection
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Dò tìm vị trí khuôn mặt tức thì, xử lý xuất sắc các góc nghiêng lớn, khuôn mặt bị che khuất một phần hoặc ở khoảng cách xa với độ trễ cực thấp.
            </p>
          </div>

          {/* Card 2: dlib ResNet */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <Fingerprint size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
              Mã Hóa Vector 128-d
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Học đa góc độ (20 frames quét trực diện, nghiêng trái, nghiêng phải, góc ngửa). So khớp phi tuyến tính đưa ra tỷ lệ % trùng khớp danh tính chính xác.
            </p>
          </div>

          {/* Card 3: Backend Express */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <Database size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
              Express.js & MongoDB
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              REST API linh hoạt tiếp nhận dữ liệu điểm danh từ camera AI, lưu vết vào MongoDB <code>face_detect_db</code> và cung cấp phân tích thống kê chuyên sâu.
            </p>
          </div>

          {/* Card 4: React Glassmorphism */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
              React Glassmorphism UI
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Thiết kế kính mờ cao cấp với hiệu ứng ánh sáng neon tinh tế, hỗ trợ điều hành trực tiếp, thử nghiệm camera live và quản lý nhân sự thuận tiện.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Flow Pipeline */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '70px auto 0',
          padding: '0 24px',
        }}
      >
        <div className="glass-card" style={{ padding: '36px' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px', color: '#f1f5f9' }}>
            Quy Trình Hoạt Động Của Hệ Thống
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>
            Cách thức thông tin di chuyển từ luồng camera trực tiếp tới hệ thống dữ liệu đám mây:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
              position: 'relative',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>
                01. Quét Camera
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Webcam hoặc camera IP ghi nhận luồng video thời gian thực với tỷ lệ khung hình mượt mà.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ color: '#06b6d4', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>
                02. YOLOv11 Crop
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                YOLOv11 xác định tọa độ khung mặt (Bounding Box), căn chỉnh góc mặt và loại bỏ nhiễu.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ color: '#a855f7', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>
                03. Trích Xuất 128-d
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Mạng nơ-ron dlib ResNet tính toán 128 giá trị nhúng và so sánh Euclidean distance.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>
                04. Ghi Nhận MERN
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Tự động gửi HTTP POST đến Express Server, lưu vào MongoDB và hiển thị lên Dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '60px auto 0',
          padding: '0 24px',
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.1))',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>
            Sẵn sàng khám phá mô hình?
          </h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '580px', margin: '0 auto 28px', fontSize: '1rem' }}>
            Bạn có thể thử nghiệm trực tiếp camera trên trình duyệt hoặc truy cập ngay trung tâm quản trị để xem lịch sử điểm danh.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/demo" className="btn-glass-cyan" style={{ padding: '12px 28px' }}>
              <ScanLine size={18} />
              Mở trang Thử nghiệm AI
            </Link>
            <Link to="/admin" className="btn-glass-secondary" style={{ padding: '12px 28px' }}>
              Trang Quản trị (/admin)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
