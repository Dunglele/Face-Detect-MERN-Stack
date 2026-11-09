import React from 'react';
import { Link } from 'react-router-dom';

const MANAGER_PORTAL_URL = import.meta.env.VITE_MANAGER_PORTAL_URL || 'http://localhost:3000';
import {
  ArrowRight,
  ArrowUpRight,
  ScanFace,
  ShieldCheck,
  Cpu,
  Sparkles,
  Layers,
  Check,
  UserCheck,
  Database,
  Eye,
  Camera,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import './LandingPage.css';

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Đăng ký & Quản trị',
    system: 'AIAttendanceWeb3 (Port 3000)',
    desc: 'Đăng ký vector khuôn mặt nhân viên, thiết lập ca kíp, phân quyền và neo hồ sơ xác thực trên blockchain.',
    icon: Database,
    badge: 'Quản lý tập trung',
  },
  {
    step: '02',
    title: 'Chấm công tức thì',
    system: 'Kiosk Station (Port 5173 /kiosk)',
    desc: 'Nhân viên đứng trước camera kiosk. YOLOv11 phát hiện khuôn mặt, dlib ResNet khớp định danh và MiniFASNet loại bỏ giả mạo trong tích tắc.',
    icon: ScanFace,
    badge: 'Edge / Kiosk AI',
  },
  {
    step: '03',
    title: 'Theo dõi & Trợ lý cá nhân',
    system: 'Cổng Nhân Viên (Port 5173 /portal)',
    desc: 'Nhân viên chủ động xem bảng công tháng, gửi đơn nghỉ phép và nhận phản hồi tức thì từ Trợ lý ảo AI.',
    icon: Sparkles,
    badge: 'Tự phục vụ',
  },
];

const HIGHLIGHTS = [
  {
    title: 'YOLOv11 Face Detector',
    desc: 'Định vị khuôn mặt đa góc độ với độ trễ cực thấp, chịu điều kiện thiếu sáng hoặc nghiêng góc.',
    icon: Eye,
  },
  {
    title: 'dlib ResNet Embedding',
    desc: 'Vector đặc trưng 128 chiều tối ưu cho so khớp định danh sinh trắc học chuẩn xác.',
    icon: Cpu,
  },
  {
    title: 'MiniFASNet Anti-Spoofing',
    desc: 'Phân tích độ sống sinh trắc học thời gian thực, ngăn chặn giả mạo bằng màn hình hoặc ảnh in.',
    icon: ShieldCheck,
  },
  {
    title: 'Kiến trúc Microservices',
    desc: 'Tách biệt rõ ràng Kiosk/Nhân viên (FaceMERN) và Quản trị/Web3/PhoBERT (AIAttendanceWeb3).',
    icon: Layers,
  },
];

