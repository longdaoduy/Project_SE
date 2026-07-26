import json
import os
from typing import Any
import time
import requests
from dotenv import load_dotenv

from . import crud, models, schemas
from .database import SessionLocal, engine

load_dotenv()

# Gắn cứng API Key của bạn vào đây
import os
import json
import time
import requests
from typing import Any
from dotenv import load_dotenv

# Vẫn giữ các import cũ của bạn...
# from . import crud, models, schemas
# from .database import SessionLocal, engine

load_dotenv()

# Cấu hình OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = "inclusionai/ling-3.0-flash:free"


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
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "ĐIỀN_API_KEY_CỦA_BẠN_VÀO_ĐÂY":
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

# Thay thế hoàn toàn hàm này
# Giữ nguyên hàm này của bạn
def parse_json_block(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
    return json.loads(cleaned)

# Cập nhật hàm tạo từ vựng
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
# ... code lưu từ vựng vào DB ở trên ...
            print(f"Seeded topic: {topic.topic_name}")
            
            # Thêm dòng này để API có thời gian nghỉ
            time.sleep(4) 
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()