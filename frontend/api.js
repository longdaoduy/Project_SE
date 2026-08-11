/**
 * SmartEng API client
 * All calls go through this file so the base URL is changed in one place.
 *
 * Platform notes:
 *  - Expo Web (browser): backend must be on same machine → http://localhost:8000
 *  - Android emulator:   loopback maps to 10.0.2.2 → http://10.0.2.2:8000
 *  - iOS simulator:      loopback works → http://localhost:8000
 *  - Physical device:    replace with your LAN IP, e.g. http://192.168.1.x:8000
 */
import { Platform } from 'react-native';

// Auto-select base URL by platform
function getApiBase() {
  if (Platform.OS === 'android') {
    // Android emulator loopback
    return 'http://10.0.2.2:8000';
  }
  // Web browser, iOS simulator, or web preview → localhost
  return 'http://localhost:8000';
}

export const API_BASE = getApiBase();

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const get   = (path, params = {}, token = null) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return request('GET', qs ? `${path}?${qs}` : path, null, token);
};
const post  = (path, body, token = null)  => request('POST',  path, body, token);
const patch = (path, body, token = null)  => request('PATCH', path, body, token);
const del   = (path, body = null, token = null) => request('DELETE', path, body, token);

// ─── Vocabulary / Topics ──────────────────────────────────────────────────────

export const getTopics = (limit = 100) =>
  get('/topics', { limit });

export const getWords = (topicId, limit = 50) =>
  get('/words', { topic_id: topicId, limit });

export const getRandomWords = (topicId = null, limit = 10) =>
  get('/flashcards/random', { topic_id: topicId, limit });

// ─── Flashcards ───────────────────────────────────────────────────────────────

export const createFlashcardSession = (userId, topicId, totalCards) =>
  post('/flashcard-sessions', { user_id: userId, topic_id: topicId ?? null, total_cards: totalCards });

export const completeFlashcardSession = (sessionId) =>
  post(`/flashcard-sessions/${sessionId}/complete`, {});

export const createFlashcardProgress = (sessionId, wordId) =>
  post('/flashcard-progress', { session_id: sessionId, word_id: wordId });

export const updateFlashcardProgress = (progressId, payload) =>
  patch(`/flashcard-progress/${progressId}`, payload);

// ─── SRS (Spaced Repetition System) ──────────────────────────────────────────

/**
 * Fetch the study queue for a topic:
 * { review_cards, new_cards, daily_learned, daily_limit, daily_remaining }
 * review_cards come first (already due), then new_cards (introduced today).
 */
export const getFlashcardQueue = (userId, topicId) =>
  get('/flashcards/queue', { user_id: userId, topic_id: topicId });

/**
 * Submit a difficulty rating for one card.
 * rating: 'again' | 'hard' | 'good' | 'easy'
 * Returns updated SRS state: { srs_id, ease_factor, interval_days, due_date, … }
 */
export const submitSRSRating = (userId, wordId, topicId, rating) =>
  post('/flashcards/srs-rating', { user_id: userId, word_id: wordId, topic_id: topicId, rating });

/**
 * Get today's learning status for a topic (used on the deck-select screen).
 * Returns: { daily_learned, daily_limit, daily_remaining, due_review_count }
 */
export const getDailyStatus = (userId, topicId) =>
  get('/flashcards/daily-status', { user_id: userId, topic_id: topicId });

// ─── Users / Stats ────────────────────────────────────────────────────────────

export const getUserStats = (userId) =>
  get(`/users/${userId}/statistics`);

// ─── Quiz ─────────────────────────────────────────────────────────────────────

/**
 * Create a quiz record and add all questions in one shot.
 * @param {number} userId
 * @param {number|null} topicId
 * @param {string} quizType  one of: multiple_choice | fill_blank | word_matching | speed_round
 * @param {Array} questionsPayload  array of {word_id, question_text, option_a-d, correct_option}
 * @returns {quiz, questions}  the created quiz and its backend question records
 */
