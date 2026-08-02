"""
SmartEng – CRUD helpers
========================
Groups:
  FR6 – Vocabulary   (Topic, Word)
  FR1 – User         (User, UserSession, LoginLog, ProfileSettings)
  FR4 – History/Stats(LearningHistory, UserStatistics)
  FR2 – Flashcard    (FlashcardSession, FlashcardProgress, StarredWord)
  FR3 – Quiz         (Quiz, QuizQuestion)
  FR8 – AI Reading   (AIReading, AIReadingQuestion)
"""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


# ============================================================
# FR6 – Vocabulary Database
# ============================================================

def create_topic(db: Session, payload: schemas.TopicCreate) -> models.Topic:
    topic = models.Topic(topic_name=payload.topic_name.strip())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def get_topic_by_name(db: Session, topic_name: str) -> models.Topic | None:
    return (
        db.query(models.Topic)
        .filter(func.lower(models.Topic.topic_name) == topic_name.strip().lower())
        .first()
    )


def get_topic_by_id(db: Session, topic_id: int) -> models.Topic | None:
    return db.query(models.Topic).filter(models.Topic.topic_id == topic_id).first()


def list_topics(db: Session, limit: int = 100, offset: int = 0) -> list[models.Topic]:
    return (
        db.query(models.Topic)
        .order_by(models.Topic.topic_id.asc())
        .offset(offset).limit(limit).all()
    )


def create_word(db: Session, payload: schemas.WordCreate) -> models.Word:
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


def get_word_by_id(db: Session, word_id: int) -> models.Word | None:
    return db.query(models.Word).filter(models.Word.word_id == word_id).first()


def list_words(
    db: Session, limit: int = 100, offset: int = 0, topic_id: int | None = None
) -> list[models.Word]:
    q = db.query(models.Word)
    if topic_id is not None:
        q = q.filter(models.Word.topic_id == topic_id)
    return q.order_by(models.Word.word_id.asc()).offset(offset).limit(limit).all()


def get_random_words(db: Session, limit: int = 10, topic_id: int | None = None) -> list[models.Word]:
    q = db.query(models.Word)
    if topic_id is not None:
        q = q.filter(models.Word.topic_id == topic_id)
    return q.order_by(func.rand()).limit(limit).all()


# ============================================================
# FR1 – User Management
# ============================================================

def create_user(
    db: Session, payload: schemas.UserCreate, hashed_password: str
) -> models.User:
    user = models.User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hashed_password,
        avatar=payload.avatar,
        english_level=payload.english_level,
        daily_goal=payload.daily_goal,
        role=payload.role,
    )
    db.add(user)
    db.flush()   # get user_id before creating dependants

    # Auto-create profile_settings (1-to-1)
    db.add(models.ProfileSettings(user_id=user.user_id))

    # Auto-create user_statistics (1-to-1)
    db.add(models.UserStatistics(user_id=user.user_id))

    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return (
        db.query(models.User)
        .filter(models.User.email == email.strip().lower())
        .first()
    )


def update_user(db: Session, user: models.User, payload: schemas.UserUpdate) -> models.User:
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.avatar is not None:
        user.avatar = payload.avatar
    if payload.english_level is not None:
        user.english_level = payload.english_level
    if payload.daily_goal is not None:
        user.daily_goal = payload.daily_goal
    db.commit()
    db.refresh(user)
    return user


# ── UserSession ───────────────────────────────────────────────────────────────

def create_user_session(
    db: Session, user_id: int, jwt_token: str,
    device_name: str | None = None, ip_address: str | None = None,
) -> models.UserSession:
    session = models.UserSession(
        user_id=user_id,
        jwt_token=jwt_token,
        device_name=device_name,
        ip_address=ip_address,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def invalidate_user_session(db: Session, session_id: int) -> bool:
    """Mark a session as inactive (logout)."""
    s = db.query(models.UserSession).filter(models.UserSession.session_id == session_id).first()
    if not s:
        return False
    s.is_active = False
    s.logout_time = datetime.now(timezone.utc)
    db.commit()
    return True


def get_active_session_by_token(db: Session, jwt_token: str) -> models.UserSession | None:
    return (
        db.query(models.UserSession)
        .filter(models.UserSession.jwt_token == jwt_token, models.UserSession.is_active == True)
        .first()
    )


def list_user_sessions(db: Session, user_id: int) -> list[models.UserSession]:
    return (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == user_id)
        .order_by(models.UserSession.login_time.desc())
        .all()
    )


