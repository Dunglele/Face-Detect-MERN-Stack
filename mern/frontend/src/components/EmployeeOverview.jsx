import React from 'react';
import { Calendar, FileText, Clock, Target, ArrowRight, ShieldCheck } from 'lucide-react';
import './EmployeeOverview.css';

function formatTodayDate() {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export default function EmployeeOverview({
  attendanceData = {},
  attendanceLoading = false,
  leaveData = {},
  leaveLoading = false,
  shiftsData = [],
  shiftsLoading = false,
  kpiData = {},
  kpiLoading = false,
  onNavigate,
  onCreateLeave,
}) {
  const stats = attendanceData.stats || {};
  const leaveQuota = leaveData.leaveQuota || {};
  const totalShifts = shiftsData.length;
  const overallKpi = kpiData.overallProgress || 0;

  return (
    <div className="employee-overview">
      <div className="employee-overview__intro">
        <div>
          <span className="employee-overview__eyebrow">TỔNG QUAN HỒ SƠ NHÂN VIÊN</span>
          <h2>Bảng làm việc cá nhân</h2>
          <p>{formatTodayDate()}</p>
        </div>

        <a
          href="/kiosk"
          target="_blank"
          rel="noreferrer"
          className="employee-overview__kiosk"
        >
          <ShieldCheck size={16} />
          <span>Mở Kiosk Chấm Công</span>
          <ArrowRight size={14} />
        </a>
      </div>

      <div className="employee-overview__grid">
        {/* Card 1: Chấm công tháng */}
        <div className="employee-overview__card">
          <div className="employee-overview__card-heading">
            <Calendar size={18} />
            <span>Chấm công tháng hiện tại</span>
          </div>
          <h3>
            {attendanceLoading ? '...' : `${stats.totalWorkDays || 0} ngày công`}
          </h3>
          <p>
            Đúng giờ: <strong>{stats.onTimeDays || 0}</strong> ngày • Đi muộn:{' '}
            <strong>{stats.lateDays || 0}</strong> • Về sớm: <strong>{stats.earlyLeaveDays || 0}</strong>
          </p>
          <button
            type="button"
            className="employee-overview__text-link"
            onClick={() => onNavigate?.('attendance')}
          >
            <span>Xem chi tiết bảng công</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 2: Phép năm */}
        <div className="employee-overview__card">
          <div className="employee-overview__card-heading">
            <FileText size={18} />
            <span>Quỹ phép năm</span>
          </div>
          <h3>
            {leaveLoading ? '...' : `${leaveQuota.remaining ?? 12} / ${leaveQuota.total || 12} ngày`}
          </h3>
          <p>
            Đã sử dụng: <strong>{leaveQuota.used || 0}</strong> ngày • Đang chờ duyệt:{' '}
            <strong>{leaveQuota.pending || 0}</strong> đơn
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: 'auto' }}>
            <button
              type="button"
              className="employee-overview__text-link"
              onClick={() => onNavigate?.('leaves')}
            >
              <span>Xem danh sách đơn</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="employee-overview__text-link"
              onClick={onCreateLeave}
            >
              <span>+ Nộp đơn mới</span>
            </button>
          </div>
        </div>

        {/* Card 3: Ca kíp làm việc */}
        <div className="employee-overview__card">
          <div className="employee-overview__card-heading">
            <Clock size={18} />
            <span>Lịch ca kíp tháng này</span>
          </div>
          <h3>{shiftsLoading ? '...' : `${totalShifts} ca làm việc`}</h3>
          <p>
            Lịch phân ca chuẩn được thiết lập bởi phòng nhân sự quản trị trên AIAttendanceWeb3.
          </p>
          <button
            type="button"
            className="employee-overview__text-link"
            onClick={() => onNavigate?.('shifts')}
          >
            <span>Tra cứu ca làm việc</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 4: KPI & Tiến độ */}
        <div className="employee-overview__card">
          <div className="employee-overview__card-heading">
            <Target size={18} />
            <span>Chỉ số mục tiêu (KPI)</span>
          </div>
          <h3>{kpiLoading ? '...' : `${Math.round(overallKpi)}% hoàn thành`}</h3>
          <div className="employee-overview__progress">
            <span style={{ width: `${Math.min(100, Math.max(0, overallKpi))}%` }} />
          </div>
          <p>
            Tiến độ công việc tháng được giao và đánh giá theo tiêu chí phòng ban.
          </p>
          <button
            type="button"
            className="employee-overview__text-link"
            onClick={() => onNavigate?.('kpis')}
          >
            <span>Xem chi tiết KPI</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
