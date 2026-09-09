import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  UserCheck,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Database,
  ArrowUpRight,
  Filter
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'users' | 'system'
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newDept, setNewDept] = useState('AI & Engineering');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 14,
    enrolledUsers: 11,
    todayCheckIns: 9,
    modelAccuracy: '99.2%',
  });

  // Users state
  const [users, setUsers] = useState([
    {
      _id: 'usr-1',
      name: 'Nguyễn Tiến Dũng',
      employeeId: 'EMP-001',
      department: 'AI & Engineering',
      isFaceEnrolled: true,
      faceSampleCount: 20,
      createdAt: '2026-03-01T08:00:00.000Z',
    },
    {
      _id: 'usr-2',
      name: 'Ngọc Khánh',
      employeeId: 'EMP-002',
      department: 'Product Design',
      isFaceEnrolled: true,
      faceSampleCount: 20,
      createdAt: '2026-03-02T09:15:00.000Z',
    },
    {
      _id: 'usr-3',
      name: 'Trần Minh Hoàng',
      employeeId: 'EMP-003',
      department: 'Human Resources',
      isFaceEnrolled: true,
      faceSampleCount: 20,
      createdAt: '2026-03-05T10:30:00.000Z',
    },
    {
      _id: 'usr-4',
      name: 'Lê Thùy Trang',
      employeeId: 'EMP-004',
      department: 'Marketing & Sales',
      isFaceEnrolled: false,
      faceSampleCount: 0,
      createdAt: '2026-03-08T14:20:00.000Z',
    },
  ]);

  // Logs state
  const [logs, setLogs] = useState([
    {
      _id: 'log-101',
      userName: 'Nguyễn Tiến Dũng',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      confidence: 96.8,
      status: 'Present',
      checkInType: 'Check-in',
    },
    {
      _id: 'log-102',
      userName: 'Ngọc Khánh',
      timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      confidence: 94.5,
      status: 'Present',
      checkInType: 'Check-in',
    },
    {
      _id: 'log-103',
      userName: 'Trần Minh Hoàng',
      timestamp: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
      confidence: 91.2,
      status: 'Present',
      checkInType: 'Check-in',
    },
    {
      _id: 'log-104',
      userName: 'Unknown Face',
      timestamp: new Date(Date.now() - 1000 * 60 * 135).toISOString(),
      confidence: 42.1,
      status: 'Unrecognized',
      checkInType: 'Check-in',
    },
  ]);

  const checkBackend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        setBackendOnline(true);
        fetchBackendData();
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackendData = async () => {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/attendance/stats`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/users`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/attendance`).then((r) => r.json()).catch(() => null),
      ]);

      if (statsRes && statsRes.success) {
        setStats((prev) => ({ ...prev, ...statsRes.data }));
      }
      if (usersRes && usersRes.success && usersRes.data.length > 0) {
        setUsers(usersRes.data);
      }
      if (logsRes && logsRes.success && logsRes.data.length > 0) {
        setLogs(logsRes.data);
      }
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }
  };

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    const newUser = {
      name: newUserName,
      employeeId: newEmpId || `EMP-${String(users.length + 1).padStart(3, '0')}`,
      department: newDept,
      isFaceEnrolled: false,
      faceSampleCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (backendOnline) {
      try {
        const res = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        });
        const data = await res.json();
        if (data.success) {
          setUsers([data.data, ...users]);
        } else {
          setUsers([newUser, ...users]);
        }
      } catch {
        setUsers([newUser, ...users]);
      }
    } else {
      setUsers([newUser, ...users]);
    }

    setNewUserName('');
    setNewEmpId('');
    setShowAddUserModal(false);
  };

  const handleSimulateCheckIn = async () => {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const newLog = {
      _id: `sim-${Date.now()}`,
      userName: randomUser ? randomUser.name : 'Nguyễn Tiến Dũng',
      timestamp: new Date().toISOString(),
      confidence: +(90 + Math.random() * 9).toFixed(1),
      status: 'Present',
      checkInType: 'Check-in',
    };

    if (backendOnline) {
      try {
        const res = await fetch(`${API_BASE}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLog),
        });
        const data = await res.json();
        if (data.success) {
          setLogs([data.data, ...logs]);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setLogs([newLog, ...logs]);
  };

  const filteredLogs = logs.filter((log) =>
    log.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '48px 24px 80px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge-minimal">
              <ShieldCheck size={14} /> Control Panel
            </span>
            <span className="badge-tag neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              /admin
            </span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 4vw, 3rem)',
              fontWeight: 700,
              letterSpacing: '-0.035em',
            }}
          >
            Quản trị{' '}
            <span className="font-accent-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
              điểm danh
            </span>{' '}
            nhân sự
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '4px' }}>
            Giám sát thời gian thực, quản lý danh bạ nhân viên và đồng bộ cơ sở dữ liệu MongoDB.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-outline"
            onClick={checkBackend}
            disabled={loading}
            style={{ padding: '8px 18px', fontSize: '0.875rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Làm mới dữ liệu
          </button>

          <Link to="/demo" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
            Thử nghiệm Camera
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        <div className="minimal-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tổng nhân sự
              </p>
              <div style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.04em', marginTop: '4px' }}>
                {users.length}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-muted)', padding: '10px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Đã nạp vector khuôn mặt: <strong style={{ color: '#108a55' }}>{users.filter(u => u.isFaceEnrolled).length}</strong>
          </div>
        </div>

        <div className="minimal-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Điểm danh hôm nay
              </p>
              <div style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.04em', marginTop: '4px' }}>
                {logs.filter(l => l.status === 'Present').length}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-muted)', padding: '10px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
              <UserCheck size={20} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Độ trùng khớp trung bình: <strong style={{ color: 'var(--text-primary)' }}>95.8%</strong>
          </div>
        </div>

        <div className="minimal-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cơ sở dữ liệu
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                face_detect_db
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-muted)', padding: '10px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
              <Database size={20} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            API: <span style={{ fontWeight: 600, color: backendOnline ? '#108a55' : '#b45309' }}>{backendOnline ? 'Port 5000 Connected' : 'Mô phỏng (Offline)'}</span>
          </div>
        </div>

        <div className="minimal-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Chuỗi mô hình AI
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', letterSpacing: '-0.02em' }}>
                YOLOv11 + dlib
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-muted)', padding: '10px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            128-d Vector &bull; Tolerance: 0.44
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '28px',
        }}
      >
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'attendance' ? '2px solid var(--text-primary)' : '2px solid transparent',
            color: activeTab === 'attendance' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'attendance' ? 600 : 500,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} />
          Nhật ký điểm danh ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid var(--text-primary)' : '2px solid transparent',
            color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'users' ? 600 : 500,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={16} />
          Danh mục nhân sự ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('system')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'system' ? '2px solid var(--text-primary)' : '2px solid transparent',
            color: activeTab === 'system' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'system' ? 600 : 500,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Database size={16} />
          Cấu trúc hệ thống
        </button>
      </div>

      {/* Tab 1: Attendance Logs */}
      {activeTab === 'attendance' && (
        <div className="minimal-card" style={{ padding: '28px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div style={{ position: 'relative', minWidth: '300px' }}>
              <Search
                size={16}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  backgroundColor: 'var(--bg-neutral)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--rounded-sm)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>

            <button className="btn-outline" onClick={handleSimulateCheckIn}>
              <Plus size={15} /> Thêm lượt điểm danh thử nghiệm
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Nhân viên</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian quét</th>
                  <th style={{ padding: '12px 16px' }}>Độ khớp AI</th>
                  <th style={{ padding: '12px 16px' }}>Hình thức</th>
                  <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log._id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    <td style={{ padding: '16px', fontWeight: 600 }}>
                      {log.userName}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')} -{' '}
                      {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: log.confidence > 85 ? '#108a55' : '#b45309',
                        }}
                      >
                        {log.confidence}%
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                      {log.checkInType || 'Check-in'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge-tag ${log.status === 'Present' ? 'active' : 'pending'}`}>
                        {log.status === 'Present' ? 'Hợp lệ' : 'Không xác định'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === 'users' && (
        <div className="minimal-card" style={{ padding: '28px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Hồ sơ nhân sự</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Quản lý trạng thái nạp 20 góc mặt của nhân viên
              </p>
            </div>

            <button className="btn-primary" onClick={() => setShowAddUserModal(true)}>
              <Plus size={16} /> Thêm nhân viên
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {users.map((u) => (
              <div
                key={u._id}
                style={{
                  backgroundColor: 'var(--bg-neutral)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>
                      {u.name}
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {u.employeeId} &bull; {u.department}
                    </p>
                  </div>
                  <span className={`badge-tag ${u.isFaceEnrolled ? 'active' : 'pending'}`}>
                    {u.isFaceEnrolled ? 'Đã học mặt' : 'Chưa nạp'}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Mẫu ảnh: {u.faceSampleCount || (u.isFaceEnrolled ? 20 : 0)} frames</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>ID: {u._id.slice(-4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: System Topology */}
      {activeTab === 'system' && (
        <div className="minimal-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>
            Kiến trúc hệ thống
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '28px' }}>
            Kết nối đa tầng giữa Mô hình AI Python (YOLOv11 + dlib) và Hệ thống MERN Stack:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                Python AI Engine
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Chạy file <code>face_detect/app.py</code>. Quét webcam độ phân giải cao, trích xuất vector nhúng 128 chiều và gửi bản ghi điểm danh qua REST API.
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                Express REST API
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Lắng nghe tại cổng 5000. Tiếp nhận dữ liệu, xác thực và lưu vết vào MongoDB <code>face_detect_db</code>.
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--bg-neutral)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                Frontend Minimalist White
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Giao diện phong cách tối giản chuẩn quốc tế, bố cục thoáng đãng, hiệu năng cao và dễ điều hành.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            padding: '20px',
          }}
        >
          <div
            className="minimal-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '32px',
              backgroundColor: '#ffffff',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
              Thêm nhân viên mới
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Sau khi tạo hồ sơ, hãy mở ứng dụng Python để quét nạp 20 góc mặt.
            </p>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Minh Đức"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-neutral)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9375rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Mã nhân viên (Employee ID)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: EMP-005"
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-neutral)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9375rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Phòng ban
                </label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-neutral)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9375rem',
                    outline: 'none',
                  }}
                >
                  <option value="AI & Engineering">AI & Engineering</option>
                  <option value="Product Design">Product Design</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Marketing & Sales">Marketing & Sales</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Lưu nhân viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
