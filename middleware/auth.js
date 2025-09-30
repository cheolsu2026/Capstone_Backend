const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'secret';

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: '토큰 없음' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '토큰 없음' });
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;     // {id, username}임!!
        next();
    } catch (err) {
        return res.status(403).json({ error: '토큰이 유효하지 않음' });
    }
}

module.exports = authMiddleware;