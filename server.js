require("dotenv").config();
const express = require("express");
const { Client } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

client.connect();

app.get("/users", async (req, res) => {
  const result = await client.query("SELECT * FROM test_table");
  res.json(result.rows);
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}/users`);
});