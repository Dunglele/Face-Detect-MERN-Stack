import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Camera, Sparkles, LayoutDashboard, ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  const [backendOnline, setBackendOnline] = useState(false);

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

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                MERN
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
            backgroundColor: 'var(--bg-muted)',
            padding: '4px',
            borderRadius: '40px',
            border: '1px solid var(--border-subtle)',
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
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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
            to="/admin"
            style={({ isActive }) => ({
              padding: '8px 18px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <LayoutDashboard size={14} />
            Quản trị (/admin)
          </NavLink>
        </nav>

        {/* Right Action & API Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className={`badge-tag ${backendOnline ? 'active' : 'neutral'}`}
            title={backendOnline ? 'Express API cổng 5000 đã kết nối' : 'Express API chưa kết nối'}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: backendOnline ? '#108a55' : '#9295a3',
              }}
            />
            {backendOnline ? 'API Online' : 'API Offline'}
          </div>

          <Link
            to="/demo"
            className="btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '0.875rem',
              borderRadius: '40px',
            }}
          >
            Quét mặt Live
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
