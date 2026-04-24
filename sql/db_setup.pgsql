-- ============================================================
-- HOSPITAL MANAGEMENT SYSTEM — FULL DB SETUP
-- Run this ONCE in your Supabase SQL editor.
-- Generated from actual schema inspection — April 2026
--
-- Covers: built-in functions), views, set operations
--         GROUP BY/HAVING/WITH/transactions
--         PL/pgSQL, cursors
--         procedures/functions, triggers
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS patients (
    patient_id         VARCHAR(10)  PRIMARY KEY,
    first_name         VARCHAR(50)  NOT NULL,
    last_name          VARCHAR(50)  NOT NULL,
    gender             VARCHAR(10),
    date_of_birth      DATE,
    contact_number     BIGINT,
    address            VARCHAR(255),
    registration_date  DATE,
    insurance_provider VARCHAR(100),
    insurance_number   VARCHAR(50),
    email              VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id        VARCHAR(10)  PRIMARY KEY,
    first_name       VARCHAR(50)  NOT NULL,
    last_name        VARCHAR(50)  NOT NULL,
    specialization   VARCHAR(100),
    phone_number     BIGINT,
    years_experience INTEGER,
    hospital_branch  VARCHAR(100),
    email            VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id   VARCHAR(10)  PRIMARY KEY,
    patient_id       VARCHAR(10)  REFERENCES patients(patient_id),
    doctor_id        VARCHAR(10)  REFERENCES doctors(doctor_id),
    appointment_date DATE,
    appointment_time TIME,
    reason_for_visit VARCHAR(255),
    status           VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS treatments (
    treatment_id     VARCHAR(10)  PRIMARY KEY,
    appointment_id   VARCHAR(10)  REFERENCES appointments(appointment_id),
    treatment_type   VARCHAR(100),
    description      VARCHAR(255),
    cost             NUMERIC,
    treatment_date   DATE
);

CREATE TABLE IF NOT EXISTS billing (
    bill_id          VARCHAR(10)  PRIMARY KEY,
    patient_id       VARCHAR(10)  REFERENCES patients(patient_id),
    treatment_id     VARCHAR(10)  REFERENCES treatments(treatment_id),
    bill_date        DATE,
    amount           NUMERIC,
    payment_method   VARCHAR(50),
    payment_status   VARCHAR(50)
);



-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════

-- patient_summary: used in Patient Portal — totals & outstanding balance
CREATE OR REPLACE VIEW patient_summary AS
SELECT
    p.patient_id,
    CONCAT(p.first_name, ' ', p.last_name)                      AS full_name,
    UPPER(p.first_name)                                         AS first_upper,
    p.gender,
    p.date_of_birth,
    p.insurance_provider,
    p.email,
    COUNT(DISTINCT a.appointment_id)                            AS total_appointments,
    COUNT(DISTINCT b.bill_id)                                   AS total_bills,
    COALESCE(SUM(b.amount), 0)                                  AS total_billed,
    COALESCE(SUM(CASE WHEN b.payment_status = 'Paid'
                      THEN b.amount ELSE 0 END), 0)             AS total_paid,
    COALESCE(SUM(CASE WHEN b.payment_status != 'Paid'
                      THEN b.amount ELSE 0 END), 0)             AS outstanding
FROM patients p
LEFT JOIN appointments a ON p.patient_id = a.patient_id
LEFT JOIN billing      b ON p.patient_id = b.patient_id
GROUP BY p.patient_id, p.first_name, p.last_name, p.gender,
         p.date_of_birth, p.insurance_provider, p.email;


-- v_doctor_workload: used in Admin Panel — doctor load table
CREATE OR REPLACE VIEW v_doctor_workload AS
SELECT
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name)                      AS doctor_name,
    d.specialization,
    d.years_experience,
    d.hospital_branch,
    COUNT(a.appointment_id)                                     AS total_appointments,
    COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)          AS completed,
    COUNT(CASE WHEN a.status = 'Scheduled' THEN 1 END)          AS scheduled,
    COUNT(CASE WHEN a.status = 'Cancelled' THEN 1 END)          AS cancelled
FROM doctors d
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
GROUP BY d.doctor_id, d.first_name, d.last_name,
         d.specialization, d.years_experience, d.hospital_branch;


-- ═══════════════════════════════════════════════════════════════
-- STORED FUNCTIONS (PL/pgSQL)
-- ═══════════════════════════════════════════════════════════════

