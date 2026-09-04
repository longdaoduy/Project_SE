# SmartEng — AI-Powered English Learning App

SmartEng is a smart English vocabulary learning app for mobile and web. It combines spaced-repetition flashcards (SRS), multiple quiz modes, and AI-generated reading comprehension tests. Users earn XP, maintain daily streaks, and track their weekly learning progress.

---

## Features

| Feature | Description |
|---|---|
| **Flashcard SRS** | Learn vocabulary using the SM-2 spaced repetition algorithm. Rate each card as Again / Hard / Good / Easy to schedule optimal review intervals |
| **Vocab Quiz** | Four modes: Multiple Choice, Fill-in-the-Blank, Word Matching, and Speed Round. Results are saved to history and award XP |
| **AI Reading** | Generate a reading passage and multiple-choice comprehension questions from any vocabulary list. Supports CEFR levels A1–C2. After submission, the AI automatically explains each answer |
| **Word List** | Browse vocabulary by topic, view Vietnamese definitions, example sentences, and phonetics. Star favourite words for quick access |
| **Profile & Stats** | Track streak, XP, total words learned, quizzes completed, and study hours. Includes a 7-day activity bar chart |
| **Custom Decks** | Create personal flashcard decks from any words and save them offline on the device |
| **Email Verification** | Account registration requires OTP verification via email |

---

## Project Structure

```
Project_SE/
├── backend/                  # FastAPI REST API
│   ├── main.py               # All route handlers
│   ├── crud.py               # Database query logic
│   ├── models.py             # SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic request / response schemas
│   ├── database.py           # Engine + session (MySQL / Aiven)
│   ├── security.py           # JWT + bcrypt
│   ├── seed_gemini.py        # AI integration (OpenRouter / Gemini)
│   ├── email_service.py      # SMTP email verification
│   ├── profanity_filter.py   # Input content moderation
│   ├── .env                  # ⚠️ Not committed — see .env.example
│   └── .env.example          # Environment variable template
│
├── frontend/                 # React Native (Expo SDK 54)
│   ├── App.js                # Navigation stack
│   ├── api.js                # All API calls (single source of truth)
│   ├── context/
│   │   └── DataContext.js    # Global state: auth, topics, statistics, decks
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
├── requirements.txt          # Python dependencies
├── ca.pem                    # SSL certificate for Aiven MySQL
└── README.md
```

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2 |
| Database | MySQL (Aiven Cloud) |
| Authentication | JWT (PyJWT) + bcrypt |
| AI | OpenRouter API (`ling-3.0-flash`) / Gemini fallback |
| Email | SMTP (Gmail App Password) |
| Server | Uvicorn |

### Frontend
| Component | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Navigation | React Navigation v7 (Stack) |
| Animations | React Native Animated API |
| Local Storage | AsyncStorage (decks, auth token) |
| Text-to-Speech | expo-speech |
| Platforms | Android, iOS, Web |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Expo CLI — `npm install -g expo-cli`
- A MySQL database (or a free [Aiven](https://aiven.io) account)

### 1. Backend

```bash
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy backend\.env.example backend\.env
# Open backend/.env and fill in your real values (DB, API keys, SMTP)

# Start the development server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs are available at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install

# Open frontend/api.js and set LAN_IP to your machine's local IP address
# const LAN_IP = '192.168.x.x';   (run `ipconfig` on Windows to find it)

npx expo start
```

Scan the QR code with the Expo Go app, or press `a` for Android emulator / `w` for the browser.

---

## Environment Variables

All variables live in `backend/.env`. Copy `backend/.env.example` as a starting point.

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full MySQL connection string (pymysql driver) |
| `DB_SSL_CA` | Path to the `ca.pem` SSL certificate (Aiven) |
| `OPENROUTER_API_KEY` | API key from [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | AI model to use (default: `inclusionai/ling-3.0-flash:free`) |
| `GEMINI_API_KEY` | Gemini API key (fallback AI provider) |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server for sending verification emails |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Gmail address + App Password |
| `EMAIL_VERIFICATION_SECRET` | Long random string to protect OTP digests |
| `APP_TIMEZONE` | Timezone for streaks and activity (default: `Asia/Ho_Chi_Minh`) |

---

## API Overview

Base URL: `http://<host>:8000`

| Group | Key Endpoints | Description |
|---|---|---|
| Auth | `POST /users` · `POST /users/login` | Register and log in |
| User | `GET /me` · `PATCH /me` | Read and update account info |
| Statistics | `GET /me/statistics` · `GET /me/weekly-activity` | XP, streak, study hours, weekly chart |
| Vocabulary | `GET /topics` · `GET /words` | Topics and word lists |
| Flashcard | `POST /flashcard-sessions` · `POST /flashcard-sessions/{id}/rate` | Create session, rate a card (SRS) |
| Quiz | `POST /quizzes/bulk` · `POST /quizzes/{id}/answers` | Create quiz + submit all answers in one call |
| AI Reading | `POST /ai-readings` · `POST /ai-readings/{id}/submit` | Generate AI reading test, submit answers |
| History | `GET /me/history` · `GET /users/{id}/history/page` | Paginated learning history |

Full interactive documentation is available at `/docs` while the server is running.

---

## Database Schema

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

## Course Info

Developed as part of the **IT Software Engineering** course — Year 2, Semester III.
