"""
SmartEng REST API  v3.0
========================
Endpoint groups:
  /topics /words                – FR6  Vocabulary Database
  /users /profile-settings      – FR1  User Management
  /history /statistics          – FR4  Learning History & Stats
  /flashcard-sessions           – FR2  Flashcard Learning
  /starred-words                – FR2  Starred Words
  /quizzes                      – FR3  Quiz / Test
  /ai-readings                  – FR8  AI Reading Generation
"""

from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import SessionLocal, engine
from .security import create_access_token, decode_access_token, hash_password, needs_rehash, verify_password

app = FastAPI(title="SmartEng API", version="3.1.0")
bearer = HTTPBearer(auto_error=False)

# ── CORS – allow all origins so Expo web / mobile simulators can reach the API ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    models.Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    """Resolve the authenticated user from a JWT and an active DB session."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    session = crud.get_active_session_by_token(db, credentials.credentials)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=401, detail="Session is inactive or invalid")
    user = crud.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    return user


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# ============================================================
# FR6 – Vocabulary Database
# ============================================================

@app.post("/topics", response_model=schemas.TopicRead, tags=["vocabulary"])
def create_topic(payload: schemas.TopicCreate, db: Session = Depends(get_db)):
    if crud.get_topic_by_name(db, payload.topic_name):
        raise HTTPException(400, "Topic already exists")
    return crud.create_topic(db, payload)


