require('dotenv').config(); 

const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));

app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`서버 실행 중: ${PORT}번 포트`);
});


