// db 레벨

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

// (본인) 프로필 조회
async function findById(userId) {   // id로 유저 찾음
    const [rows] = await pool.query(
        'SELECT id, username, nickname, password_hash, created_at FROM users WHERE id = ?',
        [userId]
    );
    return rows[0];
}

// 닉네임 변경
async function updateNickname(userId, newNickname) {
    const [result] = await pool.query(
        'UPDATE users SET nickname = ? WHERE id = ?',
        [newNickname, userId]
    );
    return result.affectedRows > 0;
}

// 비밀번호 변경
async function updatePassword(userId, newPasswordHash) {
    const [result] = await pool.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId]
    );
    return result.affectedRows > 0;
}

module.exports = {
    findByUsername,
    createUser,
    findById,
    updateNickname,
    updatePassword,
}