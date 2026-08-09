"""
SmartEng – Pydantic Schemas
============================
Groups:
  FR1  – User, UserSession, LoginLog, ProfileSettings
  FR4  – UserStatistics, LearningHistory
  FR6  – Topic, Word
  FR2  – FlashcardSession, FlashcardProgress, StarredWord
  FR3  – Quiz, QuizQuestion
  FR8  – AIReading, AIReadingQuestion
"""

from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ============================================================
# FR6 – Vocabulary Database
# ============================================================

class TopicCreate(BaseModel):
    topic_name: str = Field(..., min_length=1, max_length=150)


class TopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    topic_id: int
    topic_name: str
    created_at: datetime | None = None


class WordCreate(BaseModel):
    topic_id: int
    word: str = Field(..., min_length=1, max_length=120)
    part_of_speech: str | None = Field(default=None, max_length=80)
    phonetic: str | None = Field(default=None, max_length=120)
    meaning_vi: str = Field(..., min_length=1)
    example_en: str = Field(..., min_length=1)
    example_vi: str = Field(..., min_length=1)


class WordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    word_id: int
    topic_id: int
    word: str
    part_of_speech: str | None
    phonetic: str | None
    meaning_vi: str
    example_en: str
    example_vi: str
    created_at: datetime | None = None


# ============================================================
# FR1 – User Management
# ============================================================

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    avatar: str | None = Field(default=None, max_length=255)
    english_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] | None = None
    daily_goal: int = Field(default=20, ge=1, le=200)
    role: Literal["student", "admin"] = "student"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    full_name: str
    email: str
    avatar: str | None = None
    english_level: str | None = None
    daily_goal: int
    role: str
    is_active: bool
    created_at: datetime | None = None


class UserUpdate(BaseModel):
    """Payload for PATCH /users/{id} – only provided fields are updated."""
    full_name: str | None = Field(default=None, max_length=100)
    avatar: str | None = Field(default=None, max_length=255)
    english_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] | None = None
    daily_goal: int | None = Field(default=None, ge=1, le=200)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    device_name: str | None = None
    ip_address: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1)
    confirmation: str = Field(..., min_length=1)


class UserLoginResponse(BaseModel):
    """Returned on successful login."""
    model_config = ConfigDict(from_attributes=True)
    user: UserRead
    jwt_token: str
    session_id: int


# ── User Session ──────────────────────────────────────────────────────────────

class UserSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: int
    user_id: int
    device_name: str | None = None
    ip_address: str | None = None
    login_time: datetime | None = None
    logout_time: datetime | None = None
    is_active: bool


# ── Login Log ─────────────────────────────────────────────────────────────────

class LoginLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: int
    user_id: int
    login_time: datetime | None = None
    logout_time: datetime | None = None
    login_status: str
    ip_address: str | None = None
    device_name: str | None = None


# ── Profile Settings ──────────────────────────────────────────────────────────

class ProfileSettingsUpdate(BaseModel):
    language: str | None = Field(default=None, max_length=30)
    dark_mode: bool | None = None
    notification_enabled: bool | None = None
    reminder_time: time | None = None


class ProfileSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    setting_id: int
    user_id: int
    language: str
    dark_mode: bool
    notification_enabled: bool
    reminder_time: time | None = None
    updated_at: datetime | None = None


# ============================================================
# FR4 – Statistics & Learning History
# ============================================================

class UserStatisticsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    statistic_id: int
    user_id: int
    total_words: int
    total_flashcards: int
    total_quizzes: int
    average_score: float
    study_hours: float
    current_streak: int
    total_xp: int
    updated_at: datetime | None = None


class LearningHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: int
    user_id: int
    activity_type: str
    activity_id: int
    score: float | None = None
    accuracy: float | None = None
    duration: int | None = None
    completed_at: datetime | None = None


class LearningHistoryPage(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool
    items: list[LearningHistoryRead]


class WeeklyActivityItem(BaseModel):
    date: str
    activities: int
    minutes: int


class WeeklyActivityResponse(BaseModel):
    items: list[WeeklyActivityItem]


# ============================================================
# FR2 – Flashcard Learning
# ============================================================

class FlashcardSessionCreate(BaseModel):
    user_id: int
    topic_id: int | None = None
    total_cards: int = Field(..., ge=1)


class FlashcardSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: int
    user_id: int
    topic_id: int | None = None
    total_cards: int
    cards_reviewed: int
    is_completed: bool
    started_at: datetime | None = None
    completed_at: datetime | None = None


class FlashcardProgressCreate(BaseModel):
    session_id: int
    word_id: int


class FlashcardProgressUpdate(BaseModel):
    """Flip a card or record a difficulty rating (SRS)."""
    is_flipped: bool | None = None
    difficulty_rating: Literal["again", "hard", "good", "easy"] | None = None


class FlashcardProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    progress_id: int
    session_id: int
    word_id: int
    is_flipped: bool
    difficulty_rating: str | None = None
    reviewed_at: datetime | None = None


class StarredWordCreate(BaseModel):
    user_id: int
    word_id: int


class StarredWordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    starred_id: int
    user_id: int
    word_id: int
    starred_at: datetime | None = None
    word: WordRead | None = None


# ============================================================
# FR3 – Quiz / Test
# ============================================================

class QuizCreate(BaseModel):
    user_id: int
    topic_id: int | None = None
    quiz_type: Literal[
        "multiple_choice", "fill_blank", "word_matching", "speed_round"
    ] = "multiple_choice"
    total_questions: int = Field(..., ge=1, le=50)


class QuizRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    quiz_id: int
    user_id: int
    topic_id: int | None = None
    quiz_type: str
    total_questions: int
    score: float | None = None
    accuracy: float | None = None
    is_completed: bool
    started_at: datetime | None = None
    completed_at: datetime | None = None


class QuizQuestionCreate(BaseModel):
    quiz_id: int
    word_id: int
    question_text: str = Field(..., min_length=1)
    option_a: str = Field(..., min_length=1)
    option_b: str = Field(..., min_length=1)
    option_c: str = Field(..., min_length=1)
    option_d: str = Field(..., min_length=1)
    correct_option: Literal["A", "B", "C", "D"]


class QuizAnswerSubmit(BaseModel):
    user_answer: Literal["A", "B", "C", "D"]


class QuizQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    question_id: int
    quiz_id: int
    word_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    user_answer: str | None = None
    is_correct: bool | None = None
    answered_at: datetime | None = None


class QuizResultRead(BaseModel):
    """Full result returned after quiz submission."""
    model_config = ConfigDict(from_attributes=True)
    quiz_id: int
    score: float
    accuracy: float
    total_questions: int
    is_completed: bool
    completed_at: datetime | None = None
    questions: list[QuizQuestionRead] = []


# ============================================================
# FR8 – AI Reading Generation
# ============================================================

class AIReadingCreate(BaseModel):
    user_id: int
    input_vocabulary: str = Field(
        ..., min_length=1,
        description="Comma-separated vocabulary words to embed in the passage"
    )
    topic_param: str | None = Field(default=None, max_length=200)
    difficulty_param: str | None = Field(default=None, max_length=50)


class AIReadingQuestionCreate(BaseModel):
    reading_id: int
    question_text: str = Field(..., min_length=1)
    option_a: str = Field(..., min_length=1)
    option_b: str = Field(..., min_length=1)
    option_c: str = Field(..., min_length=1)
    option_d: str = Field(..., min_length=1)
    correct_option: Literal["A", "B", "C", "D"]


class AIReadingAnswerSubmit(BaseModel):
    user_answer: Literal["A", "B", "C", "D"]


class AIReadingQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    question_id: int
    reading_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    user_answer: str | None = None
    is_correct: bool | None = None


class AIReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reading_id: int
    user_id: int
    input_vocabulary: str
    topic_param: str | None = None
    difficulty_param: str | None = None
    generated_passage: str
    score: float | None = None
    accuracy: float | None = None
    is_completed: bool
    generated_at: datetime | None = None
    completed_at: datetime | None = None
    comprehension_questions: list[AIReadingQuestionRead] = []
