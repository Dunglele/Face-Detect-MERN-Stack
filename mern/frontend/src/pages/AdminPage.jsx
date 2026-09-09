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
  AlertCircle,
  Cpu,
  Activity,
  Trash2,
  Filter,
  ArrowUpRight
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

  // Mock initial users
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

  // Mock initial logs
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
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '32px 24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">
              <ShieldCheck size={14} /> Control Panel
            </span>
            <span className="badge badge-blue">
              Path: <code>/admin</code>
            </span>
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Quản Trị <span className="text-gradient-purple-pink">Hệ Thống Điểm Danh</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Giám sát thời gian thực, quản lý danh mục nhân viên và đồng bộ cơ sở dữ liệu MongoDB.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-glass-secondary"
            onClick={checkBackend}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Làm mới
          </button>

          <Link to="/demo" className="btn-glass-cyan" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            Thử nghiệm Camera &rarr;
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                TỔNG NHÂN SỰ
              </p>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>
                {users.length}
              </div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '10px', borderRadius: '12px' }}>
              <Users size={22} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.785rem', color: 'var(--text-dim)' }}>
            Đã nạp vector khuôn mặt: <strong style={{ color: '#34d399' }}>{users.filter(u => u.isFaceEnrolled).length}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                ĐIỂM DANH HÔM NAY
              </p>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#34d399' }}>
                {logs.filter(l => l.status === 'Present').length}
              </div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '10px', borderRadius: '12px' }}>
              <UserCheck size={22} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.785rem', color: 'var(--text-dim)' }}>
            Độ trùng khớp trung bình: <strong style={{ color: '#38bdf8' }}>95.8%</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                MONGODB DATABASE
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#60a5fa' }}>
                face_detect_db
              </div>
            </div>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', padding: '10px', borderRadius: '12px' }}>
              <Activity size={22} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.785rem', color: 'var(--text-dim)' }}>
            Backend API: <span style={{ color: backendOnline ? '#34d399' : '#fbbf24', fontWeight: 600 }}>{backendOnline ? 'Port 5000 Connected' : 'Mô phỏng (Offline)'}</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                AI MODEL PIPELINE
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#c084fc' }}>
                YOLOv11 + dlib
              </div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '10px', borderRadius: '12px' }}>
              <Cpu size={22} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.785rem', color: 'var(--text-dim)' }}>
            128-d Embedding • <span style={{ color: '#38bdf8' }}>Tolerance: 0.44</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-glass)',
          marginBottom: '24px',
        }}
      >
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'attendance' ? '2px solid #a855f7' : '2px solid transparent',
            color: activeTab === 'attendance' ? '#c084fc' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={17} />
          Nhật Ký Điểm Danh ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid #a855f7' : '2px solid transparent',
            color: activeTab === 'users' ? '#c084fc' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={17} />
          Danh Mục Nhân Sự ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('system')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'system' ? '2px solid #a855f7' : '2px solid transparent',
            color: activeTab === 'system' ? '#c084fc' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Cpu size={17} />
          Kết Nối Hệ Thống AI & APIs
        </button>
      </div>

      {/* Tab 1: Attendance Logs */}
      {activeTab === 'attendance' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <Search
                size={16}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-glass-secondary" onClick={handleSimulateCheckIn}>
                <Plus size={15} /> Thử Thêm Lượt Điểm Danh
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    color: 'var(--text-muted)',
                    fontSize: '0.785rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Nhân Viên</th>
                  <th style={{ padding: '12px 16px' }}>Thời Gian Quét</th>
                  <th style={{ padding: '12px 16px' }}>Độ Khớp AI (%)</th>
                  <th style={{ padding: '12px 16px' }}>Hình Thức</th>
                  <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log._id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      fontSize: '0.885rem',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#f1f5f9' }}>
                      {log.userName}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.825rem' }}>
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')} -{' '}
                      {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: log.confidence > 85 ? '#34d399' : '#f43f5e',
                        }}
                      >
                        {log.confidence}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-dim)' }}>
                      {log.checkInType || 'Check-in'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        className={`badge ${
                          log.status === 'Present' ? 'badge-green' : 'badge-red'
                        }`}
                      >
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
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Hồ Sơ Nhân Sự</h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Theo dõi tình trạng nạp 20 góc mặt và thông tin phòng ban
              </p>
            </div>

            <button className="btn-glass-primary" onClick={() => setShowAddUserModal(true)}>
              <Plus size={16} /> Thêm Nhân Viên
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
              gap: '16px',
            }}
          >
            {users.map((u) => (
              <div
                key={u._id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '14px',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                      {u.name}
                    </h4>
                    <p style={{ fontSize: '0.785rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {u.employeeId} • {u.department}
                    </p>
                  </div>
                  <span className={`badge ${u.isFaceEnrolled ? 'badge-green' : 'badge-amber'}`}>
                    {u.isFaceEnrolled ? 'Đã học mặt' : 'Chưa nạp'}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.775rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Mẫu góc chụp: {u.faceSampleCount || (u.isFaceEnrolled ? 20 : 0)} frames</span>
                  <span style={{ color: '#60a5fa' }}>ID: {u._id.slice(-4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: System Topology */}
      {activeTab === 'system' && (
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#c084fc' }}>
            Cấu Trúc Tích Hợp Hệ Thống & APIs
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Hệ sinh thái kết nối thời gian thực giữa Mô hình AI YOLOv11 (Python) và máy chủ MERN Stack:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>
                Python AI Engine
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Chạy file <code>face_detect/app.py</code>. Quét webcam độ phân giải cao, trích xuất vector nhúng 128 chiều và gửi bản ghi điểm danh qua REST API.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '6px' }}>
                Express REST API
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Lắng nghe tại <code>http://localhost:5000</code>. Nhận dữ liệu điểm danh, xác thực và lưu vào MongoDB <code>face_detect_db</code>.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '6px' }}>
                React Glassmorphic Frontend
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Giao diện quản trị hiện tại <code>/admin</code>. Hiển thị báo cáo, quản lý nhân viên và hỗ trợ thử nghiệm trực tiếp tại <code>/demo</code>.
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
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '28px',
              background: '#0d121c',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
              Thêm Nhân Viên Mới
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Sau khi lưu, nhân viên có thể tiến hành quét 20 góc mặt trên mô hình Python.
            </p>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Phòng ban
                </label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#151d2c',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="AI & Engineering">AI & Engineering</option>
                  <option value="Product Design">Product Design</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Marketing & Sales">Marketing & Sales</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-glass-secondary"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-glass-primary">
                  Lưu Nhân Viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
