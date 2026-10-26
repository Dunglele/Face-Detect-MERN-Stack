import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, Sparkles, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getToken, getUser, clearSession } from '../utils/auth';

const QUICK_PROMPTS = [
  'Tổng hợp chấm công của tôi',
  'Kiểm tra trạng thái đơn nghỉ phép của tôi',
];

function getInitialGreeting(user) {
  const greetingName = user?.fullName ? ` ${user.fullName}` : '';
  return {
    id: 'init-greeting',
    sender: 'bot',
    text: `Xin chào${greetingName}! Tôi là Trợ lý ảo AI kết nối với Central AI Hub. Bạn có thể tra cứu thông tin chấm công hoặc đơn nghỉ phép của mình.`,
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());
  const [isAuth, setIsAuth] = useState(() => Boolean(getToken() && getUser()));
  const [messages, setMessages] = useState(() => [getInitialGreeting(getUser())]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync auth state across login/logout/storage
  useEffect(() => {
    const handleAuthChange = (event) => {
      // Abort any ongoing request on auth change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setLoading(false);

      const currentUser = getUser();
      const authenticated = Boolean(getToken() && currentUser);
      setUser(currentUser);
      setIsAuth(authenticated);
      // Always clear the previous account's conversation. For an automatic
      // logout, keep a visible explanation so the UI does not look like it
      // simply crashed back to guest mode.
      const nextMessages = [getInitialGreeting(currentUser)];
      if (event?.type === 'auth:logout' && event.detail?.reason === 'unauthorized') {
        nextMessages.push({
          id: 'session-expired',
          sender: 'bot',
          text: 'Phiên làm việc đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          error: true,
        });
      }
      setMessages(nextMessages);
      setInput('');
    };

    const handleStorage = (e) => {
      // Filter storage events to session keys or all keys (null on storage.clear())
      if (!e.key || e.key === 'face_detect_token' || e.key === 'face_detect_user') {
        handleAuthChange();
      }
    };

    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
      window.removeEventListener('storage', handleStorage);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = useCallback(
    async (textToSend) => {
      const text = textToSend || input;
      if (!text || !text.trim() || loading || !isAuth) return;

      const trimmedText = text.trim();

      // Capture token before request
      const capturedToken = getToken();
      if (!capturedToken) {
        setIsAuth(false);
        setUser(null);
        return;
      }

      // Abort prior in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isStale = () => {
        return controller.signal.aborted || abortControllerRef.current !== controller || getToken() !== capturedToken;
      };

      const userMsg = {
        id: Date.now(),
        sender: 'user',
        text: trimmedText,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${capturedToken}`,
          },
          body: JSON.stringify({ message: trimmedText }),
          signal: controller.signal,
        });

        // Verify after fetch await
        if (isStale()) return;

        if (res.status === 401) {
          if (isStale()) return;
          if (getToken() === capturedToken) {
            clearSession();
            window.dispatchEvent(new CustomEvent('auth:logout', {
              detail: { reason: 'unauthorized' },
            }));
          }
          return;
        }

        const data = await res.json().catch(() => null);

        // Verify after json await
        if (isStale()) return;

        if (!res.ok) {
          const errMsg =
            (typeof data === 'object' && data !== null && (data.error || data.message)) ||
            `Lỗi máy chủ (${res.status})`;
          const botMsg = {
            id: Date.now() + 1,
            sender: 'bot',
            text: errMsg,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            error: true,
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }

        // Validate returned answer strictly - reject malformed / empty answer as error
        if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
          const botMsg = {
            id: Date.now() + 1,
            sender: 'bot',
            text: (typeof data?.error === 'string' && data.error) || 'Central AI Hub trả về phản hồi không hợp lệ.',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            error: true,
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }

        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.answer.trim(),
          intent: data.intent,
          confidence: data.intentConfidence,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch (err) {
        if (isStale() || err.name === 'AbortError') {
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: 'Không thể kết nối đến máy chủ chatbot. Vui lòng kiểm tra mạng hoặc thử lại sau.',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            error: true,
          },
        ]);
      } finally {
        if (!isStale()) {
          abortControllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [input, loading, isAuth]
  );

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 22px',
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '40px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9375rem',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
        >
          <Bot size={18} />
          <span>Trợ lý AI Central</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            width: '390px',
            maxWidth: 'calc(100vw - 32px)',
            height: '560px',
            maxHeight: 'calc(100vh - 100px)',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.16)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInUp 0.25s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              backgroundColor: '#fcfcfc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1a1a1a' }}>
                  AI Assistant &bull; Central Hub
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6e7180' }}>
                  {isAuth ? (user?.fullName ? `Đang đăng nhập: ${user.fullName}` : 'Đã đăng nhập') : 'Khách vãng lai'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Đóng cửa sổ chat"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                backgroundColor: '#ffffff',
                color: '#6e7180',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Guest Login Required Banner */}
          {!isAuth && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#fef3c7',
                borderBottom: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span>Vui lòng đăng nhập để sử dụng Trợ lý AI.</span>
              <Link
                to="/portal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                  color: '#92400e',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                <LogIn size={14} />
                <span>Đăng nhập</span>
              </Link>
            </div>
          )}

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: m.sender === 'user' ? '#1a1a1a' : m.error ? '#fef2f2' : '#f7f7f8',
                    color: m.sender === 'user' ? '#ffffff' : m.error ? '#b91c1c' : '#1a1a1a',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    boxShadow: m.sender === 'user' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    border: m.sender === 'user' ? 'none' : m.error ? '1px solid #fecaca' : '1px solid rgba(0,0,0,0.05)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                  {m.intent && (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '0.6875rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#e6f4ea',
                        color: '#137333',
                        display: 'inline-block',
                      }}
                    >
                      Intent: {m.intent}
                      {typeof m.confidence === 'number' ? ` (${(m.confidence * 100).toFixed(0)}%)` : ''}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: '#9295a3',
                    marginTop: '3px',
                    padding: '0 4px',
                  }}
                >
                  {m.time}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9295a3', fontSize: '0.8125rem', padding: '8px' }}>
                <Sparkles size={14} className="animate-spin" />
                <span>Central AI Hub đang xử lý câu hỏi...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(0, 0, 0, 0.04)',
              backgroundColor: '#fcfcfc',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'flex',
              gap: '6px',
              opacity: isAuth ? 1 : 0.5,
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                disabled={!isAuth || loading}
                onClick={() => handleSend(p)}
                style={{
                  fontSize: '0.75rem',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#ffffff',
                  color: isAuth ? '#373a46' : '#9ca3af',
                  cursor: isAuth && !loading ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              gap: '8px',
              backgroundColor: '#ffffff',
            }}
          >
            <input
              type="text"
              disabled={!isAuth || loading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !isAuth
                  ? 'Vui lòng đăng nhập để trò chuyện'
                  : user
                  ? `Hỏi về chấm công, nghỉ phép, ${user.fullName}...`
                  : 'Nhập câu hỏi...'
              }
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '40px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                outline: 'none',
                fontSize: '0.875rem',
                backgroundColor: isAuth ? '#f7f7f8' : '#f3f4f6',
                color: isAuth ? '#1a1a1a' : '#9ca3af',
                cursor: isAuth ? 'text' : 'not-allowed',
              }}
            />
            <button
              type="submit"
              disabled={!isAuth || loading || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !isAuth || loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: !isAuth || loading || !input.trim() ? 0.35 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
