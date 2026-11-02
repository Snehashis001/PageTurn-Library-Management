-- ============================================================================
-- PageTurn — Library Management System
-- Sample Seed Data & Academic Demonstration Queries
-- Target Database: Oracle Database (12c / 18c / 19c / 21c / 23ai)
-- File: database/sample_data.sql
-- ============================================================================

-- Disable constraints temporarily or delete existing rows for clean idempotent re-run
DELETE FROM ISSUE_RECORDS;
DELETE FROM MEMBERS;
DELETE FROM BOOKS;

-- Reset identity sequence counters if supported, or rely on identity auto-generation
-- (Identity columns automatically pick up next sequence values)

-- ============================================================================
-- 1. SEED CATALOG BOOKS (10 Curated Academic & Engineering Titles)
-- ============================================================================
INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Database System Concepts (7th Ed)', 'Abraham Silberschatz', '978-0-07-802215-9', 'Computer Science', 6, 4, SYSDATE - 120);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Clean Architecture: A Craftsman''s Guide', 'Robert C. Martin', '978-0-13-449416-6', 'Software Engineering', 5, 3, SYSDATE - 100);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Artificial Intelligence: A Modern Approach', 'Stuart Russell & Peter Norvig', '978-0-13-461099-3', 'Artificial Intelligence', 4, 2, SYSDATE - 90);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Introduction to Algorithms (CLRS 4th Ed)', 'Thomas H. Cormen', '978-0-262-04630-5', 'Computer Science', 8, 7, SYSDATE - 85);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Designing Data-Intensive Applications', 'Martin Kleppmann', '978-1-449-37332-0', 'Database Systems', 5, 3, SYSDATE - 75);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Deep Learning', 'Ian Goodfellow, Yoshua Bengio', '978-0-262-03561-3', 'Artificial Intelligence', 4, 3, SYSDATE - 60);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Computer Networks (6th Ed)', 'Andrew S. Tanenbaum', '978-0-13-466547-4', 'Networks', 4, 4, SYSDATE - 50);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Operating Systems: Three Easy Pieces', 'Remzi H. Arpaci-Dusseau', '978-1-982-86291-8', 'Operating Systems', 5, 5, SYSDATE - 40);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('Discrete Mathematics and Applications', 'Kenneth H. Rosen', '978-1-259-67651-2', 'Mathematics', 4, 4, SYSDATE - 30);

INSERT INTO BOOKS (title, author, isbn, category, total_copies, available_copies, created_at)
VALUES ('The Pragmatic Programmer (20th Anniv)', 'David Thomas & Andrew Hunt', '978-0-13-595705-9', 'Software Engineering', 3, 2, SYSDATE - 20);

-- ============================================================================
-- 2. SEED LIBRARY MEMBERS (6 Registered Cardholders)
-- ============================================================================
INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Aarav Sharma', 'aarav.sharma@mca.edu', '+91 98765 43210', SYSDATE - 90, 'ACTIVE');

INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Priya Patel', 'priya.patel@mca.edu', '+91 98765 43211', SYSDATE - 80, 'ACTIVE');

INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Rohan Verma', 'rohan.verma@mca.edu', '+91 98765 43212', SYSDATE - 60, 'ACTIVE');

INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Ananya Iyer', 'ananya.iyer@mca.edu', '+91 98765 43213', SYSDATE - 45, 'ACTIVE');

INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Vikram Deshmukh', 'vikram.d@mca.edu', '+91 98765 43214', SYSDATE - 30, 'ACTIVE');

INSERT INTO MEMBERS (full_name, email, phone, membership_date, status)
VALUES ('Neha Gupta', 'neha.gupta@mca.edu', '+91 98765 43215', SYSDATE - 15, 'ACTIVE');

-- ============================================================================
-- 3. SEED CIRCULATION ISSUE RECORDS (Historical & Active Issues)
-- Note: Subqueries match by ISBN & Email so records match regardless of generated IDs.
-- ============================================================================

-- Active Issue 1: Aarav has Database System Concepts
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-07-802215-9'),
    (SELECT member_id FROM MEMBERS WHERE email = 'aarav.sharma@mca.edu'),
    SYSDATE - 8,
    SYSDATE + 6,
    NULL,
    'ISSUED'
);

-- Active Issue 2: Priya has Clean Architecture
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-13-449416-6'),
    (SELECT member_id FROM MEMBERS WHERE email = 'priya.patel@mca.edu'),
    SYSDATE - 5,
    SYSDATE + 9,
    NULL,
    'ISSUED'
);

-- Active Issue 3: Rohan has Artificial Intelligence
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-13-461099-3'),
    (SELECT member_id FROM MEMBERS WHERE email = 'rohan.verma@mca.edu'),
    SYSDATE - 12,
    SYSDATE + 2,
    NULL,
    'ISSUED'
);

-- Active Issue 4: Ananya has Designing Data-Intensive Applications
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-1-449-37332-0'),
    (SELECT member_id FROM MEMBERS WHERE email = 'ananya.iyer@mca.edu'),
    SYSDATE - 3,
    SYSDATE + 11,
    NULL,
    'ISSUED'
);

