import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, StatusBar, Platform,
  TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getWords, buildMCQuestions,
  createQuizWithQuestions, submitAnswer, submitQuiz, getQuizQuestion,
} from '../api';

export default function QuizMultipleChoice({ navigation, route }) {
  const { topicId, topicTitle, quizType = 'multiple_choice', userId = 1, limit = 10 } = route.params || {};
  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('loading'); // loading|quiz|result|error
  const [questions, setQuestions] = useState([]);   // backend question objects + _word
  const [backendQs, setBackendQs] = useState([]);   // backend question records
  const [quizId, setQuizId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null); // 'A'|'B'|'C'|'D'
  const [answeredMap, setAnsweredMap] = useState({});   // questionId → letter
  const [resultData, setResultData] = useState(null); // final scored questions
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');

  // ── Load questions from backend ───────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    try {
      setPhase('loading');
      const words = await getWords(topicId, 100);
      if (words.length < 4) throw new Error('This topic needs at least 4 words to start a quiz.');

      const actualLimit = Math.min(limit, words.length);

      const built = buildMCQuestions(words, actualLimit);
      if (!built.length) throw new Error('Could not build questions from this topic.');

      const { quiz, questions: bqs } = await createQuizWithQuestions(
        userId, topicId, quizType, built
      );

      // merge backend question_id into local question data
      const merged = built.map((q, i) => ({ ...q, question_id: bqs[i].question_id }));

      setQuestions(merged);
      setBackendQs(bqs);
      setQuizId(quiz.quiz_id);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnsweredMap({});
      setResultData(null);
      setScore(0);
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }, [topicId, userId, quizType, limit]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  // ── Answer + advance ──────────────────────────────────────────────────────
  const handleNext = async () => {
    if (!selectedOption) return;
    const q = questions[currentIndex];

    try {
      await submitAnswer(q.question_id, selectedOption);
    } catch (e) {
      console.warn('submitAnswer error (non-critical):', e.message);
    }

    const newMap = { ...answeredMap, [q.question_id]: selectedOption };
    setAnsweredMap(newMap);

    const isCorrect = selectedOption === q.correct_option;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      await finaliseQuiz(newScore);
    }
  };

  const finaliseQuiz = async (finalScore) => {
    try {
      await submitQuiz(quizId);
    } catch (e) {
      console.warn('submitQuiz error (non-critical):', e.message);
    }
    // re-fetch questions to get is_correct from backend
    try {
      const detailed = await Promise.all(
        questions.map((q) => getQuizQuestion(q.question_id))
      );
      setResultData(detailed);
    } catch (e) {
      // fallback: compute locally
      setResultData(
        questions.map((q) => ({
          ...q,
          user_answer: answeredMap[q.question_id] ?? null,
          is_correct: answeredMap[q.question_id] === q.correct_option,
        }))
      );
    }
    setScore(finalScore);
    setPhase('result');
  };

  // ── Option map helper ─────────────────────────────────────────────────────
  const getOptions = (q) => ({
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  });

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Building quiz…</Text>
      </View>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={styles.webWrapper}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.appName}>Multiple Choice</Text>
            </View>
          </View>
          <View style={styles.whiteCard}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Could not start quiz</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadQuiz}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
              <Text style={{ color: '#667eea', fontWeight: '600' }}>Back to Quiz Menu</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const total = questions.length;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

    return (
      <View style={styles.webWrapper}>
        <LinearGradient colors={['#16A487', '#3FC5B7']} style={styles.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.appName}>Quiz Complete!</Text>
              <Text style={styles.appSubtitle}>{topicTitle || 'Multiple Choice'}</Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }}>
            <View style={styles.whiteCard}>
              {/* Score banner */}
              <View style={styles.scoreBanner}>
                <View style={styles.trophyCircle}>
                  <Ionicons name="trophy" size={32} color="#eab308" />
                </View>
                <Text style={styles.scoreText}>{score}/{total}</Text>
                <Text style={styles.scoreMotivation}>
                  {accuracy >= 80 ? '🎉 Excellent!' : accuracy >= 60 ? '👍 Good job!' : '💪 Keep practicing!'}
                </Text>
              </View>

              {/* Metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={[styles.metricVal, { color: '#16A487' }]}>{score}</Text>
                  <Text style={styles.metricLabel}>Correct</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={[styles.metricVal, { color: '#ef4444' }]}>{total - score}</Text>
                  <Text style={styles.metricLabel}>Wrong</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={[styles.metricVal, { color: '#6366f1' }]}>{accuracy}%</Text>
                  <Text style={styles.metricLabel}>Accuracy</Text>
                </View>
              </View>

              {/* Breakdown */}
              {resultData && (
                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownTitle}>Review</Text>
                  {resultData.map((q, i) => {
                    const opts = getOptions(q);
                    return (
                      <View key={q.question_id || i} style={[styles.reviewCard, q.is_correct ? styles.reviewCorrect : styles.reviewWrong]}>
                        <View style={styles.reviewHeader}>
                          <Ionicons
                            name={q.is_correct ? 'checkmark-circle' : 'close-circle'}
                            size={18}
                            color={q.is_correct ? '#22c55e' : '#ef4444'}
                          />
                          <Text style={styles.reviewQ} numberOfLines={2}>{q.question_text}</Text>
                        </View>
                        <Text style={styles.reviewAnswer}>
                          Your answer: <Text style={{ fontWeight: '700' }}>{opts[q.user_answer] || '—'}</Text>
                        </Text>
                        {!q.is_correct && (
                          <Text style={styles.reviewCorrectAns}>
                            Correct: <Text style={{ fontWeight: '700', color: '#16A487' }}>{opts[q.correct_option]}</Text>
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.restartBtn} onPress={loadQuiz}>
                <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.restartBtnText}>New Quiz</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backMenuBtn}>
                <Text style={styles.backMenuText}>Back to Quiz Menu</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  const q = questions[currentIndex];
  const opts = getOptions(q);
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <View style={styles.webWrapper}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.phoneContainer}>
        <StatusBar barStyle="light-content" />

        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.appName}>Multiple Choice</Text>
            <Text style={styles.appSubtitle}>{topicTitle || 'Quiz'}</Text>
          </View>
        </View>

        {/* Progress segments */}
        <View style={styles.progressSection}>
          <View style={styles.segmentRow}>
            {questions.map((_, i) => (
              <View key={i} style={[styles.segment, i <= currentIndex ? styles.segActive : styles.segInactive]} />
            ))}
          </View>
        </View>

        <View style={styles.whiteCard}>
          {/* Question card */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTag}>Q{currentIndex + 1} / {questions.length}</Text>
            <Text style={styles.questionText}>{q.question_text}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {letters.map((letter) => {
              const isSelected = selectedOption === letter;
              return (
                <TouchableOpacity
                  key={letter}
                  style={[styles.optionBtn, isSelected && styles.optionSelected]}
                  onPress={() => setSelectedOption(letter)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                    <Text style={[styles.optionLetterText, isSelected && { color: '#667eea' }]}>{letter}</Text>
                  </View>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opts[letter]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, !selectedOption && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!selectedOption}
          >
            <Text style={styles.nextBtnText}>
              {currentIndex + 1 < questions.length ? 'Next ▶' : 'Finish ▶'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const S = (obj) => StyleSheet.create(obj);
const styles = S({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2ff' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  headerSection: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16 },
  appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  appSubtitle: { fontSize: 13, color: '#e2e8f0' },
  progressSection: { paddingHorizontal: 20, marginBottom: 10 },
  segmentRow: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  segActive: { backgroundColor: '#ffffff' },
  segInactive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  whiteCard: { flex: 1, backgroundColor: '#F0F2FF', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  // Error
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16, textAlign: 'center' },
  errorMsg: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 20, backgroundColor: '#667eea', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  // Quiz
  questionCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 16 },
  questionTag: { fontSize: 12, fontWeight: '700', color: '#667eea', marginBottom: 6 },
  questionText: { fontSize: 17, fontWeight: '700', color: '#1e293b', lineHeight: 24 },
  optionsList: { gap: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0', gap: 12 },
  optionSelected: { borderColor: '#667eea', backgroundColor: '#f0f3ff' },
  optionLetter: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  optionLetterSelected: { backgroundColor: '#e0e7ff' },
  optionLetterText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  optionText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#334155' },
  optionTextSelected: { color: '#4f46e5', fontWeight: '700' },
  nextBtn: { marginTop: 20, backgroundColor: '#667eea', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  // Result
  scoreBanner: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16 },
  trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  scoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  scoreMotivation: { fontSize: 14, color: '#64748b', marginTop: 4 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 16, alignItems: 'center' },
  metricVal: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  breakdownSection: { width: '100%', marginBottom: 16 },
  breakdownTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 10 },
  reviewCard: { padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  reviewCorrect: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  reviewWrong: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  reviewQ: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  reviewAnswer: { fontSize: 12, color: '#475569', paddingLeft: 26 },
  reviewCorrectAns: { fontSize: 12, color: '#475569', paddingLeft: 26, marginTop: 2 },
  restartBtn: { flexDirection: 'row', backgroundColor: '#16A487', paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  restartBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  backMenuBtn: { alignItems: 'center', paddingVertical: 10 },
  backMenuText: { color: '#16A487', fontWeight: '600', fontSize: 14 },
});
