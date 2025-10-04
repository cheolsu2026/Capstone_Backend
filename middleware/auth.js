const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// JWT 토큰 검증 미들웨어
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token || !authHeader) {
        return res.status(401).json({
            isSuccess: false,
            code: "AUTH401",
            message: "토큰이 필요합니다"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                isSuccess: false,
                code: "AUTH403",
                message: "유효하지 않은 토큰입니다"
            });
        }
        req.user = user;
        next();
    });
}

module.exports = {
    authMiddleware
};