export async function createQuizWithQuestions(userId, topicId, quizType, questionsPayload) {
  // 1. create quiz header
  const quiz = await post('/quizzes', {
    user_id: userId,
    topic_id: topicId ?? null,
    quiz_type: quizType,
    total_questions: questionsPayload.length,
  });

  // 2. add questions sequentially (small number, so serial is fine)
  const questions = [];
  for (const q of questionsPayload) {
    const bq = await post(`/quizzes/${quiz.quiz_id}/questions`, {
      quiz_id: quiz.quiz_id,
      ...q,
    });
    questions.push(bq);
  }
  return { quiz, questions };
}

/**
 * Submit a single answer for a question.
 */
export const submitAnswer = (questionId, userAnswer) =>
  patch(`/quiz-questions/${questionId}/answer`, { user_answer: userAnswer });

/**
 * Finalise a quiz and get the scored result.
 */
export const submitQuiz = (quizId) =>
  post(`/quizzes/${quizId}/submit`, {});

/**
 * Fetch updated question list (with is_correct populated) after submission.
 */
export const getQuizQuestion = (questionId) =>
  get(`/quiz-questions/${questionId}`);

// ─── Build multiple-choice questions from a word list ────────────────────────

/**
 * Pure helper – builds MC question objects from backend Word records.
 * Returns array suitable for passing to createQuizWithQuestions().
 */
export function buildMCQuestions(words, count) {
  if (words.length < 4) return [];

  // deduplicate by meaning_vi to avoid identical options
  const seen = new Set();
  const unique = words.filter((w) => {
    const key = w.meaning_vi.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < 4) return [];

  const shuffled = [...unique].sort(() => Math.random() - 0.5);
  const chosen   = shuffled.slice(0, Math.min(count, shuffled.length));

  return chosen.map((w) => {
    const correct = w.meaning_vi.trim();
    const pool    = unique
      .filter((x) => x.word_id !== w.word_id)
      .map((x) => x.meaning_vi.trim());
    const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [...distractors, correct].sort(() => Math.random() - 0.5);
    const letter  = ['A', 'B', 'C', 'D'][options.indexOf(correct)];
    return {
      word_id:        w.word_id,
      question_text:  `Which definition best matches "${w.word}"?`,
      option_a:       options[0],
      option_b:       options[1],
      option_c:       options[2],
      option_d:       options[3],
      correct_option: letter,
      // local helpers used by screen UI (not sent to backend)
      _word:          w,
    };
  });
}

/**
 * Build word-matching pairs from a word list.
 * Returns array of {word_id, word, definition} shuffled pairs.
 */
export function buildMatchingPairs(words, count = 6) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((w) => ({
    word_id:    w.word_id,
    word:       w.word,
    definition: w.meaning_vi,
  }));
}

/**
 * Build fill-in-the-blank questions from a word list.
 * Returns array of {word_id, sentence, answer} objects.
 */
export function buildFillQuestions(words, count) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((w) => ({
    word_id:  w.word_id,
    sentence: w.example_en.replace(new RegExp(`\\b${w.word}\\b`, 'i'), '______'),
    answer:   w.word,
    hint:     w.phonetic || '',
    _word:    w,
  }));
}

// ─── AI Reading ───────────────────────────────────────────────────────────────

/**
 * Generate a new AI reading test.
 * topic_param is optional – pass null and the AI picks context freely.
 * difficulty_param: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2' (also drives time_limit_seconds).
 */
export const generateAIReading = (userId, vocabulary, topicParam = null, difficultyParam = null) =>
  post('/ai-readings', {
    user_id:          userId,
    input_vocabulary: vocabulary,
    topic_param:      topicParam  || null,
    difficulty_param: difficultyParam || null,
  });

export const getAIReading = (readingId) =>
  get(`/ai-readings/${readingId}`);

