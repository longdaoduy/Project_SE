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

from datetime import datetime, timezone, timedelta, date
import hashlib
import hmac
import os
import secrets

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

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


def _duration_minutes(start, end) -> int | None:
    """Compute elapsed minutes between two datetime values safely."""
    if not start or not end:
        return None
    if hasattr(start, 'tzinfo') and start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if hasattr(end, 'tzinfo') and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max(0, int((end - start).total_seconds() // 60))


# ============================================================
# FR1 – User Management
# ============================================================

def _verification_code_hash(user_id: int, code: str) -> str:
    """Key the digest so a leaked database cannot cheaply reveal six-digit codes."""
    secret = os.getenv("EMAIL_VERIFICATION_SECRET") or os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("EMAIL_VERIFICATION_SECRET or JWT_SECRET must be configured")
    value = f"{user_id}:{code}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), value, hashlib.sha256).hexdigest()

def create_user(
    db: Session, payload: schemas.UserCreate, hashed_password: str
) -> models.User:
    user = models.User(
        username=payload.email.strip().lower(),
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hashed_password,
        avatar=payload.avatar,
        english_level=payload.english_level,
        daily_goal=payload.daily_goal,
        role=payload.role,
        is_email_verified=False,
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


def create_email_verification_code(
    db: Session, user: models.User, expires_minutes: int = 10
) -> str:
    """Invalidate older codes and store only a SHA-256 digest of the new code."""
    now = datetime.now(timezone.utc)
    (db.query(models.EmailVerificationCode)
       .filter(models.EmailVerificationCode.user_id == user.user_id,
               models.EmailVerificationCode.used_at.is_(None))
       .update({models.EmailVerificationCode.used_at: now}, synchronize_session=False))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(models.EmailVerificationCode(
        user_id=user.user_id,
        code_hash=_verification_code_hash(user.user_id, code),
        expires_at=now + timedelta(minutes=expires_minutes),
    ))
    db.commit()
    return code


def verify_email_code(db: Session, user: models.User, code: str) -> str:
    """Return verified/invalid/expired/locked/already_verified."""
    if user.is_email_verified:
        return "already_verified"
    record = (db.query(models.EmailVerificationCode)
              .filter(models.EmailVerificationCode.user_id == user.user_id,
                      models.EmailVerificationCode.used_at.is_(None))
              .order_by(models.EmailVerificationCode.created_at.desc())
              .first())
    if not record:
        return "invalid"
    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        record.used_at = now
        db.commit()
        return "expired"
    if record.attempts >= 5:
        return "locked"
    supplied_hash = _verification_code_hash(user.user_id, code)
    if not hmac.compare_digest(record.code_hash, supplied_hash):
        record.attempts += 1
        db.commit()
        return "locked" if record.attempts >= 5 else "invalid"
    record.used_at = now
    user.is_email_verified = True
    db.commit()
    db.refresh(user)
    return "verified"


def seconds_until_verification_resend(db: Session, user_id: int, cooldown: int = 60) -> int:
    latest = (db.query(models.EmailVerificationCode)
              .filter(models.EmailVerificationCode.user_id == user_id)
              .order_by(models.EmailVerificationCode.created_at.desc())
              .first())
    if not latest or not latest.created_at:
        return 0
    created_at = latest.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return max(0, cooldown - int((datetime.now(timezone.utc) - created_at).total_seconds()))


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


def change_user_password(db: Session, user: models.User, new_hashed_password: str) -> models.User:
    user.password_hash = new_hashed_password
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def delete_user_account(db: Session, user: models.User) -> None:
    """Permanently remove the user and all dependent records via ORM cascades."""
    db.delete(user)
    db.commit()


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
    """Mark a session inactive and close its latest successful login log."""
    s = db.query(models.UserSession).filter(models.UserSession.session_id == session_id).first()
    if not s:
        return False
    if not s.is_active:
        return True
    now = datetime.now(timezone.utc)
    s.is_active = False
    s.logout_time = now
    # Also stamp logout_time on the matching login log entry
    log = (
        db.query(models.LoginLog)
        .filter(
            models.LoginLog.user_id == s.user_id,
            models.LoginLog.login_status == "Success",
            models.LoginLog.logout_time.is_(None),
        )
        .order_by(models.LoginLog.login_time.desc())
        .first()
    )
    if log:
        log.logout_time = now
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


def count_learning_history(
    db: Session, user_id: int, activity_type: str | None = None
) -> int:
    """Return total count for pagination."""
    q = db.query(func.count(models.LearningHistory.history_id)).filter(
        models.LearningHistory.user_id == user_id
    )
    if activity_type:
        q = q.filter(models.LearningHistory.activity_type == activity_type)
    return int(q.scalar() or 0)


def list_learning_history(
    db: Session, user_id: int,
    activity_type: str | None = None,
    limit: int = 20, offset: int = 0,
) -> list[models.LearningHistory]:
    q = db.query(models.LearningHistory).filter(models.LearningHistory.user_id == user_id)
    if activity_type:
        q = q.filter(models.LearningHistory.activity_type == activity_type)
    return q.order_by(models.LearningHistory.completed_at.desc()).offset(offset).limit(limit).all()


def get_weekly_activity(db: Session, user_id: int) -> list[dict]:
    """Return exactly 7 days of activity data for the Profile weekly chart."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=6)
    rows = (
        db.query(models.LearningHistory)
        .filter(
            models.LearningHistory.user_id == user_id,
            models.LearningHistory.completed_at >= datetime(
                start.year, start.month, start.day, tzinfo=timezone.utc
            ),
        )
        .all()
    )
    buckets = {start + timedelta(days=i): {"activities": 0, "minutes": 0} for i in range(7)}
    for row in rows:
        d = row.completed_at.date() if hasattr(row.completed_at, "date") else row.completed_at
        if d in buckets:
            buckets[d]["activities"] += 1
            buckets[d]["minutes"] += int(row.duration or 0)
    return [{"date": d.isoformat(), **buckets[d]} for d in sorted(buckets)]


def get_user_statistics(db: Session, user_id: int) -> models.UserStatistics | None:
    return (
        db.query(models.UserStatistics)
        .filter(models.UserStatistics.user_id == user_id)
        .first()
    )


def _refresh_streak(db: Session, user_id: int, stats: models.UserStatistics) -> None:
    """Recompute the current_streak from the learning_history table."""
    dates_result = (
        db.query(models.LearningHistory.completed_at)
        .filter(models.LearningHistory.user_id == user_id)
        .order_by(models.LearningHistory.completed_at.desc())
        .all()
    )
    unique_dates = set()
    for (completed_at,) in dates_result:
        if completed_at:
            unique_dates.add(
                completed_at.date() if hasattr(completed_at, "date") else completed_at
            )
    if not unique_dates:
        stats.current_streak = 0
        return
    today = datetime.now(timezone.utc).date()
    cursor = today if today in unique_dates else today - timedelta(days=1)
    streak = 0
    while cursor in unique_dates:
        streak += 1
        cursor -= timedelta(days=1)
    stats.current_streak = streak


def _update_statistics_after_flashcard(
    db: Session, user_id: int, cards_reviewed: int
) -> None:
    stats = get_user_statistics(db, user_id)
    if stats:
        stats.total_flashcards += 1
        stats.total_words += cards_reviewed
        stats.total_xp += cards_reviewed * 2
        _refresh_streak(db, user_id, stats)


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
        _refresh_streak(db, user_id, stats)


def _update_statistics_after_reading(
    db: Session, user_id: int, accuracy: float
) -> None:
    stats = get_user_statistics(db, user_id)
    if stats:
        stats.total_xp += int(accuracy // 10) * 3
        _refresh_streak(db, user_id, stats)


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
    """Complete a flashcard session and persist history/statistics atomically."""
    if session.is_completed:
        return session
    now = datetime.now(timezone.utc)
    session.is_completed = True
    session.completed_at = now
    duration = _duration_minutes(session.started_at, now)

    _update_statistics_after_flashcard(db, session.user_id, session.cards_reviewed)
    stats = get_user_statistics(db, session.user_id)
    if stats and duration is not None:
        stats.study_hours = round(stats.study_hours + duration / 60.0, 2)

    db.commit()
    db.refresh(session)

    try:
        record_learning_history(
            db,
            user_id=session.user_id,
            activity_type="Flashcard",
            activity_id=session.session_id,
            duration=duration,
        )
    except Exception:
        pass
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


# ── SRS – Spaced Repetition System ────────────────────────────────────────────

DAILY_NEW_LIMIT = 15

# SM-2 quality scores per button
_QUALITY: dict[str, int] = {"again": 0, "hard": 1, "good": 3, "easy": 5}


def _apply_srs(srs: models.UserCardSRS, rating: str) -> models.UserCardSRS:
    """
    Update SM-2 SRS parameters in-place.
    Returns the same object (caller must commit).
    """
    now = datetime.now(timezone.utc)
    q = _QUALITY[rating]

    if rating == "again":
        # Completely forgot → reset streak, show again in 10 minutes
        srs.repetitions = 0
        srs.interval_days = 0
        srs.due_date = now + timedelta(minutes=10)
        srs.card_status = "learning"

    elif rating == "hard":
        # Remembered with difficulty → small interval, ease penalty
        srs.ease_factor = max(1.3, round(srs.ease_factor - 0.15, 4))
        srs.repetitions = max(0, srs.repetitions - 1)
        interval = max(1, int(srs.interval_days * 1.2) if srs.interval_days > 0 else 1)
        srs.interval_days = interval
        srs.due_date = now + timedelta(days=interval)
        srs.card_status = "review"

    elif rating == "good":
        # Standard SM-2 progression
        if srs.repetitions == 0:
            srs.interval_days = 1
        elif srs.repetitions == 1:
            srs.interval_days = 3
        else:
            srs.interval_days = max(1, round(srs.interval_days * srs.ease_factor))
        # EF' = EF + (0.1 – (5–q)*(0.08 + (5–q)*0.02))
        ef_delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
        srs.ease_factor = max(1.3, min(3.0, round(srs.ease_factor + ef_delta, 4)))
        srs.repetitions += 1
        srs.due_date = now + timedelta(days=srs.interval_days)
        srs.card_status = "review"

    elif rating == "easy":
        # Very easy → big interval boost, ease bonus
        if srs.repetitions == 0:
            srs.interval_days = 4
        else:
            srs.interval_days = max(1, round(srs.interval_days * srs.ease_factor * 1.3))
        srs.ease_factor = max(1.3, min(3.0, round(srs.ease_factor + 0.15, 4)))
        srs.repetitions += 1
        srs.due_date = now + timedelta(days=srs.interval_days)
        srs.card_status = "review"

    srs.last_reviewed = now
    return srs


def get_or_create_srs(
    db: Session, user_id: int, word_id: int, topic_id: int
) -> models.UserCardSRS:
    """Return existing SRS record or create a fresh one."""
    srs = (
        db.query(models.UserCardSRS)
        .filter(
            models.UserCardSRS.user_id == user_id,
            models.UserCardSRS.word_id == word_id,
        )
        .first()
    )
    if srs:
        return srs
    srs = models.UserCardSRS(user_id=user_id, word_id=word_id, topic_id=topic_id)
    db.add(srs)
    db.flush()
    return srs


def apply_srs_rating(
    db: Session, user_id: int, word_id: int, topic_id: int, rating: str
) -> models.UserCardSRS:
    """Rate a card, update SRS params, persist. Returns updated record."""
    srs = get_or_create_srs(db, user_id, word_id, topic_id)
    _apply_srs(srs, rating)
    db.commit()
    db.refresh(srs)
    return srs


def get_daily_status(
    db: Session, user_id: int, topic_id: int
) -> dict:
    """Return daily learning stats for a (user, topic) pair."""
    today = date.today()
    learned_today = (
        db.query(func.count(models.DailyLearningLog.log_id))
        .filter(
            models.DailyLearningLog.user_id == user_id,
            models.DailyLearningLog.topic_id == topic_id,
            models.DailyLearningLog.learned_at == today,
        )
        .scalar() or 0
    )
    now = datetime.now(timezone.utc)
    due_review_count = (
        db.query(func.count(models.UserCardSRS.srs_id))
        .filter(
            models.UserCardSRS.user_id == user_id,
            models.UserCardSRS.topic_id == topic_id,
            models.UserCardSRS.card_status.in_(["review", "learning"]),
            models.UserCardSRS.due_date <= now,
        )
        .scalar() or 0
    )
    return {
        "topic_id": topic_id,
        "daily_learned": learned_today,
        "daily_limit": DAILY_NEW_LIMIT,
        "daily_remaining": max(0, DAILY_NEW_LIMIT - learned_today),
        "due_review_count": due_review_count,
    }


def build_session_queue(
    db: Session, user_id: int, topic_id: int
) -> dict:
    """
    Build the ordered card queue for a flashcard session.

    Priority:
      1. Due review / learning cards  (sorted by due_date ASC, shown first)
      2. New cards up to the remaining daily limit

    Returns a dict with:
      review_cards   – Word objects due for review
      new_cards      – Word objects being introduced today
      daily_learned  – new words already introduced today
      daily_limit    – cap constant
      daily_remaining– slots left for new words today
    """
    now = datetime.now(timezone.utc)
    today = date.today()

    # ── 1. Due review / learning cards ────────────────────────────────────────
    due_srs = (
        db.query(models.UserCardSRS)
        .options(joinedload(models.UserCardSRS.word))
        .filter(
            models.UserCardSRS.user_id == user_id,
            models.UserCardSRS.topic_id == topic_id,
            models.UserCardSRS.card_status.in_(["review", "learning"]),
            models.UserCardSRS.due_date <= now,
        )
        .order_by(models.UserCardSRS.due_date.asc())
        .all()
    )
    review_cards = [srs.word for srs in due_srs if srs.word is not None]

    # ── 2. Daily-limit check ───────────────────────────────────────────────────
    learned_today = (
        db.query(func.count(models.DailyLearningLog.log_id))
        .filter(
            models.DailyLearningLog.user_id == user_id,
            models.DailyLearningLog.topic_id == topic_id,
            models.DailyLearningLog.learned_at == today,
        )
        .scalar() or 0
    )
    remaining_slots = max(0, DAILY_NEW_LIMIT - learned_today)

    # ── 3. New words not yet seen by this user in this topic ──────────────────
    new_cards: list[models.Word] = []
    if remaining_slots > 0:
        seen_word_ids_subq = (
            db.query(models.UserCardSRS.word_id)
            .filter(
                models.UserCardSRS.user_id == user_id,
                models.UserCardSRS.topic_id == topic_id,
            )
            .subquery()
        )
        new_words = (
            db.query(models.Word)
            .filter(
                models.Word.topic_id == topic_id,
                models.Word.word_id.notin_(seen_word_ids_subq),
            )
            .order_by(models.Word.word_id.asc())
            .limit(remaining_slots)
            .all()
        )

        # Register each new word in SRS + daily log
        for word in new_words:
            # SRS record (status = 'new', due now so it appears immediately)
            srs = models.UserCardSRS(
                user_id=user_id,
                word_id=word.word_id,
                topic_id=topic_id,
                card_status="new",
                due_date=now,
            )
            db.add(srs)
            # Daily log (ignore duplicate key if client retries)
            existing_log = (
                db.query(models.DailyLearningLog)
                .filter(
                    models.DailyLearningLog.user_id == user_id,
                    models.DailyLearningLog.topic_id == topic_id,
                    models.DailyLearningLog.word_id == word.word_id,
                    models.DailyLearningLog.learned_at == today,
                )
                .first()
            )
            if not existing_log:
                db.add(models.DailyLearningLog(
                    user_id=user_id,
                    topic_id=topic_id,
                    word_id=word.word_id,
                    learned_at=today,
                ))

        db.commit()
        new_cards = new_words
        learned_today += len(new_words)

    return {
        "review_cards": review_cards,
        "new_cards": new_cards,
        "daily_learned": learned_today,
        "daily_limit": DAILY_NEW_LIMIT,
        "daily_remaining": max(0, DAILY_NEW_LIMIT - learned_today),
    }


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
    """Tally answers, persist score/accuracy/duration, mark completed."""
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
    duration = _duration_minutes(quiz.started_at, quiz.completed_at)

    _update_statistics_after_quiz(db, quiz.user_id, quiz.score, quiz.accuracy)
    stats = get_user_statistics(db, quiz.user_id)
    if stats and duration is not None:
        stats.study_hours = round(stats.study_hours + duration / 60.0, 2)

    db.commit()
    db.refresh(quiz)
    _ = quiz.questions   # eager-load while session open

    try:
        record_learning_history(
            db,
            user_id=quiz.user_id,
            activity_type="Quiz",
            activity_id=quiz.quiz_id,
            score=quiz.score,
            accuracy=quiz.accuracy,
            duration=duration,
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
    title: str | None = None,
) -> models.AIReading:
    # Derive time limit from difficulty if not explicitly set
    difficulty_limits = {"A1": 600, "A2": 600, "B1": 720, "B2": 900, "C1": 1080, "C2": 1200}
    time_limit = payload.time_limit_seconds
    if payload.difficulty_param and payload.difficulty_param in difficulty_limits:
        time_limit = difficulty_limits[payload.difficulty_param]

    reading = models.AIReading(
        user_id=payload.user_id,
        input_vocabulary=payload.input_vocabulary,
        topic_param=payload.topic_param,
        difficulty_param=payload.difficulty_param,
        generated_passage=generated_passage,
        title=title,
        time_limit_seconds=time_limit,
        attempt_number=1,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def _ensure_title(reading: "models.AIReading") -> "models.AIReading":
    """
    Guarantee reading.title is always a non-empty string.
    Called after every fetch so the API never returns null/generic titles.
    Does NOT write back to DB — purely in-memory for the response.
    """
    if reading and not reading.title:
        # Build a fallback from vocabulary + difficulty
        vocab_words = [w.strip().capitalize()
                       for w in (reading.input_vocabulary or '').split(',')][:3]
        base = ' · '.join(vocab_words) if vocab_words else 'Reading Test'
        level = reading.difficulty_param or ''
        reading.title = f"{base} ({level})" if level else base
    return reading


def get_ai_reading(db: Session, reading_id: int) -> models.AIReading | None:
    reading = (
        db.query(models.AIReading)
        .filter(models.AIReading.reading_id == reading_id)
        .first()
    )
    return _ensure_title(reading) if reading else None


def list_ai_readings(
    db: Session, user_id: int, limit: int = 20, offset: int = 0
) -> list[models.AIReading]:
    readings = (
        db.query(models.AIReading)
        .filter(models.AIReading.user_id == user_id)
        .order_by(models.AIReading.generated_at.desc())
        .offset(offset).limit(limit).all()
    )
    for r in readings:
        _ensure_title(r)
    return readings


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


def submit_ai_reading_with_answers(
    db: Session,
    reading: models.AIReading,
    answers: dict[int, str],
    completion_seconds: int,
    generate_explanations_fn,        # callable from seed_gemini
) -> models.AIReading:
    """
    One-shot submit: record answers, score, generate explanations (first attempt only),
    mark completed, write history.
    """
    if reading.is_completed:
        db.refresh(reading)
        _ = reading.comprehension_questions
        return reading

    questions = (
        db.query(models.AIReadingQuestion)
        .filter(models.AIReadingQuestion.reading_id == reading.reading_id)
        .all()
    )

    # 1. Record answers
    for q in questions:
        ans = answers.get(q.question_id)
        if ans:
            q.user_answer = ans
            q.is_correct = ans == q.correct_option

    # 2. Score
    correct = sum(1 for q in questions if q.is_correct)
    total = len(questions)
    reading.score = float(correct)
    reading.accuracy = round((correct / total) * 100, 2) if total else 0.0
    reading.is_completed = True
    reading.completion_seconds = min(completion_seconds, reading.time_limit_seconds)
    reading.completed_at = datetime.now(timezone.utc)
    db.flush()

    # 3. Generate explanations (only when not already present – covers first attempt)
    needs_explanation = [q for q in questions if not q.explanation]
    if needs_explanation:
        try:
            q_dicts = [
                {
                    "question_text": q.question_text,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                    "correct_option": q.correct_option,
                }
                for q in needs_explanation
            ]
            explanations = generate_explanations_fn(reading.generated_passage, q_dicts)
            for q, expl in zip(needs_explanation, explanations):
                q.explanation = expl
        except Exception as exc:
            print(f"⚠️  Explanation generation failed: {exc}")

    # 4. Stats + history
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


def retake_ai_reading(
    db: Session,
    original_reading_id: int,
    user_id: int,
) -> models.AIReading:
    """
    Create a new AIReading row that reuses the same passage as the original.
    New question rows are cloned (correct_option preserved, user_answer/is_correct cleared,
    explanation copied so the AI is NOT called again).
    Returns the new reading (not yet completed).
    """
    original = get_ai_reading(db, original_reading_id)
    if not original:
        raise ValueError(f"Reading {original_reading_id} not found")

    # Determine which reading holds the canonical questions
    # (parent_reading_id is set only on retakes; if None this IS the original)
    canonical_id = original.parent_reading_id or original.reading_id

    canonical = get_ai_reading(db, canonical_id)
    if not canonical:
        raise ValueError(f"Canonical reading {canonical_id} not found")

    # Count previous attempts for this user on this canonical reading
    prev_attempts = (
        db.query(models.AIReading)
        .filter(
            models.AIReading.user_id == user_id,
            (models.AIReading.reading_id == canonical_id) |
            (models.AIReading.parent_reading_id == canonical_id),
        )
        .count()
    )

    new_reading = models.AIReading(
        user_id=user_id,
        input_vocabulary=canonical.input_vocabulary,
        topic_param=canonical.topic_param,
        difficulty_param=canonical.difficulty_param,
        generated_passage=canonical.generated_passage,
        time_limit_seconds=canonical.time_limit_seconds,
        attempt_number=prev_attempts + 1,
        parent_reading_id=canonical_id,
    )
    db.add(new_reading)
    db.flush()   # get new reading_id

    # Clone questions (reset user state, keep explanations)
    for q in canonical.comprehension_questions:
        db.add(models.AIReadingQuestion(
            reading_id=new_reading.reading_id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            correct_option=q.correct_option,
            explanation=q.explanation,   # reuse; no AI call
        ))

    db.commit()
    db.refresh(new_reading)
    _ = new_reading.comprehension_questions
    return new_reading
