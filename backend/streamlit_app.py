"""
SmartEng – Streamlit Demo  v3.1
Demonstrates all features via the merged FastAPI backend.
Run:  streamlit run backend/streamlit_app.py
"""

import random
import requests
import streamlit as st

# ── Config ────────────────────────────────────────────────────────────────────
API_DEFAULT = "http://127.0.0.1:8000"
st.set_page_config(page_title="SmartEng Demo", page_icon="📚", layout="wide")

# ── Sidebar ───────────────────────────────────────────────────────────────────
st.sidebar.title("⚙️ SmartEng")
api_base = st.sidebar.text_input("Backend URL", API_DEFAULT).rstrip("/")

# ── HTTP helpers ──────────────────────────────────────────────────────────────
def _raise_api_error(response):
    """Show FastAPI's useful `detail` message instead of a generic HTTP status."""
    if response.ok:
        return
    try:
        payload = response.json()
        detail = payload.get("detail", payload)
        if isinstance(detail, list):
            detail = "; ".join(item.get("msg", str(item)) for item in detail)
    except ValueError:
        detail = response.text or response.reason
    raise RuntimeError(f"{response.status_code}: {detail}")

def _headers():
    token = st.session_state.get("jwt_token")
    return {"Authorization": f"Bearer {token}"} if token else {}

def api_get(path: str, **params):
    r = requests.get(f"{api_base}{path}", params=params, headers=_headers(), timeout=15)
    _raise_api_error(r)
    return r.json()

def api_post(path: str, body: dict, auth: bool = False):
    h = {"Content-Type": "application/json"}
    if auth:
        h.update(_headers())
    r = requests.post(f"{api_base}{path}", json=body, headers=h, timeout=30)
    _raise_api_error(r)
    return r.json()

def api_patch(path: str, body: dict):
    r = requests.patch(f"{api_base}{path}", json=body, headers=_headers(), timeout=15)
    _raise_api_error(r)
    return r.json()

def api_delete(path: str, body: dict):
    r = requests.delete(f"{api_base}{path}", json=body, headers=_headers(), timeout=15)
    _raise_api_error(r)
    return r.json()

@st.cache_data(ttl=60, show_spinner=False)
def fetch_topics():
    return api_get("/topics", limit=500)

def topic_map(topics):
    return {t["topic_name"]: t["topic_id"] for t in topics}

# ── Backend health check ──────────────────────────────────────────────────────
try:
    requests.get(f"{api_base}/health", timeout=4).raise_for_status()
    backend_ok = True
except Exception:
    backend_ok = False

if not backend_ok:
    st.error(
        f"⚠️  Cannot reach backend at **{api_base}**.\n\n"
        "Start it with:\n```\nuvicorn backend.main:app --reload\n```"
    )
    st.stop()

# ── Auth state helpers ────────────────────────────────────────────────────────
def is_logged_in():
    return bool(st.session_state.get("jwt_token") and st.session_state.get("current_user"))

def current_user_id():
    u = st.session_state.get("current_user", {})
    return u.get("user_id")

# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR – login / user info
# ─────────────────────────────────────────────────────────────────────────────
st.sidebar.divider()
if is_logged_in():
    u = st.session_state["current_user"]
    st.sidebar.success(f"👤 {u['full_name']}")
    st.sidebar.caption(u["email"])
    st.sidebar.caption(f"Level: {u.get('english_level') or '—'}  |  XP: see History tab")
    if st.sidebar.button("🚪 Logout"):
        sid = st.session_state.get("session_id")
        if sid:
            try:
                requests.post(f"{api_base}/users/logout", params={"session_id": sid},
                              headers=_headers(), timeout=5)
            except Exception:
                pass
        for k in ["jwt_token", "current_user", "session_id"]:
            st.session_state.pop(k, None)
        st.rerun()
else:
    st.sidebar.info("Not logged in")