@app.get("/topics", response_model=List[schemas.TopicRead], tags=["vocabulary"])
def get_topics(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return crud.list_topics(db, limit=limit, offset=offset)


@app.get("/topics/{topic_id}", response_model=schemas.TopicRead, tags=["vocabulary"])
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(404, "Topic not found")
    return topic


@app.post("/words", response_model=schemas.WordRead, tags=["vocabulary"])
def create_word(payload: schemas.WordCreate, db: Session = Depends(get_db)):
    if not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(404, "Topic not found")
    return crud.create_word(db, payload)


@app.get("/words", response_model=List[schemas.WordRead], tags=["vocabulary"])
def get_words(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    topic_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    return crud.list_words(db, limit=limit, offset=offset, topic_id=topic_id)


@app.get("/words/{word_id}", response_model=schemas.WordRead, tags=["vocabulary"])
def get_word(word_id: int, db: Session = Depends(get_db)):
    word = crud.get_word_by_id(db, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    return word


@app.get("/flashcards/random", response_model=List[schemas.WordRead], tags=["vocabulary"])
def get_random_flashcards(
    limit: int = Query(10, ge=1, le=50),
    topic_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    return crud.get_random_words(db, limit=limit, topic_id=topic_id)


# ============================================================
# FR1 – User Management
# ============================================================

@app.post("/users", response_model=schemas.UserRead, tags=["users"])
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(400, "Email already registered")
    return crud.create_user(db, payload, hashed_password=hash_password(payload.password))


@app.get("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@app.patch("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return crud.update_user(db, user, payload)


@app.post("/users/login", response_model=schemas.UserLoginResponse, tags=["users"])
def login_user(payload: schemas.UserLoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        if user:
            crud.create_login_log(db, user.user_id, "Failed",
                                  ip_address=payload.ip_address,
                                  device_name=payload.device_name)
        raise HTTPException(401, "Invalid email or password")

    # Transparently upgrade accounts created by the old SHA-256 implementation.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.user_id)
    session = crud.create_user_session(
        db, user.user_id, token,
        device_name=payload.device_name,
        ip_address=payload.ip_address,
    )
    crud.create_login_log(db, user.user_id, "Success",
                          ip_address=payload.ip_address,
                          device_name=payload.device_name)
    return {"user": user, "jwt_token": token, "session_id": session.session_id}


@app.post("/users/logout", tags=["users"])
def logout_user(session_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    """Invalidate a session token (logout)."""
    ok = crud.invalidate_user_session(db, session_id)
    if not ok:
        raise HTTPException(404, "Session not found")
    return {"detail": "Logged out successfully"}


@app.get(
    "/users/{user_id}/sessions",
    response_model=List[schemas.UserSessionRead],
    tags=["users"],
)
def get_user_sessions(user_id: int, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_user_sessions(db, user_id)


@app.get(
    "/users/{user_id}/login-logs",
    response_model=List[schemas.LoginLogRead],
    tags=["users"],
)
def get_login_logs(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_login_logs(db, user_id, limit=limit)


@app.post("/users/{user_id}/change-password", tags=["users"])
def change_password(
    user_id: int, payload: schemas.ChangePasswordRequest, db: Session = Depends(get_db)
):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "New passwords do not match")
    if payload.new_password == payload.current_password:
        raise HTTPException(400, "New password must be different from current password")
    crud.change_user_password(db, user, hash_password(payload.new_password))
    # Invalidate all existing sessions so a changed password cannot leave old tokens usable.
    for session in crud.list_user_sessions(db, user_id):
        if session.is_active:
            crud.invalidate_user_session(db, session.session_id)
    return {"detail": "Password changed successfully"}


@app.delete("/users/{user_id}", tags=["users"])
def delete_user(
    user_id: int, payload: schemas.DeleteAccountRequest, db: Session = Depends(get_db)
):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(400, "Incorrect password")
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(400, 'Confirmation must be "DELETE"')
    crud.delete_user_account(db, user)
    return {"detail": "Account deleted successfully"}


@app.post("/me/logout", tags=["users"])
def logout_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = crud.get_active_session_by_token(db, credentials.credentials)
    if session:
        crud.invalidate_user_session(db, session.session_id)
    return {"detail": "Logged out successfully"}


@app.get("/me", response_model=schemas.UserRead, tags=["users"])
def get_me(current_user=Depends(get_current_user)):
    return current_user


@app.patch("/me", response_model=schemas.UserRead, tags=["users"])
def update_me(
    payload: schemas.UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.update_user(db, current_user, payload)


@app.post("/me/change-password", tags=["users"])
def change_my_password(
    payload: schemas.ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "New passwords do not match")
    if payload.new_password == payload.current_password:
        raise HTTPException(400, "New password must be different from current password")
    crud.change_user_password(db, current_user, hash_password(payload.new_password))
    for session in crud.list_user_sessions(db, current_user.user_id):
        if session.is_active:
            crud.invalidate_user_session(db, session.session_id)
    return {"detail": "Password changed successfully. Please log in again."}


@app.delete("/me", tags=["users"])
def delete_me(
    payload: schemas.DeleteAccountRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(400, "Incorrect password")
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(400, 'Confirmation must be "DELETE"')
    crud.delete_user_account(db, current_user)
    return {"detail": "Account deleted successfully"}


# ── Profile Settings ──────────────────────────────────────────────────────────

@app.get(
    "/users/{user_id}/profile-settings",
    response_model=schemas.ProfileSettingsRead,
    tags=["users"],
)
def get_profile_settings(user_id: int, db: Session = Depends(get_db)):
    settings = crud.get_profile_settings(db, user_id)
    if not settings:
        raise HTTPException(404, "Settings not found")
    return settings


@app.patch(
    "/users/{user_id}/profile-settings",
    response_model=schemas.ProfileSettingsRead,
    tags=["users"],
)
def update_profile_settings(
    user_id: int,
    payload: schemas.ProfileSettingsUpdate,
    db: Session = Depends(get_db),
):
    settings = crud.get_profile_settings(db, user_id)
    if not settings:
        raise HTTPException(404, "Settings not found")
    return crud.update_profile_settings(db, settings, payload)


# ============================================================
# FR4 – Learning History & Statistics
# ============================================================

@app.get(
    "/users/{user_id}/history",
    response_model=List[schemas.LearningHistoryRead],
    tags=["history"],
)
def get_learning_history(
    user_id: int,
    activity_type: str | None = Query(default=None, pattern="^(Flashcard|Quiz|AI Reading)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Backward-compatible list endpoint used by the existing frontend."""
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_learning_history(db, user_id, activity_type=activity_type,
                                      limit=limit, offset=offset)


@app.get("/users/{user_id}/history/page", response_model=schemas.LearningHistoryPage, tags=["history"])
def get_learning_history_page(
    user_id: int,
    activity_type: str | None = Query(default=None, pattern="^(Flashcard|Quiz|AI Reading)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    total = crud.count_learning_history(db, user_id, activity_type=activity_type)
    items = crud.list_learning_history(db, user_id, activity_type=activity_type,
                                       limit=limit, offset=offset)
    return {"total": total, "limit": limit, "offset": offset,
            "has_more": offset + len(items) < total, "items": items}


@app.get("/users/{user_id}/weekly-activity", response_model=schemas.WeeklyActivityResponse, tags=["history"])
def get_weekly_activity(user_id: int, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return {"items": crud.get_weekly_activity(db, user_id)}


@app.get(
    "/users/{user_id}/statistics",
    response_model=schemas.UserStatisticsRead,
    tags=["history"],
)
def get_user_statistics(user_id: int, db: Session = Depends(get_db)):
    stats = crud.get_user_statistics(db, user_id)
    if not stats:
        raise HTTPException(404, "Statistics not found")
    return stats


@app.get("/me/history", response_model=schemas.LearningHistoryPage, tags=["history"])
def get_my_history(
    activity_type: str | None = Query(default=None, pattern="^(Flashcard|Quiz|AI Reading)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = crud.count_learning_history(db, current_user.user_id, activity_type=activity_type)
    items = crud.list_learning_history(db, current_user.user_id, activity_type=activity_type,
                                       limit=limit, offset=offset)
    return {"total": total, "limit": limit, "offset": offset,
            "has_more": offset + len(items) < total, "items": items}


@app.get("/me/statistics", response_model=schemas.UserStatisticsRead, tags=["history"])
def get_my_statistics(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    stats = crud.get_user_statistics(db, current_user.user_id)
    if not stats:
        raise HTTPException(404, "Statistics not found")
    return stats


@app.get("/me/weekly-activity", response_model=schemas.WeeklyActivityResponse, tags=["history"])
def get_my_weekly_activity(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return {"items": crud.get_weekly_activity(db, current_user.user_id)}


# ============================================================
# FR2 – Flashcard Learning
# ============================================================

@app.post("/flashcard-sessions", response_model=schemas.FlashcardSessionRead, tags=["flashcards"])
def start_flashcard_session(payload: schemas.FlashcardSessionCreate, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(404, "User not found")
    if payload.topic_id and not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(404, "Topic not found")
    return crud.create_flashcard_session(db, payload)


@app.get("/flashcard-sessions/{session_id}", response_model=schemas.FlashcardSessionRead, tags=["flashcards"])
def get_flashcard_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_flashcard_session(db, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@app.get("/users/{user_id}/flashcard-sessions", response_model=List[schemas.FlashcardSessionRead], tags=["flashcards"])
def list_user_flashcard_sessions(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_flashcard_sessions(db, user_id, limit=limit, offset=offset)


@app.post("/flashcard-sessions/{session_id}/complete", response_model=schemas.FlashcardSessionRead, tags=["flashcards"])
def complete_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_flashcard_session(db, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return crud.complete_flashcard_session(db, session)


@app.post("/flashcard-progress", response_model=schemas.FlashcardProgressRead, tags=["flashcards"])
def create_flashcard_progress(payload: schemas.FlashcardProgressCreate, db: Session = Depends(get_db)):
    if not crud.get_flashcard_session(db, payload.session_id):
        raise HTTPException(404, "Session not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(404, "Word not found")
    return crud.create_flashcard_progress(db, payload)


@app.patch("/flashcard-progress/{progress_id}", response_model=schemas.FlashcardProgressRead, tags=["flashcards"])
def update_flashcard_progress(
    progress_id: int,
    payload: schemas.FlashcardProgressUpdate,
    db: Session = Depends(get_db),
):
    progress = crud.get_flashcard_progress(db, progress_id)
    if not progress:
        raise HTTPException(404, "Progress record not found")
    return crud.update_flashcard_progress(db, progress, payload)


@app.post("/starred-words", response_model=schemas.StarredWordRead, tags=["flashcards"])
def star_word(payload: schemas.StarredWordCreate, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(404, "User not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(404, "Word not found")
    return crud.star_word(db, payload)


@app.delete("/starred-words", tags=["flashcards"])
def unstar_word(
    user_id: int = Query(..., ge=1),
    word_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    if not crud.unstar_word(db, user_id=user_id, word_id=word_id):
        raise HTTPException(404, "Starred word not found")
    return {"detail": "Word unstarred successfully"}


@app.get("/users/{user_id}/starred-words", response_model=List[schemas.StarredWordRead], tags=["flashcards"])
def list_starred_words(
    user_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_starred_words(db, user_id, limit=limit, offset=offset)


# ============================================================
# FR3 – Quiz / Test
# ============================================================

@app.post("/quizzes", response_model=schemas.QuizRead, tags=["quiz"])
def create_quiz(payload: schemas.QuizCreate, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(404, "User not found")
    if payload.topic_id and not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(404, "Topic not found")
    return crud.create_quiz(db, payload)


@app.get("/quizzes/{quiz_id}", response_model=schemas.QuizRead, tags=["quiz"])
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    return quiz


@app.get("/users/{user_id}/quizzes", response_model=List[schemas.QuizRead], tags=["quiz"])
def list_user_quizzes(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_quizzes(db, user_id, limit=limit, offset=offset)


@app.post("/quizzes/{quiz_id}/questions", response_model=schemas.QuizQuestionRead, tags=["quiz"])
def add_quiz_question(
    quiz_id: int,
    payload: schemas.QuizQuestionCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_quiz(db, quiz_id):
        raise HTTPException(404, "Quiz not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(404, "Word not found")
    payload.quiz_id = quiz_id
    return crud.add_quiz_question(db, payload)


@app.get("/quiz-questions/{question_id}", response_model=schemas.QuizQuestionRead, tags=["quiz"])
def get_quiz_question(question_id: int, db: Session = Depends(get_db)):
    q = crud.get_quiz_question(db, question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    return q


@app.patch("/quiz-questions/{question_id}/answer", response_model=schemas.QuizQuestionRead, tags=["quiz"])
def answer_quiz_question(
    question_id: int,
    payload: schemas.QuizAnswerSubmit,
    db: Session = Depends(get_db),
):
    q = crud.get_quiz_question(db, question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    return crud.submit_quiz_answer(db, q, payload)


@app.post("/quizzes/{quiz_id}/submit", response_model=schemas.QuizResultRead, tags=["quiz"])
def submit_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if quiz.is_completed:
        raise HTTPException(400, "Quiz already submitted")
    return crud.calculate_quiz_score(db, quiz)


# ============================================================
# FR8 – AI Reading Generation
# ============================================================

@app.post("/ai-readings", response_model=schemas.AIReadingRead, tags=["ai-reading"])
def create_ai_reading(payload: schemas.AIReadingCreate, db: Session = Depends(get_db)):
    """Generate passage + comprehension questions, persist everything."""
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(404, "User not found")

    from .seed_gemini import generate_reading_passage, generate_comprehension_questions

    try:
        generated_passage = generate_reading_passage(
            vocabulary=payload.input_vocabulary,
            topic=payload.topic_param,
            difficulty=payload.difficulty_param,
        )
    except Exception as exc:
        generated_passage = (
            f"[Passage generation failed: {exc}] Vocabulary: {payload.input_vocabulary}"
        )

    reading = crud.create_ai_reading(db, payload, generated_passage=generated_passage)

    try:
        for q in generate_comprehension_questions(
            passage=generated_passage,
            vocabulary=payload.input_vocabulary,
            count=4,
        ):
            crud.add_ai_reading_question(
                db,
                schemas.AIReadingQuestionCreate(
                    reading_id=reading.reading_id,
                    question_text=q["question_text"],
                    option_a=q["option_a"],
                    option_b=q["option_b"],
                    option_c=q["option_c"],
                    option_d=q["option_d"],
                    correct_option=q["correct_option"],
                ),
            )
    except Exception:
        pass

    db.refresh(reading)
    _ = reading.comprehension_questions
    return reading


@app.get("/ai-readings/{reading_id}", response_model=schemas.AIReadingRead, tags=["ai-reading"])
def get_ai_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = crud.get_ai_reading(db, reading_id)
    if not reading:
        raise HTTPException(404, "Reading not found")
    return reading


@app.get("/users/{user_id}/ai-readings", response_model=List[schemas.AIReadingRead], tags=["ai-reading"])
def list_user_ai_readings(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found")
    return crud.list_ai_readings(db, user_id, limit=limit, offset=offset)


@app.post("/ai-readings/{reading_id}/questions", response_model=schemas.AIReadingQuestionRead, tags=["ai-reading"])
def add_ai_reading_question(
    reading_id: int,
    payload: schemas.AIReadingQuestionCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_ai_reading(db, reading_id):
        raise HTTPException(404, "Reading not found")
    payload.reading_id = reading_id
    return crud.add_ai_reading_question(db, payload)


@app.patch("/ai-reading-questions/{question_id}/answer", response_model=schemas.AIReadingQuestionRead, tags=["ai-reading"])
def answer_ai_reading_question(
    question_id: int,
    payload: schemas.AIReadingAnswerSubmit,
    db: Session = Depends(get_db),
):
    q = crud.get_ai_reading_question(db, question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    return crud.submit_ai_reading_answer(db, q, payload)


@app.post("/ai-readings/{reading_id}/submit", response_model=schemas.AIReadingRead, tags=["ai-reading"])
def submit_ai_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = crud.get_ai_reading(db, reading_id)
    if not reading:
        raise HTTPException(404, "Reading not found")
    if reading.is_completed:
        raise HTTPException(400, "Reading test already submitted")
    return crud.calculate_ai_reading_score(db, reading)
