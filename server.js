const express = require('express');
const app = express();
const mysql = require('mysql2');
app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

const db = mysql.createConnection({
host : 'localhost',  
user : 'root',
password : 'haesung8494@',
database : 'project'
});

db.connect(function(err) {
  if (err) {
    console.error('연결실패 :' + err.stack);
    return;
  }
  console.log('연결된듯');
});

app.get('/', (요청, 응답) =>{
    db.query('select * from company.department', function(에러,결과,필드){
        if(에러){
            console.log(에러)
        }
        console.log(결과);
        응답.render('main.ejs',{ data : 결과 })
  });
});

app.get('/sign', (요청,응답) =>{
  응답.render('sign.ejs')
})

//포스트요청하면 답오는지 확인하는 코드
// app.post('/sign',(요청,응답) =>{
//   console.log(요청.body.username)
// })

//회원가입 정보받는곳
app.post('/sign', (요청,응답)=>{
  const { username,  password, nickname } = 요청.body;

  // 데이터베이스에 새로운 회원 정보 추가
  const sql = 'INSERT INTO member (username, password, nickname) VALUES (?, ?, ?)';
  db.query(sql, [username, password, nickname], (에러, 결과) => {
      if (에러) {
          console.error('회원정보추가실패: ' + 에러.stack);
          return;
      }
      console.log('회원번호: ', 결과.insertId);
      응답.send('회원가입에 성공했습니다.');
  });

});
    

  app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
});