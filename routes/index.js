const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const singlePlayerController = require('../controllers/singlePlayerController');
const multiPlayerController = require('../controllers/multiPlayerController');
const gameController = require('../controllers/gameController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => {
    res.json({ message: '라우트 작동 중'});
});

/*router.post('/login', (req, res) => {
    res.json({ message: '테스트용 로그인 성공'});
})*/

// 아이디 중복 확인
router.get('/users/check-username', userController.checkUsername);
// 회원 가입
router.post('/users/signup', userController.signup);
// 로그인
router.post('/users/login', userController.login);
// (본인) 프로필 조회
router.get('/users/profile', authMiddleware, userController.getProfile);
// 닉네임 변경
router.put('/users/nickname', authMiddleware, userController.changeNickname);
// 비밀번호 변경
router.put('/users/password', authMiddleware, userController.changePassword);


// 개인플레이 게임 관련 라우트
// 개인플레이 게임 시작
router.post('/games/single/start', authMiddleware, singlePlayerController.startSingleGame);
// 개인플레이 게임 완료
router.post('/games/single/complete', authMiddleware, singlePlayerController.completeSingleGame);

// 멀티플레이 게임 관련 라우트
// 방 생성
router.post('/games/multiply/rooms/create', authMiddleware, multiPlayerController.createRoom);
// 방 입장
router.post('/games/multiply/rooms/join', authMiddleware, multiPlayerController.joinRoom);
// 준비 상태 토글
router.post('/games/multiply/rooms/ready', authMiddleware, multiPlayerController.toggleReady);
// 게임 시작
router.post('/games/multiply/rooms/start', authMiddleware, multiPlayerController.startGame);
// 게임 완료
router.post('/games/multiply/rooms/complete', authMiddleware, multiPlayerController.completeGame);

router.use('/planets', require('./planets'));

module.exports = router;