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
