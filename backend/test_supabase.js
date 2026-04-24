require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Supabase connected!', result.rows[0]);
        
        // Test if tables exist
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📊 Tables:', tables.rows.map(r => r.table_name));
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        pool.end();
    }
}

test();