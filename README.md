# PageTurn — Library Management System

A polished, full-stack MCA mini-project demonstrating Oracle PL/SQL business logic encapsulation, Node.js/Express API integration with `oracledb` Thin Driver, and a React + Vite dashboard.

---

## 1. Project Architecture

```
[React 18 + Recharts Dashboard]
         |
         | HTTP REST (JSON)
         v
[Express API Server (server.js)]
         |
         | oracledb Thin Driver (TCP/IP)
         v
[Oracle Database 19c / 21c / 23ai]
   ├── Tables & Constraints (BOOKS, MEMBERS, ISSUE_RECORDS)
   └── PL/SQL Package: LIBRARY_PKG (FOR UPDATE Locking, Copy Integrity)
```

- **Frontend**: React 18, Vite, Recharts, Lucide Icons, Plain CSS.
- **Backend**: Node.js, Express, `oracledb` (Thin Mode).
- **Database**: Oracle Database (12c / 19c / 21c / 23ai).
- **Core Business Logic**: Oracle PL/SQL Package `LIBRARY_PKG`.

---

## 2. File Structure (11 Files Total)

```
PageTurn-Library-Management/
├── frontend/
│   ├── index.html        # HTML entry point with Plus Jakarta Sans typography
│   ├── src.jsx           # Single-file React app (Dashboard, Books, Members, Issues)
│   ├── style.css         # Midnight-navy/graphite responsive design system
│   └── package.json      # Vite, React, Recharts, and Lucide dependencies
├── backend/
│   ├── server.js         # Express REST API calling Oracle DB & LIBRARY_PKG
│   ├── package.json      # Express, cors, dotenv, and oracledb dependencies
│   └── .env.example      # Environment variables template for DB credentials
├── database/
│   ├── tables.sql        # Schema definition (BOOKS, MEMBERS, ISSUE_RECORDS)
│   ├── library_pkg.sql   # PL/SQL Package spec & body with row-level locking
│   └── sample_data.sql   # Academic seed data & viva demonstration queries
└── README.md             # Complete setup guide and MCA viva explanation
```

---

## 3. Oracle Database Setup

### Step A: Create Dedicated Database User (Run in SQL*Plus or SQL Developer as SYSDBA)

Connect to your Pluggable Database (e.g., `FREEPDB1` or `XEPDB1`):

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Create dedicated project user (Replace YOUR_SECURE_PASSWORD with your choice)
CREATE USER pageturn_app IDENTIFIED BY "YOUR_SECURE_PASSWORD"
  DEFAULT TABLESPACE users
  QUOTA 50M ON users;

-- Grant only minimum required privileges
GRANT CREATE SESSION, CREATE TABLE, CREATE PROCEDURE, CREATE SEQUENCE, CREATE VIEW TO pageturn_app;
```

### Step B: Execute Database Scripts as `pageturn_app`

Connect as `pageturn_app` in Oracle SQL Developer or SQL*Plus and run the files in this strict sequence:

1. **`database/tables.sql`**
   Creates the three tables (`BOOKS`, `MEMBERS`, `ISSUE_RECORDS`) with PK, FK, NOT NULL, UNIQUE, and CHECK constraints.
2. **`database/library_pkg.sql`**
   Compiles `LIBRARY_PKG` specification and body (`ADD_BOOK`, `REGISTER_MEMBER`, `ISSUE_BOOK`, `RETURN_BOOK`, `GET_AVAILABLE_COPIES`, `LIST_ACTIVE_ISSUES`).
3. **`database/sample_data.sql`**
   Seeds 10 academic books, 6 members, and historical/active issue records, followed by academic viva queries.

---

## 4. Backend Setup & Run

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create your `.env` file from `.env.example`:
   ```bash
   copy .env.example .env
   ```
3. Update `.env` with your Oracle connection credentials:
   ```env
   PORT=5000
   DB_USER=pageturn_app
   DB_PASSWORD=YOUR_SECURE_PASSWORD
   DB_CONNECT_STRING=localhost:1521/FREEPDB1
   DB_POOL_MIN=2
   DB_POOL_MAX=10
   DB_POOL_INCREMENT=2
   ```
4. Install dependencies (if not already installed) and launch the server:
   ```bash
   npm install
   npm start
   ```
   The backend server starts on `http://localhost:5000`.

---

## 5. Frontend Setup & Run

1. In a separate terminal, navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
4. To test a production build:
   ```bash
   npm run build
   ```

---

## 6. MCA Viva / Academic Explanation Guide

### Q1: Why is business logic implemented in PL/SQL instead of Express routes?
**Answer**: Centralizing critical business rules (such as inventory copy decrements, member status checks, and return verifications) inside Oracle PL/SQL ensures data integrity across any application layer. Even if multiple services or scripts interact with the database, business rules cannot be bypassed.

### Q2: How does `LIBRARY_PKG.ISSUE_BOOK` handle concurrency and prevent overselling?
**Answer**: When issuing a book, `LIBRARY_PKG` executes:
```sql
SELECT title, available_copies, total_copies
  INTO v_book_title, v_available_copies, v_total_copies
  FROM BOOKS
 WHERE book_id = p_book_id
   FOR UPDATE;
```
The `FOR UPDATE` clause places an exclusive row-level lock on the book record. If two users concurrently attempt to borrow the final copy, the second transaction is queued until the first completes. When the second transaction acquires the lock, it reads `available_copies = 0` and `LIBRARY_PKG` immediately raises `RAISE_APPLICATION_ERROR(-20001, 'No available copies left')`.

### Q3: How is double-returning prevented?
**Answer**: In `LIBRARY_PKG.RETURN_BOOK`, the issue record is selected `FOR UPDATE`. If `status = 'RETURNED'`, the procedure raises `RAISE_APPLICATION_ERROR(-20002)`. Otherwise, `return_date` is set to `SYSDATE`, `status` is updated to `'RETURNED'`, and `available_copies` on `BOOKS` is safely incremented up to `total_copies` using `LEAST(total_copies, available_copies + 1)`.

### Q4: How does Node.js connect to Oracle without installing Oracle Instant Client?
**Answer**: We use `oracledb` 6+ in default **Thin Mode**. Thin mode is implemented in 100% pure JavaScript and communicates directly over TCP/IP using the Oracle Net protocol, eliminating the need to install or configure Oracle Client binary packages.

### Q5: What database constraints are enforced at the schema level?
**Answer**:
- `chk_books_total_copies`: `CHECK (total_copies >= 1)`
- `chk_books_avail_copies`: `CHECK (available_copies >= 0)`
- `chk_books_avail_le_total`: `CHECK (available_copies <= total_copies)`
- `chk_members_status`: `CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE'))`
- `chk_issues_status`: `CHECK (status IN ('ISSUED', 'RETURNED', 'OVERDUE'))`
- `chk_issues_due_date`: `CHECK (due_date >= issue_date)`
- Foreign keys with `ON DELETE CASCADE` linking `ISSUE_RECORDS` to `BOOKS` and `MEMBERS`.
