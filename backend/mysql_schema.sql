-- ==========================================================================
-- SmartEng – Full Database Schema
-- Covers FR1 (User), FR2 (Flashcard), FR3 (Quiz), FR6 (Vocabulary), FR8 (AI Reading)
-- Engine: InnoDB  |  Charset: utf8mb4
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS english_learning
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE english_learning;

-- --------------------------------------------------------------------------
-- FR1 – User Management
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id             INT AUTO_INCREMENT PRIMARY KEY,
    username            VARCHAR(80)  NOT NULL UNIQUE,
    email               VARCHAR(180) NOT NULL UNIQUE,
    hashed_password     VARCHAR(255) NOT NULL,
    display_name        VARCHAR(120) NULL,
    avatar_url          VARCHAR(500) NULL,
    proficiency_level   ENUM('A1','A2','B1','B2','C1','C2') NULL,
    daily_goal_minutes  INT          NOT NULL DEFAULT 10,
    is_active           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email    (email),
    INDEX idx_users_username (username)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR6 – Vocabulary Database
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
    CONSTRAINT fk_words_topics
        FOREIGN KEY (topic_id) REFERENCES topics (topic_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR2 – Flashcard Learning
-- --------------------------------------------------------------------------

-- One study session (user picks a deck, reviews cards one by one)
CREATE TABLE IF NOT EXISTS flashcard_sessions (
    session_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    topic_id        INT          NULL,
    total_cards     INT          NOT NULL DEFAULT 0,
    cards_reviewed  INT          NOT NULL DEFAULT 0,
    is_completed    TINYINT(1)   NOT NULL DEFAULT 0,
    started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP    NULL,
    INDEX idx_fs_user_id  (user_id),
    INDEX idx_fs_topic_id (topic_id),
    CONSTRAINT fk_fs_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Per-card state within a session: flip tracking + SRS difficulty rating
CREATE TABLE IF NOT EXISTS flashcard_progresses (
    progress_id        INT AUTO_INCREMENT PRIMARY KEY,
    session_id         INT          NOT NULL,
    word_id            INT          NOT NULL,
    is_flipped         TINYINT(1)   NOT NULL DEFAULT 0,
    difficulty_rating  ENUM('again','hard','good','easy') NULL,
    reviewed_at        TIMESTAMP    NULL,
    INDEX idx_fp_session_id (session_id),
    INDEX idx_fp_word_id    (word_id),
    CONSTRAINT fk_fp_sessions FOREIGN KEY (session_id) REFERENCES flashcard_sessions (session_id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_words    FOREIGN KEY (word_id)    REFERENCES words              (word_id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- FR16 – Starred / bookmarked words
CREATE TABLE IF NOT EXISTS starred_words (
    starred_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT       NOT NULL,
    word_id     INT       NOT NULL,
    starred_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_starred (user_id, word_id),          -- one star per word per user
    INDEX idx_sw_user_id (user_id),
    INDEX idx_sw_word_id (word_id),
    CONSTRAINT fk_sw_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sw_words FOREIGN KEY (word_id) REFERENCES words (word_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR3 – Quiz / Test
-- --------------------------------------------------------------------------

-- Quiz instance: configured and started by a user
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT   NOT NULL,
    topic_id         INT   NULL,
    quiz_type        ENUM('multiple_choice','fill_blank','word_matching','speed_round')
                          NOT NULL DEFAULT 'multiple_choice',
    total_questions  INT   NOT NULL DEFAULT 0,
    score            FLOAT NULL,        -- number of correct answers
    accuracy         FLOAT NULL,        -- percentage 0-100
    is_completed     TINYINT(1) NOT NULL DEFAULT 0,
    started_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at     TIMESTAMP  NULL,
    INDEX idx_quiz_user_id  (user_id),
    INDEX idx_quiz_topic_id (topic_id),
    CONSTRAINT fk_quiz_users  FOREIGN KEY (user_id)  REFERENCES users  (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_quiz_topics FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Individual question inside a quiz (multiple-choice, 4 options)
CREATE TABLE IF NOT EXISTS quiz_questions (
    question_id     INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id         INT  NOT NULL,
    word_id         INT  NOT NULL,
    question_text   TEXT NOT NULL,
    option_a        TEXT NOT NULL,
    option_b        TEXT NOT NULL,
    option_c        TEXT NOT NULL,
    option_d        TEXT NOT NULL,
    correct_option  ENUM('A','B','C','D') NOT NULL,
    user_answer     ENUM('A','B','C','D') NULL,
    is_correct      TINYINT(1) NULL,
    answered_at     TIMESTAMP  NULL,
    INDEX idx_qq_quiz_id (quiz_id),
    INDEX idx_qq_word_id (word_id),
    CONSTRAINT fk_qq_quizzes FOREIGN KEY (quiz_id) REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
    CONSTRAINT fk_qq_words   FOREIGN KEY (word_id) REFERENCES words   (word_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- FR8 – AI Reading Generation
-- --------------------------------------------------------------------------

-- Stores each AI-generated reading passage and its lifecycle
CREATE TABLE IF NOT EXISTS ai_readings (
    reading_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT  NOT NULL,
    input_vocabulary    TEXT NOT NULL,           -- raw vocab input from user
    topic_param         VARCHAR(200) NULL,        -- e.g. 'IELTS Academic'
    difficulty_param    VARCHAR(50)  NULL,        -- e.g. 'B2', '500 words'
    generated_passage   TEXT NOT NULL,
    score               FLOAT      NULL,
    accuracy            FLOAT      NULL,
    is_completed        TINYINT(1) NOT NULL DEFAULT 0,
    generated_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP  NULL,
    INDEX idx_ar_user_id (user_id),
    CONSTRAINT fk_ar_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Comprehension questions generated alongside the AI passage
CREATE TABLE IF NOT EXISTS ai_reading_questions (
    question_id     INT AUTO_INCREMENT PRIMARY KEY,
    reading_id      INT  NOT NULL,
    question_text   TEXT NOT NULL,
    option_a        TEXT NOT NULL,
    option_b        TEXT NOT NULL,
    option_c        TEXT NOT NULL,
    option_d        TEXT NOT NULL,
    correct_option  ENUM('A','B','C','D') NOT NULL,
    user_answer     ENUM('A','B','C','D') NULL,
    is_correct      TINYINT(1) NULL,
    INDEX idx_arq_reading_id (reading_id),
    CONSTRAINT fk_arq_readings FOREIGN KEY (reading_id) REFERENCES ai_readings (reading_id) ON DELETE CASCADE
) ENGINE=InnoDB;
