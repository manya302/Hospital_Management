const express = require('express');
const db = require('../db');
const router = express.Router();

// GET all doctors
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                doctor_id as id,
                first_name,
                last_name,
                CONCAT(first_name, ' ', last_name) as name,
                specialization as specialty,
                phone_number as phone,
                email,
                years_experience,
                hospital_branch
            FROM doctors
            ORDER BY doctor_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET single doctor
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                doctor_id as id,
                first_name,
                last_name,
                CONCAT(first_name, ' ', last_name) as name,
                specialization as specialty,
                phone_number as phone,
                email,
                years_experience,
                hospital_branch
            FROM doctors 
            WHERE doctor_id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create doctor
router.post('/', async (req, res) => {
    const { first_name, last_name, specialization, phone_number, email, years_experience, hospital_branch } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO doctors (first_name, last_name, specialization, phone_number, email, years_experience, hospital_branch) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING doctor_id as id`,
            [first_name, last_name, specialization, phone_number, email, years_experience, hospital_branch]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;