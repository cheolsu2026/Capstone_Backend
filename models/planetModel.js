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
        `SELECT p.id, u.username, p.title, p.visit_count, p.created_at
        FROM planets p
        JOIN users u ON p.owner_id = u.id
        ORDER BY u.username ASC`
    );
    return rows;
}

// username으로 행성 ID 조회 (공통 함수)
async function getPlanetIdByUsername(username) {
    const [rows] = await pool.query(
        `SELECT p.id FROM planets p
        JOIN users u ON p.owner_id = u.id
        WHERE u.username = ?`,
        [username]
    );
    
    if (rows.length === 0) {
        throw new Error('행성을 찾을 수 없습니다');
    }
    
    return rows[0].id;
}

// 행성 상세 정보 조회 (username 기반)
async function findByUsername(username) {
    const [rows] = await pool.query(
        `SELECT p.*, u.nickname AS ownerNickname, u.username, u.profile_image_url
        FROM planets p
        JOIN users u ON p.owner_id = u.id
        WHERE u.username = ?`,
        [username]
    );
    return rows[0];
}

// 행성 방문 추가 (username 기반)
async function addVisitByUsername(visitorId, username) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        const planetId = await getPlanetIdByUsername(username);
        
        // 중복 방문 체크
        const [existingVisit] = await conn.query(
            `SELECT id FROM planet_visits WHERE visitor_id = ? AND planet_id = ?`,
            [visitorId, planetId]
        );
        
        // 이미 방문한 경우 처리하지 않음
        if (existingVisit.length > 0) {
            // 현재 방문 수 조회
            const [visitCountRows] = await conn.query(
                `SELECT visit_count FROM planets WHERE id = ?`,
                [planetId]
            );
            await conn.commit();
            return { 
                isNewVisit: false, 
                visitCount: visitCountRows[0].visit_count 
            };
        }
        
        // 새로운 방문만 기록
        await conn.query(
            `INSERT INTO planet_visits (visitor_id, planet_id) VALUES (?, ?)`,
            [visitorId, planetId]
        );
        await conn.query(
            `UPDATE planets SET visit_count = visit_count + 1 WHERE id = ?`,
            [planetId]
        );
        
        // 업데이트된 방문 수 조회
        const [visitCountRows] = await conn.query(
            `SELECT visit_count FROM planets WHERE id = ?`,
            [planetId]
        );
        
        await conn.commit();
        return { 
            isNewVisit: true, 
            visitCount: visitCountRows[0].visit_count 
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// 갤러리 목록 조회 (username 기반)
async function findGalleryListByUsername(username) {
    const [rows] = await pool.query(
        `SELECT g.id AS galleryId, g.title, gi.id AS imageId, gi.image_url, g.created_at
        FROM galleries g
        JOIN game_images gi ON g.image_id = gi.id
        JOIN planets p ON g.planet_id = p.id
        JOIN users u ON p.owner_id = u.id
        WHERE u.username = ?`,
        [username]
    );
    return rows;
}

// 갤러리 상세 조회 (username 기반)
async function findGalleryDetailByUsername(username, imageId) {
    const [rows] = await pool.query(
        `SELECT g.id AS galleryId, g.title, gi.image_url, gi.metadata, gi.generated_at
        FROM galleries g
        JOIN game_images gi ON g.image_id = gi.id
        JOIN planets p ON g.planet_id = p.id
        JOIN users u ON p.owner_id = u.id
        WHERE u.username = ? AND gi.id = ?`,
        [username, imageId]
    );
    return rows[0];
}

// 방명록 조회 (username 기반)
async function findGuestbookListByUsername(username) {
    const [rows] = await pool.query(
        `SELECT gb.id, gb.content, u.nickname AS authorNickname, gb.written_at
        FROM guestbooks gb
        JOIN users u ON gb.author_id = u.id
        JOIN planets p ON gb.planet_id = p.id
        JOIN users owner ON p.owner_id = owner.id
        WHERE owner.username = ?
        ORDER BY gb.written_at DESC`,
        [username]
    );
    return rows;
}

// 방명록 작성 (username 기반)
async function addGuestbookByUsername(username, authorId, content) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        const planetId = await getPlanetIdByUsername(username);
        
        await conn.query(
            `INSERT INTO guestbooks (planet_id, author_id, content)
            VALUES (?, ?, ?)`,
            [planetId, authorId, content]
        );
        
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// 즐겨찾기 추가 (username 기반)
async function addFavoriteByUsername(userId, username) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        const planetId = await getPlanetIdByUsername(username);
        
        await conn.query(
            `INSERT IGNORE INTO planet_favorites (user_id, planet_id)
            VALUES (?, ?)`,
            [userId, planetId]
        );
        
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// 즐겨찾기 삭제 (username 기반)
async function removeFavoriteByUsername(userId, username) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        const planetId = await getPlanetIdByUsername(username);
        
        await conn.query(
            `DELETE FROM planet_favorites WHERE user_id = ? AND planet_id = ?`,
            [userId, planetId]
        );
        
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}



// 내 행성 정보 수정
async function updateMyPlanet(userId, title, profileImage) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 행성 제목 수정
        if (title) {
            await conn.query(
                `UPDATE planets SET title = ? WHERE owner_id = ?`,
                [title, userId]
            );
        }
        
        // 프로필 이미지 수정 (users 테이블)
        if (profileImage) {
            await conn.query(
                `UPDATE users SET profile_image_url = ? WHERE id = ?`,
                [profileImage, userId]
            );
        }
        
        await conn.commit();
        
        // 수정된 정보 조회
        const [planetRows] = await conn.query(
            `SELECT p.*, u.username, u.profile_image_url
            FROM planets p
            JOIN users u ON p.owner_id = u.id
            WHERE p.owner_id = ?`,
            [userId]
        );
        
        return planetRows[0];
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// 사용자의 행성 조회
async function findByOwnerId(ownerId) {
    const [rows] = await pool.query(
        `SELECT p.*, u.nickname AS ownerNickname
        FROM planets p
        JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = ?`,
        [ownerId]
    );
    return rows[0];
}

// 게임 이미지를 행성 갤러리에 저장
async function saveGameImageToGallery(planetId, imageId, title) {
    const [result] = await pool.query(
        `INSERT INTO galleries (planet_id, image_id, title) VALUES (?, ?, ?)`,
        [planetId, imageId, title]
    );
    return result.insertId;
}

module.exports = {
    findAll,
    createPlanetWithConnection,
    findByOwnerId,
    saveGameImageToGallery,
    updateMyPlanet,
    // username 기반 함수들
    findByUsername,
    addVisitByUsername,
    findGalleryListByUsername,
    findGalleryDetailByUsername,
    findGuestbookListByUsername,
    addGuestbookByUsername,
    addFavoriteByUsername,
    removeFavoriteByUsername,
};