# ─────────────────────────────────────────────────────────────────────────────
# TABS
# ─────────────────────────────────────────────────────────────────────────────
st.title("📚 SmartEng – Feature Demo")

(tab_auth, tab_flash, tab_quiz, tab_ai, tab_hist) = st.tabs([
    "🔐 Login / Register",
    "🃏 Flashcards",
    "📝 Quiz",
    "🤖 AI Reading",
    "📊 History & Stats",
])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 – LOGIN / REGISTER
# ══════════════════════════════════════════════════════════════════════════════
with tab_auth:
    st.header("🔐 Authentication")

    if is_logged_in():
        u = st.session_state["current_user"]
        st.success(f"You are logged in as **{u['full_name']}** ({u['email']})")
        st.json({k: u[k] for k in ["user_id", "full_name", "email", "role",
                                     "english_level", "daily_goal", "is_active"]})

        st.divider()
        st.subheader("✏️ Edit Profile")
        with st.form("edit_profile"):
            new_name  = st.text_input("Full name",  value=u["full_name"])
            new_level = st.selectbox("English level",
                                     ["A1","A2","B1","B2","C1","C2"],
                                     index=["A1","A2","B1","B2","C1","C2"].index(u["english_level"])
                                     if u.get("english_level") else 2)
            new_goal  = st.number_input("Daily goal (words)", 1, 200, int(u.get("daily_goal", 20)))
            if st.form_submit_button("Save"):
                try:
                    updated = api_patch(f"/users/{u['user_id']}",
                                        {"full_name": new_name, "english_level": new_level,
                                         "daily_goal": new_goal})
                    st.session_state["current_user"] = updated
                    st.success("Profile updated!")
                    st.rerun()
                except Exception as exc:
                    st.error(str(exc))

        st.divider()
        st.subheader("🔑 Change Password")
        with st.form("chg_pwd"):
            cur_pwd  = st.text_input("Current password",  type="password")
            new_pwd  = st.text_input("New password",      type="password")
            conf_pwd = st.text_input("Confirm new password", type="password")
            if st.form_submit_button("Change Password"):
                try:
                    api_post(f"/users/{u['user_id']}/change-password",
                             {"current_password": cur_pwd, "new_password": new_pwd,
                              "confirm_password": conf_pwd}, auth=True)
                    st.success("Password changed. You have been logged out of all sessions.")
                    for k in ["jwt_token", "current_user", "session_id"]:
                        st.session_state.pop(k, None)
                    st.rerun()
                except Exception as exc:
                    st.error(str(exc))

        st.divider()
        with st.expander("⚠️ Delete Account", expanded=False):
            with st.form("del_acc"):
                del_pwd  = st.text_input("Password", type="password")
                del_conf = st.text_input('Type DELETE to confirm', placeholder="DELETE")
                if st.form_submit_button("Delete my account", type="primary"):
                    try:
                        api_delete(f"/users/{u['user_id']}",
                                   {"password": del_pwd, "confirmation": del_conf})
                        for k in ["jwt_token", "current_user", "session_id"]:
                            st.session_state.pop(k, None)
                        st.success("Account deleted.")
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))
    else:
        login_tab, register_tab = st.tabs(["Login", "Register"])

        with login_tab:
            with st.form("login_form"):
                email    = st.text_input("Email")
                password = st.text_input("Password", type="password")
                if st.form_submit_button("Login", type="primary"):
                    try:
                        resp = api_post("/users/login",
                                        {"email": email, "password": password,
                                         "device_name": "Streamlit Demo"})
                        st.session_state["jwt_token"]    = resp["jwt_token"]
                        st.session_state["session_id"]   = resp["session_id"]
                        st.session_state["current_user"] = resp["user"]
                        st.success(f"Welcome back, {resp['user']['full_name']}!")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Login failed: {exc}")

        with register_tab:
            with st.form("register_form"):
                r_name  = st.text_input("Full name")
                r_email = st.text_input("Email")
                r_pass  = st.text_input("Password (min 6 chars)", type="password")
                r_level = st.selectbox("English level", ["A1","A2","B1","B2","C1","C2"], index=2)
                if st.form_submit_button("Create Account", type="primary"):
                    try:
                        api_post("/users",
                                 {"full_name": r_name, "email": r_email,
                                  "password": r_pass, "english_level": r_level})
                        st.session_state["verification_email"] = r_email.strip().lower()
                        st.session_state["verification_password"] = r_pass
                        st.success("Account created! Check your email for the 6-digit code.")
                    except Exception as exc:
                        st.error(f"Registration failed: {exc}")

            st.divider()
            st.subheader("✉️ Verify email")
            verify_email = st.text_input(
                "Account email",
                value=st.session_state.get("verification_email", ""),
                key="verify_email_input",
            )
            with st.form("verify_email_form"):
                verify_code = st.text_input(
                    "6-digit verification code", max_chars=6, placeholder="000000"
                )
                if st.form_submit_button("Verify and log in", type="primary"):
                    try:
                        api_post("/users/verify-email", {
                            "email": verify_email,
                            "code": verify_code,
                        })
                        saved_password = st.session_state.get("verification_password")
                        if saved_password:
                            resp = api_post("/users/login", {
                                "email": verify_email,
                                "password": saved_password,
                                "device_name": "Streamlit Demo",
                            })
                            st.session_state["jwt_token"] = resp["jwt_token"]
                            st.session_state["session_id"] = resp["session_id"]
                            st.session_state["current_user"] = resp["user"]
                            st.session_state.pop("verification_password", None)
                            st.success("Email verified. You are now logged in!")
                            st.rerun()
                        else:
                            st.success("Email verified. You can now log in.")
                    except Exception as exc:
                        st.error(f"Verification failed: {exc}")

            if st.button("Send a new verification code", key="resend_verification"):
                try:
                    api_post("/users/resend-verification", {"email": verify_email})
                    st.success("If this account needs verification, a new code was sent.")
                except Exception as exc:
                    st.error(f"Could not resend code: {exc}")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 – FLASHCARDS (FR2)
