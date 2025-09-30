const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

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
// (본인) 프로필 조회
router.get('/user/profile', authMiddleware, userController.getProfile);
// 닉네임 변경
router.put('/users/nickname', authMiddleware, userController.changeNickname);
// 비밀번호 변경
router.put('/users/password', authMiddleware, userController.changePassword);

module.exports = router;