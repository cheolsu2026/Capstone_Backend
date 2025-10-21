const friendModel = require('../models/friendModel');

// 친구 요청 보내기
async function sendFriendRequest(req, res) {
    try {
        const requesterId = req.user.id;
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ 
                error: '사용자명이 필요합니다' 
            });
        }
        
        const result = await friendModel.createFriendRequest(requesterId, username);
        
        res.status(201).json({
            success: true,
            message: `${username}에게 친구 요청을 보냈습니다`,
            requestId: result.requestId
        });
        
    } catch (error) {
        console.error('친구 요청 오류:', error);
        
        switch (error.message) {
            case 'USER_NOT_FOUND':
                return res.status(404).json({ 
                    error: '해당 사용자를 찾을 수 없습니다' 
                });
            case 'CANNOT_REQUEST_SELF':
                return res.status(400).json({ 
                    error: '자기 자신에게 친구 요청을 보낼 수 없습니다' 
                });
            case 'ALREADY_FRIENDS':
                return res.status(400).json({ 
                    error: '이미 친구입니다' 
                });
            case 'REQUEST_ALREADY_SENT':
                return res.status(400).json({ 
                    error: '이미 친구 요청을 보냈습니다' 
                });
            case 'REVERSE_REQUEST_EXISTS':
                return res.status(400).json({ 
                    error: '상대방이 이미 친구 요청을 보냈습니다. 받은 요청을 확인해주세요' 
                });
            default:
                return res.status(500).json({ 
                    error: '서버 오류가 발생했습니다' 
                });
        }
    }
}

// 친구 요청 수락
async function acceptFriendRequest(req, res) {
    try {
        const userId = req.user.id;
        const { requestId } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ 
                error: '요청 ID가 필요합니다' 
            });
        }
        
        await friendModel.acceptFriendRequest(requestId, userId);
        
        res.json({
            success: true,
            message: '친구 요청을 수락했습니다'
        });
        
    } catch (error) {
        console.error('친구 요청 수락 오류:', error);
        
        switch (error.message) {
            case 'REQUEST_NOT_FOUND':
                return res.status(404).json({ 
                    error: '친구 요청을 찾을 수 없습니다' 
                });
            default:
                return res.status(500).json({ 
                    error: '서버 오류가 발생했습니다' 
                });
        }
    }
}

// 친구 요청 거절
async function rejectFriendRequest(req, res) {
    try {
        const userId = req.user.id;
        const { requestId } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ 
                error: '요청 ID가 필요합니다' 
            });
        }
        
        await friendModel.rejectFriendRequest(requestId, userId);
        
        res.json({
            success: true,
            message: '친구 요청을 거절했습니다'
        });
        
    } catch (error) {
        console.error('친구 요청 거절 오류:', error);
        
        switch (error.message) {
            case 'REQUEST_NOT_FOUND':
                return res.status(404).json({ 
                    error: '친구 요청을 찾을 수 없습니다' 
                });
            default:
                return res.status(500).json({ 
                    error: '서버 오류가 발생했습니다' 
                });
        }
    }
}

// 받은 친구 요청 목록 조회
async function getReceivedFriendRequests(req, res) {
    try {
        const userId = req.user.id;
        const requests = await friendModel.getReceivedFriendRequests(userId);
        
        res.json({
            success: true,
            requests: requests
        });
        
    } catch (error) {
        console.error('받은 친구 요청 조회 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다' 
        });
    }
}

// 보낸 친구 요청 목록 조회
async function getSentFriendRequests(req, res) {
    try {
        const userId = req.user.id;
        const requests = await friendModel.getSentFriendRequests(userId);
        
        res.json({
            success: true,
            requests: requests
        });
        
    } catch (error) {
        console.error('보낸 친구 요청 조회 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다' 
        });
    }
}

// 친구 목록 조회
async function getFriends(req, res) {
    try {
        const userId = req.user.id;
        const friends = await friendModel.getFriends(userId);
        
        res.json({
            success: true,
            friends: friends
        });
        
    } catch (error) {
        console.error('친구 목록 조회 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다' 
        });
    }
}

// 친구 삭제 (username으로)
async function removeFriend(req, res) {
    try {
        const userId = req.user.id;
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ 
                error: '사용자명이 필요합니다' 
            });
        }
        
        const success = await friendModel.removeFriendByUsername(userId, username);
        
        if (!success) {
            return res.status(404).json({ 
                error: '친구 관계를 찾을 수 없습니다' 
            });
        }
        
        res.json({
            success: true,
            message: `${username}을(를) 친구에서 삭제했습니다`
        });
        
    } catch (error) {
        console.error('친구 삭제 오류:', error);
        
        switch (error.message) {
            case 'USER_NOT_FOUND':
                return res.status(404).json({ 
                    error: '해당 사용자를 찾을 수 없습니다' 
                });
            default:
                return res.status(500).json({ 
                    error: '서버 오류가 발생했습니다' 
                });
        }
    }
}

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getReceivedFriendRequests,
    getSentFriendRequests,
    getFriends,
    removeFriend
};
