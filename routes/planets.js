const express = require('express');
const router = express.Router();
const planetController = require('../controllers/planetController');
// const authMiddleware = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth');

// 행성 목록 조회 - 기본: 알파벳 순서로 전체 나열
router.get('/', planetController.getPlanetList);
// 행성 상세 정보 조회
router.get('/:planetId', planetController.getPlanetDetail);
// 행성 방문 추가
router.post('/:planetId/visit', authMiddleware, planetController.visitPlanet);
// 갤러리 목록 조회
router.get('/:planetId/gallery', planetController.getGalleryList);
// 갤러리 상세 조회
router.get('/:planetId/gallery/:imageId', planetController.getGalleryDetail);
// 방명록 조회
router.get('/:planetId/guestbook', planetController.getGuestbookList);
// 방명록 작성
router.post('/:planetId/guestbook', authMiddleware, planetController.writeGuestbook);
// 즐겨찾기 추가
router.post('/:planetId/favorite', authMiddleware, planetController.addFavorite);
// 즐겨찾기 삭제
router.delete('/:planetId/favorite', authMiddleware, planetController.removeFavorite);
// 즐겨찾기 조회
router.get('/favorites/me', authMiddleware, planetController.getFavorites);

module.exports = router;