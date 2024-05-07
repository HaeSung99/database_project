const express = require('express');
const app = express();
const mysql = require('mysql2');


app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

const db = mysql.createConnection({
host : 'localhost',  
user : 'root',
password : 'haesung8494@',
database : 'company'
});

db.connect(function(err) {
  if (err) {
    console.error('연결실패 :' + err.stack);
    return;
  }
  console.log('연결된듯');
});

app.use(express.static(__dirname + '/public')); //public폴더에있는 자료들을 html에 가져다 쓸수있음

app.get('/', (요청, 응답) =>{
    db.query('select * from company.department', function(에러,결과,필드){
        if(에러){
            console.log(에러)
        }
        console.log(결과);
        응답.render('main.ejs',{ data : 결과 })
  });
});
    

  app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
});