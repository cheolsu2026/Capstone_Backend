require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const routes = require('./routes');
const WebSocketService = require('./services/websocketService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 80;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use(express.static(path.join(__dirname, 'public')));

app.set('views', path.join(__dirname, 'views'));

app.use('/', routes);

// 웹소켓 서비스 초기화
const wsService = new WebSocketService(server);

// 웹소켓 서비스를 전역으로 사용할 수 있도록 설정
global.wsService = wsService;

server.listen(PORT, HOST, () => { // AWS 사용시 해당 주석 해제
// server.listen(3000, () => { // 로컬 사용 시 해당 주석 해제
    console.log(`서버 실행 중: http://${HOST}:${PORT}`);
    // console.log(`서버 실행 중: http://localhost:3000`);
});