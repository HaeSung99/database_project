const express = require('express');
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));


app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

const db = mysql.createConnection({
host : 'localhost',  
user : 'root',
password : 'haesung8494@',
database : 'project'
});

// 데이터베이스 연결
db.connect(function(err) {
  if (err) {
    console.error('연결실패 :' + err.stack);
    return;
  }
  console.log('연결된듯');
});

// Express 앱에 세션 미들웨어 추가
app.use(session({
  secret: 'your-secret-key', // 세션을 암호화하기 위한 비밀키
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 600000 // 세션 쿠키의 유효기간을 밀리초 단위로 설정 (10분으로 설정함)
  }
}));

app.get('/', (요청, 응답) =>{
        const 사용자 = 요청.session.user || {};
        응답.render('main.ejs', { 사용자 : 사용자 })
  });

app.get('/sign', (요청,응답) =>{
  응답.render('sign.ejs')
})

app.get('/write', (요청,응답) =>{
  응답.render('write.ejs')
})

app.get('/login', (요청,응답) =>{
  요청.session.message = null;
  응답.render('login.ejs', { message:null})
})

// 로그인 기능
app.post('/login',(요청,응답) =>{
  const { username,  password } = 요청.body;
  const 로그인 = 'select memberid, nickname from member where username = ? and password = ?';
  db.query(로그인, [username, password], (에러, 결과) => {
    if (에러) {
        console.error('로그인실패' + 에러.stack);
        return;
    }
    const 사용자 = 결과[0];
    console.log(사용자);
    if (사용자) {
      요청.session.user = 사용자;
      응답.redirect('/');
    } else {
      응답.render('login', { message: '아이디 또는 비밀번호가 잘못되었습니다.' })
    }
  });
});

// 로그아웃 기능
app.get('/logout', (요청, 응답) => {
  // 세션 제거
  요청.session.destroy((err) => {
      if (err) {
          console.error('세션 제거 실패: ' + err);
          return;
      }
      // 로그아웃 후 리다이렉트
      응답.redirect('/');
  });
});

// 회원가입 정보받는곳
app.post('/sign', (요청,응답)=>{
  const { username,  password, nickname } = 요청.body;

  // 데이터베이스에 새로운 회원 정보 추가
  const 회원가입 = 'INSERT INTO member (username, password, nickname) VALUES (?, ?, ?)';
  db.query(회원가입, [username, password, nickname], (에러, 결과) => {
      if (에러) {
          console.error('회원정보추가실패: ' + 에러.stack);
          return;
      }
      console.log('회원번호: ', 결과.insertId);
      응답.send('회원가입에 성공했습니다.');
  });

});
    


// 서버 실행
  app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
});