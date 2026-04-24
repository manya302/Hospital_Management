const express = require('express');
const db = require('../db');
const router = express.Router();

// GET all billing records
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                b.bill_id as id,
                b.patient_id,
                b.treatment_id,
                b.amount,
                b.payment_status,
                b.bill_date as due_date,
                b.payment_method,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM billing b
            JOIN patients p ON b.patient_id = p.patient_id
            ORDER BY b.bill_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in GET /billing:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single billing record
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                b.bill_id as id,
                b.patient_id,
                b.treatment_id,
                b.amount,
                b.payment_status,
                b.bill_date as due_date,
                b.payment_method,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM billing b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE b.bill_id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Billing record not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET billing by patient
router.get('/patient/:patientId', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                bill_id as id,
                treatment_id,
                amount,
                payment_status,
                bill_date as due_date,
                payment_method
            FROM billing
            WHERE patient_id = $1
            ORDER BY bill_date DESC
        `, [req.params.patientId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create billing
router.post('/', async (req, res) => {
    const { patient_id, treatment_id, amount, payment_status, bill_date, payment_method } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO billing (patient_id, treatment_id, amount, payment_status, bill_date, payment_method) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING bill_id as id`,
            [patient_id, treatment_id, amount, payment_status || 'Pending', bill_date || new Date(), payment_method]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH update payment status
router.patch('/:id/payment', async (req, res) => {
    const { payment_status } = req.body;
    try {
        const result = await db.query(
            'UPDATE billing SET payment_status=$1 WHERE bill_id=$2 RETURNING bill_id as id',
            [payment_status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Billing record not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE billing record
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM billing WHERE bill_id=$1 RETURNING bill_id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Billing record not found' });
        }
        res.json({ message: 'Billing record deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;