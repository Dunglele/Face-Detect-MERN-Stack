import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import AdminPage from './pages/AdminPage';

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
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

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
                YOLOv11 &bull; dlib ResNet &bull; MongoDB
              </span>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Thiết kế tối giản theo tiêu chuẩn Swiss International Style &bull; 2026
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
