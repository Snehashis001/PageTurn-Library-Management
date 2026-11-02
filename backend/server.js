/**
 * PageTurn — Library Management System
 * Express REST API with Oracle Database & PL/SQL Package Integration
 * File: backend/server.js
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config();

// Configure oracledb defaults
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false; // Explicit transaction management

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'pageturn_app',
  password: process.env.DB_PASSWORD || '',
  connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1',
  poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  poolIncrement: parseInt(process.env.DB_POOL_INCREMENT || '2', 10)
};

let dbPool = null;
let lastDbError = null;
let poolInitPromise = null;
let lastPoolAttemptTime = 0;
const POOL_RETRY_COOLDOWN_MS = 30000; // 30-second cooldown after a failed attempt to prevent account lockout

/**
 * Initialize Oracle Connection Pool with cooldown and single-flight lock
 */
async function initDbPool() {
  const now = Date.now();
  // If an attempt failed recently, enforce cooldown to protect against account lockout
  if (lastDbError && (now - lastPoolAttemptTime < POOL_RETRY_COOLDOWN_MS)) {
    return null;
  }
  lastPoolAttemptTime = now;

  try {
    dbPool = await oracledb.createPool(dbConfig);
    lastDbError = null;
    console.log(`[Oracle DB] Connection pool created successfully for ${dbConfig.connectString}`);
    return dbPool;
  } catch (err) {
    lastDbError = err.message;
    console.warn(`[Oracle DB Warning] Could not establish connection pool: ${err.message}`);
    console.warn(`[Oracle DB Warning] Check backend/.env credentials and ensure Oracle service is running.`);
    return null;
  }
}

/**
 * Helper: Obtain an Oracle connection from pool
 * Prevents concurrent connection storms and avoids redundant fallback attempts.
 */
async function getConnection() {
  if (!dbPool) {
    if (!poolInitPromise) {
      poolInitPromise = initDbPool().finally(() => {
        poolInitPromise = null;
      });
    }
    await poolInitPromise;
  }

  if (dbPool) {
    return await dbPool.getConnection();
  }

  // Do not attempt fallback single connection if pool creation failed; throw cached error directly
  throw new Error(lastDbError || 'Database connection pool is not available.');
}

/**
 * Helper: Extract clean human-readable message from Oracle error (ORA-20001, ORA-00001, etc.)
 */
