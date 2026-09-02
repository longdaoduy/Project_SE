# SmartEng — AI-Powered English Learning App

SmartEng là ứng dụng học tiếng Anh thông minh dành cho mobile và web, kết hợp flashcard theo thuật toán lặp cách quãng (SRS), bộ quiz đa dạng, và bài đọc hiểu do AI tạo ra. Người dùng tích lũy XP, theo dõi streak hàng ngày và xem biểu đồ tiến độ học tập mỗi tuần.

---

## Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Flashcard SRS** | Học từ vựng theo thuật toán SM-2. Mỗi thẻ được đánh giá Again / Hard / Good / Easy để hệ thống lên lịch ôn tập tối ưu |
| **Vocab Quiz** | 4 chế độ: Multiple Choice, Fill-in-the-Blank, Word Matching, Speed Round. Kết quả lưu lịch sử và cộng XP |
| **AI Reading** | Tạo đoạn văn + câu hỏi trắc nghiệm từ danh sách từ vựng bất kỳ. Hỗ trợ các cấp độ A1–C2. Sau khi nộp bài, AI tự động giải thích từng đáp án |
| **Word List** | Tra cứu từ vựng theo chủ đề, xem định nghĩa tiếng Việt, ví dụ, phiên âm. Gắn sao từ yêu thích |
| **Profile & Stats** | Streak, XP, tổng từ đã học, số quiz hoàn thành, giờ học. Biểu đồ hoạt động 7 ngày |
| **Deck tự tạo** | Người dùng tạo bộ flashcard riêng từ bất kỳ từ nào, lưu offline trên thiết bị |
| **Xác thực email** | Đăng ký tài khoản yêu cầu xác minh OTP qua email |

---

## Cấu trúc dự án

```
Project_SE/
├── backend/          # FastAPI REST API
│   ├── main.py       # Tất cả các endpoint
│   ├── crud.py       # Logic truy vấn cơ sở dữ liệu
│   ├── models.py     # SQLAlchemy ORM models
│   ├── schemas.py    # Pydantic schemas (request / response)
│   ├── database.py   # Engine + session (MySQL / Aiven)
│   ├── security.py   # JWT, bcrypt
│   ├── seed_gemini.py# Tích hợp AI (OpenRouter / Gemini)
│   ├── email_service.py # SMTP email verification
│   ├── profanity_filter.py
│   ├── .env          # ⚠️ Không commit — xem .env.example
│   └── .env.example  # Template biến môi trường
│
├── frontend/         # React Native (Expo SDK 54)
│   ├── App.js        # Navigation stack
│   ├── api.js        # Tất cả API calls (single source of truth)
│   ├── context/
│   │   └── DataContext.js  # Global state: auth, topics, statistics, decks
│   └── Screens/
│       ├── HomeScreen.js
│       ├── ProfileScreen.js
│       ├── FlashcardScreen.js
│       ├── VocabQuizScreen.js
│       ├── QuizMultipleChoice.js
│       ├── QuizFillInBlank.js
│       ├── QuizMatching.js
│       ├── QuizSpeedRound.js
│       ├── AIReadingScreen.js
│       ├── WordlistScreen.js
│       ├── HistoryScreen.js
│       ├── LoginScreen.js
│       ├── RegisterScreen.js
│       └── SettingScreen.js
│
├── requirements.txt  # Python dependencies
└── ca.pem            # SSL certificate cho Aiven MySQL
```

---

## Tech Stack

### Backend
| Thành phần | Công nghệ |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2 |
| Database | MySQL (Aiven Cloud) |
| Auth | JWT (PyJWT) + bcrypt |
| AI | OpenRouter API (ling-3.0-flash) / Gemini fallback |
| Email | SMTP (Gmail App Password) |
| Server | Uvicorn |

### Frontend
| Thành phần | Công nghệ |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Navigation | React Navigation v7 (Stack) |
| Animations | React Native Animated API |
| Storage | AsyncStorage (decks, auth token) |
| TTS | expo-speech |
| Platform | Android, iOS, Web |

---

## Cài đặt & Chạy

### Yêu cầu
- Python 3.11+
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- MySQL database (hoặc tài khoản Aiven miễn phí)

### 1. Backend

```bash
# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Cài dependencies
pip install -r requirements.txt

# Cấu hình môi trường
copy backend\.env.example backend\.env
# Mở backend/.env và điền các giá trị thật (DB, API key, SMTP)

# Chạy server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs tự động có tại: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install

# Mở frontend/api.js và cập nhật LAN_IP thành địa chỉ IP máy tính của bạn
# const LAN_IP = '192.168.x.x';

# Chạy
npx expo start
```

Quét QR bằng Expo Go trên điện thoại, hoặc nhấn `a` (Android emulator) / `w` (trình duyệt web).

---

## Biến môi trường (backend/.env)

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string MySQL đầy đủ |
| `DB_SSL_CA` | Đường dẫn tới file `ca.pem` (Aiven SSL) |
| `OPENROUTER_API_KEY` | API key từ [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | Model AI mặc định (`inclusionai/ling-3.0-flash:free`) |
| `SMTP_HOST / SMTP_PORT` | Cấu hình SMTP để gửi email xác thực |
| `SMTP_USERNAME / SMTP_PASSWORD` | Gmail address + App Password |
| `EMAIL_VERIFICATION_SECRET` | Chuỗi ngẫu nhiên dài để bảo vệ mã OTP |
| `APP_TIMEZONE` | Múi giờ tính streak (mặc định `Asia/Ho_Chi_Minh`) |

Xem đầy đủ tại [`backend/.env.example`](backend/.env.example).

---

## API Overview

Base URL: `http://<host>:8000`

| Nhóm | Endpoint tiêu biểu | Mô tả |
|---|---|---|
| Auth | `POST /users`, `POST /users/login` | Đăng ký, đăng nhập |
| User | `GET /me`, `PATCH /me` | Thông tin tài khoản |
| Statistics | `GET /me/statistics` | XP, streak, tổng từ, giờ học |
| Vocabulary | `GET /topics`, `GET /words` | Danh sách chủ đề và từ vựng |
| Flashcard | `POST /flashcard-sessions`, `POST /flashcard-sessions/{id}/rate` | Tạo session, đánh giá thẻ (SRS) |
| Quiz | `POST /quizzes/bulk`, `POST /quizzes/{id}/answers` | Tạo quiz + nộp toàn bộ đáp án 1 lần |
| AI Reading | `POST /ai-readings`, `POST /ai-readings/{id}/submit` | Tạo bài đọc AI, nộp bài |
| History | `GET /me/history`, `GET /me/weekly-activity` | Lịch sử học tập |

Xem chi tiết tại `/docs` (Swagger UI) khi server đang chạy.

---

## Database Schema (tóm tắt)

```
users ──< flashcard_sessions ──< flashcard_progress
      ──< user_card_srs
      ──< quizzes ──< quiz_questions
      ──< ai_readings ──< ai_reading_questions
      ──< starred_words
      ──< learning_history
      ──< user_statistics
      ──< daily_learning_log

topics ──< words
```

---

## Liên hệ

Dự án được phát triển trong khuôn khổ môn **IT Software Engineering** — Năm 2, Học kỳ III.