# ══════════════════════════════════════════════════════════════════════════════
with tab_flash:
    st.header("🃏 Flashcard Learning (SRS)")
    if not is_logged_in():
        st.warning("Please log in first (Login / Register tab).")
    else:
        uid = current_user_id()
        try:
            topics = fetch_topics()
        except Exception as exc:
            st.error(str(exc)); st.stop()

        tmap = topic_map(topics)
        topic_options = ["— All topics —"] + list(tmap.keys())

        # session state
        for k, v in {"fc_cards": [], "fc_idx": 0, "fc_flipped": False,
                      "fc_session_id": None, "fc_progress_ids": {},
                      "fc_ratings": {}, "fc_done": False}.items():
            st.session_state.setdefault(k, v)

        col1, col2 = st.columns([2, 1])
        with col1:
            sel_topic = st.selectbox("Topic", topic_options, key="fc_topic")
        with col2:
            card_n = st.number_input("Cards", 1, 50, 10, key="fc_count")

        if st.button("🚀 Start / Restart", key="fc_start"):
            tid = tmap.get(sel_topic)
            try:
                words = api_get("/flashcards/random", limit=card_n, **
                                ({"topic_id": tid} if tid else {}))
                if not words:
                    st.warning("No words found."); st.stop()
                sess = api_post("/flashcard-sessions",
                                {"user_id": uid, "topic_id": tid, "total_cards": len(words)})
                pids = {}
                for w in words:
                    p = api_post("/flashcard-progress",
                                 {"session_id": sess["session_id"], "word_id": w["word_id"]})
                    pids[w["word_id"]] = p["progress_id"]
                st.session_state.update(fc_cards=words, fc_idx=0, fc_flipped=False,
                                        fc_session_id=sess["session_id"],
                                        fc_progress_ids=pids, fc_ratings={}, fc_done=False)
            except Exception as exc:
                st.error(str(exc))

        cards = st.session_state.fc_cards
        if not cards:
            st.info("Choose a topic and click **Start / Restart**.")
        elif st.session_state.fc_done:
            st.success("🎉 Session complete!")
            ratings = st.session_state.fc_ratings
            cols = st.columns(4)
            for label, emoji, color in [("Again","🔴","red"),("Hard","🟠","orange"),
                                         ("Good","🟢","green"),("Easy","🔵","blue")]:
                count = sum(1 for r in ratings.values() if r == label.lower())
                cols[["again","hard","good","easy"].index(label.lower())].metric(
                    f"{emoji} {label}", count)
            if st.button("🔁 Study Again", key="fc_redo"):
                st.session_state.update(fc_done=False, fc_idx=0, fc_flipped=False)
                st.rerun()
        else:
            idx  = st.session_state.fc_idx
            card = cards[idx]
            st.progress(idx / len(cards), text=f"Card {idx+1} / {len(cards)}")
            with st.container(border=True):
                c1, c2 = st.columns([3, 1])
                with c1:
                    st.markdown(f"## {card['word']}")
                    if card.get("phonetic"):
                        st.caption(f"/{card['phonetic']}/")
                with c2:
                    if card.get("part_of_speech"):
                        st.info(card["part_of_speech"])

                if not st.session_state.fc_flipped:
                    if st.button("👁️ Show Meaning", use_container_width=True, key="fc_flip"):
                        pid = st.session_state.fc_progress_ids.get(card["word_id"])
                        if pid:
                            try: api_patch(f"/flashcard-progress/{pid}", {"is_flipped": True})
                            except Exception: pass
                        st.session_state.fc_flipped = True
                        st.rerun()
                    st.caption("Think about the meaning first, then reveal.")
                else:
                    st.divider()
                    st.markdown(f"**🇻🇳 Nghĩa:** {card['meaning_vi']}")
                    st.markdown(f"**📖 Ví dụ:** _{card['example_en']}_")
                    st.markdown(f"**🇻🇳** {card['example_vi']}")
                    st.divider()
                    st.write("How well did you remember?")
                    wid  = card["word_id"]
                    pid  = st.session_state.fc_progress_ids.get(wid)
                    def _rate(r, _wid=wid, _pid=pid, _idx=idx):
                        if _pid:
                            try: api_patch(f"/flashcard-progress/{_pid}", {"difficulty_rating": r})
                            except Exception: pass
                        st.session_state.fc_ratings[_wid] = r
                        nxt = _idx + 1
                        if nxt >= len(st.session_state.fc_cards):
                            sid = st.session_state.fc_session_id
                            if sid:
                                try: api_post(f"/flashcard-sessions/{sid}/complete", {})
                                except Exception: pass
                            st.session_state.fc_done = True
                        else:
                            st.session_state.update(fc_idx=nxt, fc_flipped=False)
                        st.rerun()
                    c1, c2, c3, c4 = st.columns(4)
                    with c1:
                        if st.button("🔴 Again", use_container_width=True, key="fc_r_a"): _rate("again")
                    with c2:
                        if st.button("🟠 Hard",  use_container_width=True, key="fc_r_h"): _rate("hard")
                    with c3:
                        if st.button("🟢 Good",  use_container_width=True, key="fc_r_g"): _rate("good")
                    with c4:
                        if st.button("🔵 Easy",  use_container_width=True, key="fc_r_e"): _rate("easy")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 – QUIZ (FR3)
