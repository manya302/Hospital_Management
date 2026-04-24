const express = require('express');
const path = require('path');
const app = express();
const PORT = 5500;

// Serve static files from current directory
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`✅ Frontend running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
});