const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { console.log(`📢 ${req.method} ${req.url}`); next(); });

app.get('/debug', (req, res) => res.send('Debug endpoint works!'));
app.get('/api/health', async (req, res) => {
    const db = require('./db');
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ status: 'ok', message: 'Connected to Supabase', time: result.rows[0] });
    } catch (err) { res.json({ status: 'error', message: err.message }); }
});

// Core routes (unchanged)
app.use('/api/patients',     require('./routes/patients'));
app.use('/api/doctors',      require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/billing',      require('./routes/billing'));

// Advanced SQL routes 
app.use('/api/analytics',    require('./routes/analytics'));

app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`💚 Health: http://localhost:${PORT}/api/health\n`);
});