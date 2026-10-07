import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { getToken, getUser } from '../utils/auth';

const QUICK_PROMPTS = [
  'Hôm nay tôi vào ca mấy giờ?',
  'Tháng này tôi còn bao nhiêu ngày phép?',
  'Tôi đã check-in hôm nay chưa?',
  'Quy định đi làm muộn của công ty',
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý ảo AI kết nối trực tiếp với Central AI Hub (PhoBERT NLU). Bạn có thắc mắc gì về chấm công, ngày phép hay lịch ca không?',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const user = getUser();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  async function handleSend(textToSend) {
    const text = textToSend || input;
    if (!text || !text.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text.trim() }),
      });

      const data = await res.json();
      let botResponse = data.answer || data.message || 'Hệ thống đã tiếp nhận câu hỏi của bạn.';

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: botResponse,
        intent: data.intent,
        confidence: data.confidence,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Xin lỗi, không thể kết nối tới Central AI Service (Port 4000/8000). Vui lòng thử lại sau!',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

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
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
          />
          <Bot size={18} />
          <span>Trợ lý AI PhoBERT</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            width: '380px',
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
              padding: '18px 20px',
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
                  AI Assistant &bull; PhoBERT
                </div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Central AI Hub Online (Port 4000/8000)
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
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
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: m.sender === 'user' ? '#1a1a1a' : '#f7f7f8',
                    color: m.sender === 'user' ? '#ffffff' : '#1a1a1a',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    boxShadow: m.sender === 'user' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    border: m.sender === 'user' ? 'none' : '1px solid rgba(0,0,0,0.05)',
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
                      PhoBERT: {m.intent}
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
                <span>AI đang phân tích ý định...</span>
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
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                style={{
                  fontSize: '0.75rem',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#ffffff',
                  color: '#373a46',
                  cursor: 'pointer',
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={user ? `Hỏi về ngày phép, ca làm, ${user.fullName}...` : 'Nhập câu hỏi...'}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '40px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                outline: 'none',
                fontSize: '0.875rem',
                backgroundColor: '#f7f7f8',
                color: '#1a1a1a',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
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
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.4 : 1,
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
