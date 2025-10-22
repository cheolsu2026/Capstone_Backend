const planetModel = require('../models/planetModel');

// 행성 목록 조회 - 기본: 알파벳 순서로 전체 나열
async function getPlanetList(req, res) {
    try {
        const planets = await planetModel.findAll();
        res.json({
            isSuccess: true,
            code: 200,
            message: '행성 목록 조회 성공',
            result: planets
        });
    } catch (err) {
        console.error('행성 목록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false, 
            code: 500, 
            message: '서버 오류', 
            error: err.message
        });
    }
}



// ===== username 기반 함수들 =====

// 행성 상세 정보 조회 (username 기반)
async function getPlanetByUsername(req, res) {
    const { username } = req.params;
    const currentUserId = req.user ? req.user.id : null; // 로그인하지 않은 사용자도 접근 가능
    
    try {
        const planet = await planetModel.findByUsername(username);
        if (!planet) {
            return res.status(404).json({ 
                isSuccess: false,
                code: 404, 
                message: '행성을 찾을 수 없습니다' 
            });
        }
        
        // 소유자 확인 로직
        const isOwner = currentUserId && planet.owner_id === currentUserId;
        
        res.json({ 
            isSuccess: true, 
            code: 200, 
            message: '행성 상세 조회 성공', 
            result: {
                id: planet.id,
                ownerId: planet.owner_id,
                ownerUsername: planet.username,
                title: planet.title,
                visitCount: planet.visit_count,
                createdAt: planet.created_at,
                profileImageUrl: planet.profile_image_url,
                isOwner: isOwner, // 프론트엔드에서 권한 확인용
                canEdit: isOwner // 수정 가능 여부
            } 
        });
    } catch (err) {
        console.error('행성 상세 조회 오류: ', err);
        res.status(500).json({ 
            isSuccess: false, 
            code: 500, 
            message: '서버 오류', 
            error: err.message 
        });
    }
}