-- Active Issue 5: Vikram has The Pragmatic Programmer
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-13-595705-9'),
    (SELECT member_id FROM MEMBERS WHERE email = 'vikram.d@mca.edu'),
    SYSDATE - 2,
    SYSDATE + 12,
    NULL,
    'ISSUED'
);

-- Active Issue 6: Neha has Deep Learning
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-262-03561-3'),
    (SELECT member_id FROM MEMBERS WHERE email = 'neha.gupta@mca.edu'),
    SYSDATE - 1,
    SYSDATE + 13,
    NULL,
    'ISSUED'
);

-- Active Issue 7: Priya also has Introduction to Algorithms
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-262-04630-5'),
    (SELECT member_id FROM MEMBERS WHERE email = 'priya.patel@mca.edu'),
    SYSDATE - 4,
    SYSDATE + 10,
    NULL,
    'ISSUED'
);

-- Returned Issue 1: Aarav borrowed and returned Clean Architecture in past month
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-13-449416-6'),
    (SELECT member_id FROM MEMBERS WHERE email = 'aarav.sharma@mca.edu'),
    SYSDATE - 45,
    SYSDATE - 31,
    SYSDATE - 33,
    'RETURNED'
);

-- Returned Issue 2: Priya borrowed and returned Database System Concepts
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-07-802215-9'),
    (SELECT member_id FROM MEMBERS WHERE email = 'priya.patel@mca.edu'),
    SYSDATE - 40,
    SYSDATE - 26,
    SYSDATE - 28,
    'RETURNED'
);

-- Returned Issue 3: Rohan borrowed and returned Designing Data-Intensive Applications
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-1-449-37332-0'),
    (SELECT member_id FROM MEMBERS WHERE email = 'rohan.verma@mca.edu'),
    SYSDATE - 35,
    SYSDATE - 21,
    SYSDATE - 20,
    'RETURNED'
);

-- Returned Issue 4: Ananya borrowed and returned Computer Networks
INSERT INTO ISSUE_RECORDS (book_id, member_id, issue_date, due_date, return_date, status)
VALUES (
    (SELECT book_id FROM BOOKS WHERE isbn = '978-0-13-466547-4'),
    (SELECT member_id FROM MEMBERS WHERE email = 'ananya.iyer@mca.edu'),
    SYSDATE - 25,
    SYSDATE - 11,
    SYSDATE - 13,
    'RETURNED'
);

COMMIT;

-- ============================================================================
-- ACADEMIC DEMONSTRATION QUERIES (FOR VIVA / PRACTICAL EVALUATION)
-- ============================================================================

-- DEMO QUERY 1: Multi-Table INNER JOIN (Circulation Audit)
-- Combines BOOKS, MEMBERS, and ISSUE_RECORDS with date formatting
SELECT 
    i.issue_id,
    b.title                      AS book_title,
    b.isbn,
    b.category,
    m.full_name                  AS borrower_name,
    m.email                      AS borrower_email,
    TO_CHAR(i.issue_date, 'DD-Mon-YYYY') AS issued_on,
    TO_CHAR(i.due_date,   'DD-Mon-YYYY') AS due_on,
    NVL(TO_CHAR(i.return_date, 'DD-Mon-YYYY'), 'NOT RETURNED') AS returned_on,
    i.status
FROM ISSUE_RECORDS i
INNER JOIN BOOKS b   ON i.book_id   = b.book_id
INNER JOIN MEMBERS m ON i.member_id = m.member_id
ORDER BY i.issue_id DESC;

-- DEMO QUERY 2: GROUP BY with COUNT and SUM (Inventory Health & Borrow Ratios)
-- Demonstrates aggregate calculations, alias handling, and percentage formulas
SELECT 
    category,
    COUNT(book_id)                        AS total_titles,
    SUM(total_copies)                     AS total_stock,
    SUM(available_copies)                 AS available_stock,
    SUM(total_copies - available_copies)  AS currently_borrowed,
    ROUND((SUM(total_copies - available_copies) / NULLIF(SUM(total_copies), 0)) * 100, 1) AS utilization_pct
FROM BOOKS
GROUP BY category
ORDER BY utilization_pct DESC;

-- DEMO QUERY 3: Patron Circulation Activity (HAVING Clause)
-- Shows members who have borrowed books, ordered by total borrow transactions
SELECT 
    m.member_id,
    m.full_name,
    m.email,
    COUNT(i.issue_id)                                           AS lifetime_borrows,
    SUM(CASE WHEN i.status = 'ISSUED' THEN 1 ELSE 0 END)        AS active_loans,
    SUM(CASE WHEN i.status = 'RETURNED' THEN 1 ELSE 0 END)      AS completed_returns
FROM MEMBERS m
LEFT JOIN ISSUE_RECORDS i ON m.member_id = i.member_id
GROUP BY m.member_id, m.full_name, m.email
HAVING COUNT(i.issue_id) > 0
ORDER BY lifetime_borrows DESC;

-- DEMO QUERY 4: Calling LIBRARY_PKG.GET_AVAILABLE_COPIES function from SQL
SELECT 
    b.book_id,
    b.title,
    b.total_copies,
    LIBRARY_PKG.GET_AVAILABLE_COPIES(b.book_id) AS pkg_available_copies
FROM BOOKS b
WHERE ROWNUM <= 5;
