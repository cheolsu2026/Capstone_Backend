const gameModel = require('../models/gameModel');
const userModel = require('../models/userModel');
const pollinateService = require('../services/pollinateService');
const s3Service = require('../services/s3Service');
const pool = require('../config/db');

// 멀티플레이 방 생성
async function createRoom(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { tags } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!tags || !Array.isArray(tags) || tags.length !== 4) {
            return res.status(400).json({
                isSuccess: false,
                code: "ROOM400",
                message: "정확히 4개의 태그가 필요합니다"
            });
        }

        // 1. 룸 생성 (멀티플레이용)
        const { roomId, roomCode } = await gameModel.createRoom(userId, 'waiting');

        // 2. 룸 참가자 추가 (호스트)
        await gameModel.addRoomParticipant(roomId, userId, false, true);

        // 3. 게임 생성 (멀티플레이용)
        const gameId = await gameModel.createGame(roomId, userId, 'multi');
        
        // 디버깅 로그 추가
        console.log('=== CREATE ROOM DEBUG ===');
        console.log('roomId:', roomId);
        console.log('gameId:', gameId);
        console.log('userId:', userId);
        console.log('tags:', tags);
        console.log('=== END CREATE DEBUG ===');

        // 4. 태그 처리
        const tagIds = [];
        for (const tagName of tags) {
            const tagId = await gameModel.findOrCreateTag(tagName);
            tagIds.push(tagId);
        }

        // 5. 게임 태그 연결
        await gameModel.connectGameTags(gameId, tagIds, userId);

        // 6. AI 이미지 생성
        const imageResult = await pollinateService.generateImage(tags);
        
        if (!imageResult.success) {
            await connection.rollback();
            return res.status(500).json({
                isSuccess: false,
                code: "ROOM500",
                message: "AI 이미지 생성에 실패했습니다",
                error: imageResult.error
            });
        }

        // 7. S3에 이미지 업로드
        const uploadResult = await s3Service.uploadImage(
            imageResult.imageBuffer, 
            imageResult.contentType
        );

        if (!uploadResult.success) {
            await connection.rollback();
            return res.status(500).json({
                isSuccess: false,
                code: "ROOM500",
                message: "이미지 업로드에 실패했습니다",
                error: uploadResult.error
            });
        }

        // 8. 게임 이미지 정보 저장
        const imageMetadata = {
            tags: tags,
            generatedAt: new Date().toISOString(),
            pollinateApi: true,
            gameMode: 'multi'
        };
        
        await gameModel.saveGameImage(gameId, uploadResult.imageUrl, imageMetadata);

        // 9. 호스트 정보 조회
        const hostInfo = await userModel.findById(userId);

        await connection.commit();

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "ROOM200",
            message: "방 생성 및 이미지 생성 성공",
            result: {
                roomId: roomId,
                gameCode: roomCode,
                hostUsername: hostInfo.username,
                imageUrl: uploadResult.imageUrl,
                tags: tags
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

        // 7. 게임 이미지 정보 조회 (방 ID로 직접 조회)
        const [gameRows] = await pool.query(
            `SELECT g.id as game_id, g.started_at 
             FROM games g 
             WHERE g.room_id = ? AND g.mode = 'multi'`,
            [room.id]
        );
        
        let imageUrl = null;
        let tags = null;

        if (gameRows.length > 0) {
            const gameId = gameRows[0].game_id;
            const gameImage = await gameModel.findGameImage(gameId);
            if (gameImage) {
                imageUrl = gameImage.image_url;
                // 이미지 메타데이터에서 태그 정보 추출
                if (gameImage.metadata) {
                    let metadata;
                    // metadata가 이미 객체인지 문자열인지 확인
                    if (typeof gameImage.metadata === 'string') {
                        metadata = JSON.parse(gameImage.metadata);
                    } else {
                        metadata = gameImage.metadata;
                    }
                    tags = metadata.tags || null;
                }
            }
        }

        // 디버깅 로그 추가
        console.log('=== JOIN ROOM DEBUG ===');
        console.log('room.id:', room.id);
        console.log('gameRows:', gameRows);
        console.log('gameRows.length:', gameRows.length);
        if (gameRows.length > 0) {
            console.log('gameId:', gameRows[0].game_id);
            const gameImage = await gameModel.findGameImage(gameRows[0].game_id);
            console.log('gameImage:', gameImage);
            if (gameImage) {
                console.log('imageUrl:', gameImage.image_url);
                console.log('metadata:', gameImage.metadata);
            }
        }
        console.log('final imageUrl:', imageUrl);
        console.log('final tags:', tags);
        console.log('=== END DEBUG ===');

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
                hostUsername: hostInfo.username,
                imageUrl: imageUrl,
                tags: tags
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

        // 2. 사용자 준비 상태 토글
        const result = await gameModel.toggleUserReady(room.id, userId);

        // 3. 업데이트된 참가자 목록 조회
        const participants = await gameModel.getRoomParticipants(room.id);

        await connection.commit();

        // 웹소켓으로 다른 참가자들에게 알림
        if (global.wsService) {
            await global.wsService.broadcastRoomUpdate(room.id, participants);
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

// 멀티플레이 게임 시작
async function startGame(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { gameCode } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!gameCode) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임 코드가 필요합니다"
            });
        }

        // 1. 게임 코드로 룸 조회
        const room = await gameModel.findRoomByCode(gameCode);
        
        if (!room) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임 코드의 방을 찾을 수 없습니다"
            });
        }

        // 2. 요청한 사용자가 호스트인지 확인
        if (room.host_id !== userId) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임을 시작할 권한이 없습니다 (호스트만 가능)"
            });
        }

        // 3. 참가자 수 확인 (최소 2명)
        const participantCount = await gameModel.getRoomParticipantCount(room.id);
        
        if (participantCount < 2) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임을 시작하려면 최소 2명의 참가자가 필요합니다"
            });
        }

        // 4. 팀장을 제외한 다른 참가자들이 준비 상태인지 확인
        const participants = await gameModel.getRoomParticipants(room.id);
        const notReadyParticipants = participants.filter(p => !p.is_ready && !p.is_host);
        
        if (notReadyParticipants.length > 0) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "팀장을 제외한 모든 참가자가 준비 상태가 아닙니다"
            });
        }

        // 5. 룸 상태를 'playing'으로 변경
        await gameModel.updateRoomStatus(room.id, 'playing');

        // 6. 기존 게임 ID 조회 (방 생성 시 이미 생성됨)
        const existingGame = await gameModel.findRoomAndGame(room.id, userId, 'multi');
        const gameId = existingGame.game_id;

        // 7. 게임 시작 시간 업데이트
        await gameModel.updateGameStartedAt(gameId);

        await connection.commit();

        // 웹소켓으로 다른 참가자들에게 게임 시작 알림
        if (global.wsService) {
            await global.wsService.broadcastGameStart(room.id, {
                gameId: gameId,
                gameCode: room.code,
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isReady: p.is_ready,
                    isHost: p.is_host
                }))
            });
        }

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "GAME200",
            message: "게임 시작 성공",
            result: {
                roomId: room.id,
                gameId: gameId,
                gameCode: room.code,
                gameStatus: "playing",
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isReady: p.is_ready,
                    isHost: p.is_host
                }))
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('게임 시작 오류:', error);
        res.status(500).json({
            isSuccess: false,
            code: "GAME500",
            message: "서버 오류가 발생했습니다",
            error: error.message
        });
    } finally {
        connection.release();
    }
}

