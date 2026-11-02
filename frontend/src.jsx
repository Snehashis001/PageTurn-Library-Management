import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Calendar,
  X,
  BookMarked,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import './style.css';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState({ status: 'CHECKING', database: 'CHECKING', tip: '' });
  const [toast, setToast] = useState(null);

  // Data states
  const [dashboardData, setDashboardData] = useState({
    metrics: { totalTitles: 0, totalCopies: 0, availableCopies: 0, registeredMembers: 0, currentlyIssued: 0 },
    monthlyChart: [],
    recentActivity: []
  });
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [issueFilter, setIssueFilter] = useState('all'); // 'all' or 'active'

  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Form states
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'Computer Science',
    totalCopies: 3
  });

  const [newMember, setNewMember] = useState({
    fullName: '',
    email: '',
    phone: ''
  });

  const [issueForm, setIssueForm] = useState({
    bookId: '',
    memberId: '',
    daysValid: 14
  });

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // 1. Check Backend and Database Health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setDbStatus(data);
    } catch {
      setDbStatus({
        status: 'DOWN',
        database: 'DISCONNECTED',
        tip: 'Backend server is not running on port 5000.'
      });
    }
  }, []);

  // 2. Fetch Dashboard Data
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    }
  }, []);

  // 3. Fetch Books
  const fetchBooks = useCallback(async (query = '') => {
    try {
      const url = query ? `${API_BASE}/books?q=${encodeURIComponent(query)}` : `${API_BASE}/books`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBooks(data.books || []);
      }
    } catch (err) {
      console.warn('Books fetch error:', err);
    }
  }, []);

  // 4. Fetch Members
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/members`);
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (err) {
      console.warn('Members fetch error:', err);
    }
  }, []);

  // 5. Fetch Issues History
  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/issues`);
      const data = await res.json();
      if (data.success) {
        setIssues(data.issues || []);
      }
    } catch (err) {
      console.warn('Issues fetch error:', err);
    }
  }, []);

  // Initial Load and Tab change
  const refreshCurrentView = useCallback(async () => {
    setLoading(true);
    await checkHealth();
    if (activeTab === 'dashboard') await fetchDashboard();
    if (activeTab === 'books') await fetchBooks(searchQuery);
    if (activeTab === 'members') await fetchMembers();
    if (activeTab === 'issues') {
      await fetchIssues();
      await fetchBooks();
      await fetchMembers();
    }
    setLoading(false);
  }, [activeTab, searchQuery, checkHealth, fetchDashboard, fetchBooks, fetchMembers, fetchIssues]);

  useEffect(() => {
    refreshCurrentView();
  }, [refreshCurrentView]);

  // Handle Search input debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchBooks(val);
  };

  // Add Book handler (calls LIBRARY_PKG.ADD_BOOK via Express API)
  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author || !newBook.isbn) {
      showToast('error', 'Validation Error', 'Title, Author, and ISBN are required.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook)
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Book Catalogued', data.message);
        setIsBookModalOpen(false);
        setNewBook({ title: '', author: '', isbn: '', category: 'Computer Science', totalCopies: 3 });
        fetchBooks(searchQuery);
        fetchDashboard();
      } else {
        showToast('error', 'Oracle Error', data.error || 'Failed to add book.');
      }
    } catch (err) {
      showToast('error', 'Network Error', 'Could not reach backend API.');
    } finally {
      setActionLoading(false);
    }
  };

  // Register Member handler (calls LIBRARY_PKG.REGISTER_MEMBER)
  const handleRegisterMember = async (e) => {
    e.preventDefault();
    if (!newMember.fullName || !newMember.email || !newMember.phone) {
      showToast('error', 'Validation Error', 'Full Name, Email, and Phone number are required.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Member Registered', data.message);
        setIsMemberModalOpen(false);
        setNewMember({ fullName: '', email: '', phone: '' });
        fetchMembers();
        fetchDashboard();
      } else {
        showToast('error', 'Oracle Error', data.error || 'Failed to register member.');
      }
    } catch (err) {
      showToast('error', 'Network Error', 'Could not reach backend API.');
    } finally {
      setActionLoading(false);
    }
  };

  // Issue Book handler (calls LIBRARY_PKG.ISSUE_BOOK)
  const handleIssueBook = async (e) => {
    e.preventDefault();
    if (!issueForm.bookId || !issueForm.memberId) {
      showToast('error', 'Validation Error', 'Please select both a valid Book and Member.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/issues/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Book Issued', data.message);
        setIssueForm({ bookId: '', memberId: '', daysValid: 14 });
        fetchIssues();
        fetchBooks();
        fetchDashboard();
      } else {
        showToast('error', 'PL/SQL Exception', data.error || 'Failed to issue book.');
      }
    } catch (err) {
      showToast('error', 'Network Error', 'Could not reach backend API.');
    } finally {
      setActionLoading(false);
    }
  };

  // Return Book handler (calls LIBRARY_PKG.RETURN_BOOK)
  const handleReturnBook = async (issueId) => {
    if (!window.confirm(`Confirm return of borrowed book (Transaction #${issueId})?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/issues/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Book Returned', data.message);
        fetchIssues();
        fetchBooks();
        fetchDashboard();
      } else {
        showToast('error', 'PL/SQL Exception', data.error || 'Failed to return book.');
      }
    } catch (err) {
      showToast('error', 'Network Error', 'Could not reach backend API.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered issues
  const displayedIssues = issues.filter((iss) => {
    if (issueFilter === 'active') return iss.status === 'ISSUED';
    return true;
  });

  return (
    <div className="app-container">
      {/* 1. Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo-icon">
            <BookMarked size={22} />
          </div>
          <div className="brand-info">
            <h1>PageTurn</h1>
            <p>Library Management</p>
          </div>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => setActiveTab('books')}
          >
            <BookOpen size={18} />
            <span>Books Catalog</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={18} />
            <span>Members</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'issues' ? 'active' : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            <ArrowLeftRight size={18} />
            <span>Issue & Return</span>
          </button>
        </nav>

        {/* Database Status Widget */}
        <div className="sidebar-footer">
          <div className="db-status-card">
            <div className="db-status-info">
              <span className="db-status-label">Oracle Database</span>
              <span className="db-status-value">
                <span
                  className={`status-dot ${
                    dbStatus.database === 'CONNECTED' ? 'connected' : 'disconnected'
                  }`}
                ></span>
                {dbStatus.database === 'CONNECTED' ? 'Online' : 'Offline'}
              </span>
            </div>
            <Database size={16} color={dbStatus.database === 'CONNECTED' ? '#10b981' : '#ef4444'} />
          </div>
        </div>
      </aside>

      {/* 2. Main Content View */}
      <main className="main-wrapper">
        {/* Compact Header */}
        <header className="topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">
              {activeTab === 'dashboard' && 'Circulation Dashboard'}
              {activeTab === 'books' && 'Library Book Inventory'}
              {activeTab === 'members' && 'Registered Cardholders'}
              {activeTab === 'issues' && 'Circulation Desk: Issue & Return'}
            </h2>
            <span className="topbar-subtitle">Oracle PL/SQL Core</span>
          </div>

          <div className="topbar-right">
            <span className="academic-badge">MCA Mini-Project</span>
            <button className="btn-refresh" onClick={refreshCurrentView} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Body Container */}
        <div className="content-body">
          {/* Disconnected Notice Banner if Oracle is not reachable */}
          {dbStatus.database !== 'CONNECTED' && (
            <div className="db-alert-banner">
              <AlertTriangle size={20} className="db-alert-icon" />
              <div className="db-alert-content">
                <h4>Oracle Database Service Not Connected</h4>
                <p>
                  Backend is running, but Oracle DB is offline or unreachable at{' '}
                  <code>{dbStatus.connectString || 'localhost:1521/XEPDB1'}</code>. Start Oracle
                  service and verify credentials in <code>backend/.env</code>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* 4 KPI Summary Cards */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Total Titles</span>
                    <div className="kpi-icon-wrap kpi-icon-indigo">
                      <BookOpen size={18} />
                    </div>
                  </div>
                  <div className="kpi-value">{dashboardData.metrics.totalTitles}</div>
                  <div className="kpi-subtext">
                    {dashboardData.metrics.totalCopies} total catalog copies
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Available Copies</span>
                    <div className="kpi-icon-wrap kpi-icon-emerald">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                  <div className="kpi-value">{dashboardData.metrics.availableCopies}</div>
                  <div className="kpi-subtext">
                    Ready for immediate checkout on shelf
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Registered Members</span>
                    <div className="kpi-icon-wrap kpi-icon-cyan">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="kpi-value">{dashboardData.metrics.registeredMembers}</div>
                  <div className="kpi-subtext">Active cardholders</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Currently Issued</span>
                    <div className="kpi-icon-wrap kpi-icon-amber">
                      <ArrowLeftRight size={18} />
                    </div>
                  </div>
                  <div className="kpi-value">{dashboardData.metrics.currentlyIssued}</div>
                  <div className="kpi-subtext">Active unreturned loans</div>
                </div>
              </div>

              {/* Monthly Issues vs Returns Recharts Graph */}
              <div className="dashboard-middle-grid">
                <div className="card-panel">
                  <div className="panel-header">
                    <div className="panel-title-area">
                      <h3>Monthly Circulation Overview</h3>
                      <p>Aggregated Oracle transaction history comparing book issues and returns</p>
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-swatch indigo"></span>
                        <span>Books Issued</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-swatch emerald"></span>
                        <span>Books Returned</span>
                      </div>
                    </div>
                  </div>

                  <div className="chart-container">
                    {dashboardData.monthlyChart && dashboardData.monthlyChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dashboardData.monthlyChart}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="month"
                            stroke="#64748b"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                          />
                          <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#131b2e',
                              borderColor: 'rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              color: '#fff',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}
                          />
                          <Bar
                            dataKey="issued"
                            name="Issued"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                            barSize={24}
                          />
                          <Bar
                            dataKey="returned"
                            name="Returned"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            barSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="state-container">
                        <Calendar size={32} />
                        <h4>No Circulation Records Yet</h4>
                        <p>Issue books from the Issue & Return tab to populate monthly circulation trends.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="card-panel">
                <div className="panel-header">
                  <div className="panel-title-area">
                    <h3>Recent Circulation Transactions</h3>
                    <p>Live feed from Oracle ISSUE_RECORDS with multi-table JOIN</p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Txn #</th>
                        <th>Book Title</th>
                        <th>Borrower</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentActivity.length > 0 ? (
                        dashboardData.recentActivity.map((r) => (
                          <tr key={r.issueId}>
                            <td className="cell-mono">#{r.issueId}</td>
                            <td>
                              <div className="cell-primary-text">{r.bookTitle}</div>
                              <div className="cell-subtext">{r.isbn}</div>
                            </td>
                            <td>
                              <div className="cell-primary-text">{r.memberName}</div>
                              <div className="cell-subtext">{r.memberEmail}</div>
                            </td>
                            <td className="cell-mono">{r.issueDate}</td>
                            <td className="cell-mono">{r.dueDate}</td>
                            <td>
                              <span
                                className={`badge ${
                                  r.status === 'ISSUED' ? 'badge-issued' : 'badge-returned'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                            <div className="state-container">
                              <BookOpen size={28} />
                              <h4>No Transactions Logged</h4>
                              <p>Database table ISSUE_RECORDS is currently empty.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BOOKS PAGE */}
          {activeTab === 'books' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by title, author, category, ISBN..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  {searchQuery && (
                    <button
                      className="btn-close"
                      onClick={() => {
                        setSearchQuery('');
                        fetchBooks('');
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button className="btn-primary" onClick={() => setIsBookModalOpen(true)}>
                  <Plus size={16} />
                  <span>Add New Book</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title & Details</th>
                      <th>Author</th>
                      <th>Category</th>
                      <th>Stock / Availability</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.length > 0 ? (
                      books.map((b) => {
                        const ratio = Math.round((b.availableCopies / b.totalCopies) * 100) || 0;
                        return (
                          <tr key={b.bookId}>
                            <td className="cell-mono">#{b.bookId}</td>
                            <td>
                              <div className="cell-primary-text">{b.title}</div>
                              <div className="cell-subtext">ISBN: {b.isbn}</div>
                            </td>
                            <td>{b.author}</td>
                            <td>
                              <span className="badge badge-category">{b.category}</span>
                            </td>
                            <td>
                              <div className="stock-bar-wrap">
                                <span className="cell-mono">
                                  {b.availableCopies} / {b.totalCopies}
                                </span>
                                <div className="stock-bar">
                                  <div
                                    className="stock-fill"
                                    style={{
                                      width: `${ratio}%`,
                                      backgroundColor: ratio > 0 ? '#10b981' : '#ef4444'
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  b.availableCopies > 0 ? 'badge-available' : 'badge-out-of-stock'
                                }`}
                              >
                                {b.availableCopies > 0 ? 'Available' : 'Out of Stock'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                          <div className="state-container">
                            <BookOpen size={30} />
                            <h4>No Books Found</h4>
                            <p>
                              {searchQuery
                                ? 'No titles matched your query.'
                                : 'Catalog is empty. Add a book using the button above or run sample_data.sql in Oracle.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 3: MEMBERS PAGE */}
          {activeTab === 'members' && (
            <>
              <div className="toolbar">
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Cardholder Directory</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Total registered patrons in Oracle MEMBERS table: {members.length}
                  </p>
                </div>

                <button className="btn-primary" onClick={() => setIsMemberModalOpen(true)}>
                  <Plus size={16} />
                  <span>Register Member</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member ID</th>
                      <th>Full Name</th>
                      <th>Contact Info</th>
                      <th>Joined Date</th>
                      <th>Active Loans</th>
                      <th>Account Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length > 0 ? (
                      members.map((m) => (
                        <tr key={m.memberId}>
                          <td className="cell-mono">#{m.memberId}</td>
                          <td>
                            <div className="cell-primary-text">{m.fullName}</div>
                          </td>
                          <td>
                            <div className="cell-primary-text">{m.email}</div>
                            <div className="cell-subtext">{m.phone}</div>
                          </td>
                          <td className="cell-mono">{m.membershipDate}</td>
                          <td>
                            <span
                              className={`badge ${
                                m.activeBorrows > 0 ? 'badge-issued' : 'badge-returned'
                              }`}
                            >
                              {m.activeBorrows} {m.activeBorrows === 1 ? 'Book' : 'Books'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-available">{m.status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                          <div className="state-container">
                            <Users size={30} />
                            <h4>No Registered Members</h4>
                            <p>Register patrons to begin issuing books.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 4: ISSUE & RETURN PAGE */}
          {activeTab === 'issues' && (
            <div className="issue-grid">
              {/* Quick Issue Form Card */}
              <div className="form-card">
                <h3>Issue Book</h3>
                <p>Execute LIBRARY_PKG.ISSUE_BOOK with concurrency locking</p>

                <form onSubmit={handleIssueBook} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label>Select Book Title *</label>
                    <select
                      value={issueForm.bookId}
                      onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose a title from catalog --</option>
                      {books.map((b) => (
                        <option
                          key={b.bookId}
                          value={b.bookId}
                          disabled={b.availableCopies <= 0}
                        >
                          {b.title} ({b.availableCopies} copies available)
                        </option>
                      ))}
                    </select>
                    <span className="select-hint">
                      Books with 0 copies cannot be selected (handled by DB check).
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Select Registered Member *</label>
                    <select
                      value={issueForm.memberId}
                      onChange={(e) => setIssueForm({ ...issueForm, memberId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose member --</option>
                      {members.map((m) => (
                        <option key={m.memberId} value={m.memberId}>
                          {m.fullName} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Loan Duration (Days)</label>
                    <select
                      value={issueForm.daysValid}
                      onChange={(e) => setIssueForm({ ...issueForm, daysValid: e.target.value })}
                    >
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={14}>14 Days (Standard)</option>
                      <option value={21}>21 Days (3 Weeks)</option>
                      <option value={30}>30 Days (1 Month)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={actionLoading}
                    style={{ marginTop: '8px', justifyContent: 'center' }}
                  >
                    <ArrowLeftRight size={16} />
                    <span>{actionLoading ? 'Processing PL/SQL...' : 'Complete Book Issue'}</span>
                  </button>
                </form>
              </div>

              {/* Circulation History Table */}
              <div className="card-panel">
                <div className="panel-header">
                  <div className="panel-title-area">
                    <h3>Circulation History</h3>
                    <p>Live audit trail from Oracle ISSUE_RECORDS</p>
                  </div>

                  <div className="tab-pills">
                    <button
                      className={`tab-pill ${issueFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setIssueFilter('all')}
                    >
                      All ({issues.length})
                    </button>
                    <button
                      className={`tab-pill ${issueFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setIssueFilter('active')}
                    >
                      Active Loans ({issues.filter((i) => i.status === 'ISSUED').length})
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Txn #</th>
                        <th>Book</th>
                        <th>Member</th>
                        <th>Issued / Due</th>
                        <th>Returned</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedIssues.length > 0 ? (
                        displayedIssues.map((iss) => (
                          <tr key={iss.issueId}>
                            <td className="cell-mono">#{iss.issueId}</td>
                            <td>
                              <div className="cell-primary-text">{iss.bookTitle}</div>
                              <div className="cell-subtext">{iss.category}</div>
                            </td>
                            <td>
                              <div className="cell-primary-text">{iss.memberName}</div>
                              <div className="cell-subtext">{iss.memberPhone}</div>
                            </td>
                            <td>
                              <div className="cell-mono">{iss.issueDate}</div>
                              <div className="cell-subtext">Due: {iss.dueDate}</div>
                            </td>
                            <td>
                              <span className="cell-mono">
                                {iss.returnDate ? iss.returnDate : '—'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  iss.status === 'ISSUED' ? 'badge-issued' : 'badge-returned'
                                }`}
                              >
                                {iss.status}
                              </span>
                            </td>
                            <td>
                              {iss.status === 'ISSUED' ? (
                                <button
                                  className="btn-action-return"
                                  onClick={() => handleReturnBook(iss.issueId)}
                                  disabled={actionLoading}
                                  title="Restore inventory and mark returned via PL/SQL"
                                >
                                  <RotateCcw size={13} style={{ display: 'inline', marginRight: '4px' }} />
                                  Return
                                </button>
                              ) : (
                                <span className="cell-subtext">Completed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>
                            <div className="state-container">
                              <ArrowLeftRight size={28} />
                              <h4>No Records to Show</h4>
                              <p>No transactions match the selected filter.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: ADD BOOK */}
      {isBookModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBookModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Catalogue New Book</h3>
              <button className="btn-close" onClick={() => setIsBookModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddBook}>
              <div className="form-group">
                <label>Book Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Database System Concepts"
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Author *</label>
                <input
                  type="text"
                  placeholder="e.g. Abraham Silberschatz"
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ISBN Identifier *</label>
                  <input
                    type="text"
                    placeholder="978-0-07-802215-9"
                    value={newBook.isbn}
                    onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newBook.category}
                    onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Database Systems">Database Systems</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Networks">Networks</option>
                    <option value="Operating Systems">Operating Systems</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Literature">Literature</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Total Copy Inventory *</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={newBook.totalCopies}
                  onChange={(e) =>
                    setNewBook({ ...newBook, totalCopies: parseInt(e.target.value, 10) || 1 })
                  }
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsBookModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving to Oracle...' : 'Save Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER MEMBER */}
      {isMemberModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMemberModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Cardholder</h3>
              <button className="btn-close" onClick={() => setIsMemberModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRegisterMember}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={newMember.fullName}
                  onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. aarav.sharma@mca.edu"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsMemberModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Registering...' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION STACK */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'error' && <XCircle size={18} />}
            {toast.type === 'info' && <AlertTriangle size={18} />}
            <div className="toast-content">
              <h5>{toast.title}</h5>
              <p>{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render root
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
