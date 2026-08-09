"""
Migration: align the live `users` table on Aiven with the new ORM schema.
Uses INFORMATION_SCHEMA checks instead of ADD COLUMN IF NOT EXISTS
(compatible with MySQL 5.7+).

Database connection info is read from backend/.env (see backend/.env.example).
"""

import os
import ssl
import sys
from pathlib import Path

import pymysql
from dotenv import load_dotenv

# Load biến môi trường từ backend/.env
load_dotenv(Path(__file__).resolve().parent / ".env")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "defaultdb")
DB_SSL_CA = os.getenv("DB_SSL_CA", "ca.pem")

DB_USE_SSL = os.getenv("DB_USE_SSL", "1") == "1"

if DB_USE_SSL:
    SSL_CTX = ssl.create_default_context(cafile=DB_SSL_CA)
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE
    connect_kwargs = {"ssl": SSL_CTX}
else:
    connect_kwargs = {}

conn = pymysql.connect(
    host="",
    port=17652,
    user="",
    password="",
    database="",
    ssl=SSL_CTX,
    charset="",
)

cur = conn.cursor()


def col_exists(table: str, column: str) -> bool:
    cur.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
        (table, column),
    )
    return cur.fetchone()[0] > 0


def run(sql: str, label: str = "") -> bool:
    try:
        cur.execute(sql)
        conn.commit()
        print(f"  ✅  {label or sql[:80]}")
        return True
    except Exception as e:
        conn.rollback()
        print(f"  ⚠️  {label or sql[:80]}\n     → {e}")
        return False


def add_col(table: str, col: str, definition: str) -> None:
    label = f"ADD {table}.{col}"
    if col_exists(table, col):
        print(f"  --  {label} (already exists, skip)")
    else:
        run(f"ALTER TABLE `{table}` ADD COLUMN `{col}` {definition}", label)


print("\n=== Step 1: Migrate `users` table ===")

add_col("users", "full_name",     "VARCHAR(100) NOT NULL DEFAULT ''")
add_col("users", "password_hash", "VARCHAR(255) NOT NULL DEFAULT ''")
add_col("users", "avatar",        "VARCHAR(255) NULL")
add_col("users", "english_level", "ENUM('A1','A2','B1','B2','C1','C2') NULL")
add_col("users", "daily_goal",    "INT NOT NULL DEFAULT 20")
add_col("users", "role",          "ENUM('student','admin') NOT NULL DEFAULT 'student'")

# Populate new columns from old ones (safe even if already populated)
run("""
UPDATE users
SET full_name = COALESCE(
    NULLIF(TRIM(IFNULL(display_name,'')), ''),
    NULLIF(TRIM(IFNULL(username,'')), ''),
    'User'
)
WHERE full_name = ''
""", "Populate full_name")

run("""
UPDATE users
SET password_hash = hashed_password
WHERE password_hash = ''
""", "Populate password_hash")

run("""
UPDATE users
SET avatar = avatar_url
WHERE avatar IS NULL AND avatar_url IS NOT NULL
""", "Populate avatar")

run("""
UPDATE users
SET english_level = proficiency_level
WHERE english_level IS NULL AND proficiency_level IS NOT NULL
""", "Populate english_level")

run("""
UPDATE users
SET daily_goal = COALESCE(daily_goal_minutes, 20)
WHERE daily_goal = 20
""", "Populate daily_goal")

print("\n=== Step 2: Create new tables ===")

