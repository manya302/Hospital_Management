const express = require('express');
const db = require('../db');
const router = express.Router();

// GET all appointments
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.appointment_id as id,
                a.patient_id,
                a.doctor_id,
                TO_TIMESTAMP(CONCAT(a.appointment_date, ' ', a.appointment_time), 'YYYY-MM-DD HH24:MI:SS') as date_time,
                a.reason_for_visit as reason,
                a.status,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization as specialty
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors d ON a.doctor_id = d.doctor_id
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in GET /appointments:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single appointment
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.appointment_id as id,
                a.patient_id,
                a.doctor_id,
                TO_TIMESTAMP(CONCAT(a.appointment_date, ' ', a.appointment_time), 'YYYY-MM-DD HH24:MI:SS') as date_time,
                a.reason_for_visit as reason,
                a.status,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.appointment_id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET appointments by patient
router.get('/patient/:patientId', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.appointment_id as id,
                a.doctor_id,
                TO_TIMESTAMP(CONCAT(a.appointment_date, ' ', a.appointment_time), 'YYYY-MM-DD HH24:MI:SS') as date_time,
                a.reason_for_visit as reason,
                a.status,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization as specialty
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC
        `, [req.params.patientId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET appointments by doctor
router.get('/doctor/:doctorId', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.appointment_id as id,
                a.patient_id,
                TO_TIMESTAMP(CONCAT(a.appointment_date, ' ', a.appointment_time), 'YYYY-MM-DD HH24:MI:SS') as date_time,
                a.reason_for_visit as reason,
                a.status,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = $1
            ORDER BY a.appointment_date DESC
        `, [req.params.doctorId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create appointment
router.post('/', async (req, res) => {
    const { patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, status } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
        const now = new Date();

        if (appointmentDateTime < now) {
            throw new Error('Cannot book appointment in the past');
        }

        // Auto-generate ID
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

        const result = await client.query(
            `INSERT INTO appointments 
            (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING appointment_id as id`,
            [nextId, patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, status || 'Scheduled']
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');

        if (err.message.includes('past')) {
            return res.status(400).json({ error: err.message });
        }

        console.error(err);
        res.status(500).json({ error: err.message });

    } finally {
        client.release();
    }
});

// PATCH update appointment status
router.patch('/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const result = await db.query(
            'UPDATE appointments SET status=$1 WHERE appointment_id=$2 RETURNING appointment_id as id',
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;