// 행성 방문 추가 (username 기반)
async function visitPlanetByUsername(req, res) {
    const { username } = req.params;
    const visitorId = req.user.id;
    
    try {
        // 행성 정보 먼저 조회
        const planet = await planetModel.findByUsername(username);
        if (!planet) {
            return res.status(404).json({ 
                isSuccess: false,
                code: 404, 
                message: '행성을 찾을 수 없습니다' 
            });
        }
        
        // 자신의 행성 방문 방지
        if (planet.owner_id === visitorId) {
            return res.status(400).json({ 
                isSuccess: false,
                code: 400,
                message: '자신의 행성은 방문할 수 없습니다' 
            });
        }
        
        const visitResult = await planetModel.addVisitByUsername(visitorId, username);
        
        if (visitResult.isNewVisit) {
            res.json({
                isSuccess: true,
                code: 201,
                message: '행성 방문 성공',
                result: {
                    username: username,
                    visitCount: visitResult.visitCount
                }
            });
        } else {
            res.json({
                isSuccess: true,
                code: 200,
                message: '이미 방문한 행성입니다',
                result: {
                    username: username,
                    visitCount: visitResult.visitCount
                }
            });
        }
    } catch (err) {
        console.error('행성 방문 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 갤러리 목록 조회 (username 기반)
async function getGalleryListByUsername(req, res) {
    const { username } = req.params;
    try {
        const galleries = await planetModel.findGalleryListByUsername(username);
        res.json({
            isSuccess: true,
            code: 200,
            message: '갤러리 목록 조회 성공',
            result: {
                username: username,
                galleries: galleries
            }
        });
    } catch (err) {
        console.error('갤러리 목록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 갤러리 상세 조회 (username 기반)
async function getGalleryDetailByUsername(req, res) {
    const { username, imageId } = req.params;
    try {
        const detail = await planetModel.findGalleryDetailByUsername(username, imageId);
        if (!detail) {
            return res.status(404).json({
                isSuccess: false,
                code: 404,
                message: '이미지를 찾을 수 없습니다'
            });
        }
        
        res.json({
            isSuccess: true,
            code: 200,
            message: '갤러리 상세 조회 성공',
            result: {
                username: username,
                imageId: imageId,
                galleryId: detail.galleryId,
                title: detail.title,
                image_url: detail.image_url,
                metadata: detail.metadata
            }
        });
    } catch (err) {
        console.error('갤러리 상세 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 방명록 조회 (username 기반)
async function getGuestbookListByUsername(req, res) {
    const { username } = req.params;
    try {
        const guestbooks = await planetModel.findGuestbookListByUsername(username);
        res.json({
            isSuccess: true,
            code: 200,
            message: '방명록 조회 성공',
            result: {
                username: username,
                guestbooks: guestbooks
            }
        });
    } catch (err) {
        console.error('방명록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 방명록 작성 (username 기반)
async function writeGuestbookByUsername(req, res) {
    const { username } = req.params;
    const authorId = req.user.id;
    const { content } = req.body;
    
    try {
        // 행성 존재 확인
        const planet = await planetModel.findByUsername(username);
        if (!planet) {
            return res.status(404).json({
                isSuccess: false,
                code: 404,
                message: '행성을 찾을 수 없습니다'
            });
        }
        
        await planetModel.addGuestbookByUsername(username, authorId, content);
        res.status(201).json({
            isSuccess: true,
            code: 201,
            message: '방명록 작성 성공',
            result: {
                username: username
            }
        });
    } catch (err) {
        console.error('방명록 작성 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 즐겨찾기 추가 (username 기반)
async function addFavoriteByUsername(req, res) {
    const { username } = req.params;
    const userId = req.user.id;
    
    try {
        // 행성 존재 확인
        const planet = await planetModel.findByUsername(username);
        if (!planet) {
            return res.status(404).json({
                isSuccess: false,
                code: 404,
                message: '행성을 찾을 수 없습니다'
            });
        }
        
        // 자신의 행성 즐겨찾기 방지
        if (planet.owner_id === userId) {
            return res.status(400).json({
                isSuccess: false,
                code: 400,
                message: '자신의 행성은 즐겨찾기에 추가할 수 없습니다'
            });
        }
        
        await planetModel.addFavoriteByUsername(userId, username);
        res.status(201).json({
            isSuccess: true,
            code: 201,
            message: '즐겨찾기 추가 성공',
            result: {
                username: username
            }
        });
    } catch (err) {
        console.error('즐겨찾기 추가 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 내 행성 정보 수정
async function updateMyPlanet(req, res) {
    const userId = req.user.id;
    const { title, profileImage } = req.body;
    
    try {
        // 최소 하나의 필드는 수정되어야 함
        if (!title && !profileImage) {
            return res.status(400).json({
                isSuccess: false,
                code: 400,
                message: '수정할 정보를 입력해주세요'
            });
        }
        
        const updatedPlanet = await planetModel.updateMyPlanet(userId, title, profileImage);
        
        if (!updatedPlanet) {
            return res.status(404).json({
                isSuccess: false,
                code: 404,
                message: '행성을 찾을 수 없습니다'
            });
        }
        
        res.json({
            isSuccess: true,
            code: 200,
            message: '행성 정보 수정 성공',
            result: {
                id: updatedPlanet.id,
                ownerId: updatedPlanet.owner_id,
                username: updatedPlanet.username,
                title: updatedPlanet.title,
                visitCount: updatedPlanet.visit_count,
                createdAt: updatedPlanet.created_at,
                profileImageUrl: updatedPlanet.profile_image_url
            }
        });
    } catch (err) {
        console.error('행성 정보 수정 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 즐겨찾기 삭제 (username 기반)
async function removeFavoriteByUsername(req, res) {
    const { username } = req.params;
    const userId = req.user.id;
    
    try {
        await planetModel.removeFavoriteByUsername(userId, username);
        res.json({
            isSuccess: true, 
            code: 200,
            message: '즐겨찾기 삭제 성공',
            result: {
                username: username
            }
        });
    } catch (err) {
        console.error('즐겨찾기 삭제 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

// 즐겨찾기 목록 조회
async function getFavorites(req, res) {
    const userId = req.user.id;
    
    try {
        const favorites = await planetModel.findFavoritesByUserId(userId);
        res.json({
            isSuccess: true,
            code: 200,
            message: '즐겨찾기 목록 조회 성공',
            result: {
                favorites: favorites
            }
        });
    } catch (err) {
        console.error('즐겨찾기 목록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류',
            error: err.message
        });
    }
}

module.exports = {
    getPlanetList,
    updateMyPlanet,
    getFavorites,
    getPlanetByUsername,
    visitPlanetByUsername,
    getGalleryListByUsername,
    getGalleryDetailByUsername,
    getGuestbookListByUsername,
    writeGuestbookByUsername,
    addFavoriteByUsername,
    removeFavoriteByUsername,
};