export const getUserAIReadings = (userId, limit = 20) =>
  get(`/users/${userId}/ai-readings`, { limit });

/**
 * Submit all answers at once with elapsed time.
 * answers: { [question_id]: 'A'|'B'|'C'|'D' }
 * completionSeconds: how many seconds elapsed (capped server-side at time_limit)
 * This is called both on manual submit and on timer expiry.
 */
export const submitAIReading = (readingId, answers, completionSeconds = 0) =>
  post(`/ai-readings/${readingId}/submit`, {
    answers: answers,
    completion_seconds: completionSeconds,
  });

/**
 * Retake an existing test – same passage and questions, reset answers and timer.
 * Returns a new AIReading object (different reading_id, same content).
 */
export const retakeAIReading = (readingId, userId) =>
  post(`/ai-readings/${readingId}/retake`, { user_id: userId });

// Legacy per-question answer (kept for backward compat but no longer used by AIReadingScreen)
export const submitAIAnswer = (questionId, userAnswer) =>
  patch(`/ai-reading-questions/${questionId}/answer`, { user_answer: userAnswer });

// ─── Words (add to topic) ─────────────────────────────────────────────────────

export const addWord = (payload) =>
  post('/words', payload);
// payload: { topic_id, word, part_of_speech, phonetic, meaning_vi, example_en, example_vi }
/**
 * For fill/match/speed we build a dummy "correct_option=A" question per word
 * and mark it correct/incorrect based on local scoring.
 *
 * @param {number} userId
 * @param {number|null} topicId
 * @param {string} quizType
 * @param {Array} results   [{word_id, is_correct}]
 */
export async function saveLocalQuizResult(userId, topicId, quizType, results) {
  if (!results.length) return null;
  try {
    const questionsPayload = results.map((r) => ({
      word_id:        r.word_id,
      question_text:  `${quizType} question`,
      option_a:       'Correct',
      option_b:       'Wrong',
      option_c:       'Wrong2',
      option_d:       'Wrong3',
      correct_option: 'A',
    }));

    const { quiz, questions } = await createQuizWithQuestions(
      userId, topicId, quizType, questionsPayload
    );

    // submit answers based on local result
    for (let i = 0; i < questions.length; i++) {
      const answer = results[i].is_correct ? 'A' : 'B';
      await submitAnswer(questions[i].question_id, answer);
    }

    await submitQuiz(quiz.quiz_id);
    return quiz;
  } catch (e) {
    console.warn('saveLocalQuizResult error (non-critical):', e.message);
    return null;
  }
}

// ─── User Management ────────────────────────────────────────────────────────

export const registerUser = (payload) =>
  post('/users', payload);

export const loginUser = (payload) =>
  post('/users/login', payload);

export const getMe = (token) =>
  get('/me', {}, token);

export const updateMe = (token, payload) =>
  patch('/me', payload, token);

export const logoutMe = (token) =>
  post('/me/logout', null, token);

export const logoutUserBySessionId = (sessionId) =>
  post(`/users/logout?session_id=${encodeURIComponent(sessionId)}`, null);

export const getMyStatistics = (token) =>
  get('/me/statistics', {}, token);

export const getMyWeeklyActivity = (token) =>
  get('/me/weekly-activity', {}, token);

export const getMyHistory = (token, params = {}) =>
  get('/me/history', params, token);

export const changeMyPassword = (token, payload) =>
  post('/me/change-password', payload, token);

export const deleteMe = (token, payload) =>
  del('/me', payload, token);

export const getProfileSettings = (userId) =>
  get(`/users/${userId}/profile-settings`);

export const updateProfileSettings = (userId, payload) =>
  patch(`/users/${userId}/profile-settings`, payload);

// Backward-compatible aliases for screens already importing these names.
export const logoutUser = logoutMe;
export const changePassword = changeMyPassword;
export const deleteAccount = deleteMe;