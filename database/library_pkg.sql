-- ============================================================================
-- PageTurn — Library Management System
-- PL/SQL Package: LIBRARY_PKG (Specification & Body)
-- Purpose: Encapsulates all library circulation business logic, concurrency
--          protection (FOR UPDATE row locking), and transaction safety.
-- Target Database: Oracle Database (12c / 18c / 19c / 21c / 23ai)
-- File: database/library_pkg.sql
-- ============================================================================

CREATE OR REPLACE PACKAGE LIBRARY_PKG AS
    -- Custom Application Error Number Offsets
    c_err_no_copies      CONSTANT NUMBER := -20001;
    c_err_already_ret    CONSTANT NUMBER := -20002;
    c_err_book_not_found CONSTANT NUMBER := -20003;
    c_err_member_invalid CONSTANT NUMBER := -20004;
    c_err_active_borrow  CONSTANT NUMBER := -20005;
    c_err_invalid_param  CONSTANT NUMBER := -20006;
    c_err_issue_not_fnd  CONSTANT NUMBER := -20007;

    -- Procedure: Add a new book title to inventory
    PROCEDURE ADD_BOOK (
        p_title         IN  VARCHAR2,
        p_author        IN  VARCHAR2,
        p_isbn          IN  VARCHAR2,
        p_category      IN  VARCHAR2,
        p_total_copies  IN  NUMBER,
        o_book_id       OUT NUMBER
    );

    -- Procedure: Register a new library member
    PROCEDURE REGISTER_MEMBER (
        p_full_name     IN  VARCHAR2,
        p_email         IN  VARCHAR2,
        p_phone         IN  VARCHAR2,
        o_member_id     OUT NUMBER
    );

    -- Procedure: Issue a book to a member with concurrency locking
    PROCEDURE ISSUE_BOOK (
        p_book_id       IN  NUMBER,
        p_member_id     IN  NUMBER,
        p_days_valid    IN  NUMBER DEFAULT 14,
        o_issue_id      OUT NUMBER
    );

    -- Procedure: Return an issued book and restore stock count
    PROCEDURE RETURN_BOOK (
        p_issue_id      IN  NUMBER
    );

    -- Function: Query available copies for a book
    FUNCTION GET_AVAILABLE_COPIES (
        p_book_id       IN  NUMBER
    ) RETURN NUMBER;

    -- Procedure: Retrieve active issues using an explicit cursor
    PROCEDURE LIST_ACTIVE_ISSUES (
        o_cursor        OUT SYS_REFCURSOR
    );

END LIBRARY_PKG;
/

