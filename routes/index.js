const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const gameController = require('../controllers/gameController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => {
    res.json({ message: '라우트 작동 중'});
});

router.post('/login', (req, res) => {
    res.json({ message: '테스트용 로그인 성공'});
})

// 아이디 중복 확인
router.get('/users/check-username', userController.checkUsername);
// 회원 가입
router.post('/users/signup', userController.signup);
// 로그인
router.post('/users/login', userController.login);


// 게임 관련 라우트
// 단일 플레이 게임 시작
router.post('/games/single/start', authMiddleware, gameController.startSingleGame);
// 단일 플레이 게임 완료
router.post('/games/single/complete', authMiddleware, gameController.completeSingleGame);


module.exports = router;