// 멀티플레이 게임 완료
async function completeGame(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { gameCode } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!gameCode) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임 코드가 필요합니다"
            });
        }

        // 1. 게임 코드로 룸 조회 (상태 무관)
        const room = await gameModel.findRoomByCodeAnyStatus(gameCode);
        
        if (!room) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임 코드의 방을 찾을 수 없습니다"
            });
        }

        // 2. 게임 상태 확인
        if (room.status !== 'playing') {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임이 진행 중이 아닙니다"
            });
        }

        // 3. 사용자가 해당 방의 참가자인지 확인
        const participants = await gameModel.getRoomParticipants(room.id);
        const userParticipant = participants.find(p => p.user_id === userId);
        
        if (!userParticipant) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "해당 방의 참가자가 아닙니다"
            });
        }

        // 4. 게임 정보 조회
        const gameInfo = await gameModel.findRoomAndGame(room.id, room.host_id, 'multi');
        
        if (!gameInfo || !gameInfo.game_id) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "게임 정보를 찾을 수 없습니다"
            });
        }

        // 5. 클리어 시간 계산 (게임 시작 시각과 현재 시각의 차이)
        const gameStartTime = new Date(gameInfo.started_at).getTime();
        const currentTime = Date.now();
        const clearTimeMs = currentTime - gameStartTime;

        // 6. 게임 이미지 조회
        const gameImage = await gameModel.findGameImage(gameInfo.game_id);
        if (!gameImage) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "게임 이미지를 찾을 수 없습니다"
            });
        }

        // 7. 이미 게임이 완료되었는지 확인
        const existingCompletion = await gameModel.findGameCompletion(gameInfo.game_id);
        
        if (existingCompletion) {
            // 이미 완료된 게임
            const winnerInfo = await userModel.findById(existingCompletion.user_id);
            
            await connection.commit();
            
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임이 이미 완료되었습니다",
                result: {
                    gameId: gameInfo.game_id,
                    gameCode: room.code,
                    isWinner: false,
                    clearTimeMs: clearTimeMs,
                    totalParticipants: participants.length,
                    gameStatus: "completed",
                    winner: {
                        userId: existingCompletion.user_id,
                        username: winnerInfo.username,
                        clearTimeMs: existingCompletion.clear_time_ms
                    },
                    participants: participants.map(p => ({
                        userId: p.user_id,
                        username: p.username,
                        isWinner: p.user_id === existingCompletion.user_id,
                        clearTimeMs: p.user_id === existingCompletion.user_id ? existingCompletion.clear_time_ms : null
                    })),
                    isAlreadyCompleted: true
                }
            });
        }

        // 8. 게임 완료 기록 저장 (승자)
        await gameModel.saveGameCompletion(gameInfo.game_id, userId, gameImage.id, clearTimeMs);

        // 9. 게임 완료 시간 업데이트
        await gameModel.updateGameFinishedAt(gameInfo.game_id);

        // 10. 룸 상태를 'completed'로 변경
        await gameModel.updateRoomStatus(room.id, 'completed');

        // 11. 승자 정보 조회
        const winnerInfo = await userModel.findById(userId);

        await connection.commit();

        // 웹소켓으로 다른 참가자들에게 게임 완료 알림
        if (global.wsService) {
            await global.wsService.broadcastGameComplete(room.id, {
                gameId: gameInfo.game_id,
                gameCode: room.code,
                winner: {
                    userId: userId,
                    username: winnerInfo.username,
                    clearTimeMs: clearTimeMs
                },
                gameStatus: "completed"
            });
        }

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "GAME200",
            message: "게임 완료 성공 - 승리!",
            result: {
                gameId: gameInfo.game_id,
                gameCode: room.code,
                isWinner: true,
                clearTimeMs: clearTimeMs,
                totalParticipants: participants.length,
                gameStatus: "completed",
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isWinner: p.user_id === userId,
                    clearTimeMs: p.user_id === userId ? clearTimeMs : null
                }))
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('게임 완료 오류:', error);
        res.status(500).json({
            isSuccess: false,
            code: "GAME500",
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
    toggleReady,
    startGame,
    completeGame
};
