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

// 행성 상세 정보 조회
async function getPlanetDetail(req, res) {
    const { planetId } = req.params;
    try {
        const planet = await planetModel.findById(planetId);
        if (!planet) return res.status(404).json({ 
            code: 404, 
            message: '행성을 찾을 수 없음' 
        });
        res.json({ 
            isSuccess: true, 
            code: 200, 
            message: '행성 상세 조회 성공', 
            result: {
                id: planet.id,
                owner_id: planet.owner_id, // 이걸 userId랑 비교해야 됨!!
                title: planet.title,
                visit_count: planet.visit_count
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

// 행성 방문 추가
async function visitPlanet(req, res) {
    const { planetId } = req.params;
    const visitorId = req.user.id;
    try {
        if (planet.owner_id === req.user.id){
            return res.status(400).json({ message: '자신의 행성은 방문 불가 = 방문 수 추가 안 됨' });
        }
        await planetModel.addVisit(visitorId, planetId);
        res.json({
            isSuccess: true,
            code: 201,
            message: '행성 방문 성공'
        });
    } catch (err) {
        console.error('행성 방문 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 갤러리 목록 조회
async function getGalleryList(req, res) {
    const { planetId } = req.params;
    try {
        const galleries = await planetModel.findGalleryList(planetId);
        res.json({
            isSuccess: true,
            code: 200,
            message: '갤러리 목록 조회 성공',
            result: galleries
        });
    } catch (err) {
        console.error('갤러리 목록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 갤러리 상세 조회
async function getGalleryDetail(req, res) {
    const { planetId, imageId } = req.params;
    try {
        const detail = await planetModel.findGalleryDetail(planetId, imageId);
        if (!detail) return res.status(404).json({
            code: 404,
            message: '이미지를 찾을 수 없음'
        });
        res.json({
            isSuccess: true,
            code: 200,
            message: '갤러리 상세 조회 성공',
            result: detail
        });
    } catch (err) {
        console.error('갤러리 상세 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 방명록 조회
async function getGuestbookList(req, res) {
    const { planetId } = req.params;
    try {
        const guestbooks = await planetModel.findGuestbookList(planetId);
        res.json({
            isSuccess: true,
            code: 200,
            message: '방명록 조회 성공',
            result: guestbooks
        });
    } catch (err) {
        console.error('방명록 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 방명록 작성
async function writeGuestbook(req, res) {
    const { planetId } = req.params;
    const authorId = req.user.id;
    const { content } = req.body;
    try {
        await planetModel.addGuestbook(planetId, authorId, content);
        res.status(201).json({
            isSuccess: true,
            code: 201,
            message: '방명록 작성 성공'
        });
    } catch (err) {
        console.error('방명록 작성 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 즐겨찾기 추가
async function addFavorite(req, res) {
    const { planetId } = req.params;
    const userId = req.user.id;
    try {
        await planetModel.addFavorite(userId, planetId);
        res.status(201).json({
            isSuccess: true,
            code: 201,
            message: '즐겨찾기 추가 성공'
        });
    } catch (err) {
        console.error('즐겨찾기 추가 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 즐겨찾기 삭제
async function removeFavorite(req, res) {
    const { planetId } = req.params;
    const userId = req.user.id;
    try {
        await planetModel.removeFavorite(userId, planetId);
        res.json({
            isSuccess: true, 
            code: 200,
            message: '즐겨찾기 삭제 성공'
        });
    } catch (err) {
        console.error('즐겨찾기 삭제 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

// 즐겨찾기 조회
async function getFavorites(req, res) {
    const userId = req.user.id;
    try {
        const favorites = await planetModel.findFavorites(userId);
        res.json({
            isSuccess: true,
            code: 200,
            message: '즐겨찾기 조회 성공',
            result: favorites
        });
    } catch (err) {
        console.error('즐겨찾기 조회 오류: ', err);
        res.status(500).json({
            isSuccess: false,
            code: 500,
            message: '서버 오류'
        });
    }
}

module.exports = {
    getPlanetList,
    getPlanetDetail,
    visitPlanet,
    getGalleryList,
    getGalleryDetail,
    getGuestbookList,
    writeGuestbook,
    addFavorite,
    removeFavorite,
    getFavorites,
};