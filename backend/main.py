"""
SmartEng REST API
Endpoints grouped by feature:
  /topics, /words              – FR6 Vocabulary Database
  /users                       – FR1 User Management (stub – no auth middleware yet)
  /flashcard-sessions          – FR2 Flashcard Learning
  /starred-words               – FR2 Star Vocabulary Word (FR16)
  /quizzes                     – FR3 Quiz / Test
  /ai-readings                 – FR8 AI Reading Generation
"""

from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import SessionLocal, engine

app = FastAPI(title="SmartEng API", version="2.0.0")


@app.on_event("startup")
def on_startup() -> None:
    models.Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# Health
# ============================================================

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# ============================================================
# FR6 – Vocabulary Database
# ============================================================

@app.post("/topics", response_model=schemas.TopicRead, tags=["vocabulary"])
def create_topic(payload: schemas.TopicCreate, db: Session = Depends(get_db)):
    if crud.get_topic_by_name(db, payload.topic_name):
        raise HTTPException(status_code=400, detail="Topic already exists")
    return crud.create_topic(db, payload)


@app.get("/topics", response_model=List[schemas.TopicRead], tags=["vocabulary"])
def get_topics(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return crud.list_topics(db, limit=limit, offset=offset)


@app.post("/words", response_model=schemas.WordRead, tags=["vocabulary"])
def create_word(payload: schemas.WordCreate, db: Session = Depends(get_db)):
    if not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    return crud.create_word(db, payload)


@app.get("/words", response_model=List[schemas.WordRead], tags=["vocabulary"])
def get_words(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    topic_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    return crud.list_words(db, limit=limit, offset=offset, topic_id=topic_id)


@app.get("/flashcards/random", response_model=List[schemas.WordRead], tags=["vocabulary"])
def get_random_flashcards(
    limit: int = Query(10, ge=1, le=50),
    topic_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    return crud.get_random_words(db, limit=limit, topic_id=topic_id)


# ============================================================
# FR1 – User Management (basic CRUD stub)
# ============================================================

@app.post("/users", response_model=schemas.UserRead, tags=["users"])
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if crud.get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    # NOTE: replace with bcrypt hash in production auth layer
    import hashlib
    hashed = hashlib.sha256(payload.password.encode()).hexdigest()
    return crud.create_user(db, payload, hashed_password=hashed)


@app.get("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.patch("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.update_user(db, user, payload)


# ============================================================
# FR2 – Flashcard Learning
# ============================================================

@app.post(
    "/flashcard-sessions",
    response_model=schemas.FlashcardSessionRead,
    tags=["flashcards"],
)
def start_flashcard_session(
    payload: schemas.FlashcardSessionCreate, db: Session = Depends(get_db)
):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if payload.topic_id and not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    return crud.create_flashcard_session(db, payload)


@app.get(
    "/flashcard-sessions/{session_id}",
    response_model=schemas.FlashcardSessionRead,
    tags=["flashcards"],
)
def get_flashcard_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_flashcard_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get(
    "/users/{user_id}/flashcard-sessions",
    response_model=List[schemas.FlashcardSessionRead],
    tags=["flashcards"],
)
def list_user_flashcard_sessions(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return crud.list_flashcard_sessions(db, user_id, limit=limit, offset=offset)


@app.post(
    "/flashcard-sessions/{session_id}/complete",
    response_model=schemas.FlashcardSessionRead,
    tags=["flashcards"],
)
def complete_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_flashcard_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return crud.complete_flashcard_session(db, session)


@app.post(
    "/flashcard-progress",
    response_model=schemas.FlashcardProgressRead,
    tags=["flashcards"],
)
def create_flashcard_progress(
    payload: schemas.FlashcardProgressCreate, db: Session = Depends(get_db)
):
    if not crud.get_flashcard_session(db, payload.session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(status_code=404, detail="Word not found")
    return crud.create_flashcard_progress(db, payload)


@app.patch(
    "/flashcard-progress/{progress_id}",
    response_model=schemas.FlashcardProgressRead,
    tags=["flashcards"],
    summary="Flip card or submit difficulty rating (SRS)",
)
def update_flashcard_progress(
    progress_id: int,
    payload: schemas.FlashcardProgressUpdate,
    db: Session = Depends(get_db),
):
    """
    - Set is_flipped=true to record the card was flipped (FR2).
    - Set difficulty_rating to feed the Spaced Repetition System (FR14).
    """
    progress = crud.get_flashcard_progress(db, progress_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Progress record not found")
    return crud.update_flashcard_progress(db, progress, payload)


# ============================================================
# FR16 – Starred / Bookmarked Words
# ============================================================

@app.post("/starred-words", response_model=schemas.StarredWordRead, tags=["flashcards"])
def star_word(payload: schemas.StarredWordCreate, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(status_code=404, detail="Word not found")
    return crud.star_word(db, payload)


@app.delete(
    "/starred-words",
    tags=["flashcards"],
    summary="Unstar / remove bookmark from a word",
)
def unstar_word(
    user_id: int = Query(..., ge=1),
    word_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    removed = crud.unstar_word(db, user_id=user_id, word_id=word_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Starred word not found")
    return {"detail": "Word unstarred successfully"}


@app.get(
    "/users/{user_id}/starred-words",
    response_model=List[schemas.StarredWordRead],
    tags=["flashcards"],
)
def list_starred_words(
    user_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return crud.list_starred_words(db, user_id, limit=limit, offset=offset)


# ============================================================
# FR3 – Quiz / Test
# ============================================================

@app.post("/quizzes", response_model=schemas.QuizRead, tags=["quiz"])
def create_quiz(payload: schemas.QuizCreate, db: Session = Depends(get_db)):
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if payload.topic_id and not crud.get_topic_by_id(db, payload.topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    return crud.create_quiz(db, payload)


@app.get("/quizzes/{quiz_id}", response_model=schemas.QuizRead, tags=["quiz"])
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@app.get(
    "/users/{user_id}/quizzes",
    response_model=List[schemas.QuizRead],
    tags=["quiz"],
)
def list_user_quizzes(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return crud.list_quizzes(db, user_id, limit=limit, offset=offset)


@app.post(
    "/quizzes/{quiz_id}/questions",
    response_model=schemas.QuizQuestionRead,
    tags=["quiz"],
)
def add_quiz_question(
    quiz_id: int,
    payload: schemas.QuizQuestionCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_quiz(db, quiz_id):
        raise HTTPException(status_code=404, detail="Quiz not found")
    if not crud.get_word_by_id(db, payload.word_id):
        raise HTTPException(status_code=404, detail="Word not found")
    payload.quiz_id = quiz_id
    return crud.add_quiz_question(db, payload)


@app.get(
    "/quiz-questions/{question_id}",
    response_model=schemas.QuizQuestionRead,
    tags=["quiz"],
)
def get_quiz_question_detail(question_id: int, db: Session = Depends(get_db)):
    question = crud.get_quiz_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@app.patch(
    "/quiz-questions/{question_id}/answer",
    response_model=schemas.QuizQuestionRead,
    tags=["quiz"],
    summary="Submit a user's answer for one quiz question",
)
def answer_quiz_question(
    question_id: int,
    payload: schemas.QuizAnswerSubmit,
    db: Session = Depends(get_db),
):
    question = crud.get_quiz_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return crud.submit_quiz_answer(db, question, payload)


@app.post(
    "/quizzes/{quiz_id}/submit",
    response_model=schemas.QuizResultRead,
    tags=["quiz"],
    summary="Submit quiz – calculate & display final score (FR3)",
)
def submit_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.is_completed:
        raise HTTPException(status_code=400, detail="Quiz already submitted")
    return crud.calculate_quiz_score(db, quiz)


# ============================================================
# FR8 – AI Reading Generation
# ============================================================

@app.post("/ai-readings", response_model=schemas.AIReadingRead, tags=["ai-reading"])
def create_ai_reading(
    payload: schemas.AIReadingCreate,
    db: Session = Depends(get_db),
):
    """
    Accepts vocabulary input + optional params, calls the Gemini/AI service,
    persists the generated passage, and returns it with an empty question list.
    The frontend should then POST questions to /ai-readings/{id}/questions.
    """
    if not crud.get_user_by_id(db, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")

    # --- AI generation (Gemini integration hook) ---
    # Import the seed_gemini helper that already exists in this project.
    # Replace this block with your actual Gemini call as needed.
    try:
        from .seed_gemini import generate_reading_passage  # type: ignore
        generated_passage = generate_reading_passage(
            vocabulary=payload.input_vocabulary,
            topic=payload.topic_param,
            difficulty=payload.difficulty_param,
        )
    except Exception:
        # Fallback placeholder so the endpoint doesn't crash if the AI
        # service is unavailable during development.
        generated_passage = (
            f"[AI passage for vocabulary: {payload.input_vocabulary}] "
            "(Connect Gemini API to replace this placeholder.)"
        )

    return crud.create_ai_reading(db, payload, generated_passage=generated_passage)


@app.get(
    "/ai-readings/{reading_id}",
    response_model=schemas.AIReadingRead,
    tags=["ai-reading"],
)
def get_ai_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = crud.get_ai_reading(db, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")
    return reading


@app.get(
    "/users/{user_id}/ai-readings",
    response_model=List[schemas.AIReadingRead],
    tags=["ai-reading"],
)
def list_user_ai_readings(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return crud.list_ai_readings(db, user_id, limit=limit, offset=offset)


@app.post(
    "/ai-readings/{reading_id}/questions",
    response_model=schemas.AIReadingQuestionRead,
    tags=["ai-reading"],
)
def add_ai_reading_question(
    reading_id: int,
    payload: schemas.AIReadingQuestionCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_ai_reading(db, reading_id):
        raise HTTPException(status_code=404, detail="Reading not found")
    payload.reading_id = reading_id
    return crud.add_ai_reading_question(db, payload)


@app.patch(
    "/ai-reading-questions/{question_id}/answer",
    response_model=schemas.AIReadingQuestionRead,
    tags=["ai-reading"],
    summary="Submit answer to an AI reading comprehension question",
)
def answer_ai_reading_question(
    question_id: int,
    payload: schemas.AIReadingAnswerSubmit,
    db: Session = Depends(get_db),
):
    question = crud.get_ai_reading_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return crud.submit_ai_reading_answer(db, question, payload)


@app.post(
    "/ai-readings/{reading_id}/submit",
    response_model=schemas.AIReadingRead,
    tags=["ai-reading"],
    summary="Submit all answers – calculate reading comprehension score (FR8)",
)
def submit_ai_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = crud.get_ai_reading(db, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")
    if reading.is_completed:
        raise HTTPException(status_code=400, detail="Reading test already submitted")
    return crud.calculate_ai_reading_score(db, reading)
