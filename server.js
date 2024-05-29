const express = require('express'); // Express 모듈 가져오기
const app = express(); // Express 애플리케이션 생성
const mysql = require('mysql2'); // MySQL 연결을 위한 라이브러리
const session = require('express-session'); // 세션을 사용하기 위한 라이브러리
const multer = require('multer'); // 파일 업로드를 위한 라이브러리
const path = require('path'); // 파일 경로를 다루기 위한 라이브러리
const moment = require('moment'); // 날짜 및 시간을 다루기 위한 라이브러리
const cron = require('cron'); // 주기적으로 실행되는 작업을 설정하기 위한 라이브러리

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

// 매일 자정에 cacheRecommendations 함수 실행
const job = new cron.CronJob('0 0 * * *', () => {
  cacheRecommendations();
}, null, true, 'Asia/Seoul');

job.start();

// 캐시에서 오늘의 추천 레시피 가져오기 또는 새로 설정하기
function getTodayRecommendations(callback) {
  const cacheKey = 'today_recommendations';
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  // 캐시에서 오늘의 추천 레시피 가져오기
  const getCacheQuery = 'SELECT cache_value FROM Cache WHERE cache_key = ? AND expiration > ?';
  db.query(getCacheQuery, [cacheKey, now], (err, result) => {
    if (err) {
      console.error('캐시 확인 실패:', err);
      return callback(err);
    }

    if (result.length > 0) {
      // 캐시된 추천 레시피가 있는 경우
      let recommendations = JSON.parse(result[0].cache_value);

      if (recommendations.length === 0) {
        return callback(null, []);
      }

      // 삭제된 게시글이 있는지 확인하고 제거
      const postNumbers = recommendations.map(post => post.PostNumber);
      const checkDeletedQuery = 'SELECT PostNumber FROM Post WHERE PostNumber IN (?) AND postdeleteflag = "N"';
      db.query(checkDeletedQuery, [postNumbers], (err, validPosts) => {
        if (err) {
          console.error('게시글 검증 실패:', err);
          return callback(err);
        }

        const validPostNumbers = validPosts.map(post => post.PostNumber);
        recommendations = recommendations.filter(post => validPostNumbers.includes(post.PostNumber));

        // 필요한 경우 새 게시글 추가
        if (recommendations.length < 3) {
          const additionalPostsQuery = `
            SELECT * FROM Post 
            WHERE postdeleteflag = "N" AND PostNumber NOT IN (?) 
            ORDER BY RAND() 
            LIMIT ?
          `;
          db.query(additionalPostsQuery, [validPostNumbers, 3 - recommendations.length], (err, additionalPosts) => {
            if (err) {
              console.error('추가 게시글 가져오기 실패:', err);
              return callback(err);
            }

            recommendations = recommendations.concat(additionalPosts);
            // 캐시에 다시 저장
            const upsertCacheQuery = `
              INSERT INTO Cache (cache_key, cache_value, expiration)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE
                cache_value = VALUES(cache_value),
                expiration = VALUES(expiration)
            `;
            const tomorrow = moment().add(1, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
            db.query(upsertCacheQuery, [cacheKey, JSON.stringify(recommendations), tomorrow], (err) => {
              if (err) {
                console.error('캐시 업데이트 실패:', err);
                return callback(err);
              }
              callback(null, recommendations);
            });
          });
        } else {
          callback(null, recommendations);
        }
      });
    } else {
      // 캐시된 추천 레시피가 없는 경우, 새로 설정
      cacheRecommendations(callback);
    }
  });
}

// 오늘의 추천 레시피 캐시에 저장
function cacheRecommendations(callback) {
  const randomPostsQuery = 'SELECT * FROM Post WHERE postdeleteflag = "N" ORDER BY RAND() LIMIT 3';
  const cacheKey = 'today_recommendations';
  const tomorrow = moment().add(1, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');

  db.query(randomPostsQuery, (err, randomPosts) => {
    if (err) {
      console.error('무작위 게시글 가져오기 실패:', err);
      if (callback) callback(err);
      return;
    }

    const upsertCacheQuery = `
      INSERT INTO Cache (cache_key, cache_value, expiration)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cache_value = VALUES(cache_value),
        expiration = VALUES(expiration)
    `;
    db.query(upsertCacheQuery, [cacheKey, JSON.stringify(randomPosts), tomorrow], (err) => {
      if (err) {
        console.error('캐시 저장 실패:', err);
        if (callback) callback(err);
      } else if (callback) {
        callback(null, randomPosts);
      }
    });
  });
}

// // 서버 시작 시 캐시를 채움 여기부분 주석처리하면 서버 실행될때마다 캐시가 채워지지않음
// cacheRecommendations();

// 분류 페이지
app.get('/categories', (req, res) => {
  const user = req.session.user || {};
  const sort = req.query.sort || 'latest';
  const page = parseInt(req.query.page) || 1; // 현재 페이지 번호
  const itemsPerPage = 12; // 페이지당 항목 수
  const offset = (page - 1) * itemsPerPage;
  const searchQuery = req.query.query || ''; // 검색어
  const category = req.query.category || '';
  const difficulty = req.query.difficulty || '';
  const people = req.query.people || '';
  const time = req.query.time || '';

  let getPosts = `
    SELECT p.*, 
           (SELECT COUNT(*) FROM Comment c WHERE c.CommentPostNumber = p.PostNumber) AS commentCount
    FROM Post p 
    WHERE p.postdeleteflag = "N"
  `;
  let queryParams = [];
  
  if (searchQuery) {
    getPosts += ' AND p.Title LIKE ?';
    queryParams.push(`%${searchQuery}%`);
  }

  if (category) {
    getPosts += ' AND p.category = ?';
    queryParams.push(category);
  }

  if (difficulty) {
    getPosts += ' AND p.difficulty = ?';
    queryParams.push(difficulty);
  }

  if (people) {
    getPosts += ' AND p.people = ?';
    queryParams.push(people);
  }

  if (time) {
    getPosts += ' AND p.time = ?';
    queryParams.push(time);
  }

  if (sort === 'views') {
    getPosts += ' ORDER BY p.Views DESC';
  } else {
    getPosts += ' ORDER BY p.PostNumber DESC';
  }

  getPosts += ' LIMIT ?, ?';
  queryParams.push(offset, itemsPerPage);

  db.query(getPosts, queryParams, (err, result) => {
    if (err) {
      console.error('게시글 가져오기 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }

    let countQuery = 'SELECT COUNT(*) AS count FROM Post WHERE postdeleteflag = "N"';
    let countParams = [];

    if (searchQuery) {
      countQuery += ' AND Title LIKE ?';
      countParams.push(`%${searchQuery}%`);
    }

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }

    if (difficulty) {
      countQuery += ' AND difficulty = ?';
      countParams.push(difficulty);
    }

    if (people) {
      countQuery += ' AND people = ?';
      countParams.push(people);
    }

    if (time) {
      countQuery += ' AND time = ?';
      countParams.push(time);
    }

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('게시글 수 가져오기 실패: ' + err.stack);
        return res.status(500).send('Server error');
      }

      const totalItems = countResult[0].count;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      res.render('categories.ejs', {
        user: user,
        post: result,
        sort: sort,
        currentPage: page,
        totalPages: totalPages,
        searchQuery: searchQuery,
        category: category,
        difficulty: difficulty,
        people: people,
        time: time
      });
    });
  });
});

