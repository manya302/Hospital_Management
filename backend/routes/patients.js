const express = require('express');
const db = require('../db');
const router = express.Router();

// GET all patients
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                patient_id as id,
                first_name,
                last_name,
                CONCAT(first_name, ' ', last_name) as name,
                email,
                contact_number as phone,
                address,
                date_of_birth as dob,
                gender,
                insurance_provider,
                insurance_number
            FROM patients
            ORDER BY patient_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in GET /patients:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single patient
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                patient_id as id,
                first_name,
                last_name,
                CONCAT(first_name, ' ', last_name) as name,
                email,
                contact_number as phone,
                address,
                date_of_birth as dob,
                gender,
                insurance_provider,
                insurance_number,
                registration_date
            FROM patients 
            WHERE patient_id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create patient — auto-generates next P### patient_id
router.post('/', async (req, res) => {
    const { first_name, last_name, email, contact_number, date_of_birth, address, gender, insurance_provider, insurance_number } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Find the highest existing P### id and increment
        const maxResult = await client.query(`
            SELECT patient_id FROM patients
            WHERE patient_id ~ '^P[0-9]+$'
            ORDER BY CAST(SUBSTRING(patient_id FROM 2) AS INTEGER) DESC
            LIMIT 1
        `);

        let nextId;
        if (maxResult.rows.length === 0) {
            nextId = 'P001';
        } else {
            const lastNum = parseInt(maxResult.rows[0].patient_id.substring(1), 10);
            nextId = 'P' + String(lastNum + 1).padStart(3, '0');
        }

        const result = await client.query(
            `INSERT INTO patients
                (patient_id, first_name, last_name, email, contact_number, date_of_birth, address, gender, insurance_provider, insurance_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING patient_id as id`,
            [
                nextId,
                first_name,
                last_name,
                email,
                contact_number || null,
                date_of_birth || null,
                address || null,
                gender || null,
                insurance_provider || null,
                insurance_number || null
            ]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// PUT update patient
router.put('/:id', async (req, res) => {
    const { first_name, last_name, email, contact_number, date_of_birth, address, gender, insurance_provider, insurance_number } = req.body;
    try {
        const result = await db.query(
            `UPDATE patients 
             SET first_name=$1, last_name=$2, email=$3, contact_number=$4, date_of_birth=$5, address=$6, gender=$7, insurance_provider=$8, insurance_number=$9
             WHERE patient_id=$10 
             RETURNING patient_id as id`,
            [first_name, last_name, email, contact_number, date_of_birth, address, gender, insurance_provider, insurance_number, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE patient
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM patients WHERE patient_id=$1 RETURNING patient_id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json({ message: 'Patient deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;