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