// 메인페이지
app.get('/', (req, res) => {
  const user = req.session.user || {};

  getTodayRecommendations((err, randomPosts) => {
    if (err) {
      return res.status(500).send('Server error');
    }
    res.render('main', { user: user, randomPosts: randomPosts, message: null });
  });
});

app.get('/search', (req, res) => {
  const searchQuery = req.query.query;
  const searchSQL = 'SELECT * FROM Post WHERE Title LIKE ? AND postdeleteflag = "N"';
  const searchValues = ['%' + searchQuery + '%'];

  db.query(searchSQL, searchValues, (err, result) => {
    if (err) {
      console.error('검색 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    res.render('categories', { user: req.session.user, post: result, sort: 'search', currentPage: 1, totalPages: 1 });
  });
});

// 회원정보 수정 페이지 라우트
app.get('/edit-profile', (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }

  res.render('edit-profile', { user: user });
});


app.get('/sign', (req, res) => {
  const user = req.session.user || {};
  req.session.message = null;
  res.render('sign.ejs', { message: null, user: user });
});

app.get('/write', (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }
  next();
}, (req, res) => {
  res.render('write.ejs', { user: req.session.user });
});

//로그인 기능
app.post('/login', (req, res) => {
  const { userId, userPassword } = req.body;
  const loginQuery = 'SELECT MemberNumber, Nickname, Grade, PostCount, CommentCount, memberdeleteflag FROM Member WHERE MemberID = ? AND MemberPassword = ?';
  
  db.query(loginQuery, [userId, userPassword], (err, result) => {
    if (err) {
      console.error('로그인 실패: ' + err.stack);
      return res.send('<script>alert("로그인 중 오류가 발생했습니다."); window.location.href="/";</script>');
    }
    
    const user = result[0];
    if (user) {
      if (user.memberdeleteflag === 'Y') {
        return res.send('<script>alert("로그인 불가능한 아이디 입니다."); window.location.href="/";</script>');
      }

      req.session.user = user; // 로그인 시 유저 정보 세션에 저장
      res.redirect('/');
    } else {
      return res.send('<script>alert("아이디 또는 비밀번호가 일치하지 않습니다."); window.location.href="/";</script>');
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
  db.query(checkIdQuery, [userId], (err, result) => {
    if (err) {
      console.error('아이디 확인 실패: ' + err.stack);
      return;
    }

    if (result.length > 0) {
      return res.render('sign', { message: '이미 존재하는 아이디입니다.', user: null });
    } else {
      const checkNicknameQuery = 'SELECT * FROM Member WHERE Nickname = ?';
      db.query(checkNicknameQuery, [userNickname], (err, result) => {
        if (err) {
          console.error('닉네임 확인 실패: ' + err.stack);
          return;
        }

        if (result.length > 0) {
          return res.render('sign', { message: '이미 존재하는 닉네임입니다.', user: null });
        } else {
          const signUpQuery = 'INSERT INTO Member (MemberID, MemberPassword, Nickname) VALUES (?, ?, ?)';
          db.query(signUpQuery, [userId, userPassword, userNickname], (err, result) => {
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

//글 작성 기능
app.post('/write', upload.single('image'), (req, res) => {
  const { title, intro, method, category, people, time, difficulty, nickname, userId, timestamp } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const writePostQuery = `INSERT INTO Post (AuthorMemberNumber, AuthorNickname, title, timestamp, intro, method, category, people, time, difficulty, ImagePath) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(writePostQuery, [userId, nickname, title, timestamp, intro, method, category, people, time, difficulty, imagePath], (err, result) => {
    if (err) {
      console.error('게시글 작성 실패: ' + err.stack);
      return;
    }

    // 글 작성 후 글 수 갱신
    const updateCountsQuery = `
      UPDATE Member m
      SET 
        m.PostCount = (SELECT COUNT(*) FROM Post WHERE AuthorMemberNumber = m.MemberNumber)
      WHERE m.MemberNumber = ?`;

    db.query(updateCountsQuery, [userId], (err) => {
      if (err) {
        console.error('글 수 업데이트 실패: ' + err.stack);
        return;
      }
      res.redirect('/');
    });
  });
});

app.get('/post/:id', (req, res) => {
  const user = req.session.user || {};
  const PostNumber = req.params.id;

  const postQuery = 'SELECT * FROM Post WHERE PostNumber = ? AND postdeleteflag = "N"'; // postdeleteflag가 N이고 PostNumber가 일치하는 게시글 조회 쿼리
  const commentsQuery = 'SELECT * FROM Comment WHERE CommentPostNumber = ? ORDER BY CommentTimestamp DESC'; // CommentPostNumber가 일치하는 댓글을 최신순으로 조회하는 쿼리

  db.query(postQuery, [PostNumber], (err, postResult) => {
    if (err) {
      console.error('게시글 조회 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    if (postResult.length > 0) {
      const post = postResult[0];
      post.formattedTimestamp = moment(post.TIMESTAMP).format('YYYY-MM-DD HH:mm:ss');

      db.query(commentsQuery, [PostNumber], (err, commentsResult) => {
        if (err) throw err;
        const comments = commentsResult;

        const updateViewsQuery = 'UPDATE Post SET Views = Views + 1 WHERE PostNumber = ?'; // postnumber가 일치하는 게시글의 조회수를 1 증가시키는 쿼리
        db.query(updateViewsQuery, [PostNumber], (err) => {
          if (err) {
            console.error('조회수 업데이트 실패: ' + err);
            res.status(500).send('Server error');
            return;
          }
          const addViewEventQuery = 'INSERT INTO ViewEvents (PostNumber, MemberNumber) VALUES (?, ?)'; // 조회 이벤트를 기록하는 쿼리 (조회한 게시글의 번호와 조회한 회원의 번호를 기록)
          db.query(addViewEventQuery, [PostNumber, user.MemberNumber], (err) => {
            if (err) {
              console.error('조회 이벤트 기록 실패: ' + err.stack);
              return res.status(500).send('Server error');
            }
            res.render('post', { post: post, user: user, comments: comments, moment: moment });
          });
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
  const insertCommentQuery = 'INSERT INTO Comment (CommentPostNumber, CommentAuthorNumber, CommentAuthorNickname, CommentContent, CommentTimestamp) VALUES (?, ?, ?, ?, NOW())'; // 게시글 번호, 댓글 작성자 번호, 댓글 작성자 닉네임, 댓글 내용, 댓글 작성 시간을 기록하는 쿼리

  db.query(insertCommentQuery, [PostNumber, user.MemberNumber, user.Nickname, commentContent], (err, result) => {
    if (err) {
      console.error('댓글 작성 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }

    const CommentNumber = result.insertId;
    const addCommentEventQuery = 'INSERT INTO CommentEvents (CommentNumber, PostNumber, MemberNumber) VALUES (?, ?, ?)'; // 댓글 이벤트를 기록하는 쿼리 (댓글 번호, 게시글 번호, 댓글 작성자 번호를 기록)
    
    db.query(addCommentEventQuery, [CommentNumber, PostNumber, user.MemberNumber], (err) => {
      if (err) {
        console.error('댓글 이벤트 기록 실패: ' + err.stack);
        return res.status(500).send('Server error');
      }
      
      // 댓글 작성 후 댓글 수 갱신
      const updateCountsQuery = `
        UPDATE Member m
        SET 
          m.CommentCount = (SELECT COUNT(*) FROM Comment WHERE CommentAuthorNumber = m.MemberNumber)
        WHERE m.MemberNumber = ?`;

      db.query(updateCountsQuery, [user.MemberNumber], (err) => {
        if (err) {
          console.error('댓글 수 업데이트 실패: ' + err.stack);
          return res.status(500).send('Server error');
        }
        res.redirect(`/post/${PostNumber}`);
      });
    });
  });
});

// 수정 페이지에 원본 게시글 내용 불러오기
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

// 수정한 내용을 데이터베이스에 저장
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

  db.query(updatePostQuery, queryParams, (err, result) => {
    if (err) {
      console.error('게시글 수정 실패: ' + err.stack);
      return;
    }
    res.redirect('/categories');
  });
});

// 삭제 기능
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
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }

  const PostNumber = req.params.id;
  const MemberNumber = user.MemberNumber;

  const checkRecommendationQuery = 'SELECT * FROM RecommendationEvents WHERE PostNumber = ? AND MemberNumber = ?';
  db.query(checkRecommendationQuery, [PostNumber, MemberNumber], (err, result) => {
    if (err) {
      console.error('추천 여부 확인 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    if (result.length > 0) {
      return res.send('<script type="text/javascript">alert("이미 추천 누른 게시글 입니다."); window.location="/post/' + PostNumber + '"; </script>');
    } else {
      const addRecommendationQuery = 'INSERT INTO RecommendationEvents (PostNumber, MemberNumber) VALUES (?, ?)';
      db.query(addRecommendationQuery, [PostNumber, MemberNumber], (err, result) => {
        if (err) {
          console.error('추천 추가 실패: ' + err.stack);
          return res.status(500).send('Server error');
        }
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

// 랭킹 페이지
app.get('/ranking', (req, res) => {
  const user = req.session.user || {};

  const now = moment().format('YYYY-MM-DD HH:mm:ss'); // 현재 시간을 설정
  const yesterday = moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss'); // 24시간 전 시간을 설정
  const weekAgo = moment().subtract(1, 'weeks').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const monthAgo = moment().subtract(1, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const yearAgo = moment().subtract(1, 'years').startOf('day').format('YYYY-MM-DD HH:mm:ss');

  const rankingQuery = (startDate, endDate) => `
    SELECT p.*, 
      (COUNT(DISTINCT v.EventID) + COUNT(DISTINCT r.EventID) * 2 + COUNT(DISTINCT ce.EventID) * 3) AS score,
      COUNT(DISTINCT r.EventID) AS recommendCount,
      COUNT(DISTINCT v.EventID) AS viewCount,
      COUNT(DISTINCT ce.EventID) AS commentCount
    FROM Post p
    LEFT JOIN RecommendationEvents r ON p.PostNumber = r.PostNumber AND r.EventTimestamp BETWEEN ? AND ?
    LEFT JOIN ViewEvents v ON p.PostNumber = v.PostNumber AND v.EventTimestamp BETWEEN ? AND ?
    LEFT JOIN CommentEvents ce ON p.PostNumber = ce.PostNumber AND ce.EventTimestamp BETWEEN ? AND ?
    LEFT JOIN Comment c ON p.PostNumber = c.CommentPostNumber
    GROUP BY p.PostNumber
    ORDER BY score DESC
    LIMIT 3
  `;

  db.query(rankingQuery(yesterday, now), [yesterday, now, yesterday, now, yesterday, now, yesterday, now], (err, dailyresult) => {
    if (err) {
      console.error('일간 랭킹 조회 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    db.query(rankingQuery(weekAgo, now), [weekAgo, now, weekAgo, now, weekAgo, now, weekAgo, now], (err, weeklyresult) => {
      if (err) {
        console.error('주간 랭킹 조회 실패: ' + err.stack);
        return res.status(500).send('Server error');
      }
      db.query(rankingQuery(monthAgo, now), [monthAgo, now, monthAgo, now, monthAgo, now, monthAgo, now], (err, monthlyresult) => {
        if (err) {
          console.error('월간 랭킹 조회 실패: ' + err.stack);
          return res.status(500).send('Server error');
        }
        db.query(rankingQuery(yearAgo, now), [yearAgo, now, yearAgo, now, yearAgo, now, yearAgo, now], (err, yearlyresult) => {
          if (err) {
            console.error('연간 랭킹 조회 실패: ' + err.stack);
            return res.status(500).send('Server error');
          }
          res.render('ranking', {
            user: user,
            dailyresult: dailyresult,
            weeklyresult: weeklyresult,
            monthlyresult: monthlyresult,
            yearlyresult: yearlyresult,
            moment: moment
          });
        });
      });
    });
  });
});

// 현재 비밀번호 확인 라우트
app.post('/verify-password', (req, res) => {
  const user = req.session.user;
  const { currentPassword } = req.body;

  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }

  const verifyPasswordQuery = 'SELECT MemberPassword FROM Member WHERE MemberNumber = ?';
  db.query(verifyPasswordQuery, [user.MemberNumber], (err, result) => {
    if (err) {
      console.error('비밀번호 확인 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }

    if (result[0].MemberPassword === currentPassword) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
});

// 비밀번호 변경 라우트
app.post('/change-password', (req, res) => {
  const user = req.session.user;
  const { newPassword, confirmPassword } = req.body;

  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }

  if (newPassword !== confirmPassword) {
    return res.send('<script type="text/javascript">alert("새 비밀번호와 비밀번호 확인이 일치하지 않습니다."); window.location="/edit-profile";</script>');
  }

  const changePasswordQuery = 'UPDATE Member SET MemberPassword = ? WHERE MemberNumber = ?';
  db.query(changePasswordQuery, [newPassword, user.MemberNumber], (err, result) => {
    if (err) {
      console.error('비밀번호 변경 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    res.send('<script type="text/javascript">alert("비밀번호가 성공적으로 변경되었습니다."); window.location="/";</script>');
  });
});

// 회원탈퇴 라우트
app.get('/delete-account', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).send('<script type="text/javascript">alert("로그인이 필요한 서비스입니다."); window.location="/"; </script>');
  }

  const deleteAccountQuery = 'UPDATE Member SET memberdeleteflag = "Y" WHERE MemberNumber = ?';
  db.query(deleteAccountQuery, [user.MemberNumber], (err, result) => {
    if (err) {
      console.error('회원탈퇴 실패: ' + err.stack);
      return res.status(500).send('Server error');
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('세션 제거 실패: ' + err);
        return res.status(500).send('Server error');
      }
      res.send('<script type="text/javascript">alert("회원탈퇴가 완료되었습니다."); window.location="/"; </script>');
    });
  });
});

//유저 정보 가져오기
app.get('/user-info', (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const getUserInfoQuery = 'SELECT MemberNumber, Nickname, Grade, (SELECT COUNT(*) FROM Post WHERE AuthorMemberNumber = MemberNumber) AS PostCount, (SELECT COUNT(*) FROM Comment WHERE CommentAuthorNumber = MemberNumber) AS CommentCount FROM Member WHERE MemberNumber = ?';

  db.query(getUserInfoQuery, [user.MemberNumber], (err, result) => {
    if (err) {
      console.error('유저 정보 조회 실패: ' + err.stack);
      return res.status(500).send({ error: 'Server error' });
    }

    if (result.length > 0) {
      res.send(result[0]);
    } else {
      res.status(404).send({ error: 'User not found' });
    }
  });
});

// 서버 실행
app.listen(8080, () => {
  console.log('http://localhost:8080 에서 서버 실행중');
});