function parseOracleError(err) {
  const msg = err.message || 'Database error occurred';
  // Check for ORA-20xxx application errors from LIBRARY_PKG
  const matchAppErr = msg.match(/ORA-20\d{3}:\s*([^\n\r]+)/);
  if (matchAppErr) {
    return matchAppErr[1];
  }
  // Check for unique constraint violation
  if (msg.includes('ORA-00001')) {
    return 'A record with this unique identifier (ISBN or Email) already exists.';
  }
  // Check for check constraint violation
  if (msg.includes('ORA-02290')) {
    return 'Value violates a database check constraint.';
  }
  return msg;
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * 1. Health & Database Connectivity Check
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(`SELECT 1 AS alive, SYSDATE AS server_time FROM DUAL`);
    res.json({
      status: 'UP',
      database: 'CONNECTED',
      serverTime: result.rows[0].SERVER_TIME,
      connectString: dbConfig.connectString,
      user: dbConfig.user
    });
  } catch (err) {
    res.status(200).json({
      status: 'DEGRADED',
      database: 'DISCONNECTED',
      message: err.message,
      connectString: dbConfig.connectString,
      tip: 'Verify Oracle Listener is running and backend/.env credentials match.'
    });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 2. Dashboard Metrics, Charts & Recent Activity
 * GET /api/dashboard
 */
app.get('/api/dashboard', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    // 2a. KPI Summary Query
    const kpiSql = `
      SELECT 
        (SELECT COUNT(*) FROM BOOKS) AS TOTAL_TITLES,
        (SELECT NVL(SUM(total_copies), 0) FROM BOOKS) AS TOTAL_COPIES,
        (SELECT NVL(SUM(available_copies), 0) FROM BOOKS) AS AVAILABLE_COPIES,
        (SELECT COUNT(*) FROM MEMBERS WHERE status = 'ACTIVE') AS REGISTERED_MEMBERS,
        (SELECT COUNT(*) FROM ISSUE_RECORDS WHERE status = 'ISSUED') AS CURRENTLY_ISSUED
      FROM DUAL
    `;
    const kpiResult = await connection.execute(kpiSql);
    const kpi = kpiResult.rows[0] || {};

    // 2b. Monthly Issues vs Returns Trend for Recharts (Last 6 Months)
    const chartSql = `
      SELECT 
        TO_CHAR(issue_date, 'Mon YYYY') AS MONTH_LABEL,
        TO_CHAR(issue_date, 'YYYY-MM')  AS MONTH_KEY,
        COUNT(*) AS ISSUED_COUNT,
        SUM(CASE WHEN return_date IS NOT NULL THEN 1 ELSE 0 END) AS RETURNED_COUNT
      FROM ISSUE_RECORDS
      WHERE issue_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5)
      GROUP BY TO_CHAR(issue_date, 'Mon YYYY'), TO_CHAR(issue_date, 'YYYY-MM')
      ORDER BY MONTH_KEY ASC
    `;
    const chartResult = await connection.execute(chartSql);

    // 2c. Recent Activity Table (Last 6 circulation events)
    const recentSql = `
      SELECT 
        i.issue_id,
        b.title AS BOOK_TITLE,
        b.isbn,
        m.full_name AS MEMBER_NAME,
        m.email AS MEMBER_EMAIL,
        TO_CHAR(i.issue_date, 'YYYY-MM-DD') AS ISSUE_DATE,
        TO_CHAR(i.due_date, 'YYYY-MM-DD') AS DUE_DATE,
        TO_CHAR(i.return_date, 'YYYY-MM-DD') AS RETURN_DATE,
        i.status
      FROM ISSUE_RECORDS i
      JOIN BOOKS b ON i.book_id = b.book_id
      JOIN MEMBERS m ON i.member_id = m.member_id
      ORDER BY i.issue_id DESC
      FETCH FIRST 6 ROWS ONLY
    `;
    const recentResult = await connection.execute(recentSql);

    res.json({
      success: true,
      metrics: {
        totalTitles: Number(kpi.TOTAL_TITLES || 0),
        totalCopies: Number(kpi.TOTAL_COPIES || 0),
        availableCopies: Number(kpi.AVAILABLE_COPIES || 0),
        registeredMembers: Number(kpi.REGISTERED_MEMBERS || 0),
        currentlyIssued: Number(kpi.CURRENTLY_ISSUED || 0)
      },
      monthlyChart: chartResult.rows.map(r => ({
        month: r.MONTH_LABEL,
        issued: Number(r.ISSUED_COUNT || 0),
        returned: Number(r.RETURNED_COUNT || 0)
      })),
      recentActivity: recentResult.rows.map(r => ({
        issueId: r.ISSUE_ID,
        bookTitle: r.BOOK_TITLE,
        isbn: r.ISBN,
        memberName: r.MEMBER_NAME,
        memberEmail: r.MEMBER_EMAIL,
        issueDate: r.ISSUE_DATE,
        dueDate: r.DUE_DATE,
        returnDate: r.RETURN_DATE,
        status: r.STATUS
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 3. Books - List and Search
 * GET /api/books?q=...
 */
app.get('/api/books', async (req, res) => {
  let connection;
  try {
    const searchQuery = (req.query.q || '').trim();
    connection = await getConnection();

    let sql = `
      SELECT 
        book_id,
        title,
        author,
        isbn,
        category,
        total_copies,
        available_copies,
        TO_CHAR(created_at, 'YYYY-MM-DD') AS CREATED_AT,
        CASE WHEN available_copies > 0 THEN 'AVAILABLE' ELSE 'OUT_OF_STOCK' END AS AVAILABILITY_STATUS
      FROM BOOKS
    `;

    const binds = {};
    if (searchQuery) {
      sql += `
        WHERE LOWER(title) LIKE '%' || LOWER(:q) || '%'
           OR LOWER(author) LIKE '%' || LOWER(:q) || '%'
           OR LOWER(isbn) LIKE '%' || LOWER(:q) || '%'
           OR LOWER(category) LIKE '%' || LOWER(:q) || '%'
      `;
      binds.q = searchQuery;
    }

    sql += ` ORDER BY book_id DESC`;

    const result = await connection.execute(sql, binds);
    const books = result.rows.map(r => ({
      bookId: r.BOOK_ID,
      title: r.TITLE,
      author: r.AUTHOR,
      isbn: r.ISBN,
      category: r.CATEGORY,
      totalCopies: Number(r.TOTAL_COPIES),
      availableCopies: Number(r.AVAILABLE_COPIES),
      createdAt: r.CREATED_AT,
      status: r.AVAILABILITY_STATUS
    }));

    res.json({ success: true, count: books.length, books });
  } catch (err) {
    res.status(500).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 4. Books - Add New Book via PL/SQL Package
 * POST /api/books
 */
app.post('/api/books', async (req, res) => {
  let connection;
  try {
    const { title, author, isbn, category, totalCopies } = req.body;

    if (!title || !author || !isbn || !category || !totalCopies) {
      return res.status(400).json({
        success: false,
        error: 'Title, Author, ISBN, Category, and Total Copies are required.'
      });
    }

    const copies = parseInt(totalCopies, 10);
    if (isNaN(copies) || copies < 1) {
      return res.status(400).json({
        success: false,
        error: 'Total copies must be a positive integer.'
      });
    }

    connection = await getConnection();

    // Call PL/SQL Package LIBRARY_PKG.ADD_BOOK
    const plsql = `
      BEGIN
        LIBRARY_PKG.ADD_BOOK(
          p_title        => :p_title,
          p_author       => :p_author,
          p_isbn         => :p_isbn,
          p_category     => :p_category,
          p_total_copies => :p_total_copies,
          o_book_id      => :o_book_id
        );
      END;
    `;

    const binds = {
      p_title: title.trim(),
      p_author: author.trim(),
      p_isbn: isbn.trim(),
      p_category: category.trim(),
      p_total_copies: copies,
      o_book_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };

    const result = await connection.execute(plsql, binds);
    await connection.commit();

    const newBookId = result.outBinds.o_book_id;
    res.status(201).json({
      success: true,
      bookId: newBookId,
      message: `"${title}" was catalogued successfully in Oracle Database.`
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error(e); }
    }
    res.status(400).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 5. Members - List All Members
 * GET /api/members
 */
app.get('/api/members', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT 
        m.member_id,
        m.full_name,
        m.email,
        m.phone,
        TO_CHAR(m.membership_date, 'YYYY-MM-DD') AS MEMBERSHIP_DATE,
        m.status,
        (SELECT COUNT(*) FROM ISSUE_RECORDS WHERE member_id = m.member_id AND status = 'ISSUED') AS ACTIVE_BORROWS
      FROM MEMBERS m
      ORDER BY m.member_id DESC
    `;

    const result = await connection.execute(sql);
    const members = result.rows.map(r => ({
      memberId: r.MEMBER_ID,
      fullName: r.FULL_NAME,
      email: r.EMAIL,
      phone: r.PHONE,
      membershipDate: r.MEMBERSHIP_DATE,
      status: r.STATUS,
      activeBorrows: Number(r.ACTIVE_BORROWS || 0)
    }));

    res.json({ success: true, count: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 6. Members - Register Member via PL/SQL Package
 * POST /api/members
 */
app.post('/api/members', async (req, res) => {
  let connection;
  try {
    const { fullName, email, phone } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Full Name, Email, and Phone are required.'
      });
    }

    connection = await getConnection();

    // Call PL/SQL Package LIBRARY_PKG.REGISTER_MEMBER
    const plsql = `
      BEGIN
        LIBRARY_PKG.REGISTER_MEMBER(
          p_full_name => :p_full_name,
          p_email     => :p_email,
          p_phone     => :p_phone,
          o_member_id => :o_member_id
        );
      END;
    `;

    const binds = {
      p_full_name: fullName.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      o_member_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };

    const result = await connection.execute(plsql, binds);
    await connection.commit();

    const newMemberId = result.outBinds.o_member_id;
    res.status(201).json({
      success: true,
      memberId: newMemberId,
      message: `Member "${fullName}" registered successfully.`
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error(e); }
    }
    res.status(400).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 7. Issues - Circulation History List
 * GET /api/issues
 */
app.get('/api/issues', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT 
        i.issue_id,
        i.book_id,
        b.title AS BOOK_TITLE,
        b.isbn,
        b.category,
        i.member_id,
        m.full_name AS MEMBER_NAME,
        m.email AS MEMBER_EMAIL,
        m.phone AS MEMBER_PHONE,
        TO_CHAR(i.issue_date, 'YYYY-MM-DD') AS ISSUE_DATE,
        TO_CHAR(i.due_date, 'YYYY-MM-DD') AS DUE_DATE,
        TO_CHAR(i.return_date, 'YYYY-MM-DD') AS RETURN_DATE,
        i.status
      FROM ISSUE_RECORDS i
      JOIN BOOKS b ON i.book_id = b.book_id
      JOIN MEMBERS m ON i.member_id = m.member_id
      ORDER BY i.issue_id DESC
    `;

    const result = await connection.execute(sql);
    const issues = result.rows.map(r => ({
      issueId: r.ISSUE_ID,
      bookId: r.BOOK_ID,
      bookTitle: r.BOOK_TITLE,
      isbn: r.ISBN,
      category: r.CATEGORY,
      memberId: r.MEMBER_ID,
      memberName: r.MEMBER_NAME,
      memberEmail: r.MEMBER_EMAIL,
      memberPhone: r.MEMBER_PHONE,
      issueDate: r.ISSUE_DATE,
      dueDate: r.DUE_DATE,
      returnDate: r.RETURN_DATE,
      status: r.STATUS
    }));

    res.json({ success: true, count: issues.length, issues });
  } catch (err) {
    res.status(500).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 8. Issues - Issue Book via PL/SQL Package
 * POST /api/issues/issue
 */
app.post('/api/issues/issue', async (req, res) => {
  let connection;
  try {
    const { bookId, memberId, daysValid } = req.body;

    if (!bookId || !memberId) {
      return res.status(400).json({
        success: false,
        error: 'Please select both a valid Book and Member.'
      });
    }

    const bId = parseInt(bookId, 10);
    const mId = parseInt(memberId, 10);
    const days = parseInt(daysValid || 14, 10);

    connection = await getConnection();

    // Call PL/SQL Package LIBRARY_PKG.ISSUE_BOOK
    const plsql = `
      BEGIN
        LIBRARY_PKG.ISSUE_BOOK(
          p_book_id    => :p_book_id,
          p_member_id  => :p_member_id,
          p_days_valid => :p_days_valid,
          o_issue_id   => :o_issue_id
        );
      END;
    `;

    const binds = {
      p_book_id: bId,
      p_member_id: mId,
      p_days_valid: days,
      o_issue_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };

    const result = await connection.execute(plsql, binds);
    await connection.commit();

    const newIssueId = result.outBinds.o_issue_id;
    res.status(201).json({
      success: true,
      issueId: newIssueId,
      message: `Book issued successfully (Transaction #${newIssueId}). Due in ${days} days.`
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error(e); }
    }
    res.status(400).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

/**
 * 9. Issues - Return Book via PL/SQL Package
 * POST /api/issues/return
 */
app.post('/api/issues/return', async (req, res) => {
  let connection;
  try {
    const { issueId } = req.body;

    if (!issueId) {
      return res.status(400).json({
        success: false,
        error: 'Issue Record ID is required to process return.'
      });
    }

    const issId = parseInt(issueId, 10);

    connection = await getConnection();

    // Call PL/SQL Package LIBRARY_PKG.RETURN_BOOK
    const plsql = `
      BEGIN
        LIBRARY_PKG.RETURN_BOOK(p_issue_id => :p_issue_id);
      END;
    `;

    const binds = {
      p_issue_id: issId
    };

    await connection.execute(plsql, binds);
    await connection.commit();

    res.json({
      success: true,
      issueId: issId,
      message: `Issue record #${issId} marked RETURNED. Stock count restored.`
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error(e); }
    }
    res.status(400).json({ success: false, error: parseOracleError(err) });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`PageTurn Backend Server running on http://localhost:${PORT}`);
  console.log(`Targeting Oracle Database at: ${dbConfig.connectString}`);
  console.log(`====================================================`);
  // Attempt initial pool warmup
  await initDbPool();
});
