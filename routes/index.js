const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const singlePlayerController = require('../controllers/singlePlayerController');
const multiPlayerController = require('../controllers/multiPlayerController');
const friendController = require('../controllers/friendController');
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

// 친구 관련 라우트
// 친구 요청 보내기
router.post('/friends/request', authMiddleware, friendController.sendFriendRequest);
// 친구 요청 수락
router.post('/friends/accept', authMiddleware, friendController.acceptFriendRequest);
// 친구 요청 거절
router.post('/friends/reject', authMiddleware, friendController.rejectFriendRequest);
// 받은 친구 요청 목록 조회
router.get('/friends/received', authMiddleware, friendController.getReceivedFriendRequests);
// 보낸 친구 요청 목록 조회
router.get('/friends/sent', authMiddleware, friendController.getSentFriendRequests);
// 친구 목록 조회
router.get('/friends', authMiddleware, friendController.getFriends);
// 친구 삭제
router.delete('/friends', authMiddleware, friendController.removeFriend);


// 개인플레이 게임 관련 라우트
// 개인플레이 게임 시작
router.post('/games/single/start', authMiddleware, singlePlayerController.startSingleGame);
// 개인플레이 게임 완료
router.post('/games/single/complete', authMiddleware, singlePlayerController.completeSingleGame);
// 개인플레이 완료 후 게임 이미지를 행성에 저장
router.post('/games/single/save-to-planet', authMiddleware, singlePlayerController.saveGameImageToPlanet);

// 멀티플레이 게임 관련 라우트
// 방 생성
router.post('/games/multiplay/rooms/create', authMiddleware, multiPlayerController.createRoom);
// 방 입장
router.post('/games/multiplay/rooms/join', authMiddleware, multiPlayerController.joinRoom);
// 준비 상태 토글
router.post('/games/multiplay/rooms/ready', authMiddleware, multiPlayerController.toggleReady);
// 게임 시작
router.post('/games/multiplay/rooms/start', authMiddleware, multiPlayerController.startGame);
// 게임 완료
router.post('/games/multiplay/rooms/complete', authMiddleware, multiPlayerController.completeGame);
// 멀티플레이 완료 후 게임 이미지를 행성에 저장 (승자만 가능)
router.post('/games/multiplay/save-to-planet', authMiddleware, multiPlayerController.saveGameImageToPlanet);

router.use('/planets', require('./planets'));

module.exports = router;
