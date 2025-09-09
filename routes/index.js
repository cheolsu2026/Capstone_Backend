const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', (req, res) => {
    res.json({ message: '라우트 작동 중'});
});

router.post('\login', (req, res) => {
    res.json({ message: '테스트용 로그인 성공'});
})

module.exports = router;