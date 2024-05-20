const express = require('express');
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'haesung8494@',
  database: 'project'
});

// 데이터베이스 연결
db.connect(function(err) {
  if (err) {
    console.error('연결 실패: ' + err.stack);
    return;
  }
  console.log('연결 성공');
});

// Multer 설정
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1200000 // 세션 쿠키의 유효기간을 밀리초 단위로 설정 (20분으로 설정)
  }
}));

app.get('/', (req, res) => {
  const user = req.session.user || {};
  const sort = req.query.sort || 'latest';
  let getPosts = '';

  if (sort === 'views') {
    getPosts = 'SELECT * FROM post ORDER BY Views DESC'; // 조회수 순 정렬
  } else {
    getPosts = 'SELECT * FROM post ORDER BY PostNumber DESC'; // 최신순 정렬
  }

  db.query(getPosts, (err, results) => {
    if (err) {
      console.error('게시글 가져오기 실패: ' + err.stack);
      return;
    }
    res.render('main.ejs', { user: user, post: results, sort: sort });
  });
});

app.get('/sign', (req, res) => {
  req.session.message = null;
  res.render('sign.ejs', { message: null });
});

app.get('/write', (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/login"; </script>');
  }
  next();
}, (req, res) => {
  res.render('write.ejs', { user: req.session.user });
});

app.get('/login', (req, res) => {
  req.session.message = null;
  res.render('login.ejs', { message: null });
});

// 로그인 기능
app.post('/login', (req, res) => {
  const { userId, userPassword } = req.body;
  const loginQuery = 'SELECT MemberNumber, Nickname FROM Member WHERE MemberID = ? AND MemberPassword = ?';
  db.query(loginQuery, [userId, userPassword], (err, results) => {
    if (err) {
      console.error('로그인 실패: ' + err.stack);
      return;
    }
    const user = results[0];
    if (user) {
      console.log(user);
      req.session.user = user;
      res.redirect('/');
    } else {
      res.render('login', { message: '아이디 또는 비밀번호가 잘못되었습니다.' });
    }
  });
});

// 로그아웃 기능
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('세션 제거 실패: ' + err);
      return;
    }
    res.redirect('/');
  });
});

// 회원가입 정보 받는 곳
app.post('/sign', (req, res) => {
  const { userId, userPassword, userNickname } = req.body;

  // 입력값 검증
  if (!userId || !userPassword || !userNickname) {
    return res.render('sign', { message: '모든 빈칸을 채워주세요.' });
  }

  const checkIdQuery = 'SELECT * FROM Member WHERE MemberID = ?';
  db.query(checkIdQuery, [userId], (err, results) => {
    if (err) {
      console.error('아이디 확인 실패: ' + err.stack);
      return;
    }

    if (results.length > 0) {
      return res.render('sign', { message: '이미 존재하는 아이디입니다.' });
    } else {
      const checkNicknameQuery = 'SELECT * FROM Member WHERE MemberID = ?';
      db.query(checkNicknameQuery, [userNickname], (err, results) => {
        if (err) {
          console.error('닉네임 확인 실패: ' + err.stack);
          return;
        }

        if (results.length > 0) {
          return res.render('sign', { message: '이미 존재하는 닉네임입니다.' });
        } else {
          const signUpQuery = 'INSERT INTO Member (MemberID, MemberPassword, Nickname) VALUES (?, ?, ?)';
          db.query(signUpQuery, [userId, userPassword, userNickname], (err, results) => {
            if (err) {
              console.error('회원정보 추가 실패: ' + err.stack);
              return;
            }
            res.redirect('/');
          });
        }
      });
    }
  });
});

// 글쓰기 정보 받는 곳
app.post('/write', upload.single('image'), (req, res) => {
  const { title, content, nickname, userId, timestamp } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const writePostQuery = 'INSERT INTO Post (AuthorMemberNumber, AuthorNickname, Title, WritingTime, Content, ImagePath) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(writePostQuery, [userId, nickname, title, timestamp, content, imagePath], (err, results) => {
    if (err) {
      console.error('게시글 작성 실패: ' + err.stack);
      return;
    }
    res.redirect('/');
  });
});

//각 게시글 별로 상세페이지로 이동
app.get('/post/:id', (req, res) => {
  const PostNumber = req.params.id;
  const query = 'SELECT * FROM post WHERE PostNumber = ?';
  db.query(query, [PostNumber], (err, results) => {
      if (err) throw err;
      res.render('post', { post: results[0] });
  });
  // 조회수를 증가시키는 SQL 쿼리
  const updateViewsQuery = `UPDATE post SET views = views + 1 WHERE PostNumber = ?`;

  db.query(updateViewsQuery, [PostNumber], (err, results) => {
    if (err) {
      console.error('Failed to update views:', err);
      res.status(500).send('Server error');
      return;
    }
})
});

// 서버 실행
app.listen(8080, () => {
  console.log('http://localhost:8080 에서 서버 실행중');
});
