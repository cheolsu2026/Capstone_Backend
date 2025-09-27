// 용도: 라우트 핸들러

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { use } = require('react');

const JWT_SECRET = "process.env.JWT_SECRET";    // 알아내서 .env 수정해야 됨.

// 아이디 중복 확인
async function checkUsername(req, res) {
    const { username } = req.query;
    const user = await userModel.findByUsername(username);
    res.json({ available: !user });
}

// 회원 가입
async function signup(req, res) {
    const { username, password, nickname } = req.body;
    try {
        const existing = await userModel.findByUsername(username);
        if (existing) {
            return res.status(400).json({ 에러: '사용 중인 아이디' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = await userModel.createUser(username, passwordHash, nickname);
        res.status(201).json({ 성공: true, userId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 에러: '서버 오류' });
    }    
}

// 로그인
async function login(req, res) {
    const { username, password } = req.body;
    try {
        const user = await userModel.findByUsername(username);
        if (!user) {
            return res.status(400).json({ 에러: '아이디 또는 비밀번호가 잘못됨'});
        }
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(400).json({ 에러: '아이디 또는 비밀번호가 잘못됨'});
        }
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h'}
        );
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 에러: '서버 오류'});
    }
}

module.exports = {
    checkUsername,
    signup,
    login,
};