# ══════════════════════════════════════════════════════════════════════════════
with tab_quiz:
    st.header("📝 Vocabulary Quiz")
    if not is_logged_in():
        st.warning("Please log in first.")
    else:
        uid = current_user_id()
        try:
            topics = fetch_topics()
        except Exception as exc:
            st.error(str(exc)); st.stop()
        tmap = topic_map(topics)

        for k, v in {"qz_quiz_id": None, "qz_questions": [], "qz_q_idx": 0,
                      "qz_answers": {}, "qz_result": None, "qz_submitted": False}.items():
            st.session_state.setdefault(k, v)

        c1, c2 = st.columns(2)
        with c1:
            qz_topic = st.selectbox("Topic", ["— All —"] + list(tmap.keys()), key="qz_topic")
        with c2:
            qz_n = st.number_input("Questions", 3, 20, 5, key="qz_n")

        def _build_qs(words, n):
            seen = set()
            uniq = [w for w in words if (m := w["meaning_vi"].strip()) not in seen and not seen.add(m)]
            if len(uniq) < 4: return []
            random.shuffle(uniq)
            qs = []
            for w in uniq[:n]:
                correct = w["meaning_vi"].strip()
                pool = [x["meaning_vi"].strip() for x in uniq if x["word_id"] != w["word_id"]]
                opts = random.sample(pool, min(3, len(pool))) + [correct]
                random.shuffle(opts)
                ci = ["A","B","C","D"][opts.index(correct)]
                qs.append({"word": w,
                           "question_text": f'What is the meaning of "{w["word"]}"?',
                           "option_a": opts[0], "option_b": opts[1],
                           "option_c": opts[2], "option_d": opts[3],
                           "correct_option": ci})
            return qs

        if st.button("🚀 Start Quiz", key="qz_start"):
            tid = tmap.get(qz_topic)
            try:
                words = api_get("/words", limit=max(50, qz_n*4),
                                **{"topic_id": tid} if tid else {})
                qs_data = _build_qs(words, qz_n)
                if not qs_data:
                    st.warning("Not enough words."); st.stop()
                quiz = api_post("/quizzes", {"user_id": uid, "topic_id": tid,
                                             "quiz_type": "multiple_choice",
                                             "total_questions": len(qs_data)})
                qid = quiz["quiz_id"]
                bqs = [api_post(f"/quizzes/{qid}/questions",
                                {"quiz_id": qid, "word_id": q["word"]["word_id"],
                                 "question_text": q["question_text"],
                                 "option_a": q["option_a"], "option_b": q["option_b"],
                                 "option_c": q["option_c"], "option_d": q["option_d"],
                                 "correct_option": q["correct_option"]})
                       for q in qs_data]
                st.session_state.update(qz_quiz_id=qid, qz_questions=bqs, qz_q_idx=0,
                                        qz_answers={}, qz_result=None, qz_submitted=False)
            except Exception as exc:
                st.error(str(exc))

        qs = st.session_state.qz_questions
        if not qs:
            st.info("Choose a topic and click **Start Quiz**.")
        elif st.session_state.qz_submitted and st.session_state.qz_result:
            res = st.session_state.qz_result
            st.success(f"Score: **{int(res['score'])}/{res['total_questions']}** ({res['accuracy']:.1f}%)")
            for q in res.get("questions", []):
                icon = "✅" if q["is_correct"] else "❌"
                om = {"A": q["option_a"], "B": q["option_b"], "C": q["option_c"], "D": q["option_d"]}
                st.write(f"{icon} {q['question_text']}")
                st.caption(f"Your: **{q['user_answer']} – {om.get(q['user_answer'],'')}**  |  "
                           f"Correct: **{q['correct_option']} – {om.get(q['correct_option'],'')}**")
            if st.button("🔁 New Quiz", key="qz_new"):
                st.session_state.qz_questions = []; st.session_state.qz_submitted = False; st.rerun()
        else:
            ans = st.session_state.qz_answers
            st.progress(len(ans) / len(qs), text=f"Answered {len(ans)}/{len(qs)}")
            for i, q in enumerate(qs):
                qid = q["question_id"]
                opts = {"A": q["option_a"], "B": q["option_b"],
                        "C": q["option_c"], "D": q["option_d"]}
                with st.expander(f"Q{i+1}. {q['question_text']}", expanded=(i == st.session_state.qz_q_idx)):
                    ch = st.radio("Answer", list(opts), format_func=lambda x: f"{x}. {opts[x]}",
                                  index=list(opts).index(ans.get(qid,"A")),
                                  key=f"qz_r_{qid}", label_visibility="collapsed")
                    if st.button("Confirm", key=f"qz_c_{qid}"):
                        try:
                            api_patch(f"/quiz-questions/{qid}/answer", {"user_answer": ch})
                            st.session_state.qz_answers[qid] = ch
                            if i+1 < len(qs): st.session_state.qz_q_idx = i+1
                            st.rerun()
                        except Exception as exc:
                            st.error(str(exc))
            if len(ans) == len(qs):
                if st.button("🏁 Submit & See Results", type="primary", key="qz_submit"):
                    try:
                        result = api_post(f"/quizzes/{st.session_state.qz_quiz_id}/submit", {})
                        dqs = []
                        for q in st.session_state.qz_questions:
                            try: dqs.append(api_get(f"/quiz-questions/{q['question_id']}"))
                            except Exception: dqs.append(q)
                        result["questions"] = dqs
                        st.session_state.update(qz_result=result, qz_submitted=True)
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))
            else:
                st.info(f"Answer all {len(qs)} questions to submit.")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 – AI READING (FR8)
# ══════════════════════════════════════════════════════════════════════════════
with tab_ai:
    st.header("🤖 AI Reading Test")
    if not is_logged_in():
        st.warning("Please log in first.")
    else:
        uid = current_user_id()
        for k, v in {"ai_reading": None, "ai_answers": {},
                      "ai_result": None, "ai_submitted": False}.items():
            st.session_state.setdefault(k, v)

        try:
            topics = fetch_topics()
            topic_names = [t["topic_name"] for t in topics]
        except Exception:
            topic_names = []

        # Config
        cfg1, cfg2, cfg3 = st.columns([2, 1, 1])
        with cfg1:
            if topic_names:
                chip = st.selectbox("Load vocabulary from topic",
                                    ["— type manually —"] + topic_names[:20], key="ai_chip")
        with cfg2:
            diff = st.selectbox("Difficulty", ["—","A1","A2","B1","B2","C1","C2"],
                                index=3, key="ai_diff")
        with cfg3:
            if topic_names and chip != "— type manually —":
                if st.button("📥 Load words", key="ai_load"):
                    tid = topic_map(topics).get(chip)
                    try:
                        ws = api_get("/words", topic_id=tid, limit=15)
                        st.session_state["ai_vocab_val"] = ", ".join(w["word"] for w in ws)
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))

        vocab = st.text_area("Vocabulary words (comma-separated)",
                             value=st.session_state.get("ai_vocab_val", ""),
                             placeholder="e.g. ubiquitous, sustainable, proliferate",
                             height=80, key="ai_vocab_ta")

        if st.button("✨ Generate Reading Test", type="primary", key="ai_gen"):
            if not vocab.strip():
                st.warning("Enter vocabulary words or load from a topic.")
            else:
                with st.spinner("AI is generating passage and 5 questions… (~10–20s)"):
                    try:
                        reading = api_post("/ai-readings", {
                            "user_id": uid,
                            "input_vocabulary": vocab.strip(),
                            "topic_param": None,
                            "difficulty_param": diff if diff != "—" else None,
                        })
                        st.session_state.update(ai_reading=reading, ai_answers={},
                                                ai_result=None, ai_submitted=False)
                        st.session_state["ai_vocab_val"] = vocab.strip()
                    except Exception as exc:
                        st.error(f"Generation failed: {exc}")

        reading = st.session_state.ai_reading
        if not reading:
            st.info("Configure and click **Generate Reading Test** to begin.")
        elif st.session_state.ai_submitted and st.session_state.ai_result:
            res = st.session_state.ai_result
            total_q = len(res.get("comprehension_questions", []))
            st.success(f"📊 **Score: {int(res['score'])}/{total_q}  ({res['accuracy']:.1f}%)**")
            if res.get("completion_seconds"):
                m, s = divmod(res["completion_seconds"], 60)
                st.caption(f"⏱️ Time taken: {m:02d}:{s:02d}")

            st.subheader("📄 Passage")
            st.write(res["generated_passage"])

            st.subheader("📋 Answer Review")
            for q in res.get("comprehension_questions", []):
                icon = "✅" if q["is_correct"] else "❌"
                om = {"A": q["option_a"], "B": q["option_b"],
                      "C": q["option_c"], "D": q["option_d"]}
                with st.expander(f"{icon} {q['question_text']}"):
                    for k, v in om.items():
                        is_correct_opt  = k == q["correct_option"]
                        is_user         = k == q.get("user_answer")
                        prefix = "✅ " if is_correct_opt else ("❌ " if is_user else "   ")
                        bold   = "**" if is_user or is_correct_opt else ""
                        st.markdown(f"{prefix}{bold}{k}. {v}{bold}")
                    if q.get("explanation"):
                        st.info(f"💡 {q['explanation']}")

            c1, c2 = st.columns(2)
            with c1:
                if st.button("🔄 Retake Same Test", key="ai_retake"):
                    try:
                        new_r = api_post(f"/ai-readings/{reading['reading_id']}/retake",
                                         {"user_id": uid})
                        st.session_state.update(ai_reading=new_r, ai_answers={},
                                                ai_result=None, ai_submitted=False)
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))
            with c2:
                if st.button("🆕 Generate New Test", key="ai_new"):
                    st.session_state.update(ai_reading=None, ai_submitted=False)
                    st.rerun()
        else:
            # Active test
            pass_col, q_col = st.columns([1, 1])
            with pass_col:
                st.subheader("📄 Reading Passage")
                level_badge = reading.get("difficulty_param", "")
                title_text  = reading.get("title") or f"Reading #{reading['reading_id']}"
                if level_badge:
                    st.caption(f"Level: **{level_badge}**")
                st.markdown(f"#### {title_text}")
                st.write(reading["generated_passage"])

            with q_col:
                st.subheader("❓ Comprehension Questions")
                qs = reading.get("comprehension_questions", [])
                if not qs:
                    st.info("No questions yet — the AI is still processing.")
                else:
                    for i, q in enumerate(qs):
                        qid = q["question_id"]
                        opts = {"A": q["option_a"], "B": q["option_b"],
                                "C": q["option_c"], "D": q["option_d"]}
                        st.write(f"**{i+1}. {q['question_text']}**")
                        ch = st.radio("", list(opts), key=f"ai_r_{qid}",
                                      format_func=lambda x: f"{x}. {opts[x]}",
                                      label_visibility="collapsed")
                        st.session_state.ai_answers[qid] = ch

                    st.divider()
                    answered = len(st.session_state.ai_answers)
                    st.caption(f"Answered {answered}/{len(qs)}")

                    if st.button("🏁 Submit Answers", type="primary", key="ai_submit"):
                        from time import time
                        import time as _time
                        elapsed = int(reading.get("time_limit_seconds", 600))  # demo: full time
                        try:
                            result = api_post(
                                f"/ai-readings/{reading['reading_id']}/submit",
                                {"answers": {str(k): v for k, v in st.session_state.ai_answers.items()},
                                 "completion_seconds": elapsed}
                            )
                            st.session_state.update(ai_result=result, ai_submitted=True)
                            st.rerun()
                        except Exception as exc:
                            st.error(f"Submit failed: {exc}")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 – HISTORY & STATS (FR4)
# ══════════════════════════════════════════════════════════════════════════════
with tab_hist:
    st.header("📊 Learning History & Statistics")
    if not is_logged_in():
        st.warning("Please log in first.")
    else:
        uid = current_user_id()

        # ── Statistics dashboard ──────────────────────────────────────────────
        try:
            stats = api_get(f"/users/{uid}/statistics")
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("🔥 Streak",      f"{stats['current_streak']} days")
            c2.metric("⭐ XP",           stats['total_xp'])
            c3.metric("📖 Words",        stats['total_words'])
            c4.metric("🃏 Flashcards",   stats['total_flashcards'])
            c5.metric("📝 Quizzes",      stats['total_quizzes'])
            st.caption(f"Study hours: {stats['study_hours']:.1f} h  |  "
                       f"Average quiz score: {stats['average_score']:.1f}%")
        except Exception as exc:
            st.warning(f"Could not load statistics: {exc}")

        st.divider()

        # ── Weekly activity chart ─────────────────────────────────────────────
        st.subheader("📅 Weekly Activity")
        try:
            weekly = api_get(f"/users/{uid}/weekly-activity")
            items  = weekly.get("items", [])
            if items:
                import pandas as pd
                df = pd.DataFrame(items).rename(columns={
                    "date": "Date", "activities": "Activities", "minutes": "Minutes"
                })
                df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%a %d")
                st.bar_chart(df.set_index("Date")[["Activities"]], height=200)
                with st.expander("Show details"):
                    st.dataframe(df, use_container_width=True)
            else:
                st.info("No activity this week yet.")
        except Exception as exc:
            st.warning(f"Could not load weekly activity: {exc}")

        st.divider()

        # ── Learning history list ─────────────────────────────────────────────
        st.subheader("📋 Activity Log")
        act_filter = st.selectbox("Filter by type",
                                  ["All", "Flashcard", "Quiz", "AI Reading"],
                                  key="hist_filter")
        page_size = 10
        if "hist_offset" not in st.session_state:
            st.session_state.hist_offset = 0

        col_prev, col_next, col_reload = st.columns([1, 1, 2])
        with col_reload:
            if st.button("🔄 Refresh", key="hist_reload"):
                st.session_state.hist_offset = 0

        try:
            params = {
                "limit":  page_size,
                "offset": st.session_state.hist_offset,
            }
            if act_filter != "All":
                params["activity_type"] = act_filter

            page = api_get(f"/users/{uid}/history/page", **params)
            items = page.get("items", [])
            total = page.get("total", 0)
            has_more = page.get("has_more", False)
            offset   = st.session_state.hist_offset

            st.caption(f"Showing {offset+1}–{min(offset+len(items), total)} of {total} records")

            if not items:
                st.info("No activity found. Complete a flashcard session, quiz, or reading test!")
            else:
                for item in items:
                    icon = {"Flashcard": "🃏", "Quiz": "📝", "AI Reading": "🤖"}.get(
                        item["activity_type"], "📌")
                    ts = (item.get("completed_at") or "")[:16].replace("T", " ")
                    score_txt = ""
                    if item.get("score") is not None:
                        score_txt = f"  |  Score: {int(item['score'])}"
                    if item.get("accuracy") is not None:
                        score_txt += f"  ({item['accuracy']:.0f}%)"
                    dur_txt = ""
                    if item.get("duration"):
                        dur_txt = f"  |  {item['duration']} min"
                    st.markdown(
                        f"{icon} **{item['activity_type']}** &nbsp; "
                        f"`#{item['activity_id']}`{score_txt}{dur_txt} &nbsp; "
                        f"<small style='color:gray'>{ts}</small>",
                        unsafe_allow_html=True,
                    )

            with col_prev:
                if st.button("◀ Prev", disabled=(offset == 0), key="hist_prev"):
                    st.session_state.hist_offset = max(0, offset - page_size)
                    st.rerun()
            with col_next:
                if st.button("Next ▶", disabled=(not has_more), key="hist_next"):
                    st.session_state.hist_offset = offset + page_size
                    st.rerun()

        except Exception as exc:
            st.error(f"Could not load history: {exc}")
