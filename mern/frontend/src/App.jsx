import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import KioskPage from './pages/KioskPage';
import PortalPage from './pages/PortalPage';
import { ExternalLink } from 'lucide-react';

// Trang thông báo chuyển hướng Admin sang AIAttendanceWeb3
function AdminRedirectPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '80px auto', padding: '32px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '28px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f4f4f5', color: '#18181b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', marginBottom: '16px' }}>
        🏢
      </div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#18181b', marginBottom: '8px' }}>
        Cổng Quản Trị Đã Chuyển Sang AIAttendanceWeb3
      </h2>
      <p style={{ color: '#71717a', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '24px' }}>
        Theo mô hình Microservice, các chức năng quản trị cấp cao (phê duyệt đơn nghỉ, phân ca làm việc, giao KPI, báo cáo thống kê, quản trị thiết bị Kiosk, đăng ký khuôn mặt và neo Blockchain Web3) hiện được tập trung tại <strong>AIAttendanceWeb3 (Port 3000)</strong>.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
        <a
          href="http://localhost:3000"
          className="btn-primary"
          style={{ padding: '12px 24px', borderRadius: '40px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>Mở Cổng Quản Trị AIAttendanceWeb3</span>
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        {/* Minimalist White Header */}
        <Navbar />

        {/* Route Pages */}
        <main style={{ flex: 1, position: 'relative' }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/admin" element={<AdminRedirectPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Floating AI PhoBERT Chatbot Assistant */}
        <ChatWidget />

        {/* Minimalist Editorial Footer */}
        <footer
          style={{
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: '#ffffff',
            padding: '36px 24px',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>FaceDetect MERN</span>
              <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                YOLOv11 &bull; dlib ResNet &bull; MiniFASNet &bull; MongoDB
              </span>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Phân hệ Kiosk & Cổng Nhân Viên &bull; Kết nối Central AI Hub &bull; 2026
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
