const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://13.209.33.42:3000';

// 테스트 계정 정보 (실제 계정으로 변경하세요)
const USER1 = { username: 'test3', password: '1234' };
const USER2 = { username: 'test8', password: '1234' };

// 테스트 결과 저장
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '🔄';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

function test(name, fn) {
    return async () => {
        try {
            log(`테스트 시작: ${name}`, 'info');
            await fn();
            results.passed++;
            results.tests.push({ name, status: 'PASS' });
            log(`테스트 통과: ${name}`, 'success');
        } catch (error) {
            results.failed++;
            results.tests.push({ name, status: 'FAIL', error: error.message });
            log(`테스트 실패: ${name} - ${error.message}`, 'error');
        }
    };
}

async function main() {
    console.log('\n=== 멀티플레이 웹소켓 통합 테스트 ===\n');

    let token1, token2;
    let socket1, socket2;
    let gameCode;
    let socket1Events = [];
    let socket2Events = [];
    // 전체 이벤트 누적 저장 (요약 출력용)
    let socket1AllEvents = [];
    let socket2AllEvents = [];

    // 1단계: 로그인 (사용자1)
    await test('1. 사용자1 로그인', async () => {
        const response = await axios.post(`${BASE_URL}/users/login`, USER1);
        if (!response.data.token) throw new Error('토큰을 받지 못함');
        token1 = response.data.token;
        log(`사용자1 토큰 획득: ${token1.substring(0, 20)}...`, 'success');
    })();

    // 2단계: 로그인 (사용자2)
    await test('2. 사용자2 로그인', async () => {
        const response = await axios.post(`${BASE_URL}/users/login`, USER2);
        if (!response.data.token) throw new Error('토큰을 받지 못함');
        token2 = response.data.token;
        log(`사용자2 토큰 획득: ${token2.substring(0, 20)}...`, 'success');
    })();

    // 3단계: 웹소켓 연결 (사용자1)
    await test('3. 사용자1 웹소켓 연결', async () => {
        socket1 = io(BASE_URL, {
            transports: ['polling', 'websocket'],
            autoConnect: true
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('연결 시간 초과')), 5000);
            
            socket1.on('connect', () => {
                clearTimeout(timeout);
                log(`사용자1 연결 성공: ${socket1.id}`, 'success');
                resolve();
            });

            socket1.on('connect_error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`연결 실패: ${error.message}`));
            });
        });

        // 웹소켓 이벤트 수집
        socket1.onAny((event, data) => {
            const eventData = { event, data, time: new Date() };
            socket1Events.push(eventData);
            socket1AllEvents.push(eventData); // 전체 이벤트에도 추가
            log(`[사용자1] 이벤트 수신: ${event}`, 'info');
        });
    })();

    // 4단계: 웹소켓 인증 (사용자1)
    await test('4. 사용자1 웹소켓 인증', async () => {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('인증 시간 초과')), 5000);
            
            socket1.once('authenticated', (data) => {
                clearTimeout(timeout);
                if (data.isSuccess) {
                    log(`사용자1 인증 성공: ${data.result?.username}`, 'success');
                    resolve();
                } else {
                    reject(new Error(`인증 실패: ${data.message}`));
                }
            });

            socket1.emit('authenticate', { token: token1 });
        });
    })();

    // 5단계: 방 생성 (HTTP API)
    await test('5. 방 생성 (HTTP API)', async () => {
        try {
            const response = await axios.post(
                `${BASE_URL}/games/multiplay/rooms/create`,
                { tags: ['banana', 'money', 'yellow', 'two'] },
                { headers: { Authorization: `Bearer ${token1}` } }
            );

            if (!response.data.isSuccess || !response.data.result.gameCode) {
                log(`응답 데이터: ${JSON.stringify(response.data, null, 2)}`, 'error');
                throw new Error(response.data.message || '방 생성 실패');
            }

            gameCode = response.data.result.gameCode;
            log(`방 생성 성공: ${gameCode}`, 'success');
            
            // AI 이미지 생성 대기 (시간이 걸릴 수 있음)
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
            if (error.response) {
                log(`에러 응답 상태: ${error.response.status}`, 'error');
                log(`에러 응답 데이터: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
            }
            throw error;
        }
    })();

    // 6단계: 웹소켓으로 방 입장 (사용자1)
    await test('6. 사용자1 방 입장 (웹소켓)', async () => {
        socket1.emit('join_room', { gameCode });
        
        // 잠시 대기 (에러가 없다면 성공으로 간주)
        await new Promise(resolve => setTimeout(resolve, 1000));
        log('사용자1 방 입장 완료', 'success');
    })();

    // 7단계: 웹소켓 연결 (사용자2)
    await test('7. 사용자2 웹소켓 연결', async () => {
        socket2 = io(BASE_URL, {
            transports: ['polling', 'websocket'],
            autoConnect: true
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('연결 시간 초과')), 5000);
            
            socket2.on('connect', () => {
                clearTimeout(timeout);
                log(`사용자2 연결 성공: ${socket2.id}`, 'success');
                resolve();
            });

            socket2.on('connect_error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`연결 실패: ${error.message}`));
            });
        });

        socket2.onAny((event, data) => {
            const eventData = { event, data, time: new Date() };
            socket2Events.push(eventData);
            socket2AllEvents.push(eventData); // 전체 이벤트에도 추가
            log(`[사용자2] 이벤트 수신: ${event}`, 'info');
        });
    })();

    // 8단계: 웹소켓 인증 (사용자2)
    await test('8. 사용자2 웹소켓 인증', async () => {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('인증 시간 초과')), 5000);
            
            socket2.once('authenticated', (data) => {
                clearTimeout(timeout);
                if (data.isSuccess) {
                    log(`사용자2 인증 성공: ${data.result?.username}`, 'success');
                    resolve();
                } else {
                    reject(new Error(`인증 실패: ${data.message}`));
                }
            });

            socket2.emit('authenticate', { token: token2 });
        });
    })();

    // 9단계: 방 입장 (HTTP API - 사용자2)
    await test('9. 사용자2 방 입장 (HTTP API)', async () => {
        if (!gameCode) {
            throw new Error('gameCode가 없습니다. 방 생성이 실패했습니다.');
        }
        
        try {
            const response = await axios.post(
                `${BASE_URL}/games/multiplay/rooms/join`,
                { gameCode },
                { headers: { Authorization: `Bearer ${token2}` } }
            );

            if (!response.data.isSuccess) {
                log(`응답 데이터: ${JSON.stringify(response.data, null, 2)}`, 'error');
                throw new Error(response.data.message || '방 입장 실패');
            }

            log('사용자2 방 입장 성공 (HTTP)', 'success');
            
            // 웹소켓 브로드캐스트 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            if (error.response) {
                log(`에러 응답 상태: ${error.response.status}`, 'error');
                log(`에러 응답 데이터: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
            }
            throw error;
        }
    })();

    // 10단계: 웹소켓으로 방 입장 (사용자2)
    await test('10. 사용자2 방 입장 (웹소켓)', async () => {
        socket2.emit('join_room', { gameCode });
        
        // user_joined 이벤트 확인 (사용자1이 받아야 함)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const userJoined = socket1Events.find(e => e.event === 'user_joined');
        if (userJoined) {
            log('사용자1이 user_joined 이벤트 수신 확인', 'success');
        } else {
            log('⚠️ user_joined 이벤트를 받지 못함 (수동 확인 필요)', 'info');
        }
    })();

    // 11단계: 준비 상태 토글 (HTTP API) - 사용자2
    await test('11. 사용자2 준비 상태 토글 (HTTP API)', async () => {
        socket1Events = []; // 이벤트 리스트 초기화
        
        const response = await axios.post(
            `${BASE_URL}/games/multiplay/rooms/ready`,
            { gameCode },
            { headers: { Authorization: `Bearer ${token2}` } }
        );

        if (!response.data.isSuccess) {
            throw new Error(response.data.message || '준비 상태 변경 실패');
        }

        log('사용자2 준비 상태 변경 성공', 'success');
        
        // 웹소켓 브로드캐스트 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
    })();

    // 12단계: room_updated 이벤트 확인
    await test('12. room_updated 이벤트 확인', async () => {
        const roomUpdated = socket1Events.find(e => e.event === 'room_updated');
        if (roomUpdated) {
            log('사용자1이 room_updated 이벤트 수신 확인', 'success');
        } else {
            throw new Error('room_updated 이벤트를 받지 못함');
        }
    })();

    // 13단계: 준비 상태 토글 (HTTP API) - 사용자1
    await test('13. 사용자1 준비 상태 토글 (HTTP API)', async () => {
        socket2Events = []; // 이벤트 리스트 초기화
        
        const response = await axios.post(
            `${BASE_URL}/games/multiplay/rooms/ready`,
            { gameCode },
            { headers: { Authorization: `Bearer ${token1}` } }
        );

        if (!response.data.isSuccess) {
            throw new Error(response.data.message || '준비 상태 변경 실패');
        }

        log('사용자1 준비 상태 변경 성공', 'success');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    })();

    // 14단계: 게임 시작 (HTTP API)
    await test('14. 게임 시작 (HTTP API)', async () => {
        socket1Events = [];
        socket2Events = [];
        
        const response = await axios.post(
            `${BASE_URL}/games/multiplay/rooms/start`,
            { gameCode },
            { headers: { Authorization: `Bearer ${token1}` } }
        );

        if (!response.data.isSuccess) {
            throw new Error(response.data.message || '게임 시작 실패');
        }

        log('게임 시작 성공', 'success');
        
        // 웹소켓 브로드캐스트 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
    })();

    // 15단계: game_started 이벤트 확인
    await test('15. game_started 이벤트 확인', async () => {
        const gameStarted1 = socket1Events.find(e => e.event === 'game_started');
        const gameStarted2 = socket2Events.find(e => e.event === 'game_started');
        
        if (gameStarted1 && gameStarted2) {
            log('두 사용자 모두 game_started 이벤트 수신 확인', 'success');
        } else {
            throw new Error('game_started 이벤트를 받지 못함');
        }
    })();

    // 16단계: 게임 완료 (HTTP API)
    await test('16. 게임 완료 (HTTP API)', async () => {
        socket1Events = [];
        socket2Events = [];
        
        const response = await axios.post(
            `${BASE_URL}/games/multiplay/rooms/complete`,
            { gameCode },
            { headers: { Authorization: `Bearer ${token1}` } }
        );

        if (!response.data.isSuccess) {
            throw new Error(response.data.message || '게임 완료 실패');
        }

        log('게임 완료 성공', 'success');
        
        // 웹소켓 브로드캐스트 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
    })();

    // 17단계: game_completed 이벤트 확인
    await test('17. game_completed 이벤트 확인', async () => {
        const gameCompleted1 = socket1Events.find(e => e.event === 'game_completed');
        const gameCompleted2 = socket2Events.find(e => e.event === 'game_completed');
        
        if (gameCompleted1 && gameCompleted2) {
            log('두 사용자 모두 game_completed 이벤트 수신 확인', 'success');
        } else {
            throw new Error('game_completed 이벤트를 받지 못함');
        }
    })();

    // 정리
    socket1.disconnect();
    socket2.disconnect();

    // 결과 출력
    console.log('\n=== 테스트 결과 ===');
    console.log(`✅ 통과: ${results.passed}`);
    console.log(`❌ 실패: ${results.failed}`);
    console.log('\n상세 결과:');
    results.tests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : '❌';
        console.log(`  ${icon} ${test.name}`);
        if (test.error) {
            console.log(`     에러: ${test.error}`);
        }
    });

    console.log('\n수신된 이벤트 요약:');
    console.log('사용자1:', socket1AllEvents.map(e => e.event).join(', '));
    console.log('사용자2:', socket2AllEvents.map(e => e.event).join(', '));
    
    // 이벤트별 상세 요약
    console.log('\n이벤트별 상세 요약:');
    const eventTypes1 = [...new Set(socket1AllEvents.map(e => e.event))];
    const eventTypes2 = [...new Set(socket2AllEvents.map(e => e.event))];
    console.log('사용자1 이벤트 종류:');
    eventTypes1.forEach(eventType => {
        const count = socket1AllEvents.filter(e => e.event === eventType).length;
        console.log(`  - ${eventType}: ${count}회`);
    });
    console.log('사용자2 이벤트 종류:');
    eventTypes2.forEach(eventType => {
        const count = socket2AllEvents.filter(e => e.event === eventType).length;
        console.log(`  - ${eventType}: ${count}회`);
    });

    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
    log(`치명적 오류: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
});
