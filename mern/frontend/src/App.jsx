import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Glassmorphic Navigation Bar */}
        <Navbar />

        {/* Dynamic Route Pages */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Fallback to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(7, 9, 14, 0.65)',
            backdropFilter: 'blur(12px)',
            padding: '24px',
            textAlign: 'center',
            fontSize: '0.825rem',
            color: 'var(--text-dim)',
          }}
        >
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <p>
              Face Recognition Attendance System &bull; Powered by{' '}
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>YOLOv11 Face</span>,{' '}
              <span style={{ color: '#c084fc', fontWeight: 600 }}>dlib ResNet</span> &amp;{' '}
              <span style={{ color: '#34d399', fontWeight: 600 }}>MERN Stack</span>
            </p>
            <p style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Glassmorphism Design Theme &bull; 2026
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
