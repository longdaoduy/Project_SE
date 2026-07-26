"""
Pydantic schemas for request validation and response serialisation.

Covers:
  FR2  – Flashcard Learning   (FlashcardSession, FlashcardProgress, StarredWord)
  FR3  – Quiz / Test          (Quiz, QuizQuestion)
  FR6  – Vocabulary Database  (Topic, Word)
  FR8  – AI Reading           (AIReading, AIReadingQuestion)
  FR1  – User Management      (User – basic stub)
"""

from datetime import datetime
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
# FR1 – User (basic stub; full auth endpoints handled separately)
# ============================================================

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: str | None = Field(default=None, max_length=120)
    proficiency_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] | None = None
    daily_goal_minutes: int = Field(default=10, ge=5, le=120)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    proficiency_level: str | None = None
    daily_goal_minutes: int
    is_active: bool
    created_at: datetime | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    proficiency_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=5, le=120)


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
    """
    Called when a user flips a card (is_flipped=True) or rates difficulty.
    difficulty_rating maps to SRS: 'again' | 'hard' | 'good' | 'easy'
    """
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


# Starred Words (FR16 – Star Vocabulary Word)

class StarredWordCreate(BaseModel):
    user_id: int
    word_id: int


class StarredWordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    starred_id: int
    user_id: int
    word_id: int
    starred_at: datetime | None = None
    word: WordRead | None = None  # optional nested detail


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
    """Payload sent when a user selects an answer for a question."""
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
    """Returned after a quiz is submitted and scored (FR3 – display result)."""
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
    input_vocabulary: str = Field(..., min_length=1,
        description="Comma-separated vocabulary words to embed in the passage")
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
