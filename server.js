const express = require('express');
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const moment = require('moment');

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

app.get('/categories', (req, res) => {
  const user = req.session.user || {};
  const sort = req.query.sort || 'latest';
  const page = parseInt(req.query.page) || 1; // 현재 페이지 번호
  const itemsPerPage = 12; // 페이지당 항목 수
  const offset = (page - 1) * itemsPerPage;

  let getPosts = '';
  if (sort === 'views') {
    getPosts = `SELECT p.*, 
                      (SELECT COUNT(*) FROM Comment c WHERE c.CommentPostNumber = p.PostNumber) AS commentCount
               FROM Post p 
               WHERE p.postdeleteflag = "N" 
               ORDER BY p.Views DESC 
               LIMIT ?, ?`; // 여기바뀜
  } else {
    getPosts = `SELECT p.*, 
                      (SELECT COUNT(*) FROM Comment c WHERE c.CommentPostNumber = p.PostNumber) AS commentCount
               FROM Post p 
               WHERE p.postdeleteflag = "N" 
               ORDER BY p.PostNumber DESC 
               LIMIT ?, ?`; // 여기바뀜
  }

  db.query(getPosts, [offset, itemsPerPage], (err, results) => {
    if (err) {
      console.error('게시글 가져오기 실패: ' + err.stack);
      return;
    }

    const countQuery = 'SELECT COUNT(*) AS count FROM post WHERE postdeleteflag = "N"';
    db.query(countQuery, (err, countResult) => {
      if (err) {
        console.error('게시글 수 가져오기 실패: ' + err.stack);
        return;
      }

      const totalItems = countResult[0].count;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      res.render('categories.ejs', {
        user: user,
        post: results, // 결과를 post로 유지 // 여기바뀜
        sort: sort,
        currentPage: page,
        totalPages: totalPages
      });
    });
  });
});


//메인페이지
app.get('/', (req, res) => {
  const user = req.session.user || {};
  req.session.message = null;
  res.render('main.ejs', { user: user, message: null });
});

app.get('/sign', (req, res) => {
  const user = req.session.user || {};
  req.session.message = null;
  res.render('sign.ejs', { message: null, user: user });
});

app.get('/write', (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/login"; </script>');
  }
  next();
}, (req, res) => {
  res.render('write.ejs', { user: req.session.user });
});

// 로그인 페이지
app.get('/login', (req, res) => {
  const user = req.session.user || {};
  req.session.message = null;
  res.render('login.ejs', { message: null, user: user });
});

