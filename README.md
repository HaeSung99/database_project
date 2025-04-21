# 🍳 나만의 레시피 프로젝트

> Express.js와 MySQL 기반의 **레시피 공유 커뮤니티** 웹 서비스  
> 사용자 인증, CRUD 게시판, 추천 시스템, 랭킹 기능, 캐시 기반 오늘의 추천 등 다양한 기능 탑재!

---

## 🗓️ 개발 기간

- 2024년 5월 ~ 2024년 6월

---

## 🌟 주요 기능

### ✅ 회원 기능
- 회원가입 / 로그인 / 로그아웃
- 비밀번호 변경, 회원 탈퇴
- 회원 정보 조회 및 수정
- 게시글 및 댓글 작성 수 실시간 집계
- 회원 탈퇴를 했을때 데이터를 삭제하는것이 아니라 데이터베이스의 flag를 생성하여 Y/N 으로 데이터 보관하는 구조로 설계

### 📝 게시판 기능
- 게시글 작성 / 수정 / 삭제 (soft delete)
- 댓글 작성
- 카테고리, 난이도, 인원수, 소요시간 필터링
- 제목 기반 검색
- 이미지 업로드 기능 (Multer 사용)
- EJS 기반 SSR 화면 렌더링
- 게시글을 삭제했을때 데이터를 삭제하는것이 아니라 데이터베이스의 flag를 생성하여 Y/N 으로 데이터 보관하는 구조로 설계

### ❤️ 추천 시스템
- 게시글 추천 기능
- 중복 추천 방지 처리
- 추천 시 조회수 보정 처리 (추천을 눌렀을때 새로고침 되는것을 조회수로 계산하지않기 위해서 조회수 -1 로 설계)

### 🧠 캐싱 & 추천
- 매일 자정 무작위 추천 게시글 캐싱 (Cron + MySQL Cache 테이블)
- 추천 캐시 유효기간 관리 및 만료 시 재생성

### 🏆 랭킹 페이지
- 일간 / 주간 / 월간 / 연간 랭킹
- 조회수, 추천수, 댓글수를 기준으로 점수 계산
- 조회, 추천, 댓글 이벤트 로그 기록 기반 분석

---

## 🖼️ 주요 페이지 소개

| 페이지 | 설명 | 이미지 |
|--------|------|--------|
| 메인화면 | 오늘의 추천 게시글을 보여주는 첫 화면입니다. | <img src="https://github.com/user-attachments/assets/75b44b93-e2a0-45a3-a232-81825b88c5bd" width="100%"> |
| 카테고리 페이지 | 필터 조건(카테고리/시간/인원/난이도)으로 게시글을 탐색할 수 있습니다. | <img src="https://github.com/user-attachments/assets/ea3d700f-99cb-4b26-8056-445beb43d7f5" width="100%"> |
| 게시글 상세페이지 | 제목, 내용, 이미지, 댓글 및 추천 기능이 포함된 상세 페이지입니다. | <img src="https://github.com/user-attachments/assets/f2248e47-508a-4ad3-a1cd-c1b732da7d7d" width="100%"> |
| 글쓰기 페이지 | 이미지와 정보를 입력하여 게시글을 작성할 수 있습니다. | <img src="https://github.com/user-attachments/assets/74fef81c-0e26-46fd-9282-f6d176e23391" width="100%"> |
| 랭킹 페이지 | 일간/주간/월간/연간 기준 추천/조회/댓글 점수 기반 게시글 랭킹을 보여줍니다. | <img src="https://github.com/user-attachments/assets/0b10d3bd-c255-4d9e-b1c8-2bd2f372c0a7" width="100%"> |

## 🗂️ ERD 다이어그램

> 본 프로젝트에서 사용된 데이터베이스 구조는 아래 ERD를 통해 확인할 수 있습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/75b44b93-e2a0-45a3-a232-81825b88c5bd" alt="ERD Diagram" width="100%">
</p>

---

## 💻 기술 스택

| 구분       | 사용 기술                         |
|------------|----------------------------------|
| **Frontend** | EJS (서버사이드 렌더링)            |
| **Backend**  | Node.js, Express.js             |
| **Database** | MySQL                          |
| **캐싱 / 스케줄링** | Cron, moment.js               |
| **파일 업로드** | Multer (이미지 업로드)          |
| **인증**      | express-session 기반 로그인 유지 |
| **뷰 템플릿** | EJS + Bootstrap 또는 Custom CSS |

---

## 🚀 설치 및 실행 방법

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 2. 의존성 설치
npm install

# 3. MySQL 데이터베이스 설정 후 서버 실행
node server.js.js
