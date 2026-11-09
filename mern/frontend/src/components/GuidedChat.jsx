import { useEffect, useRef, useState } from 'react';
import './GuidedChat.css';

function labelOf(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.label || value.name || value.value || '';
}

function Field({ field, value, onChange, disabled }) {
  const choices = Array.isArray(field.options) ? field.options : [];
  const common = {
    id: `chat-field-${field.name}`,
    name: field.name,
    required: Boolean(field.required),
    disabled,
    value: value ?? '',
    onChange: (event) => onChange(field.name, event.target.value),
  };

  return (
    <label className="guided-field" htmlFor={common.id}>
      <span>{field.label || field.name}{field.required ? ' *' : ''}</span>
      {choices.length > 0 ? (
        <select {...common}>
          <option value="">Chọn...</option>
          {choices.map((choice) => (
            <option key={typeof choice === 'object' ? choice.value : choice} value={typeof choice === 'object' ? choice.value : choice}>
              {labelOf(choice)}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={['date', 'month', 'number', 'email'].includes(field.type) ? field.type : 'text'} />
      )}
    </label>
  );
}

function ResultData({ data }) {
  if (data == null) return null;
  const labels = { date: 'Ngày', status: 'Trạng thái', checkIn: 'Giờ vào', checkOut: 'Giờ ra', lateMinutes: 'Phút trễ', shift: 'Ca', startTime: 'Bắt đầu', endTime: 'Kết thúc', fromDate: 'Từ ngày', toDate: 'Đến ngày', days: 'Số ngày', type: 'Loại', reason: 'Lý do', title: 'Tên', progress: 'Tiến độ', deadline: 'Hạn', count: 'Số lượng', workdays: 'Ngày công', assignedHours: 'Giờ được phân ca', id: 'Mã' };
  const readable = (value) => {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(', ');
    return Object.entries(value).filter(([, part]) => part != null && typeof part !== 'object').map(([key, part]) => `${labels[key] || key}: ${part}`).join(' · ');
  };
  if (Array.isArray(data)) {
    return <ul className="guided-data-list">{data.map((item, index) => <li key={index}>{readable(item)}</li>)}</ul>;
  }
  if (typeof data !== 'object') return <p>{String(data)}</p>;
  return (
    <dl className="guided-data-list">
      {Object.entries(data).filter(([, value]) => value != null).map(([key, value]) => (
        <div key={key}><dt>{labels[key] || key}</dt><dd>{readable(value)}</dd></div>
      ))}
    </dl>
  );
}

export default function GuidedChat({ request, enabled = true, welcome = 'Chọn một mục để bắt đầu hoặc nhập câu hỏi.' }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState(null);
  const [input, setInput] = useState('');
  const [formValues, setFormValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const bottomRef = useRef(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, error]);

  useEffect(() => {
    generationRef.current += 1;
    setSessionId(null);
    setState(null);
    setMessages([]);
    setInput('');
    setError('');
    setReady(false);
    if (!enabled) return;

    const generation = generationRef.current;
    setBusy(true);
    busyRef.current = true;
    request('menu')
      .then((response) => {
        if (generation !== generationRef.current) return;
        acceptResponse(response, true);
        setReady(true);
      })
      .catch((cause) => {
        if (generation === generationRef.current) setError(cause.message || 'Không thể tải menu chatbot.');
      })
      .finally(() => {
        if (generation === generationRef.current) {
          setBusy(false);
          busyRef.current = false;
        }
      });
    return () => { generationRef.current += 1; };
  }, [enabled, request]);

  function acceptResponse(response, replace = false) {
    if (!response || !Array.isArray(response.messages)) throw new Error('Phản hồi chatbot không hợp lệ.');
    if (response.sessionId) setSessionId(response.sessionId);
    setState(response.state || null);
    setFormValues({});
    setMessages((previous) => replace ? response.messages : [...previous, ...response.messages]);
    setError('');
  }

  async function run(kind, payload, userText, replace = false) {
    if (busyRef.current || !enabled) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const generation = generationRef.current;
    if (userText) setMessages((previous) => [...previous, { type: 'user', text: userText }]);
    try {
      const response = await request(kind, { ...payload, ...(sessionId ? { sessionId } : {}) });
      if (generation !== generationRef.current) return;
      acceptResponse(response, replace);
      setReady(true);
    } catch (cause) {
      if (generation === generationRef.current) setError(cause.message || 'Không thể kết nối chatbot. Vui lòng thử lại.');
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function choose(option) {
    if (!option?.actionId) return;
    run('action', { actionId: option.actionId }, option.label || option.actionId);
  }

  function send(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !freeTextEnabled) return;
    setInput('');
    run('message', { message }, message);
  }

  function submitForm(event, message) {
    event.preventDefault();
    const actionId = message.actionId || state?.pendingActionId || state?.actionId;
    if (!actionId) {
      setError('Biểu mẫu chưa có hành động gửi. Vui lòng quay lại menu.');
      return;
    }
    const labels = (message.fields || []).map((field) => `${field.label || field.name}: ${formValues[field.name] || ''}`).join(' · ');
    run('action', { actionId, slots: formValues }, labels);
  }

  const lastInteractive = messages[messages.length - 1];
  const freeTextEnabled = state?.mode === 'other';

  return (
    <div className="guided-chat">
      <div className="guided-toolbar">
        <span>Trợ lý nghiệp vụ</span>
        <div>
          <button type="button" onClick={() => run('action', { actionId: 'back' })} disabled={!enabled || busy || !ready}>Quay lại</button>
          <button type="button" onClick={() => run('reset', {}, '', true)} disabled={!enabled || busy || !ready}>Bắt đầu lại</button>
        </div>
      </div>
      <div className="guided-messages" role="log" aria-live="polite" aria-label="Nội dung hội thoại">
        {!enabled && <div className="guided-notice">Đăng nhập để dùng trợ lý.</div>}
        {enabled && messages.length === 0 && !busy && <div className="guided-notice">{welcome}</div>}
        {messages.map((message, index) => {
          const type = message.type || 'text';
          const interactive = message === lastInteractive;
          const options = Array.isArray(message.options) ? message.options : [];
          return (
            <div key={index} className={`guided-bubble guided-${type}`}>
              {message.title && <strong>{message.title}</strong>}
              {message.text && <p>{message.text}</p>}
              {type === 'info_card' && <ResultData data={message.data} />}
              {options.length > 0 && <div className="guided-options">{options.map((option) => (
                <button key={option.actionId} type="button" onClick={() => choose(option)} disabled={!enabled || busy || !interactive}>{option.label}</button>
              ))}</div>}
              {type === 'form' && Array.isArray(message.fields) && <form onSubmit={(event) => submitForm(event, message)} className="guided-form">
                {message.fields.map((field) => <Field key={field.name} field={field} value={formValues[field.name]} onChange={(name, value) => setFormValues((previous) => ({ ...previous, [name]: value }))} disabled={!enabled || busy || !interactive} />)}
                <button type="submit" disabled={!enabled || busy || !interactive}>Tiếp tục</button>
              </form>}
            </div>
          );
        })}
        {busy && <div className="guided-notice">Đang xử lý…</div>}
        {error && <div className="guided-error" role="alert">{error} <button type="button" onClick={() => run('menu', {}, '', true)} disabled={busy}>Tải lại menu</button></div>}
        <div ref={bottomRef} />
      </div>
      <form className="guided-composer" onSubmit={send}>
        <input aria-label="Nhập câu hỏi cho trợ lý" value={input} onChange={(event) => setInput(event.target.value)} disabled={!enabled || busy || !ready || !freeTextEnabled} placeholder={freeTextEnabled ? 'Nhập câu hỏi của bạn…' : 'Chọn Khác để nhập câu hỏi…'} />
        <button type="submit" disabled={!enabled || busy || !ready || !freeTextEnabled || !input.trim()}>Gửi</button>
      </form>
    </div>
  );
}
