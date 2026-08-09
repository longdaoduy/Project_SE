-- ==========================================================================
-- SmartEng – Full Database Schema  v3.0
-- Tables (dependency order):
--   users, user_sessions, login_logs, profile_settings
--   user_statistics, learning_history
--   topics, words
--   flashcard_sessions, flashcard_progresses, starred_words
--   quizzes, quiz_questions
--   ai_readings, ai_reading_questions
-- Engine: InnoDB  |  Charset: utf8mb4
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS english_learning
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE english_learning;

-- --------------------------------------------------------------------------
-- FR1 – users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    avatar         VARCHAR(255) NULL,
    english_level  ENUM('A1','A2','B1','B2','C1','C2') NULL,
    daily_goal     INT          NOT NULL DEFAULT 20,
    role           ENUM('student','admin') NOT NULL DEFAULT 'student',
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR1 – user_sessions  (JWT multi-device tracking)
-- --------------------------------------------------------------------------
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
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR1 – login_logs  (immutable audit trail)
-- --------------------------------------------------------------------------
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
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR1 – profile_settings  (1-to-1 with users; auto-created on registration)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_settings (
    setting_id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id               INT          NOT NULL UNIQUE,
    language              VARCHAR(30)  NOT NULL DEFAULT 'English',
    dark_mode             TINYINT(1)   NOT NULL DEFAULT 0,
    notification_enabled  TINYINT(1)   NOT NULL DEFAULT 1,
    reminder_time         TIME         NULL,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ps_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR4 – user_statistics  (1-to-1; auto-created on registration)
-- --------------------------------------------------------------------------
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
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stat_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR4 – learning_history  (unified log: Flashcard | Quiz | AI Reading)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_history (
    history_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT   NOT NULL,
    activity_type  ENUM('Flashcard','Quiz','AI Reading') NOT NULL,
    activity_id    INT   NOT NULL,   -- FK to session_id / quiz_id / reading_id
    score          FLOAT NULL,
    accuracy       FLOAT NULL,
    duration       INT   NULL,       -- minutes
    completed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lh_user_id       (user_id),
    INDEX idx_lh_completed_at  (completed_at),
    CONSTRAINT fk_lh_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR6 – topics / words
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    topic_id    INT AUTO_INCREMENT PRIMARY KEY,
    topic_name  VARCHAR(150) NOT NULL UNIQUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_topics_name (topic_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS words (
    word_id         INT AUTO_INCREMENT PRIMARY KEY,
    topic_id        INT          NOT NULL,
    word            VARCHAR(120) NOT NULL,
    part_of_speech  VARCHAR(80)  NULL,
    phonetic        VARCHAR(120) NULL,
    meaning_vi      TEXT         NOT NULL,
    example_en      TEXT         NOT NULL,
    example_vi      TEXT         NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_words_topic_id (topic_id),
    INDEX idx_words_word     (word),
    CONSTRAINT fk_words_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR2 – flashcard_sessions / flashcard_progresses / starred_words
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcard_sessions (
    session_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT        NOT NULL,
    topic_id       INT        NULL,
    total_cards    INT        NOT NULL DEFAULT 0,
    cards_reviewed INT        NOT NULL DEFAULT 0,
    is_completed   TINYINT(1) NOT NULL DEFAULT 0,
    started_at     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at   TIMESTAMP  NULL,
    INDEX idx_fs_user_id  (user_id),
    INDEX idx_fs_topic_id (topic_id),
    CONSTRAINT fk_fs_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS flashcard_progresses (
    progress_id       INT AUTO_INCREMENT PRIMARY KEY,
    session_id        INT        NOT NULL,
    word_id           INT        NOT NULL,
    is_flipped        TINYINT(1) NOT NULL DEFAULT 0,
    difficulty_rating ENUM('again','hard','good','easy') NULL,
    reviewed_at       TIMESTAMP  NULL,
    INDEX idx_fp_session_id (session_id),
    INDEX idx_fp_word_id    (word_id),
    CONSTRAINT fk_fp_sessions FOREIGN KEY (session_id) REFERENCES flashcard_sessions (session_id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_words    FOREIGN KEY (word_id)    REFERENCES words (word_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS starred_words (
    starred_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT       NOT NULL,
    word_id    INT       NOT NULL,
    starred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_starred (user_id, word_id),
    CONSTRAINT fk_sw_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sw_words FOREIGN KEY (word_id) REFERENCES words (word_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR2 – user_card_srs  (per-user, per-word SRS state – persists across sessions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_card_srs (
    srs_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT        NOT NULL,
    word_id       INT        NOT NULL,
    topic_id      INT        NOT NULL,

    -- SM-2 algorithm fields
    ease_factor   FLOAT      NOT NULL DEFAULT 2.5,
    interval_days INT        NOT NULL DEFAULT 0,
    repetitions   INT        NOT NULL DEFAULT 0,

    -- Scheduling
    card_status   ENUM('new','learning','review') NOT NULL DEFAULT 'new',
    due_date      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed TIMESTAMP  NULL,

    created_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_srs_user_word (user_id, word_id),
    INDEX idx_srs_user_topic_due (user_id, topic_id, due_date),
    CONSTRAINT fk_srs_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_srs_words  FOREIGN KEY (word_id)  REFERENCES words  (word_id)  ON DELETE CASCADE,
    CONSTRAINT fk_srs_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR2 – daily_learning_log  (tracks new-word introductions per topic per day)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_learning_log (
    log_id      INT  AUTO_INCREMENT PRIMARY KEY,
    user_id     INT  NOT NULL,
    topic_id    INT  NOT NULL,
    word_id     INT  NOT NULL,
    learned_at  DATE NOT NULL,

    UNIQUE KEY uq_daily_word (user_id, topic_id, word_id, learned_at),
    INDEX idx_dll_user_topic_date (user_id, topic_id, learned_at),
    CONSTRAINT fk_dll_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR3 – quizzes / quiz_questions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT   NOT NULL,
    topic_id        INT   NULL,
    quiz_type       ENUM('multiple_choice','fill_blank','word_matching','speed_round')
                         NOT NULL DEFAULT 'multiple_choice',
    total_questions INT   NOT NULL DEFAULT 0,
    score           FLOAT NULL,
    accuracy        FLOAT NULL,
    is_completed    TINYINT(1) NOT NULL DEFAULT 0,
    started_at      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP  NULL,
    INDEX idx_quiz_user_id  (user_id),
    INDEX idx_quiz_topic_id (topic_id),
    CONSTRAINT fk_quiz_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_quiz_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quiz_questions (
    question_id    INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id        INT  NOT NULL,
    word_id        INT  NOT NULL,
    question_text  TEXT NOT NULL,
    option_a       TEXT NOT NULL,
    option_b       TEXT NOT NULL,
    option_c       TEXT NOT NULL,
    option_d       TEXT NOT NULL,
    correct_option ENUM('A','B','C','D') NOT NULL,
    user_answer    ENUM('A','B','C','D') NULL,
    is_correct     TINYINT(1) NULL,
    answered_at    TIMESTAMP  NULL,
    INDEX idx_qq_quiz_id (quiz_id),
    INDEX idx_qq_word_id (word_id),
    CONSTRAINT fk_qq_quizzes FOREIGN KEY (quiz_id) REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
    CONSTRAINT fk_qq_words   FOREIGN KEY (word_id) REFERENCES words   (word_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR8 – ai_readings / ai_reading_questions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_readings (
    reading_id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id              INT          NOT NULL,
    input_vocabulary     TEXT         NOT NULL,
    topic_param          VARCHAR(200) NULL,
    difficulty_param     VARCHAR(50)  NULL,
    generated_passage    TEXT         NOT NULL,
    title                VARCHAR(200) NULL,
    score                FLOAT        NULL,
    accuracy             FLOAT        NULL,
    is_completed         TINYINT(1)   NOT NULL DEFAULT 0,

    -- Timer
    time_limit_seconds   INT          NOT NULL DEFAULT 600,
    completion_seconds   INT          NULL,

    -- Retake linkage
    attempt_number       INT          NOT NULL DEFAULT 1,
    parent_reading_id    INT          NULL,

    generated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at         TIMESTAMP    NULL,
    INDEX idx_ar_user_id (user_id),
    INDEX idx_ar_parent  (parent_reading_id),
    CONSTRAINT fk_ar_users  FOREIGN KEY (user_id)          REFERENCES users      (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_ar_parent FOREIGN KEY (parent_reading_id) REFERENCES ai_readings (reading_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_reading_questions (
    question_id    INT AUTO_INCREMENT PRIMARY KEY,
    reading_id     INT  NOT NULL,
    question_text  TEXT NOT NULL,
    option_a       TEXT NOT NULL,
    option_b       TEXT NOT NULL,
    option_c       TEXT NOT NULL,
    option_d       TEXT NOT NULL,
    correct_option ENUM('A','B','C','D') NOT NULL,
    user_answer    ENUM('A','B','C','D') NULL,
    is_correct     TINYINT(1) NULL,
    explanation    TEXT       NULL,          -- generated once on first submission, reused on retakes
    INDEX idx_arq_reading_id (reading_id),
    CONSTRAINT fk_arq_readings FOREIGN KEY (reading_id) REFERENCES ai_readings (reading_id) ON DELETE CASCADE
) ENGINE=InnoDB;
