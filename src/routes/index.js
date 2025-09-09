const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: '라우트 확인'});
});

module.exports = router;