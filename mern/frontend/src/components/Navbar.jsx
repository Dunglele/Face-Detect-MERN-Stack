import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Sparkles, User, ExternalLink, LogOut, ScanFace } from 'lucide-react';
import { getUser, clearSession } from '../utils/auth';
import './Navbar.css';

const MANAGER_PORTAL_URL = import.meta.env.VITE_MANAGER_PORTAL_URL || 'http://localhost:3000';

export default function Navbar() {
  const [currentUser, setCurrentUser] = useState(() => getUser());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPortal = pathname.replace(/\/+$/, '') === '/portal';

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getUser());
    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    navigate('/');
  };

  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        {/* Brand Logo */}
        <Link
          to={isPortal ? '/portal' : '/'}
          className="app-navbar-brand"
        >
          <div className="app-navbar-brand-logo">
            <ScanFace size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="app-navbar-brand-title">FaceDetect</span>
              <span className="app-navbar-brand-tag">MERN Edge</span>
            </div>
          </div>
        </Link>

        {/* Scrollable Navigation Bar Container (prevent clipped text on mobile) */}
        <div className="app-navbar-scroll-wrap">
          <nav
            className="app-navbar-links"
            aria-label={isPortal ? 'Điều hướng nhân viên' : 'Điều hướng chính'}
          >
            {/* {!isPortal && ( */}
              <NavLink
                to="/"
                end
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Trang chủ
              </NavLink>
            {/* )} */}
{/*
            {!isPortal && ( */}
              <NavLink
                to="/demo"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Sparkles size={14} />
                Thử nghiệm AI
              </NavLink>
            {/* )} */}

            <NavLink
              to="/kiosk"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Camera size={14} />
              Thử nghiệm Kiosk thực tế
            </NavLink>

            {/* <NavLink
              to="/portal"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <User size={14} />
              {isPortal ? 'Hồ sơ cá nhân' : 'Cổng Nhân Viên'}
            </NavLink> */}
          </nav>
        </div>

        {/* Right Action & External Links */}
        <div className="app-navbar-actions">
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="app-navbar-user-badge">
                {currentUser.fullName || currentUser.username}
              </div>
              <button
                onClick={handleLogout}
                className="app-navbar-btn-logout"
                title="Đăng xuất"
              >
                <LogOut size={13} />
                <span>Thoát</span>
              </button>
            </div>
          ) : (
            <Link
              to="/portal"
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.8125rem' }}
            >
              Đăng nhập
            </Link>
          )}

          {/* External Link to Manager Portal */}
          <a
            className="app-navbar-manager-link"
            href={MANAGER_PORTAL_URL}
            target="_blank"
            rel="noreferrer"
            title="Mở Cổng Quản Trị dành cho Quản lý & Admin (AIAttendanceWeb3)"
          >
            <span>{isPortal ? 'Quản lý' : 'Cổng Quản Trị'}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
