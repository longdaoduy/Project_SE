import streamlit as st
import requests

API_URL = "http://127.0.0.1:8000"

st.set_page_config(
    page_title="SmartEng Backend Test",
    page_icon="📘",
    layout="wide"
)

# =========================
# SESSION STATE
# =========================
if "token" not in st.session_state:
    st.session_state.token = None

if "user" not in st.session_state:
    st.session_state.user = None


def auth_headers():
    if not st.session_state.token:
        return {}

    return {
        "Authorization": f"Bearer {st.session_state.token}"
    }


def show_response(response):
    st.write("Status code:", response.status_code)

    try:
        data = response.json()
        st.json(data)
        return data
    except Exception:
        st.text(response.text)
        return None


# =========================
# SIDEBAR
# =========================
st.sidebar.title("SmartEng Test")

page = st.sidebar.radio(
    "Choose function",
    [
        "Register",
        "Login",
        "Profile",
        "Learning History",
        "Statistics",
        "Weekly Activity",
        "Change Password",
        "Logout"
    ]
)

if st.session_state.token:
    st.sidebar.success("Authenticated")
else:
    st.sidebar.warning("Not logged in")


# =========================
# REGISTER
# =========================
if page == "Register":
    st.title("Register User")

    full_name = st.text_input("Full name")
    email = st.text_input("Email")
    password = st.text_input(
        "Password",
        type="password"
    )

    avatar = st.text_input(
        "Avatar",
        value=""
    )

    english_level = st.selectbox(
        "English Level",
        ["A1", "A2", "B1", "B2", "C1", "C2"]
    )

    daily_goal = st.number_input(
        "Daily Goal",
        min_value=1,
        value=20
    )

    if st.button("Register"):
        payload = {
            "full_name": full_name,
            "email": email,
            "password": password,
            "avatar": avatar,
            "english_level": english_level,
            "daily_goal": daily_goal,
            "role": "student"
        }

        try:
            response = requests.post(
                f"{API_URL}/users",
                json=payload
            )

            if response.status_code == 200:
                st.success("Register successful")

            show_response(response)

        except requests.exceptions.ConnectionError:
            st.error(
                "Cannot connect to FastAPI. "
                "Make sure backend is running on port 8000."
            )


# =========================
# LOGIN
# =========================
elif page == "Login":
    st.title("Login")

    email = st.text_input("Email")
    password = st.text_input(
        "Password",
        type="password"
    )

    if st.button("Login"):
        payload = {
            "email": email,
            "password": password
        }

        try:
            response = requests.post(
                f"{API_URL}/users/login",
                json=payload
            )

            data = show_response(response)

            if response.status_code == 200 and data:

                # Backend của bạn trả jwt_token
                token = data.get("jwt_token")

                if token:
                    st.session_state.token = token
                    st.session_state.user = data.get("user")

                    st.success("Login successful. JWT saved.")

                    st.rerun()
                else:
                    st.error("Login thành công nhưng không tìm thấy jwt_token.")

        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to backend.")

# =========================
# PROFILE
# =========================
elif page == "Profile":
    st.title("My Profile")

    if not st.session_state.token:
        st.warning("Please login first.")

    else:
        if st.session_state.user:
            st.subheader("Current User")

            user = st.session_state.user

            st.write("User ID:", user.get("user_id"))
            st.write("Full name:", user.get("full_name"))
            st.write("Email:", user.get("email"))
            st.write("English level:", user.get("english_level"))
            st.write("Daily goal:", user.get("daily_goal"))
            st.write("Role:", user.get("role"))

        if st.button("Reload Profile"):
            response = requests.get(
                f"{API_URL}/me",
                headers=auth_headers()
            )

            data = show_response(response)

            if response.status_code == 200:
                st.session_state.user = data
                st.rerun()


# =========================
# LEARNING HISTORY
# =========================
elif page == "Learning History":
    st.title("Learning History")

    if not st.session_state.token:
        st.warning("Please login first.")

    else:

        if st.button("Load Learning History"):

            response = requests.get(
                f"{API_URL}/me/history",
                headers=auth_headers()
            )

            data = show_response(response)

            if response.status_code == 200:

                if isinstance(data, list):

                    if len(data) == 0:
                        st.info(
                            "No learning history yet."
                        )

                    else:
                        st.dataframe(
                            data,
                            use_container_width=True
                        )


# =========================
# STATISTICS
# =========================
elif page == "Statistics":
    st.title("Learning Statistics")

    if not st.session_state.token:
        st.warning("Please login first.")

    else:

        if st.button("Load Statistics"):

            response = requests.get(
                f"{API_URL}/me/statistics",
                headers=auth_headers()
            )

            data = show_response(response)

            if response.status_code == 200 and data:

                col1, col2, col3 = st.columns(3)

                with col1:
                    st.metric(
                        "Total Words",
                        data.get("total_words", 0)
                    )

                with col2:
                    st.metric(
                        "Total Quizzes",
                        data.get("total_quizzes", 0)
                    )

                with col3:
                    st.metric(
                        "Current Streak",
                        data.get("current_streak", 0)
                    )


# =========================
# WEEKLY ACTIVITY
# =========================
elif page == "Weekly Activity":
    st.title("Weekly Activity")

    if not st.session_state.token:
        st.warning("Please login first.")

    else:

        if st.button("Load Weekly Activity"):

            response = requests.get(
                f"{API_URL}/me/weekly-activity",
                headers=auth_headers()
            )

            data = show_response(response)

            if response.status_code == 200:

                if isinstance(data, list) and data:
                    st.dataframe(
                        data,
                        use_container_width=True
                    )


# =========================
# CHANGE PASSWORD
# =========================
elif page == "Change Password":
    st.title("Change Password")

    if not st.session_state.token:
        st.warning("Please login first.")

    else:

        current_password = st.text_input(
            "Current password",
            type="password"
        )

        new_password = st.text_input(
            "New password",
            type="password"
        )

        if st.button("Change Password"):

            payload = {
                "current_password": current_password,
                "new_password": new_password
            }

            response = requests.post(
                f"{API_URL}/me/change-password",
                headers=auth_headers(),
                json=payload
            )

            if response.status_code == 200:
                st.success(
                    "Password changed successfully."
                )

            show_response(response)


# =========================
# LOGOUT
# =========================
elif page == "Logout":
    st.title("Logout")

    if not st.session_state.token:
        st.info("You are not logged in.")

    else:

        if st.button("Logout Now"):

            response = requests.post(
                f"{API_URL}/me/logout",
                headers=auth_headers()
            )

            show_response(response)

            if response.status_code == 200:

                st.session_state.token = None
                st.session_state.user = None

                st.success("Logged out.")

                st.rerun()