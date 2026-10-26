import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Target,
  CheckCircle,
  AlertCircle,
  LogOut,
  Plus,
  User,
  Building,
  ArrowRight,
  Sparkles,
  Camera,
  Coffee,
} from 'lucide-react';
import { getToken, getUser, setSession, clearSession, authFetch } from '../utils/auth';

const DEMO_ACCOUNTS = [
  { code: 'NV002', name: 'Nhân viên mẫu (SX)', pass: 'matkhau123' },
  { code: 'NV003', name: 'Nhân viên mẫu (KT)', pass: 'matkhau123' },
  { code: 'NV004', name: 'Nhân viên mẫu (VP)', pass: 'matkhau123' },
];

// Helper to get current month in Vietnam timezone (Asia/Ho_Chi_Minh - GMT+7)
function getVietnamCurrentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

function extractErrorMessage(data, fallback = 'Có lỗi xảy ra, vui lòng thử lại.') {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  const rawMsg = data.message || data.error || data.msg;
  const code = data.code ? ` [Mã lỗi: ${data.code}]` : '';
  if (rawMsg) return `${rawMsg}${code}`;
  if (data.code) return `Lỗi hệ thống [Mã lỗi: ${data.code}]`;
  return fallback;
}

// Helper phân tích mốc thời gian VN (+07:00) cho ca làm và timestamp
function parseVnDateTime(workDateStr, hhmmStr, dayOffset = 0) {
  if (!workDateStr || !hhmmStr) return null;
  const [yStr, mStr, dStr] = workDateStr.split('-');
  const [hStr, minStr] = hhmmStr.split(':');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  const h = parseInt(hStr, 10);
  const min = parseInt(minStr, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) return null;

  // Sử dụng Date.UTC chuyển dịch sang múi giờ VN +07:00
  // VN = UTC + 7 -> giờ UTC = VN_hour - 7
  return new Date(Date.UTC(y, m - 1, d + dayOffset, h - 7, min, 0, 0));
}