CREATE OR REPLACE PACKAGE BODY LIBRARY_PKG AS

    -- ========================================================================
    -- 1. ADD_BOOK
    -- Adds a new book title. Initial available_copies = total_copies.
    -- ========================================================================
    PROCEDURE ADD_BOOK (
        p_title         IN  VARCHAR2,
        p_author        IN  VARCHAR2,
        p_isbn          IN  VARCHAR2,
        p_category      IN  VARCHAR2,
        p_total_copies  IN  NUMBER,
        o_book_id       OUT NUMBER
    ) IS
    BEGIN
        -- Input validation
        IF TRIM(p_title) IS NULL OR TRIM(p_author) IS NULL OR TRIM(p_isbn) IS NULL THEN
            RAISE_APPLICATION_ERROR(c_err_invalid_param, 'Title, Author, and ISBN cannot be blank.');
        END IF;

        IF p_total_copies IS NULL OR p_total_copies < 1 THEN
            RAISE_APPLICATION_ERROR(c_err_invalid_param, 'Total copies must be at least 1.');
        END IF;

        INSERT INTO BOOKS (
            title,
            author,
            isbn,
            category,
            total_copies,
            available_copies,
            created_at
        ) VALUES (
            TRIM(p_title),
            TRIM(p_author),
            UPPER(TRIM(p_isbn)),
            TRIM(p_category),
            p_total_copies,
            p_total_copies,
            SYSDATE
        ) RETURNING book_id INTO o_book_id;

    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            RAISE_APPLICATION_ERROR(c_err_invalid_param, 'A book with ISBN ' || UPPER(TRIM(p_isbn)) || ' already exists in catalog.');
        WHEN OTHERS THEN
            RAISE;
    END ADD_BOOK;

    -- ========================================================================
    -- 2. REGISTER_MEMBER
    -- Registers a new cardholder with status ACTIVE.
    -- ========================================================================
    PROCEDURE REGISTER_MEMBER (
        p_full_name     IN  VARCHAR2,
        p_email         IN  VARCHAR2,
        p_phone         IN  VARCHAR2,
        o_member_id     OUT NUMBER
    ) IS
    BEGIN
        IF TRIM(p_full_name) IS NULL OR TRIM(p_email) IS NULL OR TRIM(p_phone) IS NULL THEN
            RAISE_APPLICATION_ERROR(c_err_invalid_param, 'Full name, email, and phone number are required.');
        END IF;

        INSERT INTO MEMBERS (
            full_name,
            email,
            phone,
            membership_date,
            status
        ) VALUES (
            TRIM(p_full_name),
            LOWER(TRIM(p_email)),
            TRIM(p_phone),
            SYSDATE,
            'ACTIVE'
        ) RETURNING member_id INTO o_member_id;

    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            RAISE_APPLICATION_ERROR(c_err_invalid_param, 'Member email ' || LOWER(TRIM(p_email)) || ' is already registered.');
        WHEN OTHERS THEN
            RAISE;
    END REGISTER_MEMBER;

    -- ========================================================================
    -- 3. ISSUE_BOOK
    -- Issues a book to a member. Employs SELECT ... FOR UPDATE to lock the book
    -- row and prevent race conditions / negative stock counts.
    -- ========================================================================
    PROCEDURE ISSUE_BOOK (
        p_book_id       IN  NUMBER,
        p_member_id     IN  NUMBER,
        p_days_valid    IN  NUMBER DEFAULT 14,
        o_issue_id      OUT NUMBER
    ) IS
        v_available_copies BOOKS.available_copies%TYPE;
        v_total_copies     BOOKS.total_copies%TYPE;
        v_book_title       BOOKS.title%TYPE;
        v_member_status    MEMBERS.status%TYPE;
        v_active_borrow    NUMBER := 0;
        v_loan_days        NUMBER := NVL(p_days_valid, 14);
    BEGIN
        IF v_loan_days < 1 OR v_loan_days > 90 THEN
            v_loan_days := 14;
        END IF;

        -- Step A: Validate Member Existence and Status
        BEGIN
            SELECT status
              INTO v_member_status
              FROM MEMBERS
             WHERE member_id = p_member_id;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(c_err_member_invalid, 'Member ID ' || p_member_id || ' does not exist.');
        END;

        IF v_member_status != 'ACTIVE' THEN
            RAISE_APPLICATION_ERROR(c_err_member_invalid, 'Member account is currently ' || v_member_status || '. Issues not permitted.');
        END IF;

        -- Step B: Acquire pessimistic lock on book row (FOR UPDATE)
        BEGIN
            SELECT title, available_copies, total_copies
              INTO v_book_title, v_available_copies, v_total_copies
              FROM BOOKS
             WHERE book_id = p_book_id
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(c_err_book_not_found, 'Book ID ' || p_book_id || ' does not exist.');
        END;

        -- Step C: Check stock availability
        IF v_available_copies <= 0 THEN
            RAISE_APPLICATION_ERROR(c_err_no_copies, 'No available copies left for "' || v_book_title || '".');
        END IF;

        -- Step D: Check if member already has an unreturned copy of this book
        SELECT COUNT(*)
          INTO v_active_borrow
          FROM ISSUE_RECORDS
         WHERE member_id = p_member_id
           AND book_id = p_book_id
           AND status = 'ISSUED';

        IF v_active_borrow > 0 THEN
            RAISE_APPLICATION_ERROR(c_err_active_borrow, 'Member already holds an unreturned copy of "' || v_book_title || '".');
        END IF;

        -- Step E: Decrement available stock
        UPDATE BOOKS
           SET available_copies = available_copies - 1
         WHERE book_id = p_book_id;

        -- Step F: Insert circulation issue record
        INSERT INTO ISSUE_RECORDS (
            book_id,
            member_id,
            issue_date,
            due_date,
            return_date,
            status
        ) VALUES (
            p_book_id,
            p_member_id,
            SYSDATE,
            SYSDATE + v_loan_days,
            NULL,
            'ISSUED'
        ) RETURNING issue_id INTO o_issue_id;

    END ISSUE_BOOK;

    -- ========================================================================
    -- 4. RETURN_BOOK
    -- Processes book return, verifies active status, locks row, restores stock.
    -- ========================================================================
    PROCEDURE RETURN_BOOK (
        p_issue_id      IN  NUMBER
    ) IS
        v_book_id      ISSUE_RECORDS.book_id%TYPE;
        v_status       ISSUE_RECORDS.status%TYPE;
        v_total_copies BOOKS.total_copies%TYPE;
        v_avail_copies BOOKS.available_copies%TYPE;
    BEGIN
        -- Step A: Lock and verify the issue record
        BEGIN
            SELECT book_id, status
              INTO v_book_id, v_status
              FROM ISSUE_RECORDS
             WHERE issue_id = p_issue_id
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(c_err_issue_not_fnd, 'Issue record #' || p_issue_id || ' not found.');
        END;

        -- Step B: Guard against double returns
        IF v_status = 'RETURNED' THEN
            RAISE_APPLICATION_ERROR(c_err_already_ret, 'Issue record #' || p_issue_id || ' has already been returned.');
        END IF;

        -- Step C: Lock target book row for inventory restoration
        BEGIN
            SELECT total_copies, available_copies
              INTO v_total_copies, v_avail_copies
              FROM BOOKS
             WHERE book_id = v_book_id
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(c_err_book_not_found, 'Associated book ID ' || v_book_id || ' not found.');
        END;

        -- Step D: Mark issue record as RETURNED with timestamp
        UPDATE ISSUE_RECORDS
           SET return_date = SYSDATE,
               status      = 'RETURNED'
         WHERE issue_id = p_issue_id;

        -- Step E: Increment available copies (bounded by total_copies)
        UPDATE BOOKS
           SET available_copies = LEAST(total_copies, available_copies + 1)
         WHERE book_id = v_book_id;

    END RETURN_BOOK;

    -- ========================================================================
    -- 5. GET_AVAILABLE_COPIES
    -- Returns current on-shelf copies for a given book ID.
    -- ========================================================================
    FUNCTION GET_AVAILABLE_COPIES (
        p_book_id       IN  NUMBER
    ) RETURN NUMBER IS
        v_avail NUMBER;
    BEGIN
        SELECT available_copies
          INTO v_avail
          FROM BOOKS
         WHERE book_id = p_book_id;
        RETURN v_avail;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(c_err_book_not_found, 'Book ID ' || p_book_id || ' does not exist.');
    END GET_AVAILABLE_COPIES;

    -- ========================================================================
    -- 6. LIST_ACTIVE_ISSUES
    -- Uses explicit cursor query returning a SYS_REFCURSOR for callers.
    -- Demonstrates multi-table JOIN and explicit query encapsulation.
    -- ========================================================================
    PROCEDURE LIST_ACTIVE_ISSUES (
        o_cursor        OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
            SELECT i.issue_id,
                   b.book_id,
                   b.title          AS book_title,
                   b.isbn,
                   m.member_id,
                   m.full_name      AS member_name,
                   m.email          AS member_email,
                   m.phone          AS member_phone,
                   TO_CHAR(i.issue_date, 'YYYY-MM-DD') AS issue_date,
                   TO_CHAR(i.due_date,   'YYYY-MM-DD') AS due_date,
                   i.status
              FROM ISSUE_RECORDS i
              JOIN BOOKS b   ON i.book_id   = b.book_id
              JOIN MEMBERS m ON i.member_id = m.member_id
             WHERE i.status = 'ISSUED'
             ORDER BY i.issue_date DESC;
    END LIST_ACTIVE_ISSUES;

END LIBRARY_PKG;
/

COMMIT;
