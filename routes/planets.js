const express = require('express');
const router = express.Router();
const planetController = require('../controllers/planetController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// 행성 목록 조회 - 기본: 알파벳 순서로 전체 나열
router.get('/', planetController.getPlanetList);
// 내 행성 정보 수정
router.put('/me', authMiddleware, planetController.updateMyPlanet);
// 내 즐겨찾기 목록 조회
router.get('/favorites/me', authMiddleware, planetController.getFavorites);
// 행성 상세 정보 조회 - 인증 선택적
router.get('/:username', optionalAuthMiddleware, planetController.getPlanetByUsername);
// 행성 방문 추가 
router.post('/:username/visit', authMiddleware, planetController.visitPlanetByUsername);
// 갤러리 목록 조회 
router.get('/:username/gallery', planetController.getGalleryListByUsername);
// 갤러리 상세 조회 
router.get('/:username/gallery/:imageId', planetController.getGalleryDetailByUsername);
// 방명록 조회 
router.get('/:username/guestbook', planetController.getGuestbookListByUsername);
// 방명록 작성 
router.post('/:username/guestbook', authMiddleware, planetController.writeGuestbookByUsername);
// 즐겨찾기 추가 
router.post('/:username/favorite', authMiddleware, planetController.addFavoriteByUsername);
// 즐겨찾기 삭제 
router.delete('/:username/favorite', authMiddleware, planetController.removeFavoriteByUsername);

module.exports = router;