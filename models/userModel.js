const pool = require('../config/db');

// 아이디 중복 확인
async function findByUsername(username) {
    const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
    );
    return rows[0];
}

// 회원 가입
async function createUser(username, passwordHash, nickname) {
    const [result] = await pool.query(
        `INSERT INTO users (username, password_hash, nickname)
        VALUES (?, ?, ?)`,
        [username, passwordHash, nickname]
    );
    return result.insertId;
}

module.exports = {
    findByUsername,
    createUser,
}