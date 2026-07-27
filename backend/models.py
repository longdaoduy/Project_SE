"""
SmartEng – SQLAlchemy ORM Models
=================================
Tables (in dependency order):
  users               – FR1  User Management
  user_sessions       – FR1  JWT session tracking
  login_logs          – FR1  Login audit
  profile_settings    – FR1  App preferences (dark mode, notifications…)
  user_statistics     – FR4  Lifetime stats / dashboard (streak, XP, words…)
  learning_history    – FR4  Unified activity log (Flashcard | Quiz | AI Reading)
  topics              – FR6  Vocabulary topics / decks
  words               – FR6  Individual vocabulary entries
  flashcard_sessions  – FR2  Flashcard study session header
  flashcard_progresses– FR2  Per-card flip + SRS rating
  starred_words       – FR2  Bookmarked words
  quizzes             – FR3  Quiz instance
  quiz_questions      – FR3  Per-question record
  ai_readings         – FR8  AI-generated passage + lifecycle
  ai_reading_questions– FR8  Comprehension questions for a passage
"""

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, Time, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ===========================================================================
# FR1 – User Management
# ===========================================================================

class User(Base):
    """
    Core user account.
    - full_name  : display name shown in UI (maps to C1.fullName)
    - role       : 'student' | 'admin'  (maps to data-SE table users.role)
    - daily_goal : daily vocabulary target in words (maps to users.daily_goal)
    - english_level: proficiency level A1-C2
    """
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    english_level: Mapped[str | None] = mapped_column(
        Enum("A1", "A2", "B1", "B2", "C1", "C2", name="english_level_enum"), nullable=True
    )
    daily_goal: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    role: Mapped[str] = mapped_column(
        Enum("student", "admin", name="role_enum"), nullable=False, default="student"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── relationships ────────────────────────────────────────────────────────
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    login_logs: Mapped[list["LoginLog"]] = relationship(
        "LoginLog", back_populates="user", cascade="all, delete-orphan"
    )
    profile_settings: Mapped["ProfileSettings | None"] = relationship(
        "ProfileSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    statistics: Mapped["UserStatistics | None"] = relationship(
        "UserStatistics", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    learning_histories: Mapped[list["LearningHistory"]] = relationship(
        "LearningHistory", back_populates="user", cascade="all, delete-orphan"
    )
    flashcard_sessions: Mapped[list["FlashcardSession"]] = relationship(
        "FlashcardSession", back_populates="user", cascade="all, delete-orphan"
    )
    starred_words: Mapped[list["StarredWord"]] = relationship(
        "StarredWord", back_populates="user", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz", back_populates="user", cascade="all, delete-orphan"
    )
    ai_readings: Mapped[list["AIReading"]] = relationship(
        "AIReading", back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    """
    Active JWT sessions per device (maps to data-SE: user_sessions).
    Allows multi-device login tracking and forced logout.
    """
    __tablename__ = "user_sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    jwt_token: Mapped[str] = mapped_column(String(500), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    login_time: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    logout_time: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped[User] = relationship("User", back_populates="sessions")


class LoginLog(Base):
    """
    Immutable login attempt audit trail (maps to data-SE: login_logs).
    Records both successful and failed attempts for security monitoring.
    """
    __tablename__ = "login_logs"

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    login_time: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    logout_time: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_status: Mapped[str] = mapped_column(
        Enum("Success", "Failed", name="login_status_enum"), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="login_logs")


class ProfileSettings(Base):
    """
    Per-user UI preferences (maps to data-SE: profile_settings).
    One-to-one with User. Created automatically on registration.
    """
    __tablename__ = "profile_settings"

    setting_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String(30), nullable=False, default="English")
    dark_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notification_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reminder_time: Mapped[str | None] = mapped_column(Time, nullable=True)
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="profile_settings")


# ===========================================================================
# FR4 – Learning History & Statistics
# ===========================================================================

class UserStatistics(Base):
    """
    Aggregated lifetime learning stats (maps to data-SE: user_statistics).
    One-to-one with User. Updated whenever a learning activity completes.
    Powers the Profile screen dashboard (streak, XP, total words…).
    """
    __tablename__ = "user_statistics"

    statistic_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    total_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_flashcards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_quizzes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    average_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    study_hours: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="statistics")


class LearningHistory(Base):
    """
    Unified activity log (maps to data-SE: learning_history / C5 LearningHistory).
    Every time a user completes a Flashcard session, Quiz, or AI Reading,
    one record is appended here.  activity_id points to the relevant table's PK.

    activity_type  → activity_id points to
    'Flashcard'    → flashcard_sessions.session_id
    'Quiz'         → quizzes.quiz_id
    'AI Reading'   → ai_readings.reading_id
    """
    __tablename__ = "learning_history"

    history_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_type: Mapped[str] = mapped_column(
        Enum("Flashcard", "Quiz", "AI Reading", name="activity_type_enum"), nullable=False
    )
    # Generic FK – points to session_id / quiz_id / reading_id depending on type
    activity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)   # minutes
    completed_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped[User] = relationship("User", back_populates="learning_histories")


# ===========================================================================
# FR6 – Vocabulary Database
# ===========================================================================

