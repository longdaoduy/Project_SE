from fastapi import FastAPI

app = FastAPI()

@app.get("/words")
def get_words():
    return [
        {"id": 1, "word": "Hello", "meaning": "Xin chào", "pronunciation": "/həˈloʊ/"},
        {"id": 2, "word": "Apple", "meaning": "Quả táo", "pronunciation": "/ˈæp.əl/"}
    ]