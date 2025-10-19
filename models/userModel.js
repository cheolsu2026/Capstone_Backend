const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// 커넥션 함수
async function getConnection() {
    return await pool.getConnection();
}

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
async function createUserWithConnection(conn, username, passwordHash, nickname) {
    const id = uuidv4();
    await conn.query(
        `INSERT INTO users (id, username, password_hash, nickname) 
        VALUES (?, ?, ?, ?)`,
        [id, username, passwordHash, nickname]
    );
    return id;
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

// 로그인 시 planetId 반환을 위한 userId 반환
async function findPlanetByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT id FROM planets WHERE owner_id = ? LIMIT 1',
    [userId]
  );
  return rows[0];
}

module.exports = {
    findByUsername,
    createUser,
    findById,
    updateNickname,
    updatePassword,
    getConnection,
    createUserWithConnection,
    findPlanetByUserId,
}