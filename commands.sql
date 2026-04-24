SELECT * FROM patients;
SELECT first_name, specialization FROM doctors;

SELECT doctor_id, COUNT(*) total_appointments
FROM appointments
GROUP BY doctor_id;


SELECT p.first_name, d.first_name, a.appointment_date
FROM patients p, doctors d, appointments a
WHERE p.patient_id = a.patient_id
AND d.doctor_id = a.doctor_id;


SELECT UPPER(first_name) FROM patients;

SELECT LENGTH(first_name) FROM patients;


INSERT INTO appointments
VALUES ('A101', 'P101', NULL, '2026-02-21', '10:30:00', 'Fever', 'Scheduled');


SELECT version();






-- Patients Table
CREATE TABLE patients (
    patient_id        VARCHAR(10) PRIMARY KEY,
    first_name        VARCHAR(50) NOT NULL,
    last_name         VARCHAR(50) NOT NULL,
    email             VARCHAR(100) UNIQUE,
    contact_number    VARCHAR(15),
    date_of_birth     DATE,
    address           TEXT,
    gender            VARCHAR(10),
    insurance_provider VARCHAR(100),
    insurance_number  VARCHAR(50),
    registration_date DATE DEFAULT CURRENT_DATE
);

-- Doctors Table
CREATE TABLE doctors (
    doctor_id         VARCHAR(10) PRIMARY KEY,
    first_name        VARCHAR(50) NOT NULL,
    last_name         VARCHAR(50) NOT NULL,
    specialization    VARCHAR(100),
    phone_number      VARCHAR(15),
    email             VARCHAR(100),
    years_experience  INTEGER,
    hospital_branch   VARCHAR(100)
);

-- Appointments Table
CREATE TABLE appointments (
    appointment_id    VARCHAR(10) PRIMARY KEY,
    patient_id        VARCHAR(10) REFERENCES patients(patient_id),
    doctor_id         VARCHAR(10) REFERENCES doctors(doctor_id),
    appointment_date  DATE NOT NULL,
    appointment_time  TIME,
    reason_for_visit  VARCHAR(255),
    status            VARCHAR(20) DEFAULT 'Scheduled'
);

-- Billing Table
CREATE TABLE billing (
    bill_id           SERIAL PRIMARY KEY,
    patient_id        VARCHAR(10) REFERENCES patients(patient_id),
    treatment_id      VARCHAR(10),
    amount            NUMERIC(10,2),
    payment_status    VARCHAR(20) DEFAULT 'Pending',
    bill_date         DATE DEFAULT CURRENT_DATE,
    payment_method    VARCHAR(50)
);

-- Audit Log Table (used by triggers)
CREATE TABLE audit_log (
    log_id        SERIAL PRIMARY KEY,
    table_name    VARCHAR(50),
    operation     VARCHAR(10),
    record_id     VARCHAR(20),
    changed_field VARCHAR(50),
    old_value     TEXT,
    new_value     TEXT,
    changed_at    TIMESTAMP DEFAULT NOW(),
    note          TEXT
);

-- Deleted Patients Archive (used by trigger)
CREATE TABLE deleted_patients_log (
    log_id      SERIAL PRIMARY KEY,
    patient_id  VARCHAR(10),
    full_name   VARCHAR(100),
    email       VARCHAR(100),
    deleted_at  TIMESTAMP DEFAULT NOW()
);


-- Insert sample patients
INSERT INTO patients (patient_id, first_name, last_name, email,
    contact_number, date_of_birth, gender, insurance_provider)
VALUES
    ('P001', 'David',  'Williams',  'aanya.sharma@email.com',  '9876543210',
     '1990-04-12', 'Female', 'StarHealth');

-- Insert sample doctors
INSERT INTO doctors (doctor_id, first_name, last_name, specialization,
    phone_number, email, years_experience, hospital_branch)
VALUES
    ('D001', 'Rajesh', 'Kumar',   'Cardiology',    '9900112233',
     'r.kumar@medicare.com',   14, 'Bengaluru Main');

-- Insert sample appointments
INSERT INTO appointments (appointment_id, patient_id, doctor_id,
    appointment_date, appointment_time, reason_for_visit, status)
VALUES
    ('A001', 'P001', 'D001', '2026-04-10', '09:30:00', 'Chest pain checkup',   'Scheduled'),


-- Insert sample billing records
INSERT INTO billing (patient_id, treatment_id, amount, payment_status,
    bill_date, payment_method)
VALUES
    ('P001', 'T001', 3500.00, 'Paid',    '2026-03-16', 'UPI'),
