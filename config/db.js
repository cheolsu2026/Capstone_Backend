const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', // 로컬에서는 root로, aws에서는 puzzle13
    password: process.env.DB_PASS, 
    database: process.env.DB_NAME || 'puzzle13_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool
