"""
SmartEng – Streamlit Demo
Demonstrates FR2 (Flashcard), FR3 (Quiz), FR8 (AI Reading) via the FastAPI backend.
Run: streamlit run backend/streamlit_app.py
"""

import random
import requests
import streamlit as st

# ── Configuration ────────────────────────────────────────────────────────────
API_DEFAULT = "http://127.0.0.1:8000"
DEMO_USER_ID = 1          # A seeded / pre-existing user used for demo sessions

st.set_page_config(page_title="SmartEng Demo", page_icon="📚", layout="wide")

# ── Sidebar ───────────────────────────────────────────────────────────────────
st.sidebar.title("⚙️ SmartEng")
api_base = st.sidebar.text_input("Backend URL", API_DEFAULT).rstrip("/")

# ── Helpers ───────────────────────────────────────────────────────────────────

def api_get(path: str, **params) -> list | dict:
    r = requests.get(f"{api_base}{path}", params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def api_post(path: str, body: dict) -> dict:
    r = requests.post(f"{api_base}{path}", json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def api_patch(path: str, body: dict) -> dict:
    r = requests.patch(f"{api_base}{path}", json=body, timeout=15)
    r.raise_for_status()
    return r.json()


@st.cache_data(ttl=60, show_spinner=False)
def fetch_topics() -> list[dict]:
    return api_get("/topics", limit=500, offset=0)


def topic_map(topics: list[dict]) -> dict[str, int]:
    return {t["topic_name"]: t["topic_id"] for t in topics}


# ── Ensure demo user exists ───────────────────────────────────────────────────
def ensure_demo_user() -> bool:
    """
    Verify demo user exists; create if missing.
    Returns True if backend is reachable, False otherwise.
    """
    try:
        resp = requests.get(f"{api_base}/users/{DEMO_USER_ID}", timeout=5)
        if resp.status_code == 200:
            return True
        if resp.status_code == 404:
            # Try to create with the current schema
            r = requests.post(f"{api_base}/users", json={
                "full_name": "Demo User",
                "email": "demo@smarteng.app",
                "password": "demo1234",
            }, timeout=10)
            return r.status_code in (200, 201, 400)  # 400 = already exists = fine
        return True
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# TAB LAYOUT
# ─────────────────────────────────────────────────────────────────────────────
st.title("📚 SmartEng – Feature Demo")

tab_flash, tab_quiz, tab_ai = st.tabs([
    "🃏 Flashcards (FR2)",
    "📝 Vocabulary Quiz (FR3)",
    "🤖 AI Reading (FR8)",
])

backend_ok = ensure_demo_user()
if not backend_ok:
    st.error(
        "⚠️ Cannot connect to the backend at **{}**. "
        "Please start it first:\n\n"
        "```\nuvicorn backend.main:app --reload\n```".format(api_base)
    )
    st.stop()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 – FLASHCARDS (FR2)
# ══════════════════════════════════════════════════════════════════════════════
with tab_flash:
    st.header("🃏 Flashcard Learning")
    st.caption("Flip cards to reveal meanings, then rate your recall difficulty (SRS).")

    try:
        topics = fetch_topics()
    except Exception as exc:
        st.error(f"Cannot reach backend: {exc}")
        st.stop()

    tmap = topic_map(topics)
    topic_options = ["— All topics —"] + list(tmap.keys())

    col_cfg1, col_cfg2 = st.columns([2, 1])
    with col_cfg1:
        selected_topic_label = st.selectbox("Choose topic", topic_options, key="fc_topic")
    with col_cfg2:
        card_count = st.number_input("# of cards", 1, 50, 10, key="fc_count")

    # ── session state keys ────────────────────────────────────────────────────
    def fc_init():
        defaults = {
            "fc_cards": [],
            "fc_idx": 0,
            "fc_flipped": False,
            "fc_session_id": None,
            "fc_progress_ids": {},   # word_id -> progress_id
            "fc_ratings": {},        # word_id -> rating
            "fc_done": False,
        }
        for k, v in defaults.items():
            if k not in st.session_state:
                st.session_state[k] = v

    fc_init()

    # ── Start session ─────────────────────────────────────────────────────────
    if st.button("🚀 Start / Restart Session", key="fc_start"):
        topic_id = tmap.get(selected_topic_label)
        try:
            params = {"limit": card_count}
            if topic_id:
                params["topic_id"] = topic_id
            words = api_get("/flashcards/random", **params)
            if not words:
                st.warning("No words found for this topic.")
                st.stop()

            # Create a backend session
            session = api_post("/flashcard-sessions", {
                "user_id": DEMO_USER_ID,
                "topic_id": topic_id,
                "total_cards": len(words),
            })
            st.session_state.fc_session_id = session["session_id"]
            st.session_state.fc_cards = words
            st.session_state.fc_idx = 0
            st.session_state.fc_flipped = False
            st.session_state.fc_ratings = {}
            st.session_state.fc_done = False

            # Pre-create progress records for each card
            progress_ids = {}
            for w in words:
                prog = api_post("/flashcard-progress", {
                    "session_id": session["session_id"],
                    "word_id": w["word_id"],
                })
                progress_ids[w["word_id"]] = prog["progress_id"]
            st.session_state.fc_progress_ids = progress_ids

        except Exception as exc:
            st.error(f"Error starting session: {exc}")

    cards = st.session_state.fc_cards
    if not cards:
        st.info("👆 Choose a topic and click **Start Session** to begin.")
    elif st.session_state.fc_done:
        st.success("🎉 Session complete! All cards reviewed.")
        ratings = st.session_state.fc_ratings
        if ratings:
            st.write("**Your ratings:**")
            for w in cards:
                r = ratings.get(w["word_id"], "—")
                emoji = {"again": "🔴", "hard": "🟠", "good": "🟢", "easy": "🔵"}.get(r, "⬜")
                st.write(f"{emoji} **{w['word']}** → {r}")
        if st.button("🔁 Study Again", key="fc_again"):
            st.session_state.fc_done = False
            st.session_state.fc_idx = 0
            st.session_state.fc_flipped = False
            st.rerun()
    else:
        idx = st.session_state.fc_idx
        card = cards[idx]

        # Progress bar
        st.progress((idx) / len(cards), text=f"Card {idx + 1} / {len(cards)}")

        # ── Card display ─────────────────────────────────────────────────────
        with st.container(border=True):
            col_word, col_meta = st.columns([3, 1])
            with col_word:
                st.markdown(f"## {card['word']}")
                if card.get("phonetic"):
                    st.caption(f"/{card['phonetic']}/")
            with col_meta:
                if card.get("part_of_speech"):
                    st.info(card["part_of_speech"])

            if not st.session_state.fc_flipped:
                if st.button("👁️ Show Meaning", key="fc_flip", use_container_width=True):
                    # Record flip on backend
                    pid = st.session_state.fc_progress_ids.get(card["word_id"])
                    if pid:
                        try:
                            api_patch(f"/flashcard-progress/{pid}", {"is_flipped": True})
                        except Exception:
                            pass
                    st.session_state.fc_flipped = True
                    st.rerun()
                st.caption("*Think about the meaning first, then reveal.*")
            else:
                st.divider()
                st.markdown(f"**🇻🇳 Meaning:** {card['meaning_vi']}")
                st.markdown(f"**📖 Example:** _{card['example_en']}_")
                st.markdown(f"**🇻🇳 Translation:** {card['example_vi']}")
                st.divider()

                # SRS rating buttons
                st.write("How well did you remember it?")
                r_col1, r_col2, r_col3, r_col4 = st.columns(4)

                # Capture card/idx/pid NOW via default args to avoid closure issues
                _cur_word_id = card["word_id"]
                _cur_pid = st.session_state.fc_progress_ids.get(_cur_word_id)
                _cur_idx = idx

                def _rate(rating: str, word_id=_cur_word_id, pid=_cur_pid, cur_idx=_cur_idx):
                    if pid:
                        try:
                            api_patch(f"/flashcard-progress/{pid}", {"difficulty_rating": rating})
                        except Exception:
                            pass
                    st.session_state.fc_ratings[word_id] = rating
                    next_idx = cur_idx + 1
                    if next_idx >= len(st.session_state.fc_cards):
                        sid = st.session_state.fc_session_id
                        if sid:
                            try:
                                api_post(f"/flashcard-sessions/{sid}/complete", {})
                            except Exception:
                                pass
                        st.session_state.fc_done = True
                    else:
                        st.session_state.fc_idx = next_idx
                        st.session_state.fc_flipped = False
                    st.rerun()

                with r_col1:
                    if st.button("🔴 Again", use_container_width=True, key="fc_again_btn"):
                        _rate("again")
                with r_col2:
                    if st.button("🟠 Hard", use_container_width=True, key="fc_hard_btn"):
                        _rate("hard")
                with r_col3:
                    if st.button("🟢 Good", use_container_width=True, key="fc_good_btn"):
                        _rate("good")
                with r_col4:
                    if st.button("🔵 Easy", use_container_width=True, key="fc_easy_btn"):
                        _rate("easy")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 – VOCABULARY QUIZ (FR3)
# ══════════════════════════════════════════════════════════════════════════════
with tab_quiz:
    st.header("📝 Vocabulary Quiz")
    st.caption("Multiple-choice quiz: pick a topic, answer questions, and see your score.")

    try:
        topics = fetch_topics()
    except Exception as exc:
        st.error(f"Cannot reach backend: {exc}")
        st.stop()

    tmap = topic_map(topics)

    # ── session state keys ────────────────────────────────────────────────────
    def qz_init():
        defaults = {
            "qz_quiz_id": None,
            "qz_questions": [],
            "qz_q_idx": 0,
            "qz_answers": {},    # question_id -> chosen option letter
            "qz_result": None,
            "qz_submitted": False,
        }
        for k, v in defaults.items():
            if k not in st.session_state:
                st.session_state[k] = v

    qz_init()

    # ── Config ────────────────────────────────────────────────────────────────
    col_qcfg1, col_qcfg2 = st.columns(2)
    with col_qcfg1:
        qz_topic_label = st.selectbox(
            "Topic", ["— All topics —"] + list(tmap.keys()), key="qz_topic"
        )
    with col_qcfg2:
        qz_n = st.number_input("# of questions", 3, 20, 5, key="qz_n")

    def _build_quiz_questions(words: list[dict], n: int) -> list[dict]:
        """Build multiple-choice questions from the word list."""
        if len(words) < 4:
            return []
        # Deduplicate by meaning_vi to avoid identical options
        seen_meanings: set[str] = set()
        unique_words = []
        for w in words:
            m = w["meaning_vi"].strip()
            if m not in seen_meanings:
                seen_meanings.add(m)
                unique_words.append(w)
        if len(unique_words) < 4:
            return []

        random.shuffle(unique_words)
        chosen = unique_words[:n]
        questions = []
        for w in chosen:
            correct = w["meaning_vi"].strip()
            # distractors: pick from the rest, guaranteed distinct meanings
            pool = [x["meaning_vi"].strip() for x in unique_words if x["word_id"] != w["word_id"]]
            distractors = random.sample(pool, min(3, len(pool)))
            options = distractors[:3] + [correct]
            random.shuffle(options)
            # safe index: correct always present once
            correct_idx = options.index(correct)
            correct_letter = ["A", "B", "C", "D"][correct_idx]
            questions.append({
                "word": w,
                "question_text": f'Which definition best matches "{w["word"]}"?',
                "option_a": options[0],
                "option_b": options[1],
                "option_c": options[2],
                "option_d": options[3],
                "correct_option": correct_letter,
            })
        return questions

    if st.button("🚀 Start Quiz", key="qz_start"):
        topic_id = tmap.get(qz_topic_label)
        try:
            params = {"limit": max(50, qz_n * 4)}
            if topic_id:
                params["topic_id"] = topic_id
            words = api_get("/words", **params)
            if len(words) < 4:
                st.warning("Not enough words in this topic (need at least 4).")
                st.stop()

            questions_data = _build_quiz_questions(words, qz_n)
            if not questions_data:
                st.warning("Could not build questions. Try a larger topic.")
                st.stop()

            # Create quiz on backend
            quiz = api_post("/quizzes", {
                "user_id": DEMO_USER_ID,
                "topic_id": topic_id,
                "quiz_type": "multiple_choice",
                "total_questions": len(questions_data),
            })
            quiz_id = quiz["quiz_id"]

            # Add questions to backend
            backend_questions = []
            for q in questions_data:
                bq = api_post(f"/quizzes/{quiz_id}/questions", {
                    "quiz_id": quiz_id,
                    "word_id": q["word"]["word_id"],
                    "question_text": q["question_text"],
                    "option_a": q["option_a"],
                    "option_b": q["option_b"],
                    "option_c": q["option_c"],
                    "option_d": q["option_d"],
                    "correct_option": q["correct_option"],
                })
                backend_questions.append(bq)

            st.session_state.qz_quiz_id = quiz_id
            st.session_state.qz_questions = backend_questions
            st.session_state.qz_q_idx = 0
            st.session_state.qz_answers = {}
            st.session_state.qz_result = None
            st.session_state.qz_submitted = False

        except Exception as exc:
            st.error(f"Error starting quiz: {exc}")

    qs = st.session_state.qz_questions

    if not qs:
        st.info("👆 Choose a topic and click **Start Quiz**.")
    elif st.session_state.qz_submitted and st.session_state.qz_result:
        res = st.session_state.qz_result
        st.success(
            f"✅ Quiz Complete! Score: **{int(res['score'])}/{res['total_questions']}** "
            f"({res['accuracy']:.1f}%)"
        )
        # Detailed breakdown
        for q in res.get("questions", []):
            correct = q["is_correct"]
            icon = "✅" if correct else "❌"
            label = q["question_text"]
            st.write(f"{icon} {label}")
            opt_map = {"A": q["option_a"], "B": q["option_b"],
                       "C": q["option_c"], "D": q["option_d"]}
            st.caption(
                f"Your answer: **{q['user_answer']} – {opt_map.get(q['user_answer'], '')}** | "
                f"Correct: **{q['correct_option']} – {opt_map.get(q['correct_option'], '')}**"
            )
        if st.button("🔁 New Quiz", key="qz_new"):
            st.session_state.qz_questions = []
            st.session_state.qz_submitted = False
            st.rerun()
    else:
        idx = st.session_state.qz_q_idx
        answered = st.session_state.qz_answers

        # Progress
        st.progress(len(answered) / len(qs), text=f"Answered {len(answered)} / {len(qs)}")

        # Display all questions (allow revisiting)
        for i, q in enumerate(qs):
            qid = q["question_id"]
            with st.expander(f"Q{i+1}. {q['question_text']}", expanded=(i == idx)):
                options = {
                    "A": q["option_a"],
                    "B": q["option_b"],
                    "C": q["option_c"],
                    "D": q["option_d"],
                }
                current = answered.get(qid)
                choice = st.radio(
                    "Select answer",
                    list(options.keys()),
                    format_func=lambda x: f"{x}. {options[x]}",
                    index=list(options.keys()).index(current) if current else 0,
                    key=f"qz_radio_{qid}",
                    label_visibility="collapsed",
                )
                if st.button("Confirm answer", key=f"qz_confirm_{qid}"):
                    # Submit to backend
                    try:
                        api_patch(
                            f"/quiz-questions/{qid}/answer",
                            {"user_answer": choice},
                        )
                        st.session_state.qz_answers[qid] = choice
                        if i + 1 < len(qs):
                            st.session_state.qz_q_idx = i + 1
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Error saving answer: {exc}")

        # Submit all
        if len(answered) == len(qs):
            if st.button("🏁 Submit Quiz & See Results", type="primary", key="qz_submit"):
                try:
                    result = api_post(f"/quizzes/{st.session_state.qz_quiz_id}/submit", {})
                    # Re-fetch each question to get is_correct populated
                    detailed_qs = []
                    for q in st.session_state.qz_questions:
                        try:
                            dq = api_get(f"/quiz-questions/{q['question_id']}")
                            detailed_qs.append(dq)
                        except Exception:
                            detailed_qs.append(q)
                    result["questions"] = detailed_qs
                    st.session_state.qz_result = result
                    st.session_state.qz_submitted = True
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error submitting quiz: {exc}")
        else:
            st.info(f"Answer all {len(qs)} questions to submit.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 – AI READING (FR8)
# ══════════════════════════════════════════════════════════════════════════════
with tab_ai:
    st.header("🤖 AI Reading Comprehension")
    st.caption(
        "Enter vocabulary words, generate a contextual English passage with AI, "
        "then answer comprehension questions."
    )

    # ── session state ─────────────────────────────────────────────────────────
    def ai_init():
        defaults = {
            "ai_reading": None,       # AIReadingRead dict
            "ai_answers": {},         # question_id -> letter
            "ai_result": None,
            "ai_submitted": False,
        }
        for k, v in defaults.items():
            if k not in st.session_state:
                st.session_state[k] = v

    ai_init()

    # Quick-load recent sets from topics
    try:
        topics = fetch_topics()
        topic_names = [t["topic_name"] for t in topics]
    except Exception:
        topic_names = []

    recent_col, input_col = st.columns([1, 2])
    with recent_col:
        st.write("**Recent Sets (quick load):**")
        if topic_names:
            chip_topic = st.selectbox(
                "Load words from topic",
                ["—"] + topic_names[:10],
                key="ai_chip",
            )
            if chip_topic != "—" and st.button("Load", key="ai_load_chip"):
                tid = topic_map(topics).get(chip_topic)
                try:
                    sample = api_get("/words", topic_id=tid, limit=10)
                    loaded = ", ".join(w["word"] for w in sample)
                    st.session_state["ai_vocab_input"] = loaded
                    st.rerun()
                except Exception as exc:
                    st.error(str(exc))

    with input_col:
        vocab_input = st.text_area(
            "Enter vocabulary words (comma-separated)",
            value=st.session_state.get("ai_vocab_input", ""),
            placeholder="e.g. ubiquitous, proliferate, sustainable, elusive",
            height=100,
            key="ai_vocab_text",
        )

    col_ai1, col_ai2 = st.columns(2)
    with col_ai1:
        topic_param = st.text_input(
            "Topic / context (optional)", placeholder="e.g. IELTS Academic, Environment",
            key="ai_topic_param"
        )
    with col_ai2:
        difficulty_param = st.selectbox(
            "Difficulty (optional)", ["—", "A1", "A2", "B1", "B2", "C1", "C2"],
            key="ai_diff"
        )

    if st.button("✨ Generate Reading Test", type="primary", key="ai_generate"):
        vocab = vocab_input.strip()
        if not vocab:
            st.warning("Please enter at least one vocabulary word.")
        else:
            with st.spinner("Generating passage and questions with AI… (may take ~10s)"):
                try:
                    payload = {
                        "user_id": DEMO_USER_ID,
                        "input_vocabulary": vocab,
                        "topic_param": topic_param.strip() or None,
                        "difficulty_param": difficulty_param if difficulty_param != "—" else None,
                    }
                    reading = api_post("/ai-readings", payload)
                    st.session_state.ai_reading = reading
                    st.session_state.ai_answers = {}
                    st.session_state.ai_result = None
                    st.session_state.ai_submitted = False
                except Exception as exc:
                    st.error(f"Generation failed: {exc}")

    reading = st.session_state.ai_reading

    if reading:
        st.divider()

        if st.session_state.ai_submitted and st.session_state.ai_result:
            res = st.session_state.ai_result
            st.success(
                f"📊 Reading Test Complete! Score: **{int(res['score'])}/{len(res['comprehension_questions'])}** "
                f"({res['accuracy']:.1f}%)"
            )
            st.markdown("### 📄 Passage")
            st.write(reading["generated_passage"])
            st.markdown("### 📋 Question Review")
            for q in res["comprehension_questions"]:
                icon = "✅" if q["is_correct"] else "❌"
                st.write(f"{icon} **{q['question_text']}**")
                opt_map = {"A": q["option_a"], "B": q["option_b"],
                           "C": q["option_c"], "D": q["option_d"]}
                st.caption(
                    f"Your answer: **{q['user_answer']} – {opt_map.get(q['user_answer'], '')}** | "
                    f"Correct: **{q['correct_option']} – {opt_map.get(q['correct_option'], '')}**"
                )
            if st.button("🔁 Generate New Reading", key="ai_reset"):
                st.session_state.ai_reading = None
                st.session_state.ai_submitted = False
                st.rerun()
        else:
            # Show passage
            pass_col, q_col = st.columns([1, 1])
            with pass_col:
                st.markdown("### 📄 Reading Passage")
                st.write(reading["generated_passage"])

            with q_col:
                st.markdown("### ❓ Comprehension Questions")
                comprehension_qs = reading.get("comprehension_questions", [])

                if not comprehension_qs:
                    st.info(
                        "No questions have been added yet. "
                        "The AI service generates them automatically when available. "
                        "You can add demo questions below."
                    )
                    with st.expander("➕ Add a demo question manually"):
                        with st.form("ai_add_q"):
                            qt = st.text_input("Question text")
                            oa = st.text_input("Option A")
                            ob = st.text_input("Option B")
                            oc = st.text_input("Option C")
                            od = st.text_input("Option D")
                            co = st.selectbox("Correct option", ["A", "B", "C", "D"])
                            if st.form_submit_button("Add question"):
                                try:
                                    api_post(
                                        f"/ai-readings/{reading['reading_id']}/questions",
                                        {
                                            "reading_id": reading["reading_id"],
                                            "question_text": qt,
                                            "option_a": oa,
                                            "option_b": ob,
                                            "option_c": oc,
                                            "option_d": od,
                                            "correct_option": co,
                                        },
                                    )
                                    # refresh
                                    st.session_state.ai_reading = api_get(
                                        f"/ai-readings/{reading['reading_id']}"
                                    )
                                    st.rerun()
                                except Exception as exc:
                                    st.error(str(exc))
                else:
                    ai_ans = st.session_state.ai_answers
                    for q in comprehension_qs:
                        qid = q["question_id"]
                        opts = {
                            "A": q["option_a"],
                            "B": q["option_b"],
                            "C": q["option_c"],
                            "D": q["option_d"],
                        }
                        st.write(f"**{q['question_text']}**")
                        ch = st.radio(
                            "Answer",
                            list(opts.keys()),
                            format_func=lambda x: f"{x}. {opts[x]}",
                            index=list(opts.keys()).index(ai_ans.get(qid, "A")),
                            key=f"ai_radio_{qid}",
                            label_visibility="collapsed",
                        )
                        st.session_state.ai_answers[qid] = ch

                    st.divider()
                    if len(ai_ans) == len(comprehension_qs) or True:
                        if st.button("🏁 Submit Answers", type="primary", key="ai_submit"):
                            try:
                                # Submit each answer
                                for q in comprehension_qs:
                                    qid = q["question_id"]
                                    answer = st.session_state.ai_answers.get(qid, "A")
                                    api_patch(
                                        f"/ai-reading-questions/{qid}/answer",
                                        {"user_answer": answer},
                                    )
                                # Score
                                result = api_post(
                                    f"/ai-readings/{reading['reading_id']}/submit", {}
                                )
                                st.session_state.ai_result = result
                                st.session_state.ai_submitted = True
                                st.rerun()
                            except Exception as exc:
                                st.error(f"Error submitting: {exc}")