-- Total billing amount for a patient
-- Used in: Patient Portal — "Your Total Spend" card
CREATE OR REPLACE FUNCTION get_patient_bill_total(p_id VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO   total
    FROM   billing
    WHERE  patient_id = p_id;
    RETURN total;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RETURN -1;
END;
$$ LANGUAGE plpgsql;


-- Classify patient as None / Low / Medium / High spender
-- Uses IF/ELSIF/ELSE 
-- Used in: Patient Portal — spend classification badge
CREATE OR REPLACE FUNCTION classify_patient_spend(p_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    total  NUMERIC;
    result VARCHAR(10);
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO   total
    FROM   billing
    WHERE  patient_id = p_id;

    IF    total = 0     THEN result := 'None';
    ELSIF total < 5000  THEN result := 'Low';
    ELSIF total < 20000 THEN result := 'Medium';
    ELSE                     result := 'High';
    END IF;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN RETURN 'Unknown';
END;
$$ LANGUAGE plpgsql;


-- Appointment count for a doctor
-- Used in: Doctor Dashboard — count badge
CREATE OR REPLACE FUNCTION get_doctor_appt_count(d_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    cnt INTEGER := 0;
BEGIN
    SELECT COUNT(*)
    INTO   cnt
    FROM   appointments
    WHERE  doctor_id = d_id;
    RETURN cnt;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
END;
$$ LANGUAGE plpgsql;


-- Highest billed patient for a given specialty
-- Uses subquery + ORDER BY + LIMIT 
CREATE OR REPLACE FUNCTION top_patient_for_specialty(spec VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    pname VARCHAR(100);
BEGIN
    SELECT CONCAT(p.first_name, ' ', p.last_name)
    INTO   pname
    FROM   patients p
    JOIN   billing      b ON p.patient_id = b.patient_id
    JOIN   appointments a ON p.patient_id = a.patient_id
    JOIN   doctors      d ON a.doctor_id  = d.doctor_id
    WHERE  d.specialization = spec
    GROUP  BY p.patient_id, p.first_name, p.last_name
    ORDER  BY SUM(b.amount) DESC
    LIMIT  1;

    RETURN COALESCE(pname, 'No data');
EXCEPTION
    WHEN TOO_MANY_ROWS THEN RETURN 'Multiple';
    WHEN OTHERS        THEN RETURN 'Error';
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════
-- CURSOR-BASED FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Explicit cursor: all patients with unpaid/outstanding bills
-- Demonstrates OPEN / FETCH / EXIT WHEN NOT FOUND / CLOSE 
-- Used in: Admin Panel — Outstanding Bills list
CREATE OR REPLACE FUNCTION get_unpaid_patients()
RETURNS TABLE(
    patient_id         VARCHAR,
    full_name          TEXT,
    outstanding_amount NUMERIC,
    bill_count         BIGINT
) AS $$
DECLARE
    c_unpaid CURSOR FOR
        SELECT p.patient_id,
               CONCAT(p.first_name, ' ', p.last_name) AS fname,
               SUM(b.amount)                           AS owed,
               COUNT(b.bill_id)                        AS bcnt
        FROM   patients p
        JOIN   billing b ON p.patient_id = b.patient_id
        WHERE  b.payment_status != 'Paid'
        GROUP  BY p.patient_id, p.first_name, p.last_name
        HAVING SUM(b.amount) > 0;

    rec RECORD;
BEGIN
    OPEN c_unpaid;
    LOOP
        FETCH c_unpaid INTO rec;
        EXIT WHEN NOT FOUND;
        patient_id         := rec.patient_id;
        full_name          := rec.fname;
        outstanding_amount := rec.owed;
        bill_count         := rec.bcnt;
        RETURN NEXT;
    END LOOP;
    CLOSE c_unpaid;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Cursor error in get_unpaid_patients: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- Parameterized cursor: full sorted schedule for one doctor 
-- Used in: Doctor Dashboard — schedule table
CREATE OR REPLACE FUNCTION get_doctor_schedule(d_id VARCHAR)
RETURNS TABLE(
    appointment_id VARCHAR,
    patient_name   TEXT,
    appt_date      DATE,
    appt_time      TIME,
    reason         VARCHAR,
    status         VARCHAR
) AS $$
DECLARE
    c_schedule CURSOR (doc_id VARCHAR) FOR
        SELECT a.appointment_id,
               CONCAT(p.first_name, ' ', p.last_name) AS pname,
               a.appointment_date,
               a.appointment_time,
               a.reason_for_visit,
               a.status
        FROM   appointments a
        JOIN   patients p ON a.patient_id = p.patient_id
        WHERE  a.doctor_id = doc_id
        ORDER  BY a.appointment_date ASC, a.appointment_time ASC;

    rec RECORD;
BEGIN
    OPEN c_schedule(d_id);
    LOOP
        FETCH c_schedule INTO rec;
        EXIT WHEN NOT FOUND;
        appointment_id := rec.appointment_id;
        patient_name   := rec.pname;
        appt_date      := rec.appointment_date;
        appt_time      := rec.appointment_time;
        reason         := rec.reason_for_visit;
        status         := rec.status;
        RETURN NEXT;
    END LOOP;
    CLOSE c_schedule;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════
-- TRIGGER FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- ── Trigger 1: BEFORE INSERT on appointments ──────────────────
-- Rejects bookings with a past appointment_date.
CREATE OR REPLACE FUNCTION trg_validate_appointment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_date < CURRENT_DATE THEN
        RAISE EXCEPTION
            'Appointment date (%) cannot be in the past. Please choose a future date.',
            NEW.appointment_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_appointment_date ON appointments;
CREATE TRIGGER validate_appointment_date
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION trg_validate_appointment();