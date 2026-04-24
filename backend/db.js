const { Pool } = require('pg');
require('dotenv').config();

// Configure for Supabase
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false } // Required for Supabase
});

// Test connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Supabase connection failed:', err.message);
    } else {
        console.log('✅ Connected to Supabase PostgreSQL');
        release();
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};