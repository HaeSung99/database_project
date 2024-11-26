
SET FOREIGN_KEY_CHECKS = 0; -- 외래키 제약조건 해제

-- 데이터베이스에 있는 모든 테이블 삭제
DROP TABLE IF EXISTS CommentEvents;
DROP TABLE IF EXISTS ViewEvents;
DROP TABLE IF EXISTS RecommendationEvents;
DROP TABLE IF EXISTS Cache;
DROP TABLE IF EXISTS Comment;
DROP TABLE IF EXISTS Post;
DROP TABLE IF EXISTS Member;

SET FOREIGN_KEY_CHECKS = 1; -- 외래키 제약조건 복구

CREATE TABLE Member (
    MemberNumber INT AUTO_INCREMENT PRIMARY KEY, -- 회원 고유 번호
    MemberID VARCHAR(50) NOT NULL UNIQUE,       -- 회원 아이디
    MemberPassword VARCHAR(255) NOT NULL,       -- 회원 비밀번호
    Nickname VARCHAR(50) NOT NULL UNIQUE,       -- 닉네임
    Grade VARCHAR(20) DEFAULT 'Basic',          -- 등급 (기본값: Basic)
    PostCount INT DEFAULT 0,                    -- 작성한 게시글 수
    CommentCount INT DEFAULT 0,                 -- 작성한 댓글 수
    memberdeleteflag CHAR(1) DEFAULT 'N',       -- 삭제 여부 ('N': 사용중, 'Y': 삭제)
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 생성일
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- 업데이트일
);

CREATE TABLE Post (
    PostNumber INT AUTO_INCREMENT PRIMARY KEY,      -- 게시글 번호
    AuthorMemberNumber INT NOT NULL,                -- 작성자 회원 번호
    AuthorNickname VARCHAR(50) NOT NULL,           -- 작성자 닉네임
    Title VARCHAR(255) NOT NULL,                   -- 제목
    Intro TEXT,                                    -- 간단한 소개
    Method TEXT,                                   -- 방법
    Category VARCHAR(50),                          -- 카테고리
    People VARCHAR(50),                            -- 적정 인원
    Time VARCHAR(50),                              -- 소요 시간
    Difficulty VARCHAR(50),                        -- 난이도
    ImagePath VARCHAR(255),                        -- 이미지 경로
    Views INT DEFAULT 0,                           -- 조회수
    RecommendCounts INT DEFAULT 0,                 -- 추천수
    Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 게시글 작성 시간
    postdeleteflag CHAR(1) DEFAULT 'N',            -- 삭제 여부 ('N': 사용중, 'Y': 삭제)
    FOREIGN KEY (AuthorMemberNumber) REFERENCES Member(MemberNumber) -- 작성자 외래키
);

CREATE TABLE Comment (
    CommentNumber INT AUTO_INCREMENT PRIMARY KEY,  -- 댓글 번호
    CommentPostNumber INT NOT NULL,                -- 게시글 번호
    CommentAuthorNumber INT NOT NULL,              -- 작성자 회원 번호
    CommentAuthorNickname VARCHAR(50) NOT NULL,    -- 작성자 닉네임
    CommentContent TEXT NOT NULL,                  -- 댓글 내용
    CommentTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 작성 시간
    FOREIGN KEY (CommentPostNumber) REFERENCES Post(PostNumber), -- 게시글 외래키
    FOREIGN KEY (CommentAuthorNumber) REFERENCES Member(MemberNumber) -- 작성자 외래키
);

CREATE TABLE Cache (
    CacheID INT AUTO_INCREMENT PRIMARY KEY,        -- 캐시 ID
    cache_key VARCHAR(255) NOT NULL UNIQUE,        -- 캐시 키
    cache_value TEXT,                              -- 캐시 데이터 (JSON 형태)
    expiration TIMESTAMP NOT NULL                  -- 만료 시간
);

CREATE TABLE RecommendationEvents (
    EventID INT AUTO_INCREMENT PRIMARY KEY,        -- 추천 이벤트 ID
    PostNumber INT NOT NULL,                       -- 게시글 번호
    MemberNumber INT NOT NULL,                     -- 추천한 회원 번호
    EventTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 이벤트 발생 시간
    FOREIGN KEY (PostNumber) REFERENCES Post(PostNumber), -- 게시글 외래키
    FOREIGN KEY (MemberNumber) REFERENCES Member(MemberNumber) -- 회원 외래키
);

CREATE TABLE ViewEvents (
    EventID INT AUTO_INCREMENT PRIMARY KEY,        -- 조회 이벤트 ID
    PostNumber INT NOT NULL,                       -- 게시글 번호
    EventTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 조회 발생 시간
    FOREIGN KEY (PostNumber) REFERENCES Post(PostNumber) -- 게시글 외래키
);

CREATE TABLE CommentEvents (
    EventID INT AUTO_INCREMENT PRIMARY KEY,        -- 댓글 이벤트 ID
    CommentNumber INT NOT NULL,                    -- 댓글 번호
    PostNumber INT NOT NULL,                       -- 게시글 번호
    EventTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 이벤트 발생 시간
    FOREIGN KEY (CommentNumber) REFERENCES Comment(CommentNumber), -- 댓글 외래키
    FOREIGN KEY (PostNumber) REFERENCES Post(PostNumber) -- 게시글 외래키
);
