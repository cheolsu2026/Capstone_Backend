const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'puzzle13', // 원래 root였음
    password: process.env.DB_PASS || 'Whfdjqgkwk123!', // 이은총 로컬 mysql 비번: w(소문자)hfdjqgkwk123!
    database: process.env.DB_NAME || 'puzzle13_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool