from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---------------------------------------------------------------------------
# FR6 – Vocabulary Database
# ---------------------------------------------------------------------------

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
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.topic_id"), nullable=False, index=True)
    word: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    part_of_speech: Mapped[str | None] = mapped_column(String(80), nullable=True)
    phonetic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    meaning_vi: Mapped[str] = mapped_column(Text, nullable=False)
    example_en: Mapped[str] = mapped_column(Text, nullable=False)
    example_vi: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topic: Mapped[Topic] = relationship("Topic", back_populates="words")

    # back-refs populated by child tables
    flashcard_progresses: Mapped[list["FlashcardProgress"]] = relationship(
        "FlashcardProgress", back_populates="word", cascade="all, delete-orphan"
    )
    starred_by: Mapped[list["StarredWord"]] = relationship(
        "StarredWord", back_populates="word", cascade="all, delete-orphan"
    )
    quiz_questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="word", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# FR2 – Flashcard Learning
# ---------------------------------------------------------------------------

class FlashcardSession(Base):
    """
    One study session where a user goes through a deck of flashcards.
    Tracks overall session state and when it was completed.
    """
    __tablename__ = "flashcard_sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True, index=True
    )
    # total cards in this session
    total_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # how many cards were reviewed so far
    cards_reviewed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="flashcard_sessions")
    topic: Mapped[Topic | None] = relationship("Topic")
    progresses: Mapped[list["FlashcardProgress"]] = relationship(
        "FlashcardProgress", back_populates="session", cascade="all, delete-orphan"
    )


class FlashcardProgress(Base):
    """
    Per-card progress record within a flashcard session.
    Supports animated transitions (is_flipped) and spaced-repetition rating.
    difficulty_rating: 'again' | 'hard' | 'good' | 'easy'  (SRS input – FR14)
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
    """
    FR16 – Star Vocabulary Word.
    Allows a user to bookmark/favourite a word for quick access.
    """
    __tablename__ = "starred_words"

    starred_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.word_id", ondelete="CASCADE"), nullable=False, index=True
    )
    starred_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="starred_words")
    word: Mapped[Word] = relationship("Word", back_populates="starred_by")


# ---------------------------------------------------------------------------
# FR3 – Quiz / Test
# ---------------------------------------------------------------------------

class Quiz(Base):
    """
    A quiz instance configured and taken by a user.
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
        Enum("multiple_choice", "fill_blank", "word_matching", "speed_round", name="quiz_type_enum"),
        nullable=False,
        default="multiple_choice",
    )
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)           # raw score (correct count)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)        # percentage 0-100
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="quizzes")
    topic: Mapped[Topic | None] = relationship("Topic")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(Base):
    """
    One question inside a quiz.
    Stores the question text, the four options (A-D for multiple choice),
    the correct answer key, and what the user answered.
    """
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


# ---------------------------------------------------------------------------
# FR8 – AI Reading Generation
# ---------------------------------------------------------------------------

class AIReading(Base):
    """
    Stores AI-generated reading passages and their comprehension questions.
    Each record is one generated article tied to a user session.
    """
    __tablename__ = "ai_readings"

    reading_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    # vocabulary words the user submitted as input (comma-separated or JSON text)
    input_vocabulary: Mapped[str] = mapped_column(Text, nullable=False)
    # optional: topic/difficulty param chosen by user (FR8 / U028)
    topic_param: Mapped[str | None] = mapped_column(String(200), nullable=True)
    difficulty_param: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # the AI-generated article
    generated_passage: Mapped[str] = mapped_column(Text, nullable=False)
    # score after answering comprehension questions (null until submitted)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="ai_readings")
    comprehension_questions: Mapped[list["AIReadingQuestion"]] = relationship(
        "AIReadingQuestion", back_populates="reading", cascade="all, delete-orphan"
    )


class AIReadingQuestion(Base):
    """
    Comprehension question auto-generated alongside the AI reading passage.
    Same multiple-choice structure as QuizQuestion for consistency.
    """
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


# ---------------------------------------------------------------------------
# User (referenced by FK in all feature tables above)
# FR1 – User Management (basic stub; full auth handled separately)
# ---------------------------------------------------------------------------

class User(Base):
    """
    Application user. Passwords are stored as bcrypt hashes (FR U001 constraint).
    proficiency_level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
    """
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proficiency_level: Mapped[str | None] = mapped_column(
        Enum("A1", "A2", "B1", "B2", "C1", "C2", name="proficiency_enum"), nullable=True
    )
    daily_goal_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    flashcard_sessions: Mapped[list[FlashcardSession]] = relationship(
        "FlashcardSession", back_populates="user", cascade="all, delete-orphan"
    )
    starred_words: Mapped[list[StarredWord]] = relationship(
        "StarredWord", back_populates="user", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list[Quiz]] = relationship(
        "Quiz", back_populates="user", cascade="all, delete-orphan"
    )
    ai_readings: Mapped[list[AIReading]] = relationship(
        "AIReading", back_populates="user", cascade="all, delete-orphan"
    )