# ── LoginLog ──────────────────────────────────────────────────────────────────

def create_login_log(
    db: Session, user_id: int, status: str,
    ip_address: str | None = None, device_name: str | None = None,
) -> models.LoginLog:
    log = models.LoginLog(
        user_id=user_id,
        login_status=status,
        ip_address=ip_address,
        device_name=device_name,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_login_logs(db: Session, user_id: int, limit: int = 20) -> list[models.LoginLog]:
    return (
        db.query(models.LoginLog)
        .filter(models.LoginLog.user_id == user_id)
        .order_by(models.LoginLog.login_time.desc())
        .limit(limit).all()
    )


# ── ProfileSettings ───────────────────────────────────────────────────────────

def get_profile_settings(db: Session, user_id: int) -> models.ProfileSettings | None:
    return (
        db.query(models.ProfileSettings)
        .filter(models.ProfileSettings.user_id == user_id)
        .first()
    )


def update_profile_settings(
    db: Session, settings: models.ProfileSettings, payload: schemas.ProfileSettingsUpdate
) -> models.ProfileSettings:
    if payload.language is not None:
        settings.language = payload.language
    if payload.dark_mode is not None:
        settings.dark_mode = payload.dark_mode
    if payload.notification_enabled is not None:
        settings.notification_enabled = payload.notification_enabled
    if payload.reminder_time is not None:
        settings.reminder_time = payload.reminder_time
    db.commit()
    db.refresh(settings)
    return settings


# ============================================================
# FR4 – Learning History & Statistics
# ============================================================

def record_learning_history(
    db: Session,
    user_id: int,
    activity_type: str,
    activity_id: int,
    score: float | None = None,
    accuracy: float | None = None,
    duration: int | None = None,
) -> models.LearningHistory:
    """Append one entry to learning_history.  Called whenever an activity completes."""
    entry = models.LearningHistory(
        user_id=user_id,
        activity_type=activity_type,
        activity_id=activity_id,
        score=score,
        accuracy=accuracy,
        duration=duration,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_learning_history(
    db: Session, user_id: int,
    activity_type: str | None = None,
    limit: int = 20, offset: int = 0,
) -> list[models.LearningHistory]:
    q = db.query(models.LearningHistory).filter(models.LearningHistory.user_id == user_id)
    if activity_type:
        q = q.filter(models.LearningHistory.activity_type == activity_type)
    return q.order_by(models.LearningHistory.completed_at.desc()).offset(offset).limit(limit).all()


def get_user_statistics(db: Session, user_id: int) -> models.UserStatistics | None:
    return (
        db.query(models.UserStatistics)
        .filter(models.UserStatistics.user_id == user_id)
        .first()
    )


def _update_statistics_after_flashcard(
    db: Session, user_id: int, cards_reviewed: int
) -> None:
    stats = get_user_statistics(db, user_id)
    if stats:
        stats.total_flashcards += 1
        stats.total_words += cards_reviewed
        stats.total_xp += cards_reviewed * 2
        # No commit here – caller is responsible for the transaction boundary


def _update_statistics_after_quiz(
    db: Session, user_id: int, score: float, accuracy: float
) -> None:
    stats = get_user_statistics(db, user_id)
    if stats:
        prev_total = stats.total_quizzes
        stats.total_quizzes += 1
        stats.average_score = round(
            (stats.average_score * prev_total + accuracy) / stats.total_quizzes, 2
        )
        stats.total_xp += int(score) * 5


def _update_statistics_after_reading(
    db: Session, user_id: int, accuracy: float
) -> None:
    stats = get_user_statistics(db, user_id)
    if stats:
        stats.total_xp += int(accuracy // 10) * 3


# ============================================================
# FR2 – Flashcard Learning
# ============================================================

def create_flashcard_session(
    db: Session, payload: schemas.FlashcardSessionCreate
) -> models.FlashcardSession:
    session = models.FlashcardSession(
        user_id=payload.user_id,
        topic_id=payload.topic_id,
        total_cards=payload.total_cards,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_flashcard_session(db: Session, session_id: int) -> models.FlashcardSession | None:
    return (
        db.query(models.FlashcardSession)
        .filter(models.FlashcardSession.session_id == session_id)
        .first()
    )


def list_flashcard_sessions(
    db: Session, user_id: int, limit: int = 20, offset: int = 0
) -> list[models.FlashcardSession]:
    return (
        db.query(models.FlashcardSession)
        .filter(models.FlashcardSession.user_id == user_id)
        .order_by(models.FlashcardSession.started_at.desc())
        .offset(offset).limit(limit).all()
    )


def complete_flashcard_session(
    db: Session, session: models.FlashcardSession
) -> models.FlashcardSession:
    """Mark completed → write learning_history + update statistics."""
    if session.is_completed:
        return session  # idempotent – already done
    session.is_completed = True
    session.completed_at = datetime.now(timezone.utc)
    # Do NOT commit here – caller (update_flashcard_progress) owns the transaction
    # when called from the SRS path.  We flush so the timestamp is visible,
    # and let the outer commit persist everything atomically.
    db.flush()

    # ── side-effects (each opens its own commit) ──────────────────────────────
    try:
        record_learning_history(
            db,
            user_id=session.user_id,
            activity_type="Flashcard",
            activity_id=session.session_id,
            duration=None,
        )
        _update_statistics_after_flashcard(db, session.user_id, session.cards_reviewed)
    except Exception:
        pass  # never block the main flow for stats errors
    return session


def create_flashcard_progress(
    db: Session, payload: schemas.FlashcardProgressCreate
) -> models.FlashcardProgress:
    progress = models.FlashcardProgress(
        session_id=payload.session_id,
        word_id=payload.word_id,
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def get_flashcard_progress(db: Session, progress_id: int) -> models.FlashcardProgress | None:
    return (
        db.query(models.FlashcardProgress)
        .filter(models.FlashcardProgress.progress_id == progress_id)
        .first()
    )


def update_flashcard_progress(
    db: Session,
    progress: models.FlashcardProgress,
    payload: schemas.FlashcardProgressUpdate,
) -> models.FlashcardProgress:
    if payload.is_flipped is not None:
        progress.is_flipped = payload.is_flipped

    if payload.difficulty_rating is not None:
        first_rating = progress.difficulty_rating is None
        progress.difficulty_rating = payload.difficulty_rating
        progress.reviewed_at = datetime.now(timezone.utc)

        if first_rating:
            sess = progress.session
            sess.cards_reviewed = min(sess.cards_reviewed + 1, sess.total_cards)
            if sess.cards_reviewed >= sess.total_cards:
                # complete_flashcard_session uses flush (no commit), safe here
                complete_flashcard_session(db, sess)

    # Single commit for progress + any session changes above
    db.commit()
    db.refresh(progress)
    return progress


# ── Starred Words ─────────────────────────────────────────────────────────────

def star_word(db: Session, payload: schemas.StarredWordCreate) -> models.StarredWord:
    existing = (
        db.query(models.StarredWord)
        .filter(
            models.StarredWord.user_id == payload.user_id,
            models.StarredWord.word_id == payload.word_id,
        )
        .first()
    )
    if existing:
        return existing
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


def list_starred_words(
    db: Session, user_id: int, limit: int = 100, offset: int = 0
) -> list[models.StarredWord]:
    return (
        db.query(models.StarredWord)
        .filter(models.StarredWord.user_id == user_id)
        .order_by(models.StarredWord.starred_at.desc())
        .offset(offset).limit(limit).all()
    )


# ============================================================
# FR3 – Quiz / Test
# ============================================================

def create_quiz(db: Session, payload: schemas.QuizCreate) -> models.Quiz:
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


def get_quiz(db: Session, quiz_id: int) -> models.Quiz | None:
    return db.query(models.Quiz).filter(models.Quiz.quiz_id == quiz_id).first()


def list_quizzes(
    db: Session, user_id: int, limit: int = 20, offset: int = 0
) -> list[models.Quiz]:
    return (
        db.query(models.Quiz)
        .filter(models.Quiz.user_id == user_id)
        .order_by(models.Quiz.started_at.desc())
        .offset(offset).limit(limit).all()
    )


def add_quiz_question(db: Session, payload: schemas.QuizQuestionCreate) -> models.QuizQuestion:
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


def get_quiz_question(db: Session, question_id: int) -> models.QuizQuestion | None:
    return (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.question_id == question_id)
        .first()
    )


def submit_quiz_answer(
    db: Session, question: models.QuizQuestion, payload: schemas.QuizAnswerSubmit
) -> models.QuizQuestion:
    question.user_answer = payload.user_answer
    question.is_correct = payload.user_answer == question.correct_option
    question.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(question)
    return question


def calculate_quiz_score(db: Session, quiz: models.Quiz) -> models.Quiz:
    """Tally answers, persist score/accuracy, mark completed."""
    questions = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.quiz_id == quiz.quiz_id)
        .all()
    )
    correct = sum(1 for q in questions if q.is_correct)
    total = len(questions)

    quiz.score = float(correct)
    quiz.accuracy = round((correct / total) * 100, 2) if total else 0.0
    quiz.is_completed = True
    quiz.completed_at = datetime.now(timezone.utc)

    # side-effects – queue changes before single commit
    _update_statistics_after_quiz(db, quiz.user_id, quiz.score, quiz.accuracy)

    db.commit()
    db.refresh(quiz)
    _ = quiz.questions   # eager-load while session open

    # history written after commit (its own transaction)
    try:
        record_learning_history(
            db,
            user_id=quiz.user_id,
            activity_type="Quiz",
            activity_id=quiz.quiz_id,
            score=quiz.score,
            accuracy=quiz.accuracy,
        )
    except Exception:
        pass
    return quiz


# ============================================================
# FR8 – AI Reading Generation
# ============================================================

def create_ai_reading(
    db: Session,
    payload: schemas.AIReadingCreate,
    generated_passage: str,
) -> models.AIReading:
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


def get_ai_reading(db: Session, reading_id: int) -> models.AIReading | None:
    return (
        db.query(models.AIReading)
        .filter(models.AIReading.reading_id == reading_id)
        .first()
    )


def list_ai_readings(
    db: Session, user_id: int, limit: int = 20, offset: int = 0
) -> list[models.AIReading]:
    return (
        db.query(models.AIReading)
        .filter(models.AIReading.user_id == user_id)
        .order_by(models.AIReading.generated_at.desc())
        .offset(offset).limit(limit).all()
    )


def add_ai_reading_question(
    db: Session, payload: schemas.AIReadingQuestionCreate
) -> models.AIReadingQuestion:
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


def get_ai_reading_question(db: Session, question_id: int) -> models.AIReadingQuestion | None:
    return (
        db.query(models.AIReadingQuestion)
        .filter(models.AIReadingQuestion.question_id == question_id)
        .first()
    )


def submit_ai_reading_answer(
    db: Session,
    question: models.AIReadingQuestion,
    payload: schemas.AIReadingAnswerSubmit,
) -> models.AIReadingQuestion:
    question.user_answer = payload.user_answer
    question.is_correct = payload.user_answer == question.correct_option
    db.commit()
    db.refresh(question)
    return question


def calculate_ai_reading_score(db: Session, reading: models.AIReading) -> models.AIReading:
    """Tally answers, mark complete. Side-effects: history + statistics."""
    questions = (
        db.query(models.AIReadingQuestion)
        .filter(models.AIReadingQuestion.reading_id == reading.reading_id)
        .all()
    )
    correct = sum(1 for q in questions if q.is_correct)
    total = len(questions)

    reading.score = float(correct)
    reading.accuracy = round((correct / total) * 100, 2) if total else 0.0
    reading.is_completed = True
    reading.completed_at = datetime.now(timezone.utc)

    _update_statistics_after_reading(db, reading.user_id, reading.accuracy)

    db.commit()
    db.refresh(reading)
    _ = reading.comprehension_questions

    try:
        record_learning_history(
            db,
            user_id=reading.user_id,
            activity_type="AI Reading",
            activity_id=reading.reading_id,
            score=reading.score,
            accuracy=reading.accuracy,
        )
    except Exception:
        pass
    return reading