export default function LandingPage() {
  return (
    <div className="landing-editorial">
      {/* Split-screen Hero: Text Left / Visual Right (design.md) */}
      <section className="landing-hero-section">
        <div className="landing-container landing-hero-grid">
          {/* Left Column: Text & Editorial Typography */}
          <div className="landing-hero-content">
            <div className="landing-hero-badge">
              <span className="landing-badge-dot" />
              <span className="landing-badge-label">Kiến Trúc Microservices 2026</span>
              <span className="landing-badge-sep">•</span>
              <span className="landing-badge-desc">Kiosk & Cổng Nhân Viên</span>
            </div>

            <h1 className="landing-hero-title">
              Chấm công sinh trắc học{' '}
              <span className="font-accent-italic">chuẩn xác</span> bằng thị giác AI.
            </h1>

            <p className="landing-hero-subtitle">
              Kết hợp tốc độ bắt diện <strong>YOLOv11 Face</strong>, mạng nhúng vector{' '}
              <strong>dlib ResNet</strong> 128 chiều và kiểm định độ sống <strong>MiniFASNet</strong>.
              Giao diện tối giản thiết kế riêng cho trạm kiosk và cổng tự phục vụ nhân viên.
            </p>

            <div className="landing-hero-cta">
              <Link to="/kiosk" className="btn-primary landing-btn-pill">
                <Camera size={18} />
                <span>Mở Kiosk Chấm Công</span>
                <ArrowRight size={16} />
              </Link>

              <Link to="/portal" className="btn-outline landing-btn-pill">
                <UserCheck size={18} />
                <span>Cổng Nhân Viên</span>
              </Link>
            </div>

            {/* Meta Strip */}
            <div className="landing-meta-strip">
              <div className="landing-meta-item">
                <span className="landing-meta-value">YOLOv11</span>
                <span className="landing-meta-tag">Face Detect</span>
              </div>
              <div className="landing-meta-divider" />
              <div className="landing-meta-item">
                <span className="landing-meta-value">128-D</span>
                <span className="landing-meta-tag">dlib Vector</span>
              </div>
              <div className="landing-meta-divider" />
              <div className="landing-meta-item">
                <span className="landing-meta-value">MiniFASNet</span>
                <span className="landing-meta-tag">Anti-Spoof</span>
              </div>
            </div>
          </div>

          {/* Right Column: Local Simulated Kiosk Viewfinder Visual (No external URLs) */}
          <div className="landing-hero-visual">
            <div className="landing-kiosk-kard minimal-card">
              <div className="landing-kiosk-kard-header">
                <div className="landing-kiosk-live-badge">
                  <span className="pulse-dot" />
                  <span>MÔ PHỎNG GIAO DIỆN KIOSK</span>
                </div>
                <div className="landing-kiosk-res">1280 × 720 (16:9)</div>
              </div>

              {/* Viewfinder simulation using pure CSS and inline SVG */}
              <div className="landing-kiosk-screen">
                {/* Crosshairs & Scanning laser */}
                <div className="landing-kiosk-laser" />

                {/* Oval Guide Target */}
                <div className="landing-kiosk-oval-target">
                  {/* Subtle Wireframe Face SVG */}
                  <svg
                    viewBox="0 0 160 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="landing-face-vector"
                  >
                    <ellipse cx="80" cy="100" rx="60" ry="80" stroke="#1a1a1a" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
                    <circle cx="60" cy="88" r="4" fill="#1a1a1a" opacity="0.5" />
                    <circle cx="100" cy="88" r="4" fill="#1a1a1a" opacity="0.5" />
                    <path d="M78 96 L82 110 L75 112" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                    <path d="M64 135 Q80 148 96 135" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                    <line x1="80" y1="15" x2="80" y2="30" stroke="#1a1a1a" strokeWidth="2" opacity="0.5" />
                    <line x1="80" y1="170" x2="80" y2="185" stroke="#1a1a1a" strokeWidth="2" opacity="0.5" />
                    <line x1="15" y1="100" x2="30" y2="100" stroke="#1a1a1a" strokeWidth="2" opacity="0.5" />
                    <line x1="130" y1="100" x2="145" y2="100" stroke="#1a1a1a" strokeWidth="2" opacity="0.5" />
                  </svg>
                </div>

                {/* Top Corner HUD brackets */}
                <div className="landing-hud-bracket tl" />
                <div className="landing-hud-bracket tr" />
                <div className="landing-hud-bracket bl" />
                <div className="landing-hud-bracket br" />

                {/* Floating Liveness Pill Indicator — demo label, không phải dữ liệu thật */}
                <div className="landing-kiosk-floating-pill">
                  <CheckCircle2 size={15} color="#108a55" />
                  <span>MiniFASNet · Kiểm định độ sống sinh trắc học</span>
                </div>

                {/* Bottom Overlay Status — mô phỏng giao diện, không phải dữ liệu thật */}
                <div className="landing-kiosk-hud-bottom">
                  <div className="landing-hud-metric">
                    <span>Định danh</span>
                    <strong style={{ color: 'var(--text-muted, #6e7180)', fontStyle: 'italic' }}>— mô phỏng —</strong>
                  </div>
                  <div className="landing-hud-metric">
                    <span>Thời gian quét</span>
                    <strong style={{ color: 'var(--text-muted, #6e7180)', fontStyle: 'italic' }}>— mô phỏng —</strong>
                  </div>
                  <div className="landing-hud-metric">
                    <span>Chế độ</span>
                    <strong>Kiosk</strong>
                  </div>
                </div>
              </div>

              {/* Terminal Footer */}
              <div className="landing-kiosk-kard-footer">
                <span className="landing-footer-item">
                  <Activity size={13} />
                  <span>Central AI Hub · Kết nối thực khi khởi động Kiosk</span>
                </span>
                <span className="landing-footer-sep">•</span>
                <span className="landing-footer-item">
                  <span>Khoảng cách tối ưu: 50-70cm</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric / Zigzag Overview Section */}
      <section className="landing-zigzag-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-kicker">KIẾN TRÚC PHÂN HỆ</span>
            <h2 className="landing-section-title">
              Một hệ sinh thái, <span className="font-accent-italic">hai vai trò</span> chuyên biệt.
            </h2>
            <p className="landing-section-desc">
              Phân hệ Kiosk & Cổng Nhân viên hoạt động độc lập, trao đổi dữ liệu an toàn với Central AI Hub
              và chia sẻ cơ sở dữ liệu MongoDB đồng bộ với cổng quản trị AIAttendanceWeb3.
            </p>
          </div>

          {/* Zigzag Row 1: Kiosk Station */}
          <div className="landing-zigzag-row">
            <div className="landing-zigzag-text">
              <div className="landing-pill-tag">Trạm Kiosk Chấm Công</div>
              <h3 className="landing-zigzag-heading">
                Xác thực gương mặt rảnh tay trong 3 giây
              </h3>
              <p className="landing-zigzag-p">
                Thiết kế toàn màn hình cho màn hình cảm ứng hoặc tablet đặt tại cửa ra vào.
                Nhân viên chỉ cần hướng mắt về khung căn chỉnh oval, hệ thống tự động kiểm tra
                khuôn mặt thật qua MiniFASNet trước khi ghi nhận lượt vào/ra ca.
              </p>
              <ul className="landing-feature-list">
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Cắt khung oval chuẩn hóa tránh méo ảnh và giảm tải truyền dữ liệu</span>
                </li>
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Xác nhận thông minh khi trùng ca hoặc cần chuyển đổi sang Check-out</span>
                </li>
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Âm báo trạng thái hỗ trợ xác thực trực quan và trợ năng</span>
                </li>
              </ul>
              <div className="landing-zigzag-action">
                <Link to="/kiosk" className="btn-primary landing-btn-pill">
                  Trải nghiệm Kiosk ngay <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="landing-zigzag-preview minimal-card">
              <div className="landing-preview-frame">
                <div className="landing-preview-bar">
                  <span className="landing-preview-dot red" />
                  <span className="landing-preview-dot yellow" />
                  <span className="landing-preview-dot green" />
                  <span className="landing-preview-caption">kiosk-station / live-stream</span>
                </div>
                <div className="landing-preview-body">
                  <div className="landing-mock-viewfinder">
                    <div className="landing-mock-oval">
                      <ScanFace size={48} className="landing-mock-face" />
                    </div>
                    <div className="landing-mock-toast">
                      <span className="landing-mock-pulse" />
                      <span>MiniFASNet · Kiểm định độ sống sinh trắc học</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Zigzag Row 2: Employee Portal & AI Chatbot */}
          <div className="landing-zigzag-row reverse">
            <div className="landing-zigzag-text">
              <div className="landing-pill-tag">Cổng Nhân Viên & AI Assistant</div>
              <h3 className="landing-zigzag-heading">
                Tra cứu công nhật, gửi phép và hỗ trợ thông minh
              </h3>
              <p className="landing-zigzag-p">
                Không gian làm việc cá nhân hóa cho từng nhân viên. Trực quan hóa dữ liệu chấm công theo
                tháng, biểu đồ hiện diện, quản lý ca kíp và nộp đơn xin nghỉ có kiểm tra số ngày phép còn lại.
              </p>
              <ul className="landing-feature-list">
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Biểu đồ chấm công trực quan và bảng chi tiết từng lượt quét Kiosk</span>
                </li>
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Tự phục vụ nộp đơn nghỉ phép nhanh chóng với quy trình xét duyệt minh bạch</span>
                </li>
                <li>
                  <Check size={16} className="landing-check-icon" />
                  <span>Tích hợp Trợ lý AI kết nối Central AI Hub tra cứu chính sách công ty</span>
                </li>
              </ul>
              <div className="landing-zigzag-action">
                <Link to="/portal" className="btn-primary landing-btn-pill">
                  Đăng nhập Cổng Nhân Viên <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="landing-zigzag-preview minimal-card">
              <div className="landing-preview-frame">
                <div className="landing-preview-bar">
                  <span className="landing-preview-dot red" />
                  <span className="landing-preview-dot yellow" />
                  <span className="landing-preview-dot green" />
                  <span className="landing-preview-caption">portal-workspace / dashboard</span>
                </div>
                <div className="landing-preview-body p-padded">
                  <div className="landing-mock-card-row">
                    <div className="landing-mock-mini-card">
                      <span className="landing-mock-num">22</span>
                      <span className="landing-mock-lbl">Ngày công tháng</span>
                    </div>
                    <div className="landing-mock-mini-card">
                      <span className="landing-mock-num">100%</span>
                      <span className="landing-mock-lbl">Đúng giờ</span>
                    </div>
                    <div className="landing-mock-mini-card">
                      <span className="landing-mock-num">10/12</span>
                      <span className="landing-mock-lbl">Phép còn lại</span>
                    </div>
                  </div>
                  <div className="landing-mock-chat-bubble">
                    <Sparkles size={16} />
                    <span>Trợ lý AI: &quot;Bạn đã hoàn thành đủ số công tuần này.&quot;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Flow Section */}
      <section className="landing-steps-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-kicker">QUY TRÌNH HOẠT ĐỘNG</span>
            <h2 className="landing-section-title">
              Đồng bộ dữ liệu ba bước <span className="font-accent-italic">liền mạch</span>.
            </h2>
            <p className="landing-section-desc">
              Phân chia trách nhiệm rõ ràng theo chuẩn Microservice để đảm bảo an toàn sinh trắc học và hiệu năng cao.
            </p>
          </div>

          <div className="landing-steps-grid">
            {WORKFLOW_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="landing-step-card minimal-card">
                  <div className="landing-step-top">
                    <span className="landing-step-number">{item.step}</span>
                    <span className="badge-minimal">{item.badge}</span>
                  </div>
                  <div className="landing-step-icon-wrap">
                    <Icon size={24} />
                  </div>
                  <h3 className="landing-step-title">{item.title}</h3>
                  <div className="landing-step-system">{item.system}</div>
                  <p className="landing-step-desc">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Highlights Grid */}
      <section className="landing-tech-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-kicker">CÔNG NGHỆ CỐT LÕI</span>
            <h2 className="landing-section-title">
              Nền tảng kỹ thuật <span className="font-accent-italic">đột phá</span>.
            </h2>
          </div>

          <div className="landing-tech-grid">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="landing-tech-card minimal-card">
                  <div className="landing-tech-icon">
                    <Icon size={22} />
                  </div>
                  <h4 className="landing-tech-name">{item.title}</h4>
                  <p className="landing-tech-desc">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Block */}
      <section className="landing-cta-section">
        <div className="landing-container">
          <div className="landing-cta-box">
            <span className="landing-section-kicker light">TRUY CẬP NHANH HỆ THỐNG</span>
            <h2 className="landing-cta-title">
              Sẵn sàng trải nghiệm hệ thống điểm danh?
            </h2>
            <p className="landing-cta-desc">
              Khởi động máy Kiosk chấm công hoặc truy cập Cổng nhân viên để tra cứu dữ liệu thực tế.
            </p>
            <div className="landing-cta-actions">
              <Link to="/kiosk" className="btn-primary landing-btn-pill light">
                <Camera size={18} />
                <span>Bật Kiosk Chấm Công</span>
              </Link>
              <Link to="/portal" className="btn-outline landing-btn-pill light">
                <UserCheck size={18} />
                <span>Cổng Nhân Viên</span>
              </Link>
              <Link to="/demo" className="btn-outline landing-btn-pill light">
                <Cpu size={18} />
                <span>Phòng Lab Thử Nghiệm AI</span>
              </Link>
              <a
                href={MANAGER_PORTAL_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-outline landing-btn-pill light"
              >
                <span>Cổng Quản Trị AIAttendanceWeb3</span>
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
