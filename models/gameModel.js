const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// 룸 코드 생성 (6자리 랜덤 문자열)
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 룸 생성
async function createRoom(hostId, status = 'waiting') {
    const roomId = uuidv4();
    const roomCode = generateRoomCode();
    
    const [result] = await pool.query(
        `INSERT INTO rooms (id, host_id, code, status) VALUES (?, ?, ?, ?)`,
        [roomId, hostId, roomCode, status]
    );
    
    return { roomId, roomCode };
}

// 룸 참가자 추가
async function addRoomParticipant(roomId, userId, isReady = false, isHost = false) {
    const [result] = await pool.query(
        `INSERT INTO room_participants (room_id, user_id, is_ready, is_host) VALUES (?, ?, ?, ?)`,
        [roomId, userId, isReady, isHost]
    );
    
    return result.insertId;
}

// 게임 생성
async function createGame(roomId, userId, mode = 'single') {
    const gameId = uuidv4();
    
    const [result] = await pool.query(
        `INSERT INTO games (id, room_id, user_id, mode, started_at) VALUES (?, ?, ?, ?, NOW())`,
        [gameId, roomId, userId, mode]
    );
    
    return gameId;
}

// 태그 조회 또는 생성
async function findOrCreateTag(tagName) {
    // 기존 태그 조회
    const [existingTags] = await pool.query(
        'SELECT id FROM tags WHERE name = ?',
        [tagName]
    );

    if (existingTags.length > 0) {
        return existingTags[0].id;
    } else {
        // 새 태그 생성
        const [result] = await pool.query(
            'INSERT INTO tags (name) VALUES (?)',
            [tagName]
        );
        return result.insertId;
    }
}

// 게임 태그 연결
async function connectGameTags(gameId, tagIds, userId) {
    for (let i = 0; i < tagIds.length; i++) {
        await pool.query(
            `INSERT INTO game_tags (game_id, tag_id, entered_by_user_id, order_index) 
             VALUES (?, ?, ?, ?)`,
            [gameId, tagIds[i], userId, i + 1]
        );
    }
}

// 게임 이미지 저장
async function saveGameImage(gameId, imageUrl, metadata) {
    const [result] = await pool.query(
        `INSERT INTO game_images (game_id, image_url, metadata) VALUES (?, ?, ?)`,
        [gameId, imageUrl, JSON.stringify(metadata)]
    );
    
    return result.insertId;
}

// 룸과 게임 정보 조회
async function findRoomAndGame(roomId, userId, mode = 'single') {
    const [rows] = await pool.query(
        `SELECT r.id, r.status, g.id as game_id, g.started_at 
         FROM rooms r 
         LEFT JOIN games g ON r.id = g.room_id AND g.user_id = ? AND g.mode = ?
         WHERE r.id = ?`,
        [userId, mode, roomId]
    );
    
    return rows[0];
}

// 게임 이미지 조회
async function findGameImage(gameId) {
    const [rows] = await pool.query(
        `SELECT id FROM game_images WHERE game_id = ? ORDER BY generated_at DESC LIMIT 1`,
        [gameId]
    );
    
    return rows[0];
}

// 게임 완료 기록 저장
async function saveGameCompletion(gameId, userId, imageId, clearTimeMs) {
    const [result] = await pool.query(
        `INSERT INTO game_completions (game_id, user_id, image_id, clear_time_ms, completed_at, winner) 
         VALUES (?, ?, ?, ?, NOW(), true)`,
        [gameId, userId, imageId, clearTimeMs]
    );
    
    return result.insertId;
}

// 게임 완료 시간 업데이트
async function updateGameFinishedAt(gameId) {
    const [result] = await pool.query(
        `UPDATE games SET finished_at = NOW() WHERE id = ?`,
        [gameId]
    );
    
    return result.affectedRows;
}

// 룸 상태 업데이트
async function updateRoomStatus(roomId, status) {
    const [result] = await pool.query(
        `UPDATE rooms SET status = ? WHERE id = ?`,
        [status, roomId]
    );
    
    return result.affectedRows;
}

module.exports = {
    generateRoomCode,
    createRoom,
    addRoomParticipant,
    createGame,
    findOrCreateTag,
    connectGameTags,
    saveGameImage,
    findRoomAndGame,
    findGameImage,
    saveGameCompletion,
    updateGameFinishedAt,
    updateRoomStatus
};