const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const gameModel = require('../models/gameModel');

class WebSocketService {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.roomConnections = new Map(); // roomId -> Set of socketIds
        this.userSockets = new Map(); // userId -> socketId
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log('클라이언트 연결됨:', socket.id);

            // 인증 처리
            socket.on('authenticate', async (data) => {
                try {
                    const { token } = data;
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    
                    socket.userId = decoded.id;
                    socket.username = decoded.username;
                    this.userSockets.set(decoded.id, socket.id);
                    
                    socket.emit('authenticated', { 
                        success: true, 
                        userId: decoded.id,
                        username: decoded.username 
                    });
                    
                    console.log(`사용자 인증됨: ${decoded.username} (${socket.id})`);
                } catch (error) {
                    socket.emit('authenticated', { success: false, error: '인증 실패' });
                    console.error('인증 오류:', error);
                }
            });

            // 방 입장
            socket.on('join_room', async (data) => {
                try {
                    const { roomId } = data;
                    
                    if (!socket.userId) {
                        socket.emit('error', { message: '인증이 필요합니다' });
                        return;
                    }

                    // 방 존재 확인
                    const participants = await gameModel.getRoomParticipants(roomId);
                    if (participants.length === 0) {
                        socket.emit('error', { message: '방을 찾을 수 없습니다' });
                        return;
                    }

                    // 사용자가 방에 참가했는지 확인
                    const isInRoom = participants.some(p => p.user_id === socket.userId);
                    if (!isInRoom) {
                        socket.emit('error', { message: '방에 참가하지 않았습니다' });
                        return;
                    }

                    // 소켓을 방에 추가
                    socket.join(roomId);
                    
                    if (!this.roomConnections.has(roomId)) {
                        this.roomConnections.set(roomId, new Set());
                    }
                    this.roomConnections.get(roomId).add(socket.id);

                    socket.emit('room_joined', { roomId, success: true });
                    
                    // 방의 다른 참가자들에게 새 참가자 알림
                    socket.to(roomId).emit('user_joined', {
                        userId: socket.userId,
                        username: socket.username,
                        participants: participants.map(p => ({
                            userId: p.user_id,
                            username: p.username,
                            isReady: p.is_ready
                        }))
                    });

                    console.log(`사용자 ${socket.username}이 방 ${roomId}에 입장했습니다`);
                } catch (error) {
                    socket.emit('error', { message: '방 입장 중 오류가 발생했습니다' });
                    console.error('방 입장 오류:', error);
                }
            });

            // 방 퇴장
            socket.on('leave_room', async (data) => {
                try {
                    const { roomId } = data;
                    
                    socket.leave(roomId);
                    
                    if (this.roomConnections.has(roomId)) {
                        this.roomConnections.get(roomId).delete(socket.id);
                        if (this.roomConnections.get(roomId).size === 0) {
                            this.roomConnections.delete(roomId);
                        }
                    }

                    // 방의 다른 참가자들에게 퇴장 알림
                    socket.to(roomId).emit('user_left', {
                        userId: socket.userId,
                        username: socket.username
                    });

                    console.log(`사용자 ${socket.username}이 방 ${roomId}에서 퇴장했습니다`);
                } catch (error) {
                    console.error('방 퇴장 오류:', error);
                }
            });

            // 연결 해제 처리
            socket.on('disconnect', () => {
                console.log('클라이언트 연결 해제됨:', socket.id);
                
                if (socket.userId) {
                    this.userSockets.delete(socket.userId);
                }
                
                // 모든 방에서 제거
                for (const [roomId, connections] of this.roomConnections.entries()) {
                    if (connections.has(socket.id)) {
                        connections.delete(socket.id);
                        
                        // 방의 다른 참가자들에게 연결 해제 알림
                        socket.to(roomId).emit('user_disconnected', {
                            userId: socket.userId,
                            username: socket.username
                        });
                        
                        if (connections.size === 0) {
                            this.roomConnections.delete(roomId);
                        }
                    }
                }
            });
        });
    }

    // 방 업데이트 브로드캐스트
    async broadcastRoomUpdate(roomId, participants) {
        const roomSockets = this.roomConnections.get(roomId);
        if (roomSockets && roomSockets.size > 0) {
            this.io.to(roomId).emit('room_updated', {
                participants: participants.map(p => ({
                    userId: p.user_id,
                    username: p.username,
                    isReady: p.is_ready
                }))
            });
        }
    }

    // 게임 시작 브로드캐스트
    async broadcastGameStart(roomId, gameData) {
        const roomSockets = this.roomConnections.get(roomId);
        if (roomSockets && roomSockets.size > 0) {
            this.io.to(roomId).emit('game_started', {
                gameId: gameData.gameId,
                gameCode: gameData.gameCode,
                participants: gameData.participants,
                message: "게임이 시작되었습니다!"
            });
        }
    }

    // 게임 완료 브로드캐스트
    async broadcastGameComplete(roomId, gameData) {
        const roomSockets = this.roomConnections.get(roomId);
        if (roomSockets && roomSockets.size > 0) {
            this.io.to(roomId).emit('game_completed', {
                gameId: gameData.gameId,
                gameCode: gameData.gameCode,
                winner: gameData.winner,
                gameStatus: gameData.gameStatus,
                message: "게임이 완료되었습니다!"
            });
        }
    }

    // 특정 사용자에게 메시지 전송
    sendToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    // 방의 모든 사용자에게 메시지 전송
    sendToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }
}

module.exports = WebSocketService;