class Topic(Base):
    """Vocabulary topic / deck (e.g. 'IELTS Academic', 'Environment')."""
    __tablename__ = "topics"

    topic_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    words: Mapped[list["Word"]] = relationship(
        "Word", back_populates="topic", cascade="all, delete-orphan"
    )


class Word(Base):
    """A single vocabulary entry stored in the vocabulary database."""
    __tablename__ = "words"

    word_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topics.topic_id", ondelete="CASCADE"), nullable=False, index=True
    )
    word: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    part_of_speech: Mapped[str | None] = mapped_column(String(80), nullable=True)
    phonetic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    meaning_vi: Mapped[str] = mapped_column(Text, nullable=False)
    example_en: Mapped[str] = mapped_column(Text, nullable=False)
    example_vi: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topic: Mapped[Topic] = relationship("Topic", back_populates="words")
    flashcard_progresses: Mapped[list["FlashcardProgress"]] = relationship(
        "FlashcardProgress", back_populates="word", cascade="all, delete-orphan"
    )
    starred_by: Mapped[list["StarredWord"]] = relationship(
        "StarredWord", back_populates="word", cascade="all, delete-orphan"
    )
    quiz_questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="word", cascade="all, delete-orphan"
    )


# ===========================================================================
# FR2 – Flashcard Learning
# ===========================================================================

class FlashcardSession(Base):
    """
    One study session – user works through a deck of flashcards.
    On completion → writes to learning_history + updates user_statistics.
    """
    __tablename__ = "flashcard_sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True, index=True
    )
    total_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cards_reviewed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="flashcard_sessions")
    topic: Mapped[Topic | None] = relationship("Topic")
    progresses: Mapped[list["FlashcardProgress"]] = relationship(
        "FlashcardProgress", back_populates="session", cascade="all, delete-orphan"
    )


class FlashcardProgress(Base):
    """
    Per-card state within a session.
    is_flipped tracks the flip animation; difficulty_rating feeds SRS.
    """
    __tablename__ = "flashcard_progresses"

    progress_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("flashcard_sessions.session_id", ondelete="CASCADE"), nullable=False, index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.word_id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_flipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    difficulty_rating: Mapped[str | None] = mapped_column(
        Enum("again", "hard", "good", "easy", name="difficulty_enum"), nullable=True
    )
    reviewed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[FlashcardSession] = relationship("FlashcardSession", back_populates="progresses")
    word: Mapped[Word] = relationship("Word", back_populates="flashcard_progresses")


class StarredWord(Base):
    """Bookmarked word – one row per (user, word) pair."""
    __tablename__ = "starred_words"

    starred_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.word_id", ondelete="CASCADE"), nullable=False, index=True
    )
    starred_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship("User", back_populates="starred_words")
    word: Mapped[Word] = relationship("Word", back_populates="starred_by")


# ===========================================================================
# FR3 – Quiz / Test
# ===========================================================================

class Quiz(Base):
    """
    Quiz instance.  On completion → writes to learning_history + user_statistics.
    quiz_type: 'multiple_choice' | 'fill_blank' | 'word_matching' | 'speed_round'
    """
    __tablename__ = "quizzes"

    quiz_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True, index=True
    )
    quiz_type: Mapped[str] = mapped_column(
        Enum("multiple_choice", "fill_blank", "word_matching", "speed_round",
             name="quiz_type_enum"),
        nullable=False, default="multiple_choice",
    )
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="quizzes")
    topic: Mapped[Topic | None] = relationship("Topic")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(Base):
    """One question inside a quiz with four options and tracked answer."""
    __tablename__ = "quiz_questions"

    question_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False, index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.word_id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[str] = mapped_column(
        Enum("A", "B", "C", "D", name="option_enum"), nullable=False
    )
    user_answer: Mapped[str | None] = mapped_column(
        Enum("A", "B", "C", "D", name="option_enum"), nullable=True
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    answered_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="questions")
    word: Mapped[Word] = relationship("Word", back_populates="quiz_questions")


# ===========================================================================
# FR8 – AI Reading Generation
# ===========================================================================

class AIReading(Base):
    """
    AI-generated reading passage + lifecycle.
    On completion → writes to learning_history + user_statistics.
    """
    __tablename__ = "ai_readings"

    reading_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_vocabulary: Mapped[str] = mapped_column(Text, nullable=False)
    topic_param: Mapped[str | None] = mapped_column(String(200), nullable=True)
    difficulty_param: Mapped[str | None] = mapped_column(String(50), nullable=True)
    generated_passage: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="ai_readings")
    comprehension_questions: Mapped[list["AIReadingQuestion"]] = relationship(
        "AIReadingQuestion", back_populates="reading", cascade="all, delete-orphan"
    )


class AIReadingQuestion(Base):
    """Comprehension question for an AI reading passage."""
    __tablename__ = "ai_reading_questions"

    question_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reading_id: Mapped[int] = mapped_column(
        ForeignKey("ai_readings.reading_id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[str] = mapped_column(
        Enum("A", "B", "C", "D", name="option_enum"), nullable=False
    )
    user_answer: Mapped[str | None] = mapped_column(
        Enum("A", "B", "C", "D", name="option_enum"), nullable=True
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    reading: Mapped[AIReading] = relationship("AIReading", back_populates="comprehension_questions")
