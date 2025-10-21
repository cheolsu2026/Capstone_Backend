const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// 친구 요청 생성
async function createFriendRequest(requesterId, targetUsername) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 대상 사용자 찾기
        const [targetUser] = await conn.query(
            'SELECT id FROM users WHERE username = ?',
            [targetUsername]
        );
        
        if (!targetUser.length) {
            throw new Error('USER_NOT_FOUND');
        }
        
        const targetId = targetUser[0].id;
        
        // 자기 자신에게 친구 요청하는지 확인
        if (requesterId === targetId) {
            throw new Error('CANNOT_REQUEST_SELF');
        }
        
        // 이미 친구인지 확인
        const [existingFriendship] = await conn.query(
            `SELECT id FROM friends 
             WHERE (user_a_id = ? AND user_b_id = ?) 
             OR (user_a_id = ? AND user_b_id = ?)`,
            [requesterId, targetId, targetId, requesterId]
        );
        
        if (existingFriendship.length > 0) {
            throw new Error('ALREADY_FRIENDS');
        }
        
        // 이미 대기 중인 요청이 있는지 확인
        const [existingRequest] = await conn.query(
            `SELECT id FROM friend_requests 
             WHERE requester_id = ? AND target_id = ? AND status = 'pending'`,
            [requesterId, targetId]
        );
        
        if (existingRequest.length > 0) {
            throw new Error('REQUEST_ALREADY_SENT');
        }
        
        // 반대 방향 요청이 있는지 확인
        const [reverseRequest] = await conn.query(
            `SELECT id FROM friend_requests 
             WHERE requester_id = ? AND target_id = ? AND status = 'pending'`,
            [targetId, requesterId]
        );
        
        if (reverseRequest.length > 0) {
            throw new Error('REVERSE_REQUEST_EXISTS');
        }
        
        // 친구 요청 생성
        const requestId = uuidv4();
        await conn.query(
            `INSERT INTO friend_requests (id, requester_id, target_id, status) 
             VALUES (?, ?, ?, 'pending')`,
            [requestId, requesterId, targetId]
        );
        
        await conn.commit();
        return { requestId, targetId };
        
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// 친구 요청 수락
async function acceptFriendRequest(requestId, userId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 요청 확인
        const [request] = await conn.query(
            'SELECT * FROM friend_requests WHERE id = ? AND target_id = ? AND status = "pending"',
            [requestId, userId]
        );
        
        if (!request.length) {
            throw new Error('REQUEST_NOT_FOUND');
        }
        
        const { requester_id, target_id } = request[0];
        
        // 친구 관계 생성
        const friendshipId = uuidv4();
        await conn.query(
            'INSERT INTO friends (id, user_a_id, user_b_id) VALUES (?, ?, ?)',
            [friendshipId, requester_id, target_id]
        );
        
        // 요청 상태 업데이트
        await conn.query(
            'UPDATE friend_requests SET status = "accepted", responded_at = NOW() WHERE id = ?',
            [requestId]
        );
        
        await conn.commit();
        return true;
        
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// 친구 요청 거절
async function rejectFriendRequest(requestId, userId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 요청 확인
        const [request] = await conn.query(
            'SELECT * FROM friend_requests WHERE id = ? AND target_id = ? AND status = "pending"',
            [requestId, userId]
        );
        
        if (!request.length) {
            throw new Error('REQUEST_NOT_FOUND');
        }
        
        // 요청 상태 업데이트
        await conn.query(
            'UPDATE friend_requests SET status = "rejected", responded_at = NOW() WHERE id = ?',
            [requestId]
        );
        
        await conn.commit();
        return true;
        
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// 받은 친구 요청 목록 조회 (대기 중인 것만)
async function getReceivedFriendRequests(userId) {
    const [requests] = await pool.query(
        `SELECT fr.id as requestId, fr.requester_id, fr.requested_at, u.username, u.nickname, u.profile_image_url
         FROM friend_requests fr
         JOIN users u ON fr.requester_id = u.id
         WHERE fr.target_id = ? AND fr.status = 'pending'
         ORDER BY fr.requested_at DESC`,
        [userId]
    );
    return requests;
}

// 보낸 친구 요청 목록 조회 (대기 중인 것만)
async function getSentFriendRequests(userId) {
    const [requests] = await pool.query(
        `SELECT fr.id as requestId, fr.target_id, fr.status, fr.requested_at, fr.responded_at, u.username, u.nickname, u.profile_image_url
         FROM friend_requests fr
         JOIN users u ON fr.target_id = u.id
         WHERE fr.requester_id = ? AND fr.status = 'pending'
         ORDER BY fr.requested_at DESC`,
        [userId]
    );
    return requests;
}

// 친구 목록 조회
async function getFriends(userId) {
    const [friends] = await pool.query(
        `SELECT f.id, f.created_at,
                CASE 
                    WHEN f.user_a_id = ? THEN u2.id
                    ELSE u1.id
                END as friend_id,
                CASE 
                    WHEN f.user_a_id = ? THEN u2.username
                    ELSE u1.username
                END as friend_username,
                CASE 
                    WHEN f.user_a_id = ? THEN u2.nickname
                    ELSE u1.nickname
                END as friend_nickname,
                CASE 
                    WHEN f.user_a_id = ? THEN u2.profile_image_url
                    ELSE u1.profile_image_url
                END as friend_profile_image_url
         FROM friends f
         JOIN users u1 ON f.user_a_id = u1.id
         JOIN users u2 ON f.user_b_id = u2.id
         WHERE f.user_a_id = ? OR f.user_b_id = ?
         ORDER BY f.created_at DESC`,
        [userId, userId, userId, userId, userId, userId]
    );
    return friends;
}

// 친구 삭제 (username으로)
async function removeFriendByUsername(userId, friendUsername) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 친구 사용자 찾기
        const [friendUser] = await conn.query(
            'SELECT id FROM users WHERE username = ?',
            [friendUsername]
        );
        
        if (!friendUser.length) {
            throw new Error('USER_NOT_FOUND');
        }
        
        const friendId = friendUser[0].id;
        
        const [result] = await conn.query(
            `DELETE FROM friends 
             WHERE (user_a_id = ? AND user_b_id = ?) 
             OR (user_a_id = ? AND user_b_id = ?)`,
            [userId, friendId, friendId, userId]
        );
        
        await conn.commit();
        return result.affectedRows > 0;
        
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = {
    createFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getReceivedFriendRequests,
    getSentFriendRequests,
    getFriends,
    removeFriendByUsername
};
