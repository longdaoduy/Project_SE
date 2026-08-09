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
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    **connect_kwargs,
    charset="utf8mb4",
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

print("\n=== Step 4: Verify ===")
cur.execute("DESCRIBE users")
cols = [row[0] for row in cur.fetchall()]
print(f"  users columns: {cols}")

needed = {"full_name", "password_hash", "avatar", "english_level", "daily_goal", "role"}
missing = needed - set(cols)
if missing:
    print(f"\n❌ Still missing: {missing}")
    sys.exit(1)
else:
    print("\n✅ Migration complete. All required columns present.")

cur.close()
conn.close()
