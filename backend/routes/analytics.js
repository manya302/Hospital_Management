// routes/analytics.js 
const express = require('express');
const db      = require('../db');
const router  = express.Router();

// Built-in functions (UPPER, LENGTH, SUBSTR, LIKE, COALESCE, TO_CHAR) ──
// Feature: Patient name search in Patient Portal
router.get('/patients/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query param ?q= required' });
    try {
        const result = await db.query(`
            SELECT
                patient_id,
                UPPER(CONCAT(first_name, ' ', last_name))        AS name_upper,
                LENGTH(CONCAT(first_name, ' ', last_name))       AS name_length,
                SUBSTR(first_name, 1, 1) || '. ' || last_name    AS short_name,
                email,
                gender,
                TO_CHAR(date_of_birth, 'DD-Mon-YYYY')           AS dob_formatted,
                COALESCE(insurance_provider, 'Not Insured')     AS insurance_display
            FROM patients
            WHERE LOWER(first_name) LIKE LOWER($1)
               OR LOWER(last_name)  LIKE LOWER($1)
               OR LOWER(email)      LIKE LOWER($1)
            ORDER BY last_name ASC, first_name ASC
        `, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// UNION — any patient engagement ──
router.get('/admin/patients-with-any-activity', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT patient_id, 'Has Appointment' AS activity_type FROM appointments
            UNION
            SELECT patient_id, 'Has Billing'     AS activity_type FROM billing
            ORDER BY patient_id
        `);
        if (!result.rows.length) return res.json([]);
        const ids = [...new Set(result.rows.map(r => r.patient_id))];
        const patients = await db.query(
            `SELECT patient_id, CONCAT(first_name,' ',last_name) AS full_name, email
             FROM patients WHERE patient_id = ANY($1)`, [ids]);
        const nm = {};
        patients.rows.forEach(p => { nm[p.patient_id] = p; });
        res.json(result.rows.map(r => ({
            ...r, full_name: nm[r.patient_id]?.full_name || 'Unknown',
            email: nm[r.patient_id]?.email || ''
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// INTERSECT — patients with both appointments AND billing ──
router.get('/admin/patients-fully-active', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT patient_id FROM appointments
            INTERSECT
            SELECT patient_id FROM billing
        `);
        if (!result.rows.length) return res.json([]);
        const ids = result.rows.map(r => r.patient_id);
        const enriched = await db.query(
            `SELECT patient_id, CONCAT(first_name,' ',last_name) AS full_name, email
             FROM patients WHERE patient_id = ANY($1) ORDER BY last_name`, [ids]);
        res.json(enriched.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

//EXCEPT (MINUS) — appointments with no billing = missing invoices ──
router.get('/admin/patients-missing-billing', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT patient_id FROM appointments
            EXCEPT
            SELECT patient_id FROM billing
        `);
        if (!result.rows.length) return res.json([]);
        const ids = result.rows.map(r => r.patient_id);
        const enriched = await db.query(`
            SELECT p.patient_id, CONCAT(p.first_name,' ',p.last_name) AS full_name,
                   p.email, COUNT(a.appointment_id) AS appointment_count
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE p.patient_id = ANY($1)
            GROUP BY p.patient_id, p.first_name, p.last_name, p.email
            ORDER BY appointment_count DESC
        `, [ids]);
        res.json(enriched.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NOT EXISTS — patients who have NEVER had an appointment ──
router.get('/admin/patients-never-appointed', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT patient_id, CONCAT(first_name,' ',last_name) AS full_name,
                   email, TO_CHAR(registration_date,'DD-Mon-YYYY') AS registered_on
            FROM patients p
            WHERE NOT EXISTS (
                SELECT 1 FROM appointments a WHERE a.patient_id = p.patient_id
            )
            ORDER BY registration_date DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NOT EXISTS — doctors with no upcoming appointments ──
router.get('/admin/doctors-available', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT doctor_id, CONCAT(first_name,' ',last_name) AS doctor_name,
                   specialization, years_experience, hospital_branch
            FROM doctors d
            WHERE NOT EXISTS (
                SELECT 1 FROM appointments a
                WHERE  a.doctor_id = d.doctor_id
                AND    a.appointment_date >= CURRENT_DATE
                AND    a.status NOT IN ('Cancelled','Completed')
            )
            ORDER BY years_experience DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VIEWs ──
router.get('/view/patient-summary/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM patient_summary WHERE patient_id = $1`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/view/doctor-workload', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM doctor_workload ORDER BY total_appointments DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ORDER BY — sortable appointments table ──
router.get('/appointments/sorted', async (req, res) => {
    const { sort_by = 'date', order = 'desc' } = req.query;
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortMap = {
        date: 'a.appointment_date', status: 'a.status',
        doctor: 'd.last_name', reason: 'a.reason_for_visit'
    };
    const sortCol = sortMap[sort_by] || 'a.appointment_date';
    try {
        const result = await db.query(`
            SELECT a.appointment_id, a.patient_id, a.doctor_id,
                   CONCAT(p.first_name,' ',p.last_name) AS patient_name,
                   CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
                   a.appointment_date, a.appointment_time,
                   a.reason_for_visit, a.status
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors  d ON a.doctor_id  = d.doctor_id
            ORDER BY ${sortCol} ${safeOrder}
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GROUP BY + aggregates — doctor load ──
router.get('/stats/doctor-load', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT d.doctor_id,
                   CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
                   d.specialization, d.years_experience,
                   COUNT(CASE WHEN a.status IN ('Completed','Scheduled','Cancelled') THEN 1 END) AS total,
                   COUNT(CASE WHEN a.status='Completed' THEN 1 END) AS completed,
                   COUNT(CASE WHEN a.status='Scheduled' THEN 1 END) AS scheduled,
                   COUNT(CASE WHEN a.status='Cancelled' THEN 1 END) AS cancelled
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name,
                     d.specialization, d.years_experience
            ORDER BY total DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GROUP BY + HAVING — specialties with high demand ──
router.get('/stats/busy-specialties', async (req, res) => {
    const { min_appointments = 1 } = req.query;
    try {
        const result = await db.query(`
            SELECT d.specialization,
                   COUNT(DISTINCT d.doctor_id)   AS num_doctors,
                   COUNT(a.appointment_id)        AS total_appointments,
                   ROUND(AVG(d.years_experience)) AS avg_experience,
                   ROUND(COUNT(a.appointment_id)::numeric /
                         NULLIF(COUNT(DISTINCT d.doctor_id),0), 1) AS load_per_doctor
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.specialization
            HAVING COUNT(a.appointment_id) > $1
            ORDER BY total_appointments DESC
        `, [min_appointments]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──  WITH clause — top revenue specialty ──
router.get('/stats/top-revenue-specialty', async (req, res) => {
    try {
        const result = await db.query(`
            WITH specialty_revenue AS (
                SELECT d.specialization,
                       COALESCE(SUM(b.amount), 0)    AS total_revenue,
                       COUNT(DISTINCT a.patient_id)   AS unique_patients
                FROM doctors d
                LEFT JOIN appointments a ON d.doctor_id      = a.doctor_id
                LEFT JOIN treatments   t ON a.appointment_id = t.appointment_id
                LEFT JOIN billing      b ON t.treatment_id   = b.treatment_id
                GROUP BY d.specialization
            ),
            max_rev AS (SELECT MAX(total_revenue) AS max_val FROM specialty_revenue)
            SELECT sr.specialization, sr.total_revenue, sr.unique_patients,
                   (sr.total_revenue = mr.max_val) AS is_top
            FROM specialty_revenue sr CROSS JOIN max_rev mr
            ORDER BY sr.total_revenue DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Derived relation (subquery in FROM) — above-avg spenders ──
router.get('/stats/above-avg-spenders', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.patient_id,
                   CONCAT(p.first_name,' ',p.last_name) AS patient_name,
                   pt.total_spent, oa.avg_spend,
                   ROUND(pt.total_spent - oa.avg_spend, 2) AS above_avg_by
            FROM patients p
            JOIN (
                SELECT patient_id, SUM(amount) AS total_spent
                FROM billing GROUP BY patient_id
            ) AS pt ON p.patient_id = pt.patient_id
            CROSS JOIN (
                SELECT ROUND(AVG(total),2) AS avg_spend
                FROM (SELECT patient_id, SUM(amount) AS total FROM billing GROUP BY patient_id) sub
            ) AS oa
            WHERE pt.total_spent > oa.avg_spend
            ORDER BY pt.total_spent DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── All aggregates — dashboard stats ──
router.get('/stats/dashboard', async (req, res) => {
    try {
        const [patients, doctors, appointments, billing] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total FROM patients`),
            db.query(`SELECT COUNT(*) AS total FROM doctors`),
            db.query(`
                SELECT COUNT(*) AS total,
                       COUNT(CASE WHEN status='Scheduled'          THEN 1 END) AS scheduled,
                       COUNT(CASE WHEN status='Completed'          THEN 1 END) AS completed,
                       COUNT(CASE WHEN status='Cancelled'          THEN 1 END) AS cancelled,
                       COUNT(CASE WHEN appointment_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 END) AS today
                FROM appointments
            `),
            db.query(`
                SELECT COALESCE(SUM(amount),0) AS total_revenue,
                       COALESCE(SUM(CASE WHEN payment_status='Paid'  THEN amount END),0) AS paid,
                       COALESCE(SUM(CASE WHEN payment_status!='Paid' THEN amount END),0) AS outstanding,
                       COUNT(*) AS total_bills,
                       ROUND(AVG(amount),2) AS avg_bill,
                       MAX(amount) AS max_bill, MIN(amount) AS min_bill
                FROM billing
            `)
        ]);
        res.json({ patients: patients.rows[0], doctors: doctors.rows[0],
                   appointments: appointments.rows[0], billing: billing.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMMIT / ROLLBACK / SAVEPOINT — transactional booking ──
router.post('/appointments/book-safe', async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit } = req.body;
        const patCheck = await client.query(`SELECT patient_id FROM patients WHERE patient_id=$1`, [patient_id]);
        if (!patCheck.rows.length) throw new Error(`Patient ${patient_id} not found`);
        const docCheck = await client.query(`SELECT doctor_id FROM doctors WHERE doctor_id=$1`, [doctor_id]);
        if (!docCheck.rows.length) throw new Error(`Doctor ${doctor_id} not found`);
        await client.query('SAVEPOINT before_appointment');

        // Auto-generate next A### appointment_id
        const maxResult = await client.query(`
            SELECT appointment_id FROM appointments
            WHERE appointment_id ~ '^A[0-9]+$'
            ORDER BY CAST(SUBSTRING(appointment_id FROM 2) AS INTEGER) DESC
            LIMIT 1
        `);
        let nextId;
        if (maxResult.rows.length === 0) {
            nextId = 'A001';
        } else {
            const lastNum = parseInt(maxResult.rows[0].appointment_id.substring(1), 10);
            nextId = 'A' + String(lastNum + 1).padStart(3, '0');
        }

        const apptResult = await client.query(`
            INSERT INTO appointments (appointment_id, patient_id, doctor_id,
                appointment_date, appointment_time, reason_for_visit, status)
            VALUES ($1,$2,$3,$4,$5,$6,'Scheduled') RETURNING appointment_id
        `, [nextId, patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit]);
        await client.query('COMMIT');
        res.status(201).json({
            success: true, appointment_id: apptResult.rows[0].appointment_id,
            message: 'Appointment booked successfully (transactional)'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// ── Cursor-based functions ──
router.get('/cursor/unpaid-patients', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM get_unpaid_patients() ORDER BY outstanding_amount DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/cursor/doctor-schedule/:id', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM get_doctor_schedule($1)`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TREATMENTS SUMMARY — Home page chart ──
router.get('/stats/treatments-summary', async (req, res) => {
    try {
        const breakdown = await db.query(`
            SELECT
                COALESCE(treatment_type, 'Unspecified') AS treatment_type,
                COUNT(treatment_id)                      AS total_treatments,
                COALESCE(SUM(cost), 0)                  AS total_cost,
                ROUND(AVG(cost), 2)                     AS avg_cost
            FROM treatments
            GROUP BY treatment_type
            ORDER BY total_treatments DESC
        `);
        const totals = await db.query(`
            SELECT
                COUNT(*)                           AS total_treatments,
                COUNT(DISTINCT appointment_id)     AS unique_appointments,
                COALESCE(SUM(cost), 0)             AS total_revenue,
                ROUND(AVG(cost), 2)                AS avg_cost
            FROM treatments
        `);
        res.json({ breakdown: breakdown.rows, totals: totals.rows[0] });
    } catch (err) {
        console.error('Error in /stats/treatments-summary:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;