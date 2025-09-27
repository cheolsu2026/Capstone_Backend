const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

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

module.exports = router;