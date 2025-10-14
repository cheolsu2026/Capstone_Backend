const gameModel = require('../models/gameModel');
const userModel = require('../models/userModel');
const pool = require('../config/db');

// 멀티플레이 방 생성
async function createRoom(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 1. 룸 생성 (멀티플레이용)
        const { roomId, roomCode } = await gameModel.createRoom(userId, 'waiting');

        // 2. 룸 참가자 추가 (호스트)
        await gameModel.addRoomParticipant(roomId, userId, false, true);

        // 3. 호스트 정보 조회
        const hostInfo = await userModel.findById(userId);

        await connection.commit();

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "ROOM200",
            message: "방 생성 성공",
            result: {
                roomId: roomId,
                gameCode: roomCode,
                hostUsername: hostInfo.username
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('방 생성 오류:', error);
        res.status(500).json({
            isSuccess: false,
            code: "ROOM500",
            message: "서버 오류가 발생했습니다",
            error: error.message
        });
    } finally {
        connection.release();
    }
}

// 멀티플레이 방 입장
async function joinRoom(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { gameCode } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!gameCode) {
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: "게임 코드가 필요합니다"
            });
        }

        // 1. 게임 코드로 룸 조회
        const room = await gameModel.findRoomByCode(gameCode);
        
        if (!room) {
            return res.status(404).json({
                isSuccess: false,
                code: "ROOM404",
                message: "해당 게임 코드의 방을 찾을 수 없습니다"
            });
        }

        // 2. 사용자가 이미 룸에 참가했는지 확인
        const isAlreadyInRoom = await gameModel.isUserInRoom(room.id, userId);
        
        if (isAlreadyInRoom) {
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: "이미 해당 방에 참가되어 있습니다"
            });
        }

        // 3. 룸 참가자 수 확인 (최대 2명)
        const participantCount = await gameModel.getRoomParticipantCount(room.id);
        
        if (participantCount >= 2) { // ⭐ 만약 인원 제한을 늘리고 싶다면? 2를 원하는 숫자로 수정정
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: "방이 가득 찼습니다"
            });
        }

        // 4. 룸 참가자 추가
        await gameModel.addRoomParticipant(room.id, userId, false, false);

        // 5. 참가자 목록 조회
        const participants = await gameModel.getRoomParticipants(room.id);

        // 6. 호스트 정보 조회
        const hostInfo = await userModel.findById(room.host_id);

        await connection.commit();

        // 웹소켓으로 다른 참가자들에게 알림
        if (global.wsService) {
            await global.wsService.broadcastRoomUpdate(room.id, participants);
        }

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "ROOM200",
            message: "방 입장 성공",
            result: {
                roomId: room.id,
                gameCode: room.code,
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isReady: p.is_ready
                })),
                hostUsername: hostInfo.username
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('방 입장 오류:', error);
        res.status(500).json({
            isSuccess: false,
            code: "ROOM500",
            message: "서버 오류가 발생했습니다",
            error: error.message
        });
    } finally {
        connection.release();
    }
}

// 멀티플레이 준비 상태 토글
async function toggleReady(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { roomId } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!roomId) {
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: "roomId가 필요합니다"
            });
        }

        // 1. 사용자 준비 상태 토글
        const result = await gameModel.toggleUserReady(roomId, userId);

        // 2. 업데이트된 참가자 목록 조회
        const participants = await gameModel.getRoomParticipants(roomId);

        await connection.commit();

        // 웹소켓으로 다른 참가자들에게 알림
        if (global.wsService) {
            await global.wsService.broadcastRoomUpdate(roomId, participants);
        }

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "ROOM200",
            message: result.isReady ? "준비 완료" : "준비 취소",
            result: {
                isReady: result.isReady,
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isReady: p.is_ready
                }))
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('준비 상태 토글 오류:', error);
        
        if (error.message.includes('참가하지 않았습니다')) {
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: error.message
            });
        }
        
        res.status(500).json({
            isSuccess: false,
            code: "ROOM500",
            message: "서버 오류가 발생했습니다",
            error: error.message
        });
    } finally {
        connection.release();
    }
}

module.exports = {
    createRoom,
    joinRoom,
    toggleReady
};
