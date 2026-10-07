import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Camera, Sparkles, User, ExternalLink, Clock, LogOut } from 'lucide-react';
import { getUser, clearSession } from '../utils/auth';

export default function Navbar() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getUser());
  const navigate = useNavigate();

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch('/api/health');
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getUser());
    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);
    return () => {
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
    };
  }, []);

  function handleLogout() {
    clearSession();
    setCurrentUser(null);
    navigate('/portal');
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '16px 24px',
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
            gap: '10px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--text-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  fontFamily: 'var(--font-display)',
                }}
              >
                FaceDetect
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  backgroundColor: '#f4f4f5',
                  color: '#52525b',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                Employee & Kiosk
              </span>
            </div>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#f7f7f8',
            padding: '4px',
            borderRadius: '40px',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#1a1a1a' : '#6e7180',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
            })}
          >
            Trang chủ
          </NavLink>

          <NavLink
            to="/demo"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#1a1a1a' : '#6e7180',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <Sparkles size={14} />
            Thử nghiệm AI
          </NavLink>

          <NavLink
            to="/kiosk"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#1a1a1a' : '#6e7180',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <Clock size={14} />
            Máy chấm công Kiosk
          </NavLink>

          <NavLink
            to="/portal"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#1a1a1a' : '#6e7180',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <User size={14} />
            Cổng Nhân Viên
          </NavLink>
        </nav>

        {/* Right Action & External Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User info if logged in */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  padding: '6px 12px',
                  backgroundColor: '#f4f4f5',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ color: '#16a34a' }}>●</span>
                <span>{currentUser.fullName}</span>
                <span style={{ color: '#9295a3', fontWeight: 400 }}>({currentUser.employeeCode})</span>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid rgba(0,0,0,0.1)',
                  backgroundColor: '#ffffff',
                  color: '#6e7180',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Đăng xuất"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link
              to="/portal"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#1a1a1a',
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '40px',
                border: '1px solid rgba(0,0,0,0.12)',
              }}
            >
              Đăng nhập
            </Link>
          )}

          {/* External Link to Manager Portal */}
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '40px',
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
            title="Mở Cổng Quản Trị dành cho Quản lý & Admin (AIAttendanceWeb3)"
          >
            <span>Cổng Quản Trị</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