// Phân tích đặc điểm chấm công của ngày với ca làm việc
function analyzeDayAttendance(record) {
  if (!record) {
    return {
      hasRecord: false,
      traits: [],
      tooltip: 'Chưa có bản ghi chấm công',
      accessibleLabel: 'Chưa có bản ghi chấm công',
    };
  }

  const shift = record.shift;
  const hasShift = Boolean(shift && shift.startTime && shift.endTime);

  const isAbsent = record.status === 'absent';
  const isInvalid = record.status === 'invalid';
  const hasTime = Boolean(record.checkInAt || record.checkInTime || record.checkOutAt || record.checkOutTime);

  let isEarlyCheckIn = false;
  let isLate = (record.lateMinutes || 0) > 0;
  let isEarlyLeave = (record.earlyLeaveMinutes || 0) > 0;
  let isLateCheckOut = false;

  // So sánh mốc Date đầy đủ dựa trên record.workDate (VN +07:00) và ISO timestamp
  if (hasShift && !isAbsent && !isInvalid) {
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const isOvernight = endH * 60 + endM <= startH * 60 + startM;

    // Giờ bắt đầu ca chuẩn (+07:00)
    const shiftStartDate = parseVnDateTime(record.workDate, shift.startTime, 0);
    // Giờ kết thúc ca chuẩn (+07:00), nếu qua đêm thì cộng thêm 1 ngày
    const shiftEndDate = parseVnDateTime(record.workDate, shift.endTime, isOvernight ? 1 : 0);

    // Xác định đi sớm: có checkInAt ISO hợp lệ và bắt đầu ca hợp lệ
    if (record.checkInAt && shiftStartDate) {
      const cinDate = new Date(record.checkInAt);
      if (!isNaN(cinDate.getTime()) && cinDate.getTime() < shiftStartDate.getTime()) {
        isEarlyCheckIn = true;
      }
    }

    // Xác định về trễ: có checkOutAt ISO hợp lệ và kết thúc ca hợp lệ
    if (record.checkOutAt && shiftEndDate) {
      const coutDate = new Date(record.checkOutAt);
      if (!isNaN(coutDate.getTime()) && coutDate.getTime() > shiftEndDate.getTime()) {
        isLateCheckOut = true;
      }
    }
  }

  const traits = [];
  const labels = [];

  if (isAbsent) {
    traits.push({ id: 'absent', label: 'Vắng mặt', symbol: '✕', color: '#991b1b', bg: '#fee2e2' });
    labels.push('Vắng mặt');
  } else if (isInvalid) {
    traits.push({ id: 'invalid', label: 'Không hợp lệ', symbol: '!', color: '#c2410c', bg: '#ffedd5' });
    labels.push('Không hợp lệ');
  } else if (!hasTime) {
    traits.push({ id: 'no_time', label: 'Chưa có giờ', symbol: '?', color: '#64748b', bg: '#f1f5f9' });
    labels.push('Chưa có giờ');
  } else {
    // Có ghi nhận giờ
    if (isEarlyCheckIn) {
      traits.push({ id: 'early_in', label: 'Đi sớm', symbol: '▲', color: '#0284c7', bg: '#e0f2fe' });
      labels.push('Đi sớm');
    }
    if (isLate) {
      traits.push({
        id: 'late_in',
        label: `Đi muộn (${record.lateMinutes}p)`,
        symbol: '▼',
        color: '#d97706',
        bg: '#fef3c7',
      });
      labels.push(`Đi muộn +${record.lateMinutes}p`);
    }
    if (isEarlyLeave) {
      traits.push({
        id: 'early_out',
        label: `Về sớm (${record.earlyLeaveMinutes}p)`,
        symbol: '◄',
        color: '#dc2626',
        bg: '#fee2e2',
      });
      labels.push(`Về sớm -${record.earlyLeaveMinutes}p`);
    }
    if (isLateCheckOut) {
      traits.push({ id: 'late_out', label: 'Về trễ', symbol: '►', color: '#7c3aed', bg: '#ede9fe' });
      labels.push('Về trễ');
    }

    // Nếu không có trait nào vi phạm/sớm/muộn thì là đúng giờ
    if (traits.length === 0 && (record.checkInTime || record.checkInAt)) {
      traits.push({ id: 'ontime', label: 'Đúng giờ', symbol: '●', color: '#16a34a', bg: '#dcfce7' });
      labels.push('Đúng giờ');
    }
  }

  // Xây dựng tooltip chi tiết
  const tooltipLines = [
    `Ngày: ${record.workDate}`,
    shift ? `Ca: ${shift.name || shift.code || 'Ca chuẩn'} (${shift.startTime} - ${shift.endTime})` : 'Chưa phân ca cụ thể',
    record.checkInTime ? `Check-in: ${record.checkInTime}` : null,
    record.checkOutTime ? `Check-out: ${record.checkOutTime}` : null,
    record.workedHours > 0 ? `Giờ làm: ${record.workedHours}h` : null,
    labels.length > 0 ? `Trạng thái: ${labels.join(', ')}` : null,
    record.method === 'face' ? 'Phương thức: Khuôn mặt (AI Face)' : record.method ? 'Phương thức: Thủ công' : null,
  ].filter(Boolean);

  const displayCheckIn = record.checkInTime || (record.checkInAt ? record.checkInAt.slice(11, 16) : null);
  const displayCheckOut = record.checkOutTime || (record.checkOutAt ? record.checkOutAt.slice(11, 16) : null);

  return {
    hasRecord: true,
    isAbsent,
    isInvalid,
    hasTime,
    isEarlyCheckIn,
    isLate,
    isEarlyLeave,
    isLateCheckOut,
    displayCheckIn,
    displayCheckOut,
    traits,
    labels,
    tooltip: tooltipLines.join('\n'),
    accessibleLabel: `Ngày ${record.workDate}: ${labels.length > 0 ? labels.join(', ') : 'Có bản ghi'}${displayCheckIn ? `, vào ${displayCheckIn}` : ''}${displayCheckOut ? `, ra ${displayCheckOut}` : ''}`,
  };
}

