const pool = require('../config/db');

// 행성 생성
async function createPlanetWithConnection(conn, ownerId, title) {
    const [result] = await conn.query(
        `INSERT INTO planets (owner_id, title, visit_count) VALUES (?, ?, 0)`,
        [ownerId, title]
    );
    return result.insertId;
}

// 행성 목록 조회 - 기본: 알파벳 순서로 전체 나열
async function findAll() {
    const [rows] = await pool.query(
        `SELECT p.id, u.nickname AS ownerNickname, p.title, p.visit_count, p.created_at
        FROM planets p
        JOIN users u ON p.owner_id = u.id
        ORDER BY u.nickname ASC`
    );
    return rows;
}

// 행성 상세 정보 조회
async function findById(planetId) {
    const [rows] = await pool.query(
        `SELECT p.*, u.nickname AS ownerNickname
        FROM planets p
        JOIN users u ON p.owner_id = u.id
        WHERE p.id = ?`,
        [planetId]
    );
    return rows[0];
}

// 행성 방문 추가
async function addVisit(visitorId, planetId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO planet_visits (visitor_id, planet_id) VALUES (?, ?)`,
            [visitorId, planetId]
        );
        await conn.query(
            `UPDATE planets SET visit_count = visit_count + 1 WHERE id = ?`,
            [planetId]
        );
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// 갤러리 목록 조회
async function findGalleryList(planetId) {
    const [rows] = await pool.query(
        `SELECT g.id AS galleryId, g.title, gi.image_url, g.created_at
        FROM galleries g
        JOIN game_images gi ON g.image_id = gi.id
        WHERE g.planet_id = ?`,
        [planetId]
    );
    return rows;
}

// 갤러리 상세 조회
async function findGalleryDetail(planetId, imageId) {
    const [rows] = await pool.query(
        `SELECT g.id AS galleryId, g.title, gi.image_url, gi.metadata, gi.generated_at
        FROM galleries g
        JOIN game_images gi ON g.image_id = gi.id
        WHERE g.planet_id = ? AND gi.id = ?`,
        [planetId, imageId]
    );
    return rows[0];
}

// 방명록 조회
async function findGuestbookList(planetId) {
    const [rows] = await pool.query(
        `SELECT gb.id, gb.content, u.nickname AS authorNickname, gb.written_at
        FROM guestbooks gb
        JOIN users u ON gb.author_id = u.id
        WHERE gb.planet_id = ?
        ORDER BY gb.written_at DESC`,
        [planetId]
    );
    return rows;
}

// 방명록 작성
async function addGuestbook(planetId, authorId, content) {
    await pool.query(
        `INSERT INTO guestbooks (planet_id, author_id, content)
        VALUES (?, ?, ?)`,
        [planetId, authorId, content]
    );
}

// 즐겨찾기 추가
async function addFavorite(userId, planetId) {
    await pool.query(
        `INSERT IGNORE INTO planet_favorites (user_id, planet_id)
        VALUES (?, ?)`,
        [userId, planetId]
    );
}

// 즐겨찾기 삭제
async function removeFavorite(userId, planetId) {
    await pool.query(
        `DELETE FROM planet_favorites WHERE user_id = ? AND planet_id = ?`,
        [userId, planetId]
    );
}

// 즐겨찾기 조회
async function findFavorites(userId) {
    const [rows] = await pool.query(
        `SELECT p.id, p.title, u.nickname AS ownerNickname, p.created_at
        FROM planet_favorites f
        JOIN planets p ON f.planet_id = p.id
        JOIN users u ON p.owner_id = u.id
        WHERE f.user_id = ?`,
        [userId]
    );
    return rows;
}

module.exports = {
    findAll,
    findById,
    addVisit,
    findGalleryList,
    findGalleryDetail,
    findGuestbookList,
    addGuestbook,
    addFavorite,
    removeFavorite,
    findFavorites,
    createPlanetWithConnection,
};