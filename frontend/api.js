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

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const get   = (path, params = {}) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return request('GET', qs ? `${path}?${qs}` : path);
};
const post  = (path, body)  => request('POST',  path, body);
const patch = (path, body)  => request('PATCH', path, body);

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

export const submitAIAnswer = (questionId, userAnswer) =>
  patch(`/ai-reading-questions/${questionId}/answer`, { user_answer: userAnswer });

export const submitAIReading = (readingId) =>
  post(`/ai-readings/${readingId}/submit`, {});

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
