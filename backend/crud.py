"""
CRUD helpers for all feature modules:
  FR6 – Vocabulary (Topic, Word)
  FR2 – Flashcard  (FlashcardSession, FlashcardProgress, StarredWord)
  FR3 – Quiz       (Quiz, QuizQuestion)
  FR8 – AI Reading (AIReading, AIReadingQuestion)
  FR1 – User       (User)
"""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


# ============================================================
# FR6 – Vocabulary Database
# ============================================================

def create_topic(db: Session, payload: schemas.TopicCreate):
    topic = models.Topic(topic_name=payload.topic_name.strip())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def get_topic_by_name(db: Session, topic_name: str):
    return (
        db.query(models.Topic)
        .filter(func.lower(models.Topic.topic_name) == topic_name.strip().lower())
        .first()
    )


def get_topic_by_id(db: Session, topic_id: int):
    return db.query(models.Topic).filter(models.Topic.topic_id == topic_id).first()


def list_topics(db: Session, limit: int = 100, offset: int = 0):
    return (
        db.query(models.Topic)
        .order_by(models.Topic.topic_id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def create_word(db: Session, payload: schemas.WordCreate):
    word = models.Word(
        topic_id=payload.topic_id,
        word=payload.word.strip(),
        part_of_speech=payload.part_of_speech.strip() if payload.part_of_speech else None,
        phonetic=payload.phonetic.strip() if payload.phonetic else None,
        meaning_vi=payload.meaning_vi.strip(),
        example_en=payload.example_en.strip(),
        example_vi=payload.example_vi.strip(),
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def get_word_by_id(db: Session, word_id: int):
    return db.query(models.Word).filter(models.Word.word_id == word_id).first()


def list_words(db: Session, limit: int = 100, offset: int = 0, topic_id: int | None = None):
    query = db.query(models.Word)
    if topic_id is not None:
        query = query.filter(models.Word.topic_id == topic_id)
    return query.order_by(models.Word.word_id.asc()).offset(offset).limit(limit).all()


def get_random_words(db: Session, limit: int = 10, topic_id: int | None = None):
    query = db.query(models.Word)
    if topic_id is not None:
        query = query.filter(models.Word.topic_id == topic_id)
    return query.order_by(func.rand()).limit(limit).all()


# ============================================================
# FR1 – User (basic)
# ============================================================

def create_user(db: Session, payload: schemas.UserCreate, hashed_password: str):
    user = models.User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=hashed_password,
        display_name=payload.display_name,
        proficiency_level=payload.proficiency_level,
        daily_goal_minutes=payload.daily_goal_minutes,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return (
        db.query(models.User)
        .filter(models.User.email == email.strip().lower())
        .first()
    )


def get_user_by_username(db: Session, username: str):
    return (
        db.query(models.User)
        .filter(models.User.username == username.strip())
        .first()
    )


def update_user(db: Session, user: models.User, payload: schemas.UserUpdate):
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.proficiency_level is not None:
        user.proficiency_level = payload.proficiency_level
    if payload.daily_goal_minutes is not None:
        user.daily_goal_minutes = payload.daily_goal_minutes
    db.commit()
    db.refresh(user)
    return user


# ============================================================
# FR2 – Flashcard Learning
# ============================================================

def create_flashcard_session(db: Session, payload: schemas.FlashcardSessionCreate):
    session = models.FlashcardSession(
        user_id=payload.user_id,
        topic_id=payload.topic_id,
        total_cards=payload.total_cards,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_flashcard_session(db: Session, session_id: int):
    return (
        db.query(models.FlashcardSession)
        .filter(models.FlashcardSession.session_id == session_id)
        .first()
    )


def list_flashcard_sessions(db: Session, user_id: int, limit: int = 20, offset: int = 0):
    return (
        db.query(models.FlashcardSession)
        .filter(models.FlashcardSession.user_id == user_id)
        .order_by(models.FlashcardSession.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def complete_flashcard_session(db: Session, session: models.FlashcardSession):
    """Mark a session as fully completed."""
    session.is_completed = True
    session.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return session


def create_flashcard_progress(db: Session, payload: schemas.FlashcardProgressCreate):
    progress = models.FlashcardProgress(
        session_id=payload.session_id,
        word_id=payload.word_id,
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def get_flashcard_progress(db: Session, progress_id: int):
    return (
        db.query(models.FlashcardProgress)
        .filter(models.FlashcardProgress.progress_id == progress_id)
        .first()
    )


def update_flashcard_progress(
    db: Session,
    progress: models.FlashcardProgress,
    payload: schemas.FlashcardProgressUpdate,
):
    """
    Record a card flip and/or a difficulty rating.
    Also increments the parent session's cards_reviewed counter when a rating is first given.
    """
    if payload.is_flipped is not None:
        progress.is_flipped = payload.is_flipped

    if payload.difficulty_rating is not None:
        first_rating = progress.difficulty_rating is None
        progress.difficulty_rating = payload.difficulty_rating
        progress.reviewed_at = datetime.now(timezone.utc)

        # bump session counter on first rating
        if first_rating:
            session = progress.session
            session.cards_reviewed = min(session.cards_reviewed + 1, session.total_cards)
            # auto-complete session if all cards reviewed
            if session.cards_reviewed >= session.total_cards:
                session.is_completed = True
                session.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)
    return progress


# Starred Words (FR16)

def star_word(db: Session, payload: schemas.StarredWordCreate):
    existing = (
        db.query(models.StarredWord)
        .filter(
            models.StarredWord.user_id == payload.user_id,
            models.StarredWord.word_id == payload.word_id,
        )
        .first()
    )
    if existing:
        return existing  # idempotent
    starred = models.StarredWord(user_id=payload.user_id, word_id=payload.word_id)
    db.add(starred)
    db.commit()
    db.refresh(starred)
    return starred


def unstar_word(db: Session, user_id: int, word_id: int) -> bool:
    row = (
        db.query(models.StarredWord)
        .filter(
            models.StarredWord.user_id == user_id,
            models.StarredWord.word_id == word_id,
        )
        .first()
    )
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def list_starred_words(db: Session, user_id: int, limit: int = 100, offset: int = 0):
    return (
        db.query(models.StarredWord)
        .filter(models.StarredWord.user_id == user_id)
        .order_by(models.StarredWord.starred_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


# ============================================================
# FR3 – Quiz / Test
# ============================================================

def create_quiz(db: Session, payload: schemas.QuizCreate):
    quiz = models.Quiz(
        user_id=payload.user_id,
        topic_id=payload.topic_id,
        quiz_type=payload.quiz_type,
        total_questions=payload.total_questions,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def get_quiz(db: Session, quiz_id: int):
    return db.query(models.Quiz).filter(models.Quiz.quiz_id == quiz_id).first()


def list_quizzes(db: Session, user_id: int, limit: int = 20, offset: int = 0):
    return (
        db.query(models.Quiz)
        .filter(models.Quiz.user_id == user_id)
        .order_by(models.Quiz.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def add_quiz_question(db: Session, payload: schemas.QuizQuestionCreate):
    question = models.QuizQuestion(
        quiz_id=payload.quiz_id,
        word_id=payload.word_id,
        question_text=payload.question_text,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        correct_option=payload.correct_option,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_quiz_question(db: Session, question_id: int):
    return (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.question_id == question_id)
        .first()
    )


def submit_quiz_answer(
    db: Session,
    question: models.QuizQuestion,
    payload: schemas.QuizAnswerSubmit,
):
    question.user_answer = payload.user_answer
    question.is_correct = payload.user_answer == question.correct_option
    question.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(question)
    return question


def calculate_quiz_score(db: Session, quiz: models.Quiz):
    """
    Tally answers, persist score/accuracy, mark completed.
    FR3: The system shall automatically calculate the user's score.
    """
    questions = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.quiz_id == quiz.quiz_id)
        .all()
    )
    answered = [q for q in questions if q.user_answer is not None]
    correct = sum(1 for q in answered if q.is_correct)
    total = len(questions)

    quiz.score = float(correct)
    quiz.accuracy = round((correct / total) * 100, 2) if total else 0.0
    quiz.is_completed = True
    quiz.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(quiz)
    return quiz


# ============================================================
# FR8 – AI Reading Generation
# ============================================================

def create_ai_reading(
    db: Session,
    payload: schemas.AIReadingCreate,
    generated_passage: str,
) -> models.AIReading:
    """Persist the AI-generated passage returned by the Gemini API."""
    reading = models.AIReading(
        user_id=payload.user_id,
        input_vocabulary=payload.input_vocabulary,
        topic_param=payload.topic_param,
        difficulty_param=payload.difficulty_param,
        generated_passage=generated_passage,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def get_ai_reading(db: Session, reading_id: int):
    return (
        db.query(models.AIReading)
        .filter(models.AIReading.reading_id == reading_id)
        .first()
    )


def list_ai_readings(db: Session, user_id: int, limit: int = 20, offset: int = 0):
    return (
        db.query(models.AIReading)
        .filter(models.AIReading.user_id == user_id)
        .order_by(models.AIReading.generated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def add_ai_reading_question(db: Session, payload: schemas.AIReadingQuestionCreate):
    question = models.AIReadingQuestion(
        reading_id=payload.reading_id,
        question_text=payload.question_text,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        correct_option=payload.correct_option,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_ai_reading_question(db: Session, question_id: int):
    return (
        db.query(models.AIReadingQuestion)
        .filter(models.AIReadingQuestion.question_id == question_id)
        .first()
    )


def submit_ai_reading_answer(
    db: Session,
    question: models.AIReadingQuestion,
    payload: schemas.AIReadingAnswerSubmit,
):
    question.user_answer = payload.user_answer
    question.is_correct = payload.user_answer == question.correct_option
    db.commit()
    db.refresh(question)
    return question


def calculate_ai_reading_score(db: Session, reading: models.AIReading):
    """Tally answers and mark the reading session complete."""
    questions = (
        db.query(models.AIReadingQuestion)
        .filter(models.AIReadingQuestion.reading_id == reading.reading_id)
        .all()
    )
    answered = [q for q in questions if q.user_answer is not None]
    correct = sum(1 for q in answered if q.is_correct)
    total = len(questions)

    reading.score = float(correct)
    reading.accuracy = round((correct / total) * 100, 2) if total else 0.0
    reading.is_completed = True
    reading.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reading)
    return reading