// 로그인 기능
app.post('/login', (req, res) => {
  const { userId, userPassword } = req.body;
  const loginQuery = 'SELECT MemberNumber, Nickname FROM Member WHERE MemberID = ? AND MemberPassword = ?';
  db.query(loginQuery, [userId, userPassword], (err, results) => {
    if (err) {
      console.error('로그인 실패: ' + err.stack);
      return res.render('login', { message: '로그인 중 오류가 발생했습니다.', user: null });
    }
    const user = results[0];
    if (user) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.render('login', { message: '아이디 또는 비밀번호가 일치하지 않습니다.', user: null });
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
    return res.render('sign', { message: '모든 빈칸을 채워주세요.', user: null });
  }

  const checkIdQuery = 'SELECT * FROM Member WHERE MemberID = ?';
  db.query(checkIdQuery, [userId], (err, results) => {
    if (err) {
      console.error('아이디 확인 실패: ' + err.stack);
      return;
    }

    if (results.length > 0) {
      return res.render('sign', { message: '이미 존재하는 아이디입니다.', user: null });
    } else {
      const checkNicknameQuery = 'SELECT * FROM Member WHERE Nickname = ?';
      db.query(checkNicknameQuery, [userNickname], (err, results) => {
        if (err) {
          console.error('닉네임 확인 실패: ' + err.stack);
          return;
        }

        if (results.length > 0) {
          return res.render('sign', { message: '이미 존재하는 닉네임입니다.', user: null });
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
  const { title, intro, method, category, people, time, difficulty, nickname, userId, timestamp } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const writePostQuery = 'INSERT INTO Post (AuthorMemberNumber, AuthorNickname, title, timestamp, intro, method, category, people, time, difficulty, ImagePath) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(writePostQuery, [userId, nickname, title, timestamp, intro, method, category, people, time, difficulty, imagePath], (err, results) => {
    if (err) {
      console.error('게시글 작성 실패: ' + err.stack);
      return;
    }
    res.redirect('/');
  });
});

// 게시글 내용 보여주는 곳
app.get('/post/:id', (req, res) => {
  const user = req.session.user || {};
  const PostNumber = req.params.id;

  const postQuery = 'SELECT * FROM Post WHERE PostNumber = ? AND postdeleteflag = "N"';
  const commentsQuery = 'SELECT * FROM Comment WHERE CommentPostNumber = ? ORDER BY CommentTimestamp DESC'; // 여기수정함: CommentTimestamp로 수정

  db.query(postQuery, [PostNumber], (err, postResult) => { // 여기수정함: postQuery로 수정
    if (err) {
      console.error('게시글 조회 실패: ' + err.stack);
      return;
    }
    if (postResult.length > 0) {
      const post = postResult[0];
      post.formattedTimestamp = moment(post.TIMESTAMP).format('YYYY-MM-DD HH:mm:ss');

      db.query(commentsQuery, [PostNumber], (err, commentsResult) => { // 여기수정함: commentsQuery로 댓글 조회 추가
        if (err) throw err;
        const comments = commentsResult;

        // 조회수를 증가시키는 SQL 쿼리
        const updateViewsQuery = `UPDATE Post SET Views = Views + 1 WHERE PostNumber = ?`;
        db.query(updateViewsQuery, [PostNumber], (err) => {
          if (err) {
            console.error('조회수 업데이트 실패: ' + err);
            res.status(500).send('Server error');
            return;
          }
          res.render('post', { post: post, user: user, comments: comments, moment: moment }); // 여기수정함: 댓글 데이터 추가
        });
      });
    } else {
      res.send('Post not found');
    }
  });
});

// 댓글 작성 라우트 추가
app.post('/post/:id/comment', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/login"; </script>');
  }

  const PostNumber = req.params.id;
  const { commentContent } = req.body;
  const insertCommentQuery = 'INSERT INTO Comment (CommentPostNumber, CommentAuthorNumber, CommentAuthorNickname, CommentContent, CommentTimestamp) VALUES (?, ?, ?, ?, NOW())';

  db.query(insertCommentQuery, [PostNumber, user.MemberNumber, user.Nickname, commentContent], (err, results) => {
    if (err) {
      console.error('댓글 작성 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    res.redirect(`/post/${PostNumber}`);
  });
});


//수정 페이지에 원본 게시글 내용 불러오기
app.get('/edit/:id', (req, res) => {
  const user = req.session.user || {};
  const PostNumber = req.params.id;
  const query = 'SELECT * FROM post WHERE PostNumber = ? AND postdeleteflag = "N"'; 
  db.query(query, [PostNumber], (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      const post = result[0];
      res.render('edit', { post: post, user: user });
    } else {
      res.send('Post not found');
    }
  });
});

//수정한 내용을 데이터베이스에 저장
app.post('/edit/:id', upload.single('image'), (req, res) => {
  const { title, intro, method, category, people, time, difficulty, nickname, userId, timestamp, PostNumber } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  let updatePostQuery;
  let queryParams;

  if (imagePath) {
    updatePostQuery = 'UPDATE post SET title = ?, intro = ?, method = ?, category = ?, people = ?, time = ?, difficulty = ?, ImagePath = ? WHERE PostNumber = ?';
    queryParams = [title, intro, method, category, people, time, difficulty, imagePath, PostNumber];
  } else {
    updatePostQuery = 'UPDATE post SET title = ?, intro = ?, method = ?, category = ?, people = ?, time = ?, difficulty = ? WHERE PostNumber = ?';
    queryParams = [title, intro, method, category, people, time, difficulty, PostNumber];
  }

  db.query(updatePostQuery, queryParams, (err, results) => {
    if (err) {
      console.error('게시글 수정 실패: ' + err.stack);
      return;
    }
    res.redirect('/categories');
  });
});

//삭제 기능
app.post('/delete', (req, res) => {
  const PostNumber = req.body['PostNumber'];
  const query = 'UPDATE post SET postdeleteflag = "Y" WHERE PostNumber = ?';
  db.query(query, [PostNumber], (err, result) => {
    if (err) {
      console.error('게시글 삭제 실패: ' + err.stack);
      return;
    }
    res.redirect('/categories');
  });
});

// 추천 기능
app.post('/post/:id/recommend', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/login"; </script>');
  }

  const PostNumber = req.params.id;
  const MemberNumber = user.MemberNumber;

  // 추천 여부 확인 쿼리
  const checkRecommendationQuery = 'SELECT * FROM PostRecommendations WHERE PostNumber = ? AND MemberNumber = ?';
  db.query(checkRecommendationQuery, [PostNumber, MemberNumber], (err, results) => {
    if (err) {
      console.error('추천 여부 확인 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    if (results.length > 0) {
      return res.send('<script type="text/javascript">alert("이미 추천 누른 게시글 입니다."); window.location="/post/' + PostNumber + '"; </script>');
    } else {
      // 추천 추가 쿼리
      const addRecommendationQuery = 'INSERT INTO PostRecommendations (PostNumber, MemberNumber) VALUES (?, ?)';
      db.query(addRecommendationQuery, [PostNumber, MemberNumber], (err, result) => {
        if (err) {
          console.error('추천 추가 실패: ' + err.stack);
          return res.status(500).send('Server error');
        }
        // 게시글 추천수 증가 쿼리
        const updateRecommendCountQuery = 'UPDATE Post SET RecommendCounts = RecommendCounts + 1 WHERE PostNumber = ?';
        db.query(updateRecommendCountQuery, [PostNumber], (err) => {
          if (err) {
            console.error('추천수 업데이트 실패: ' + err.stack);
            return res.status(500).send('Server error');
          }
          res.redirect('/post/' + PostNumber);
        });
      });
    }
  });
});


// 서버 실행
app.listen(8080, () => {
  console.log('http://localhost:8080 에서 서버 실행중');
});
