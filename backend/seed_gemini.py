import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

from . import crud, models, schemas
from .database import SessionLocal, engine

# Load biến môi trường từ backend/.env (xem backend/.env.example)
load_dotenv(Path(__file__).resolve().parent / ".env")

# Cấu hình OpenRouter API – đọc từ biến môi trường (xem backend/.env.example)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "inclusionai/ling-3.0-tiny:free")


def _extract_text_openrouter(response_json: dict[str, Any]) -> str:
    """Trích xuất nội dung văn bản từ cấu trúc trả về của OpenRouter (chuẩn OpenAI)"""
    choices = response_json.get("choices", [])
    if not choices:
        raise ValueError(f"OpenRouter response missing choices: {response_json}")

    message = choices[0].get("message", {})
    text = message.get("content", "").strip()

    if not text:
        raise ValueError(f"OpenRouter response empty content: {response_json}")
    return text


def call_openrouter(prompt: str, max_retries: int = 5) -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("Missing OPENROUTER_API_KEY in environment or variable")

    url = "https://openrouter.ai/api/v1/chat/completions"

    # Header bắt buộc theo doc của OpenRouter
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    # Body chuẩn theo doc của OpenRouter
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }

    for attempt in range(max_retries):
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 429:
            wait_time = (2 ** attempt) * 5
            print(f"⏳ API đang quá tải (429). Đang đợi {wait_time} giây để thử lại (Lần {attempt + 1}/{max_retries})...")
            time.sleep(wait_time)
            continue

        response.raise_for_status()
        return _extract_text_openrouter(response.json())

    raise RuntimeError("Đã thử lại quá nhiều lần nhưng vẫn bị 429 Rate Limit.")


def parse_json_block(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
    return json.loads(cleaned)


def generate_topics() -> list[str]:
    print("Dùng dữ liệu giả tạo 30 chủ đề...")
    return [
        "Technology", "Travel", "Education", "Health", "Food",
        "Business", "Environment", "Sports", "Music", "Art",
        "Science", "History", "Politics", "Animals", "Fashion",
        "Movies", "Literature", "Weather", "Family", "Hobbies",
        "Transportation", "Culture", "Economy", "Law", "Media",
        "Psychology", "Architecture", "Space", "Agriculture", "Daily Life"
    ]


def generate_words_for_topic(topic: str, count: int = 30) -> list[dict]:
    print(f"Đang nhờ OpenRouter AI tạo {count} từ vựng thật cho chủ đề '{topic}'...")

    prompt = f"""
    Bạn là một chuyên gia ngôn ngữ học. Hãy tạo danh sách {count} từ vựng tiếng Anh phổ biến và hữu ích thuộc chủ đề '{topic}'.
    Yêu cầu định dạng đầu ra BẮT BUỘC là một mảng JSON (JSON array), không kèm thêm bất kỳ văn bản giải thích nào khác ngoài JSON.
    Mỗi phần tử trong mảng là một object chứa chính xác các key sau:
    - "word": từ vựng tiếng Anh.
    - "part_of_speech": từ loại (ví dụ: noun, verb, adjective, adverb...).
    - "phonetic": phiên âm quốc tế IPA chuẩn xác (ví dụ: /tɛkˈnɒlədʒi/).
    - "meaning_vi": nghĩa tiếng Việt ngắn gọn, dễ hiểu.
    - "example_en": một câu ví dụ tiếng Anh thực tế sử dụng từ vựng này.
    - "example_vi": bản dịch tiếng Việt của câu ví dụ trên.
    """

    try:
        # Gọi qua OpenRouter thay vì Gemini
        response_text = call_openrouter(prompt)
        words_data = parse_json_block(response_text)

        print(f"✅ Đã nhận thành công {len(words_data)} từ vựng chủ đề {topic} từ OpenRouter AI!")
        return words_data

    except Exception as e:
        print(f"❌ Lỗi khi gọi AI cho chủ đề {topic}: {e}")
        return []


def generate_reading_passage(vocabulary: str, topic: str | None = None, difficulty: str | None = None) -> str:
    """
    FR8 – Generate an AI reading passage that embeds the given vocabulary words.
    Adapts length, sentence complexity and vocabulary density to the CEFR level.
    Returns the passage text only (questions generated separately).
    """
    level_descriptions = {
        "A1": "very simple sentences, basic everyday vocabulary, present tense only, 100-150 words",
        "A2": "simple sentences, familiar topics, limited tenses, 130-180 words",
        "B1": "clear standard language, familiar topics, some complex sentences, 180-230 words",
        "B2": "complex texts, abstract topics, varied grammar, 220-280 words",
        "C1": "sophisticated language, implicit meaning, advanced vocabulary, 270-330 words",
        "C2": "highly sophisticated, nuanced, native-like fluency, academic register, 300-370 words",
    }
    level_hint = ""
    if difficulty and difficulty in level_descriptions:
        level_hint = f" Write at CEFR {difficulty} level: {level_descriptions[difficulty]}."

    topic_hint = f" The passage should relate to the topic: '{topic}'." if topic else ""

    prompt = (
        f"You are an English language teacher creating a reading passage for a language learner."
        f"{level_hint}{topic_hint}"
        f" Naturally incorporate ALL of the following vocabulary words into the passage: {vocabulary}."
        f" The passage must be coherent, educational, and engaging."
        f" Output ONLY the passage text with no titles, labels, or extra commentary."
    )
    try:
        return call_openrouter(prompt)
    except Exception as e:
        return (
            f"[AI passage generation failed: {e}] "
            f"Vocabulary: {vocabulary}"
        )


def generate_comprehension_questions(passage: str, vocabulary: str, count: int = 5) -> list[dict]:
    """
    FR8 – Generate multiple-choice comprehension questions for a reading passage.
    Questions are grounded in the passage and test both comprehension and
    vocabulary in context.
    Returns a list of dicts with keys:
      question_text, option_a, option_b, option_c, option_d, correct_option
    """
    prompt = f"""You are an English comprehension question writer.
Given the reading passage below, generate exactly {count} multiple-choice comprehension questions.

PASSAGE:
{passage}

VOCABULARY USED: {vocabulary}

Requirements:
- Each question MUST be answerable from the passage text.
- Questions should test understanding of both content and vocabulary in context.
- Provide exactly 4 options labeled A, B, C, D.
- Only ONE option is correct; the others must be clearly wrong based on the passage.
- Output ONLY a valid JSON array, no extra text outside the array.
- Each element must have these exact keys:
  "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"
- "correct_option" must be exactly one of: "A", "B", "C", "D"

Example format:
[
  {{
    "question_text": "What does 'ubiquitous' mean in the passage?",
    "option_a": "Rare and hard to find",
    "option_b": "Present everywhere at once",
    "option_c": "Expensive and luxurious",
    "option_d": "Old and outdated",
    "correct_option": "B"
  }}
]"""
    try:
        response_text = call_openrouter(prompt)
        questions = parse_json_block(response_text)
        valid = []
        for q in questions:
            if all(k in q for k in ("question_text", "option_a", "option_b", "option_c", "option_d", "correct_option")):
                if q["correct_option"] in ("A", "B", "C", "D"):
                    valid.append(q)
        return valid
    except Exception as e:
        print(f"❌ Error generating comprehension questions: {e}")
        return []


def generate_test_title(passage: str, vocabulary: str, difficulty: str | None = None) -> str:
    """
    Generate a short, meaningful title for a reading test.
    Format: "Short Descriptive Title (Level – Topic)" e.g. "A Day in Paris (A2 – Travel)"
    Falls back to a vocab-derived label if AI call fails.
    """
    level_part = f" – {difficulty}" if difficulty else ""
    prompt = (
        f"You are naming a reading comprehension test. "
        f"Based on the passage and vocabulary below, generate a SHORT descriptive title (max 8 words). "
        f"Format: A brief title{level_part} — like 'Climate Change and Its Effects (B2)' or 'Daily Life in Tokyo (A2)'. "
        f"Output ONLY the title text, nothing else.\n\n"
        f"PASSAGE (first 300 chars): {passage[:300]}\n"
        f"VOCABULARY: {vocabulary[:150]}"
    )
    try:
        title = call_openrouter(prompt).strip().strip('"').strip("'")
        # Truncate to 200 chars max (DB constraint)
        return title[:200] if title else _fallback_title(vocabulary, difficulty)
    except Exception:
        return _fallback_title(vocabulary, difficulty)


def _fallback_title(vocabulary: str, difficulty: str | None) -> str:
    """Generate a simple fallback title from the first few vocabulary words."""
    words = [w.strip().capitalize() for w in vocabulary.split(',')][:3]
    base = ' · '.join(words) if words else 'Reading Test'
    return f"{base} ({difficulty})" if difficulty else base


def generate_explanations(passage: str, questions: list[dict]) -> list[str]:
    """
    FR8 – Generate a concise explanation for each question's correct answer.
    Each explanation should:
      - State why the correct answer is right (reference the passage).
      - Briefly note why the other options are wrong (optional but included).
      - Be 1–3 sentences, plain English.

    `questions` must be a list of dicts with keys:
      question_text, option_a, option_b, option_c, option_d, correct_option

    Returns a list of explanation strings, same order as input questions.
    """
    if not questions:
        return []

    q_block = "\n".join(
        f"{i+1}. {q['question_text']}\n"
        f"   A: {q['option_a']}\n"
        f"   B: {q['option_b']}\n"
        f"   C: {q['option_c']}\n"
        f"   D: {q['option_d']}\n"
        f"   Correct: {q['correct_option']}"
        for i, q in enumerate(questions)
    )

    prompt = f"""You are an English teacher providing answer explanations for a reading comprehension test.

PASSAGE:
{passage}

QUESTIONS AND CORRECT ANSWERS:
{q_block}

For each question, write a short explanation (1-3 sentences) that:
1. Clearly states why the correct answer is right, referencing the passage directly.
2. Briefly explains why the other options are incorrect (one sentence is enough).

Output ONLY a valid JSON array of strings, one explanation per question, in the same order.
Example: ["Explanation for Q1.", "Explanation for Q2.", ...]
No extra text outside the JSON array."""

    try:
        response_text = call_openrouter(prompt)
        explanations = parse_json_block(response_text)
        if isinstance(explanations, list) and len(explanations) == len(questions):
            return [str(e) for e in explanations]
        # Fallback: pad or trim to match question count
        result = [str(e) for e in explanations]
        while len(result) < len(questions):
            result.append("")
        return result[:len(questions)]
    except Exception as e:
        print(f"❌ Error generating explanations: {e}")
        return ["" for _ in questions]


def seed_database() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        topic_names = generate_topics()
        for topic_name in topic_names:
            existing_topic = crud.get_topic_by_name(db, topic_name)
            if existing_topic:
                topic = existing_topic
            else:
                topic = crud.create_topic(db, schemas.TopicCreate(topic_name=topic_name))

            words = generate_words_for_topic(topic.topic_name)
            for item in words:
                crud.create_word(
                    db,
                    schemas.WordCreate(
                        topic_id=topic.topic_id,
                        word=str(item["word"]),
                        part_of_speech=item.get("part_of_speech"),
                        phonetic=item.get("phonetic"),
                        meaning_vi=str(item["meaning_vi"]),
                        example_en=str(item["example_en"]),
                        example_vi=str(item["example_vi"]),
                    ),
                )
            print(f"Seeded topic: {topic.topic_name}")

            # Thêm dòng này để API có thời gian nghỉ
            time.sleep(4)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
