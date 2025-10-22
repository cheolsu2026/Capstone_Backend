const pollinateService = require('../services/pollinateService');
const s3Service = require('../services/s3Service');
const gameModel = require('../models/gameModel');
const planetModel = require('../models/planetModel');
const pool = require('../config/db');

// 단일 플레이 게임 시작
async function startSingleGame(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { tags } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!tags || !Array.isArray(tags) || tags.length !== 4) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "정확히 4개의 태그가 필요합니다"
            });
        }

        // 1. 룸 생성 (단일 플레이용)
        const { roomId, roomCode } = await gameModel.createRoom(userId, 'playing');

        // 2. 룸 참가자 추가 (호스트)
        await gameModel.addRoomParticipant(roomId, userId, true, true);

        // 3. 게임 생성
        const gameId = await gameModel.createGame(roomId, userId, 'single');

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
                code: "GAME500",
                message: "이미지 생성에 실패했습니다",
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
                code: "GAME500",
                message: "이미지 업로드에 실패했습니다",
                error: uploadResult.error
            });
        }

        // 8. 게임 이미지 정보 저장
        const imageMetadata = {
            tags: tags,
            generatedAt: new Date().toISOString(),
            pollinateApi: true
        };
        
        await gameModel.saveGameImage(gameId, uploadResult.imageUrl, imageMetadata);

        await connection.commit();

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "GAME200",
            message: "AI 이미지 생성 성공",
            result: {
                roomId: roomId,
                gameCode: roomCode,
                imageUrl: uploadResult.imageUrl
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('단일 플레이 게임 시작 오류:', error);
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

// 단일 플레이 게임 완료
async function completeSingleGame(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { gameCode, startTime, endTime } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!gameCode || !startTime || !endTime) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "gameCode, startTime, endTime이 모두 필요합니다"
            });
        }

        // 시작 시간과 종료 시간 유효성 검증
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "유효하지 않은 시간 형식입니다"
            });
        }

        if (end <= start) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "종료 시간은 시작 시간보다 늦어야 합니다"
            });
        }

        // 게임 시간 계산 (밀리초)
        const clearTimeMs = end.getTime() - start.getTime();

        // 1. 게임 코드로 룸과 게임 존재 확인
        const room = await gameModel.findRoomAndGameByCode(gameCode, userId, 'single');

        if (!room) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임 코드를 찾을 수 없습니다"
            });
        }
        
        if (!room.game_id) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임을 찾을 수 없습니다"
            });
        }

        if (room.status !== 'playing') {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "게임이 진행 중이 아닙니다"
            });
        }

        // 2. 게임 이미지 조회
        const image = await gameModel.findGameImage(room.game_id);

        if (!image) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "게임 이미지를 찾을 수 없습니다"
            });
        }

        // 3. 게임 완료 기록 저장
        await gameModel.saveGameCompletion(room.game_id, userId, image.id, clearTimeMs);

        // 4. 게임 테이블 업데이트 (finished_at)
        await gameModel.updateGameFinishedAt(room.game_id);

        // 5. 룸 상태 업데이트
        await gameModel.updateRoomStatus(room.id, 'finished');

        await connection.commit();

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "GAME200",
            message: "클리어 기록 저장 성공",
            result: {
                gameId: room.game_id,
                gameCode: room.code,
                clearTimeMs: clearTimeMs,
                imageUrl: image.image_url,
                gameStatus: "completed"
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('단일 플레이 게임 완료 오류:', error);
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

// 개인플레이 완료 후 게임 이미지를 행성에 저장
async function saveGameImageToPlanet(req, res) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { gameCode, title } = req.body;
        const userId = req.user.id; // JWT에서 추출한 사용자 ID

        // 입력 검증
        if (!gameCode) {
            return res.status(400).json({
                isSuccess: false,
                code: "GAME400",
                message: "gameCode가 필요합니다"
            });
        }

        // 1. 게임 코드로 룸과 게임 존재 확인
        const room = await gameModel.findRoomAndGameByCode(gameCode, userId, 'single');

        if (!room) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임 코드를 찾을 수 없습니다"
            });
        }
        
        if (!room.game_id) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "해당 게임을 찾을 수 없습니다"
            });
        }

        // 2. 사용자의 행성 조회
        const planet = await planetModel.findByOwnerId(userId);
        
        if (!planet) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "사용자의 행성을 찾을 수 없습니다"
            });
        }

        // 3. 게임 이미지 조회
        const image = await gameModel.findGameImage(room.game_id);

        if (!image) {
            return res.status(404).json({
                isSuccess: false,
                code: "GAME404",
                message: "게임 이미지를 찾을 수 없습니다"
            });
        }

        // 4. 갤러리에 이미지 저장
        const galleryTitle = title || `게임 이미지 ${new Date().toLocaleDateString()}`;
        await planetModel.saveGameImageToGallery(planet.id, image.id, galleryTitle);

        await connection.commit();

        // 성공 응답
        res.json({
            isSuccess: true,
            code: "GAME200",
            message: "게임 이미지가 행성에 저장되었습니다",
            result: {
                planetId: planet.id,
                imageUrl: image.image_url,
                galleryTitle: galleryTitle
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('게임 이미지 행성 저장 오류:', error);
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
    startSingleGame,
    completeSingleGame,
    saveGameImageToPlanet
};
