import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Camera, ShieldCheck, Sparkles, LayoutDashboard, Radio } from 'lucide-react';

export default function Navbar() {
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/health');
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7, 9, 14, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        {/* Brand Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            }}
          >
            <Camera size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                FaceDetect
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                MERN
              </span>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              YOLOv11 + dlib ResNet Engine
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            })}
          >
            Trang chủ
          </NavLink>

          <NavLink
            to="/demo"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#38bdf8' : 'var(--text-muted)',
              background: isActive ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <Sparkles size={15} />
            Thử nghiệm AI
          </NavLink>

          <NavLink
            to="/admin"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#a855f7' : 'var(--text-muted)',
              background: isActive ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <LayoutDashboard size={15} />
            Quản trị (/admin)
          </NavLink>
        </div>

        {/* Status indicator & Direct CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className={`badge ${backendOnline ? 'badge-green' : 'badge-amber'}`}
            title={backendOnline ? 'Backend API hoạt động tại port 5000' : 'Backend Express chưa kết nối'}
            style={{ display: 'inline-flex' }}
          >
            <span
              className="pulse-indicator"
              style={{ background: backendOnline ? '#10b981' : '#f59e0b' }}
            />
            {backendOnline ? 'API Online' : 'API Offline'}
          </div>

          <Link to="/demo" className="btn-glass-cyan" style={{ padding: '8px 16px', fontSize: '0.825rem' }}>
            <Radio size={14} />
            Quét mặt Live
          </Link>
        </div>
      </div>
    </nav>
  );
}
