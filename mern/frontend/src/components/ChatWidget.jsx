import { useEffect, useState } from 'react';
import { Bot, X, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GuidedChat from './GuidedChat.jsx';
import { authFetch, getToken, getUser } from '../utils/auth.js';

async function chatbotRequest(kind, payload = {}) {
  const endpoint =
    kind === 'menu'
      ? '/api/chatbot/menu'
      : kind === 'reset'
      ? '/api/chatbot/session/reset'
      : `/api/chatbot/${kind}`;
  const response = await authFetch(endpoint, {
    method: kind === 'menu' ? 'GET' : 'POST',
    ...(kind === 'menu' ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      body.error || body.messages?.[0]?.text || body.message || `HTTP ${response.status}`
    );
  }
  return body;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [identity, setIdentity] = useState(() => ({
    token: getToken(),
    user: getUser(),
    version: 0,
  }));

  useEffect(() => {
    function updateIdentity() {
      setIdentity((previous) => ({
        token: getToken(),
        user: getUser(),
        version: previous.version + 1,
      }));
    }
    function onStorage(event) {
      if (!event.key || ['face_detect_token', 'face_detect_user'].includes(event.key)) {
        updateIdentity();
      }
    }
    window.addEventListener('auth:login', updateIdentity);
    window.addEventListener('auth:logout', updateIdentity);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:login', updateIdentity);
      window.removeEventListener('auth:logout', updateIdentity);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const enabled = Boolean(identity.token && identity.user);

  return (
    <div
      style={{
        position: 'fixed',
        right: 'max(16px, 2vw)',
        bottom: 'max(16px, 2vw)',
        zIndex: 200,
      }}
    >
      {openedOnce && (
        <section
          aria-label="Trợ lý nghiệp vụ AI"
          aria-hidden={!open}
          style={{
            width: 390,
            maxWidth: 'calc(100vw - 32px)',
            height: 560,
            maxHeight: 'calc(100dvh - 96px)',
            display: open ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.12)',
            marginBottom: 12,
          }}
        >
          {/* Header */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: '#fcfcfc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} aria-hidden="true" />
              </div>
              <div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    color: '#1a1a1a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Trợ lý nghiệp vụ AI
                </strong>
                <small style={{ color: '#6e7180', fontSize: 12 }}>
                  {enabled ? identity.user.fullName || 'Đã xác thực' : 'Yêu cầu đăng nhập'}
                </small>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng cửa sổ chat"
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                padding: 6,
                color: '#6e7180',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </header>

          {!enabled && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fff8eb',
                color: '#b45309',
                fontSize: 13,
                borderBottom: '1px solid #fde68a',
              }}
            >
              Vui lòng{' '}
              <Link
                to="/portal"
                style={{ textDecoration: 'underline', fontWeight: 600, color: '#b45309' }}
              >
                đăng nhập cổng nhân viên
              </Link>{' '}
              để tra cứu dữ liệu cá nhân.
            </div>
          )}

          <GuidedChat key={identity.version} request={chatbotRequest} enabled={enabled} />
        </section>
      )}

      {/* Floating Toggle Button (Swiss Pill) */}
      <button
        type="button"
        onClick={() => {
          setOpenedOnce(true);
          setOpen((previous) => !previous);
        }}
        aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý'}
        aria-expanded={open}
        className="btn-primary"
        style={{
          borderRadius: 9999,
          padding: '12px 20px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
        }}
      >
        {open ? <X size={18} /> : <Sparkles size={18} />}
        <span>{open ? 'Đóng Trợ lý' : 'Trợ lý AI'}</span>
      </button>
    </div>
  );
}