run("""
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT          NOT NULL,
    jwt_token    VARCHAR(500) NOT NULL,
    device_name  VARCHAR(150) NULL,
    ip_address   VARCHAR(50)  NULL,
    login_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time  TIMESTAMP    NULL,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    INDEX idx_us_user_id (user_id),
    INDEX idx_us_token   (jwt_token(64)),
    CONSTRAINT fk_us_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create user_sessions")

run("""
CREATE TABLE IF NOT EXISTS login_logs (
    log_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    login_time    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time   TIMESTAMP    NULL,
    login_status  ENUM('Success','Failed') NOT NULL,
    ip_address    VARCHAR(50)  NULL,
    device_name   VARCHAR(150) NULL,
    INDEX idx_ll_user_id (user_id),
    CONSTRAINT fk_ll_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create login_logs")

run("""
CREATE TABLE IF NOT EXISTS profile_settings (
    setting_id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id               INT          NOT NULL UNIQUE,
    language              VARCHAR(30)  NOT NULL DEFAULT 'English',
    dark_mode             TINYINT(1)   NOT NULL DEFAULT 0,
    notification_enabled  TINYINT(1)   NOT NULL DEFAULT 1,
    reminder_time         TIME         NULL,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ps_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create profile_settings")

run("""
CREATE TABLE IF NOT EXISTS user_statistics (
    statistic_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT   NOT NULL UNIQUE,
    total_words      INT   NOT NULL DEFAULT 0,
    total_flashcards INT   NOT NULL DEFAULT 0,
    total_quizzes    INT   NOT NULL DEFAULT 0,
    average_score    FLOAT NOT NULL DEFAULT 0,
    study_hours      FLOAT NOT NULL DEFAULT 0,
    current_streak   INT   NOT NULL DEFAULT 0,
    total_xp         INT   NOT NULL DEFAULT 0,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stat_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create user_statistics")

run("""
CREATE TABLE IF NOT EXISTS learning_history (
    history_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT   NOT NULL,
    activity_type  ENUM('Flashcard','Quiz','AI Reading') NOT NULL,
    activity_id    INT   NOT NULL,
    score          FLOAT NULL,
    accuracy       FLOAT NULL,
    duration       INT   NULL,
    completed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lh_user_id      (user_id),
    INDEX idx_lh_completed_at (completed_at),
    CONSTRAINT fk_lh_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create learning_history")

print("\n=== Step 3: Back-fill profile_settings + user_statistics ===")

run("""
INSERT IGNORE INTO profile_settings (user_id)
SELECT user_id FROM users
""", "Back-fill profile_settings")

run("""
INSERT IGNORE INTO user_statistics (user_id)
SELECT user_id FROM users
""", "Back-fill user_statistics")

# ---------------------------------------------------------------------------
print("\n=== Step 4: Migrate ai_readings – add timer & retake columns ===")
# These columns were added to the ORM model but the live table predates them.
# All are backward-compatible: existing rows get sensible defaults.
# ---------------------------------------------------------------------------

add_col("ai_readings", "title",
        "VARCHAR(200) NULL COMMENT 'AI-generated descriptive title'")

add_col("ai_readings", "time_limit_seconds",
        "INT NOT NULL DEFAULT 600 COMMENT 'Fixed countdown per difficulty (seconds)'")

add_col("ai_readings", "completion_seconds",
        "INT NULL COMMENT 'Actual seconds taken by the user (<=time_limit_seconds)'")

add_col("ai_readings", "attempt_number",
        "INT NOT NULL DEFAULT 1 COMMENT '1=first attempt, 2+=retake'")

add_col("ai_readings", "parent_reading_id",
        "INT NULL COMMENT 'Points to the canonical reading for retakes'")

# Add FK for parent_reading_id only if not already present
cur.execute("""
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'ai_readings'
      AND CONSTRAINT_NAME = 'fk_ar_parent'
""")
if cur.fetchone()[0] == 0:
    run("""
        ALTER TABLE ai_readings
        ADD CONSTRAINT fk_ar_parent
            FOREIGN KEY (parent_reading_id)
            REFERENCES ai_readings (reading_id)
            ON DELETE SET NULL
    """, "ADD FK ai_readings.fk_ar_parent")
else:
    print("  --  FK fk_ar_parent already exists, skip")

# Add index on parent_reading_id if missing
cur.execute("""
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'ai_readings'
      AND INDEX_NAME   = 'idx_ar_parent'
""")
if cur.fetchone()[0] == 0:
    run("ALTER TABLE ai_readings ADD INDEX idx_ar_parent (parent_reading_id)",
        "ADD INDEX ai_readings.idx_ar_parent")
else:
    print("  --  INDEX idx_ar_parent already exists, skip")

# ---------------------------------------------------------------------------
print("\n=== Step 5: Migrate ai_reading_questions – add explanation column ===")
# ---------------------------------------------------------------------------

add_col("ai_reading_questions", "explanation",
        "TEXT NULL COMMENT 'AI-generated answer explanation, stored once and reused on retakes'")

# ---------------------------------------------------------------------------
print("\n=== Step 6: Migrate SRS tables (user_card_srs + daily_learning_log) ===")
# ---------------------------------------------------------------------------

run("""
CREATE TABLE IF NOT EXISTS user_card_srs (
    srs_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT        NOT NULL,
    word_id       INT        NOT NULL,
    topic_id      INT        NOT NULL,
    ease_factor   FLOAT      NOT NULL DEFAULT 2.5,
    interval_days INT        NOT NULL DEFAULT 0,
    repetitions   INT        NOT NULL DEFAULT 0,
    card_status   ENUM('new','learning','review') NOT NULL DEFAULT 'new',
    due_date      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed TIMESTAMP  NULL,
    created_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_srs_user_word (user_id, word_id),
    INDEX idx_srs_user_topic_due (user_id, topic_id, due_date),
    CONSTRAINT fk_srs_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_srs_words  FOREIGN KEY (word_id)  REFERENCES words  (word_id)  ON DELETE CASCADE,
    CONSTRAINT fk_srs_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create user_card_srs")

run("""
CREATE TABLE IF NOT EXISTS daily_learning_log (
    log_id     INT  AUTO_INCREMENT PRIMARY KEY,
    user_id    INT  NOT NULL,
    topic_id   INT  NOT NULL,
    word_id    INT  NOT NULL,
    learned_at DATE NOT NULL,
    UNIQUE KEY uq_daily_word (user_id, topic_id, word_id, learned_at),
    INDEX idx_dll_user_topic_date (user_id, topic_id, learned_at),
    CONSTRAINT fk_dll_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
""", "Create daily_learning_log")

# ---------------------------------------------------------------------------
print("\n=== Step 7: Verify ===")
# ---------------------------------------------------------------------------

cur.execute("DESCRIBE users")
cols = [row[0] for row in cur.fetchall()]
print(f"  users columns: {cols}")

needed_users = {"full_name", "password_hash", "avatar", "english_level", "daily_goal", "role"}
missing_users = needed_users - set(cols)
if missing_users:
    print(f"\n❌ users – still missing: {missing_users}")
    sys.exit(1)

cur.execute("DESCRIBE ai_readings")
ai_cols = [row[0] for row in cur.fetchall()]
needed_ai = {"time_limit_seconds", "completion_seconds", "attempt_number", "parent_reading_id", "title"}
missing_ai = needed_ai - set(ai_cols)
if missing_ai:
    print(f"\n❌ ai_readings – still missing: {missing_ai}")
    # Attempt to add any still-missing columns rather than hard-failing
    col_defs = {
        "title":               "VARCHAR(200) NULL",
        "time_limit_seconds":  "INT NOT NULL DEFAULT 600",
        "completion_seconds":  "INT NULL",
        "attempt_number":      "INT NOT NULL DEFAULT 1",
        "parent_reading_id":   "INT NULL",
    }
    for col in missing_ai:
        add_col("ai_readings", col, col_defs.get(col, "TEXT NULL"))
    print("  ↑ Attempted emergency add. Re-run migration to confirm.")
else:
    print("  ✅  ai_readings columns OK")

cur.execute("DESCRIBE ai_reading_questions")
aq_cols = [row[0] for row in cur.fetchall()]
if "explanation" not in aq_cols:
    print("\n❌ ai_reading_questions – still missing: explanation")
    sys.exit(1)

print("\n✅ Migration complete. All required columns and tables present.")

cur.close()
conn.close()
