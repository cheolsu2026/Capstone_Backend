const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const planetModel = require('../models/planetModel');

const JWT_SECRET = process.env.JWT_SECRET;

// 아이디 중복 확인
async function checkUsername(req, res) {
    const { username } = req.query;
    const user = await userModel.findByUsername(username);
    res.json({ available: !user });
}

// 회원 가입
async function signup(req, res) {
    const { username, password, nickname } = req.body;
    let conn;
    try {
        const existing = await userModel.findByUsername(username);
        if (existing) {
            return res.status(400).json({ 에러: '사용 중인 아이디' });
        }
        const passwordHash = await bcrypt.hash(password, 10);

        const conn = await userModel.getConnection();
        await conn.beginTransaction();
        const userId = await userModel.createUserWithConnection(conn, username, passwordHash, nickname);
        
        const planetTitle = `${nickname}의 행성`;
        await planetModel.createPlanetWithConnection(conn, userId, planetTitle);

        await conn.commit();
        conn.release();

        res.status(201).json({
            isSuccess: true,
            userId: userId,
            message: '회원가입 & 행성 생성 성공',
        });
    } catch (err) {
        console.error('회원가입 오류: ', err);
        if (conn) {
            try {
                await conn.rollback();
                conn.release();
            } catch (rollbackErr) {
                console.error('롤백 오류: ', rollbackErr);
            }
        }
        res.status(500).json({ error: '서버 오류' });
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

        const planet = await userModel.findPlanetByUserId(user.id);
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h'}
        );

        res.json({ 
            token, 
            userId: user.id,
            planetId: planet ? planet.id : null,
            nickname: user.nickname
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 에러: '서버 오류'});
    }
}

// (본인) 프로필 조회
async function getProfile(req, res) {
    try {
        const userId = req.user.id;
        const user = await userModel.findById(userId);
        if(!user) {
            return res.status(404).json({ error: '유저를 찾을 수 없음' });
        }
        res.json(user);
    } catch (err) {
        console.error('프로필 조회 오류: ', err);
        res.status(500).json({ error: '서버 오류' });
    }
}

// 닉네임 변경
async function changeNickname(req, res) {
    try {
        const userId = req.user.id;
        const { nickname } = req.body;
        const success = await userModel.updateNickname(userId, nickname);
        if (!success) {
            return res.status(400).json({ error: '닉네임 변경 실패' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('닉네임 변경 오류: ', err);
        res.status(500).json({ error: '서버 오류' });
    }
}

// 비밀번호 변경
async function changePassword(req, res) {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;
        const user = await userModel.findById(userId);

        console.log("=== 비밀번호 변경 디버그 ===");
        console.log("oldPassword:", oldPassword);
        console.log("user.password_hash:", user.password_hash);
        console.log("===========================");

        const match = await bcrypt.compare(oldPassword, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: '기존 비밀번호가 틀림' });
        }
        const newHash = await bcrypt.hash(newPassword, 10);
        const success = await userModel.updatePassword(userId, newHash);
        if (!success) {
            return res.status(400).json({ error: '비밀번호 변경 실패' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('비밀번호 변경 오류: ', err);
        res.status(500).json({ error: '서버 오류' });
    }
}

module.exports = {
    checkUsername,
    signup,
    login,
    getProfile,
    changeNickname,
    changePassword
};