// Component Contribution Graph Lịch Tháng
function AttendanceContributionGraph({ month, records = [], loading = false, error = '' }) {
  // Lấy năm và tháng
  const [yStr, mStr] = (month || '').split('-');
  const year = parseInt(yStr, 10);
  const monthNum = parseInt(mStr, 10);

  if (!year || !monthNum) return null;

  // Bản đồ tra cứu records theo workDate (YYYY-MM-DD)
  const recordsMap = new Map();
  if (!loading && !error && Array.isArray(records)) {
    records.forEach((r) => {
      if (r?.workDate) {
        recordsMap.set(r.workDate, r);
      }
    });
  }

  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const firstDayDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const firstDayOfWeek = firstDayDate.getUTCDay();
  // Căn cột Thứ 2 (index 0) đến Chủ Nhật (index 6):
  const startOffset = (firstDayOfWeek + 6) % 7;

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const weekDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - startOffset + 1;
    if (dayNumber >= 1 && dayNumber <= daysInMonth) {
      const dayStr = String(dayNumber).padStart(2, '0');
      const dateStr = `${month}-${dayStr}`;
      const record = (!loading && !error) ? recordsMap.get(dateStr) : null;
      const analysis = analyzeDayAttendance(record);
      cells.push({
        type: 'day',
        dayNumber,
        dateStr,
        record,
        analysis,
      });
    } else {
      cells.push({
        type: 'empty',
        dayNumber: null,
        dateStr: null,
      });
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Biểu đồ chấm công tháng {mStr}/{year} (Lịch đóng góp)
          </h3>
          <p style={{ fontSize: '0.8125rem', color: '#6e7180', marginTop: '4px', margin: 0 }}>
            Quan sát trực quan toàn bộ các ngày trong tháng, căn chuẩn từ Thứ 2 đến Chủ Nhật.
          </p>
        </div>

        {/* Legend / Chú giải */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.75rem',
            color: '#4b5563',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '4px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'inline-block',
              }}
            />
            <span>Chưa có bản ghi</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ●
            </span>
            <span>Đúng giờ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ▲
            </span>
            <span>Đi sớm</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ▼
            </span>
            <span>Đi muộn</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ◄
            </span>
            <span>Về sớm</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#ede9fe',
                color: '#7c3aed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ►
            </span>
            <span>Về trễ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ✕
            </span>
            <span>Vắng mặt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#ffedd5',
                color: '#c2410c',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              !
            </span>
            <span>Không hợp lệ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ?
            </span>
            <span>Chưa có giờ</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
        <div style={{ minWidth: '680px' }}>
          {/* Weekday headers: T2 - CN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            {weekDays.map((wd, idx) => (
              <div
                key={wd}
                style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: idx >= 5 ? '#e11d48' : '#64748b',
                  padding: '4px 0',
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
            }}
          >
            {cells.map((cell, idx) => {
              if (cell.type === 'empty') {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{
                      minHeight: '80px',
                      backgroundColor: 'transparent',
                      border: '1px dashed rgba(0,0,0,0.04)',
                      borderRadius: '14px',
                    }}
                  />
                );
              }

              const { dayNumber, dateStr, record, analysis } = cell;
              const hasRecord = analysis.hasRecord;

              // Xác định màu nền và viền dựa trên trạng thái bản ghi
              let cellBg = '#f8fafc'; // Ô trung tính khi không có bản ghi (không suy diễn ngày trống là vắng)
              let cellBorder = 'rgba(0, 0, 0, 0.08)';

              if (hasRecord) {
                if (analysis.isAbsent) {
                  cellBg = '#fef2f2';
                  cellBorder = '#fecaca';
                } else if (analysis.isInvalid) {
                  cellBg = '#fff7ed';
                  cellBorder = '#ffedd5';
                } else if (!analysis.hasTime) {
                  cellBg = '#f8fafc';
                  cellBorder = '#cbd5e1';
                } else if (analysis.isLate || analysis.isEarlyLeave) {
                  cellBg = '#fffbeb';
                  cellBorder = '#fef08a';
                } else {
                  cellBg = '#f0fdf4';
                  cellBorder = '#bbf7d0';
                }
              }

              return (
                <div
                  key={dateStr}
                  title={analysis.tooltip}
                  aria-label={analysis.accessibleLabel}
                  tabIndex={0}
                  style={{
                    minHeight: '82px',
                    backgroundColor: cellBg,
                    border: `1px solid ${cellBorder}`,
                    borderRadius: '14px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all 0.15s ease-in-out',
                    cursor: hasRecord ? 'pointer' : 'default',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top row: Ngày số & Giờ vào rút gọn */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: hasRecord ? '#1a1a1a' : '#94a3b8',
                      }}
                    >
                      {dayNumber}
                    </span>

                    {hasRecord && analysis.displayCheckIn && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: '#475569',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                        }}
                      >
                        {analysis.displayCheckIn}
                      </span>
                    )}
                  </div>

                  {/* Middle: Thông tin biểu thị đặc điểm */}
                  {hasRecord ? (
                    <div
                      style={{
                        margin: '4px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {/* Huy hiệu các đặc điểm kết hợp (multi-badge markers) */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          alignItems: 'center',
                        }}
                      >
                        {analysis.traits.map((t) => (
                          <span
                            key={t.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              padding: '2px 5px',
                              borderRadius: '6px',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              backgroundColor: t.bg,
                              color: t.color,
                              lineHeight: 1,
                            }}
                            title={t.label}
                          >
                            <span style={{ fontSize: '0.625rem' }}>{t.symbol}</span>
                            <span>{t.label}</span>
                          </span>
                        ))}
                      </div>

                      {/* Giờ ra nếu có */}
                      {analysis.displayCheckOut && (
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: '#64748b',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          Ra: {analysis.displayCheckOut}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: '#94a3b8',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        margin: 'auto 0',
                      }}
                    >
                      Chưa có bản ghi
                    </div>
                  )}

                  {/* Footer nhỏ: Nhãn ca nếu có */}
                  {hasRecord && record.shift && (
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        borderTop: '1px solid rgba(0,0,0,0.04)',
                        paddingTop: '2px',
                      }}
                    >
                      {record.shift.name || record.shift.code}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Loading / Error Overlay */}
        {(loading || error) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              zIndex: 10,
              padding: '20px',
            }}
          >
            {loading ? (
              <div style={{ fontSize: '0.875rem', color: '#6e7180', fontWeight: 500 }}>
                Đang tải dữ liệu biểu đồ chấm công tháng {mStr}/{year}...
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: '#b91c1c', fontWeight: 500, textAlign: 'center' }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const [user, setUser] = useState(() => getUser());
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'leaves' | 'shifts' | 'kpis'

  // Login Form States
  const [loginCode, setLoginCode] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Attendance States
  const [selectedMonth, setSelectedMonth] = useState(() => getVietnamCurrentMonth());
  const [attendanceData, setAttendanceData] = useState({ stats: {}, data: [] });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Leave Requests States
  const [leaveData, setLeaveData] = useState({ leaveQuota: {}, data: [] });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    type: 'annual',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reasonText: '',
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Shifts & KPI States
  const [shiftsData, setShiftsData] = useState([]);
  const [kpiData, setKpiData] = useState({ overallProgress: 0, data: [] });

  // Sync session on mount or change & listen for auth:logout
  useEffect(() => {
    function handleAuthLogout() {
      setUser(null);
    }
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadAttendance(selectedMonth);
      loadLeaves();
      loadShifts();
      loadKpis();
    }
  }, [user, selectedMonth]);

  // Load Attendance
  async function loadAttendance(monthToLoad = selectedMonth) {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const res = await authFetch(`/api/employee/attendance?month=${monthToLoad}`);
      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
      }

      if (!res.ok || !data?.success) {
        const errorMsg = extractErrorMessage(data, `Không thể tải bảng chấm công (HTTP ${res.status})`);
        setAttendanceError(errorMsg);
        setAttendanceData({ stats: {}, data: [] });
        return;
      }

      setAttendanceData(data);
    } catch (e) {
      console.error(e);
      setAttendanceError(e.message || 'Lỗi mạng khi tải bảng chấm công');
      setAttendanceData({ stats: {}, data: [] });
    } finally {
      setAttendanceLoading(false);
    }
  }

  // Load Leaves
  async function loadLeaves() {
    setLeaveLoading(true);
    try {
      const res = await authFetch('/api/employee/leave-requests');
      const data = await res.json();
      if (data.success) {
        setLeaveData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLeaveLoading(false);
    }
  }

  // Load Shifts
  async function loadShifts() {
    try {
      const res = await authFetch(`/api/employee/shifts?month=${selectedMonth}`);
      const data = await res.json();
      if (data.success) {
        setShiftsData(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Load KPIs
  async function loadKpis() {
    try {
      const res = await authFetch('/api/employee/kpi');
      const data = await res.json();
      if (data.success) {
        setKpiData(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Login handler
  async function handleLogin(e) {
    e?.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode: loginCode, password: loginPass }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Đăng nhập không thành công');
      }

      setSession(data.token, data.user);
      setUser(data.user);
      window.dispatchEvent(new Event('auth:login'));
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    window.dispatchEvent(new Event('auth:logout'));
  }

  // Quick check-in/check-out
  async function handleCheckIn() {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMsg({ type: '', text: '' });
    try {
      const res = await authFetch('/api/employee/attendance/checkin', { method: 'POST' });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok || !data?.success) {
        const errorText = extractErrorMessage(data, `Check-in thất bại (HTTP ${res.status})`);
        throw new Error(errorText);
      }

      setActionMsg({ type: 'success', text: data.message || 'Check-in thành công!' });

      const currentVNMonth = getVietnamCurrentMonth();
      if (selectedMonth !== currentVNMonth) {
        setSelectedMonth(currentVNMonth);
      } else {
        loadAttendance(currentVNMonth);
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Lỗi khi thực hiện check-in' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMsg({ type: '', text: '' });
    try {
      const res = await authFetch('/api/employee/attendance/checkout', { method: 'POST' });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok || !data?.success) {
        const errorText = extractErrorMessage(data, `Check-out thất bại (HTTP ${res.status})`);
        throw new Error(errorText);
      }

      setActionMsg({ type: 'success', text: data.message || 'Check-out thành công!' });

      const currentVNMonth = getVietnamCurrentMonth();
      if (selectedMonth !== currentVNMonth) {
        setSelectedMonth(currentVNMonth);
      } else {
        loadAttendance(currentVNMonth);
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Lỗi khi thực hiện check-out' });
    } finally {
      setActionLoading(false);
    }
  }

  // Submit Leave Request
  async function handleSubmitLeave(e) {
    e.preventDefault();
    setSubmittingLeave(true);
    try {
      const res = await authFetch('/api/employee/leave-requests', {
        method: 'POST',
        body: JSON.stringify(newLeave),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowLeaveModal(false);
      setNewLeave({
        type: 'annual',
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        reasonText: '',
      });
      loadLeaves();
    } catch (err) {
      alert('Lỗi nộp đơn: ' + err.message);
    } finally {
      setSubmittingLeave(false);
    }
  }

  // ==========================================
  // RENDER: GIAO DIỆN CHƯA ĐĂNG NHẬP (LOGIN FORM)
  // ==========================================
  if (!user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', backgroundColor: '#ffffff' }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <User size={26} strokeWidth={2.2} />
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1a1a1a', marginBottom: '8px' }}>
              Cổng Nhân Viên
            </h1>
            <p style={{ color: '#6e7180', fontSize: '0.9375rem', lineHeight: '1.5' }}>
              Theo dõi lịch sử chấm công dạng bảng, tình trạng đơn nghỉ phép và ca kíp làm việc.
            </p>
          </div>

          {/* Form Card */}
          <div
            style={{
              padding: '32px',
              borderRadius: '28px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
            }}
          >
            {loginError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#b91c1c',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '8px' }}>
                  Mã nhân viên hoặc Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: NV002 hoặc nv002@congty.vn"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 18px',
                    borderRadius: '40px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    backgroundColor: '#fcfcfc',
                    color: '#1a1a1a',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '8px' }}>
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mật khẩu của bạn"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 18px',
                    borderRadius: '40px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    backgroundColor: '#fcfcfc',
                    color: '#1a1a1a',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '0.9375rem',
                  borderRadius: '40px',
                  marginTop: '8px',
                  justifyContent: 'center',
                }}
              >
                {loginLoading ? 'Đang xác thực...' : 'Đăng nhập vào Cổng'}
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Quick Fill Demo Accounts */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9295a3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Tài khoản mẫu thử nghiệm nhanh (Mật khẩu: matkhau123):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.code}
                    type="button"
                    onClick={() => {
                      setLoginCode(acc.code);
                      setLoginPass(acc.pass);
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid rgba(0,0,0,0.08)',
                      backgroundColor: '#f7f7f8',
                      color: '#373a46',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {acc.code} ({acc.name})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: GIAO DIỆN ĐÃ ĐĂNG NHẬP (EMPLOYEE WORKSPACE)
  // ==========================================
  const stats = attendanceData.stats || {};

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
      {/* Employee Profile Header */}
      <div
        style={{
          padding: '24px 28px',
          borderRadius: '24px',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            {user.fullName ? user.fullName.charAt(0) : 'NV'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1a1a1a' }}>
                {user.fullName}
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: '20px',
                  backgroundColor: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}
              >
                {user.employeeCode}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6e7180', marginTop: '2px', display: 'flex', gap: '12px' }}>
              <span>Phòng ban: <strong>{user.department?.name || 'Nhà xưởng'}</strong></span>
              <span>&bull;</span>
              <span>Chức vụ: <strong>{user.position || 'Nhân viên'}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Check-in/Check-out Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              opacity: actionLoading ? 0.7 : 1,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <Clock size={16} />
            {actionLoading ? 'Đang xử lý...' : 'Check-in vào ca'}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="btn-secondary"
            style={{
              padding: '10px 20px',
              borderRadius: '40px',
              fontSize: '0.875rem',
              opacity: actionLoading ? 0.7 : 1,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <Coffee size={16} />
            {actionLoading ? 'Đang xử lý...' : 'Check-out ra ca'}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 14px',
              borderRadius: '40px',
              border: '1px solid rgba(0,0,0,0.1)',
              backgroundColor: '#ffffff',
              color: '#6e7180',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.875rem',
            }}
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMsg.text && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '16px',
            backgroundColor: actionMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${actionMsg.type === 'success' ? '#bbf7d0' : '#fee2e2'}`,
            color: actionMsg.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.875rem',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {actionMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Tab Navigation Menu */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          marginBottom: '28px',
          paddingBottom: '2px',
        }}
      >
        {[
          { key: 'attendance', label: 'Bảng Chấm Công', icon: Calendar },
          { key: 'leaves', label: 'Đơn Nghỉ Phép', icon: FileText },
          { key: 'shifts', label: 'Ca Làm Việc Của Tôi', icon: Clock },
          { key: 'kpis', label: 'Nhiệm Vụ & KPI', icon: Target },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                border: 'none',
                borderBottom: isActive ? '2px solid #1a1a1a' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#1a1a1a' : '#6e7180',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BẢNG CHẤM CÔNG DẠNG BẢNG (ATTENDANCE REPORT TABLE) */}
      {/* ======================================================== */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Controls & Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#373a46' }}>
                Chọn tháng báo cáo:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  fontSize: '0.875rem',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>
              Hiển thị <strong>{attendanceData.data?.length || 0}</strong> ngày ghi nhận
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card-minimalist" style={{ padding: '20px', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.8125rem', color: '#6e7180', fontWeight: 500 }}>Tổng ngày đi làm</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a', marginTop: '6px' }}>
                {stats.totalWorkDays || 0} <span style={{ fontSize: '0.9375rem', fontWeight: 400, color: '#9295a3' }}>ngày</span>
              </div>
            </div>

            <div className="card-minimalist" style={{ padding: '20px', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 500 }}>Đi đúng giờ</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a', marginTop: '6px' }}>
                {stats.onTimeDays || 0} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#15803d' }}>({stats.onTimeRate || 0}%)</span>
              </div>
            </div>

            <div className="card-minimalist" style={{ padding: '20px', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.8125rem', color: '#d97706', fontWeight: 500 }}>Số lần đi muộn</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#d97706', marginTop: '6px' }}>
                {stats.lateDays || 0} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#b45309' }}>lần (+{stats.totalLateMinutes || 0}p)</span>
              </div>
            </div>

            <div className="card-minimalist" style={{ padding: '20px', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.8125rem', color: '#4f46e5', fontWeight: 500 }}>Tổng giờ làm tích lũy</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4f46e5', marginTop: '6px' }}>
                {stats.totalWorkedHours || 0} <span style={{ fontSize: '0.9375rem', fontWeight: 400, color: '#9295a3' }}>giờ</span>
              </div>
            </div>
          </div>

          {/* Contribution Graph Lịch Tháng */}
          <AttendanceContributionGraph
            month={selectedMonth}
            records={attendanceData.month === selectedMonth ? attendanceData.data || [] : []}
            loading={attendanceLoading}
            error={attendanceError}
          />

          {/* Table Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Ngày làm việc</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Ca làm</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Giờ vào</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Giờ ra</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Trạng thái</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Đi muộn</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Giờ làm</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Hình thức</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#9295a3' }}>
                        Đang tải bảng chấm công...
                      </td>
                    </tr>
                  ) : attendanceError ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#b91c1c' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <AlertCircle size={18} />
                          <span>{attendanceError}</span>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => loadAttendance(selectedMonth)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '0.8125rem',
                              border: '1px solid #fca5a5',
                              backgroundColor: '#fef2f2',
                              color: '#991b1b',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Thử tải lại
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : attendanceData.data?.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#9295a3' }}>
                        Chưa có dữ liệu chấm công cho tháng {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    attendanceData.data.map((record) => {
                      const isLate = record.status === 'late';
                      const isEarly = record.status === 'early_leave';
                      const isOntime = record.status === 'on_time';

                      return (
                        <tr
                          key={record._id}
                          style={{
                            borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbfbfb')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1a1a1a' }}>
                            {record.workDate}
                          </td>
                          <td style={{ padding: '16px 20px', color: '#6e7180' }}>
                            {record.shift?.name || 'Ca sáng'}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 500, color: record.checkInTime ? '#1a1a1a' : '#9295a3' }}>
                            {record.checkInTime || '—'}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 500, color: record.checkOutTime ? '#1a1a1a' : '#9295a3' }}>
                            {record.checkOutTime || '—'}
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: isOntime ? '#f0fdf4' : isLate ? '#fefce8' : isEarly ? '#f5f3ff' : '#f3f4f6',
                                color: isOntime ? '#15803d' : isLate ? '#a16207' : isEarly ? '#6d28d9' : '#374151',
                                border: `1px solid ${isOntime ? '#bbf7d0' : isLate ? '#fef08a' : isEarly ? '#ddd6fe' : '#e5e7eb'}`,
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: isOntime ? '#15803d' : isLate ? '#a16207' : isEarly ? '#6d28d9' : '#9ca3af',
                                }}
                              />
                              {isOntime ? 'Đúng giờ' : isLate ? 'Đi muộn' : isEarly ? 'Về sớm' : record.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', color: isLate ? '#b45309' : '#6e7180', fontWeight: isLate ? 600 : 400 }}>
                            {record.lateMinutes > 0 ? `+${record.lateMinutes} phút` : '—'}
                          </td>
                          <td style={{ padding: '16px 20px', color: '#1a1a1a', fontWeight: 500 }}>
                            {record.workedHours > 0 ? `${record.workedHours}h` : '—'}
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '3px 10px',
                                borderRadius: '16px',
                                backgroundColor: record.method === 'face' ? '#eff6ff' : '#f4f4f5',
                                color: record.method === 'face' ? '#1d4ed8' : '#52525b',
                                border: `1px solid ${record.method === 'face' ? '#bfdbfe' : '#e4e4e7'}`,
                              }}
                            >
                              {record.method === 'face' ? '📷 AI Face' : '✋ Thủ công'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ĐƠN NGHỈ PHÉP (LEAVE REQUESTS MANAGEMENT) */}
      {/* ======================================================== */}
      {activeTab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quota Banner & Button */}
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#fcfcfc',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Phép năm định mức</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>
                  {leaveData.leaveQuota?.quota ?? 12} ngày
                </div>
              </div>
              <div style={{ width: '1px', height: '36px', backgroundColor: 'rgba(0,0,0,0.08)' }} />
              <div>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Đã nghỉ</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309' }}>
                  {leaveData.leaveQuota?.used ?? 0} ngày
                </div>
              </div>
              <div style={{ width: '1px', height: '36px', backgroundColor: 'rgba(0,0,0,0.08)' }} />
              <div>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Còn lại</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>
                  {leaveData.leaveQuota?.remaining ?? 12} ngày
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLeaveModal(true)}
              className="btn-primary"
              style={{ padding: '12px 24px', borderRadius: '40px', fontSize: '0.875rem' }}
            >
              <Plus size={16} />
              Tạo đơn xin nghỉ phép
            </button>
          </div>

          {/* Leave Requests Table */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Loại nghỉ</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Khoảng thời gian</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Số ngày</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Lý do</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Trạng thái</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#373a46' }}>Người duyệt / Phản hồi</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9295a3' }}>
                        Đang tải danh sách đơn nghỉ...
                      </td>
                    </tr>
                  ) : leaveData.data?.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#9295a3' }}>
                        Bạn chưa có đơn xin nghỉ phép nào. Bấm nút phía trên để tạo đơn mới.
                      </td>
                    </tr>
                  ) : (
                    leaveData.data.map((item) => {
                      const isPending = item.status === 'pending';
                      const isApproved = item.status === 'approved';
                      const isRejected = item.status === 'rejected';

                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1a1a1a' }}>
                            {item.type === 'annual'
                              ? 'Nghỉ phép năm'
                              : item.type === 'sick'
                              ? 'Nghỉ ốm'
                              : item.type === 'remote'
                              ? 'Làm việc từ xa'
                              : 'Việc riêng'}
                          </td>
                          <td style={{ padding: '16px 20px', color: '#373a46' }}>
                            {item.fromDate} &rarr; {item.toDate}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1a1a1a' }}>
                            {item.numDays} ngày
                          </td>
                          <td style={{ padding: '16px 20px', color: '#6e7180', maxWidth: '240px' }}>
                            {item.reasonText}
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span
                              style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: isPending ? '#fefce8' : isApproved ? '#f0fdf4' : '#fef2f2',
                                color: isPending ? '#a16207' : isApproved ? '#15803d' : '#b91c1c',
                                border: `1px solid ${isPending ? '#fef08a' : isApproved ? '#bbf7d0' : '#fee2e2'}`,
                              }}
                            >
                              {isPending ? '⏳ Đang chờ duyệt' : isApproved ? '✓ Đã phê duyệt' : '✕ Từ chối'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', color: '#6e7180' }}>
                            {item.decidedBy ? (
                              <div>
                                <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{item.decidedBy}</span>
                                {item.decisionNote && (
                                  <div style={{ fontSize: '0.75rem', color: '#9295a3' }}>"{item.decisionNote}"</div>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CA LÀM VIỆC CỦA TÔI (MY SHIFTS) */}
      {/* ======================================================== */}
      {activeTab === 'shifts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#fcfcfc',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a1a1a' }}>
              Quy định ca làm việc hiện hành
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Ca hành chính tiêu chuẩn</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', marginTop: '4px' }}>08:00 - 17:00</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Thời gian nghỉ giữa ca</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', marginTop: '4px' }}>60 phút</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Ân hạn vào muộn</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>5 phút</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.8125rem', color: '#6e7180' }}>Ngưỡng tính về sớm</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>15 phút</div>
              </div>
            </div>
          </div>

          {/* Shift Schedule List */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 700, color: '#1a1a1a' }}>
              Lịch phân ca tháng {selectedMonth}
            </div>
            <div style={{ padding: '24px' }}>
              {shiftsData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#9295a3' }}>
                  Lịch phân ca được áp dụng theo Ca sáng chuẩn mặc định (08:00 - 17:00).
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {shiftsData.map((s) => (
                    <div
                      key={s._id}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        backgroundColor: s.isDayOff ? '#f4f4f5' : '#ffffff',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{s.workDate}</div>
                      <div style={{ fontSize: '0.8125rem', color: s.isDayOff ? '#71717a' : '#2563eb', marginTop: '4px' }}>
                        {s.isDayOff ? '🏖️ Ngày nghỉ' : `${s.shift?.name || 'Ca sáng'} (${s.shift?.startTime} - ${s.shift?.endTime})`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: NHIỆM VỤ & KPI (MY KPIS) */}
      {/* ======================================================== */}
      {activeTab === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Progress Header */}
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#fcfcfc',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a1a1a' }}>
                  Tiến độ hoàn thành KPI tổng thể
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#6e7180' }}>
                  Được tính toán dựa trên trọng số các nhiệm vụ do Quản lý giao phó.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a' }}>
                {kpiData.overallProgress || 0}%
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, kpiData.overallProgress || 0)}%`,
                  height: '100%',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '10px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* KPI Task Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {kpiData.data?.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: '#9295a3' }}>
                Hiện chưa có mục tiêu KPI nào được giao cho bạn.
              </div>
            ) : (
              kpiData.data?.map((task) => (
                <div
                  key={task._id}
                  style={{
                    padding: '24px',
                    borderRadius: '20px',
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
                        {task.title}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: task.progress === 100 ? '#f0fdf4' : '#eff6ff',
                          color: task.progress === 100 ? '#15803d' : '#1d4ed8',
                          fontWeight: 600,
                        }}
                      >
                        Trọng số: {task.weight}
                      </span>
                    </div>

                    {task.evaluatorNote && (
                      <p style={{ fontSize: '0.8125rem', color: '#6e7180', marginTop: '8px' }}>
                        Ghi chú: {task.evaluatorNote}
                      </p>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                      <span style={{ color: '#6e7180' }}>Hạn chót: <strong>{task.deadline}</strong></span>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{task.progress}%</span>
                    </div>

                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '6px',
                        backgroundColor: '#f0f0f2',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${task.progress}%`,
                          height: '100%',
                          backgroundColor: task.progress === 100 ? '#16a34a' : '#1a1a1a',
                          borderRadius: '6px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL NỘP ĐƠN NGHỈ PHÉP (NEW LEAVE REQUEST MODAL) */}
      {/* ======================================================== */}
      {showLeaveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#ffffff',
              borderRadius: '28px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
              animation: 'fadeInUp 0.2s ease-out',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Nộp Đơn Xin Nghỉ Phép
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6e7180', marginBottom: '20px' }}>
              Đơn sẽ được gửi trực tiếp đến Quản lý phòng ban trên AIAttendanceWeb3 để xem xét và phê duyệt.
            </p>

            <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '6px' }}>
                  Loại nghỉ
                </label>
                <select
                  value={newLeave.type}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '20px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                >
                  <option value="annual">Nghỉ phép năm (Trừ vào quota)</option>
                  <option value="sick">Nghỉ ốm đau / Khám bệnh</option>
                  <option value="unpaid">Nghỉ việc riêng không hưởng lương</option>
                  <option value="remote">Làm việc từ xa (Remote)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '6px' }}>
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.fromDate}
                    onChange={(e) => setNewLeave({ ...newLeave, fromDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '20px',
                      border: '1px solid rgba(0,0,0,0.12)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '6px' }}>
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.toDate}
                    onChange={(e) => setNewLeave({ ...newLeave, toDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '20px',
                      border: '1px solid rgba(0,0,0,0.12)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#373a46', marginBottom: '6px' }}>
                  Lý do xin nghỉ
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ghi rõ lý do xin nghỉ phép để quản lý xét duyệt..."
                  value={newLeave.reasonText}
                  onChange={(e) => setNewLeave({ ...newLeave, reasonText: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '40px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    backgroundColor: '#ffffff',
                    color: '#6e7180',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', borderRadius: '40px', justifyContent: 'center' }}
                >
                  {submittingLeave ? 'Đang gửi...' : 'Nộp đơn ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
