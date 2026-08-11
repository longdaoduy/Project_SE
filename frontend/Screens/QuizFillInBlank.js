import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, Text, TextInput, View, StatusBar, Platform,
  TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getWords, buildFillQuestions, saveLocalQuizResult } from '../api';

export default function QuizFillInBlank({ navigation, route }) {
  const { topicId, topicTitle, userId = 1, deckWords = null, limit = 8 } = route.params || {};

  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const loadQuiz = useCallback(async () => {
    try {
      setPhase('loading');
      const words = deckWords ? deckWords : await getWords(topicId, Math.max(limit * 2, 60));
      if (words.length < 3) throw new Error('Not enough words to start a quiz (need at least 3).');
      const built = buildFillQuestions(words, limit);
      if (!built.length) throw new Error('Could not build questions from this deck.');
      setQuestions(built);
      setCurrentIndex(0);
      setUserAnswer('');
      setShowResult(false);
      setIsCorrect(false);
      setScore(0);
      setResults([]);
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }, [topicId, deckWords, limit]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const currentQ = questions[currentIndex];

  const checkAnswer = () => {
    const correct = userAnswer.trim().toLowerCase() === currentQ.answer.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleNext = async () => {
    const newResults = [...results, { word_id: currentQ.word_id, is_correct: isCorrect }];
    setResults(newResults);
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setShowResult(false);
      setIsCorrect(false);
    } else {
      if (!deckWords) saveLocalQuizResult(userId, topicId, 'fill_blank', newResults);
      setPhase('result');
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A487" />
        <Text style={styles.loadingText}>Building quiz…</Text>
      </View>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={styles.webWrapper}>
        <LinearGradient colors={['#16A487', '#3FC5B7']} style={styles.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.appName}>Fill in the blank</Text>
            </View>
          </View>
          <View style={styles.whiteCardContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" style={{ marginTop: 30 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 12 }}>Could not start quiz</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>{error}</Text>
            <TouchableOpacity style={[styles.nextActionBtn, { marginTop: 20, width: '80%' }]} onPress={loadQuiz}>
              <Text style={styles.nextActionBtnText}>Try Again</Text>
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
              <Text style={styles.appName}>Quiz Complete</Text>
              <Text style={styles.appSubtitle}>{topicTitle || 'Fill in the blank'}</Text>
            </View>
          </View>
          <View style={styles.whiteCardContainer}>
            <View style={styles.resultBannerCard}>
              <View style={styles.trophyCircle}><Ionicons name="trophy" size={32} color="#eab308" /></View>
              <Text style={styles.resultScoreText}>{score}/{total}</Text>
              <Text style={styles.resultMotivationText}>{accuracy >= 80 ? '🎉 Excellent!' : '💪 Keep practicing!'}</Text>
            </View>
            <View style={styles.resultMetricsRow}>
              <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#16A487' }]}>{score}</Text><Text style={styles.metricLabel}>Correct</Text></View>
              <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#ef4444' }]}>{total - score}</Text><Text style={styles.metricLabel}>Wrong</Text></View>
              <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#6366f1' }]}>{accuracy}%</Text><Text style={styles.metricLabel}>Accuracy</Text></View>
            </View>
            <TouchableOpacity style={styles.restartButton} onPress={loadQuiz}>
              <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.restartButtonText}>New Quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backToMenuBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backToMenuText}>Back to Quiz Menu</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.webWrapper}>
      <LinearGradient colors={['#16A487', '#3FC5B7']} style={styles.phoneContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.appName}>Fill in the blank</Text>
            <Text style={styles.appSubtitle}>{topicTitle || 'Quiz'}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.segmentContainer}>
            {questions.map((_, i) => (
              <View key={i} style={[styles.segmentBar, i <= currentIndex ? styles.activeSegment : styles.inactiveSegment]} />
            ))}
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.whiteCardContainer}>
            <View style={styles.quizQuestionCard}>
              <Text style={styles.questionTag}>QUESTION {currentIndex + 1} / {questions.length}</Text>
              <Text style={styles.questionTitleText}>Complete the sentence:</Text>
              <View style={styles.sentenceBox}>
                <Text style={styles.sentenceText}>{currentQ?.sentence}</Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <TextInput
                style={[styles.answerInput, showResult && (isCorrect ? styles.inputCorrect : styles.inputWrong)]}
                placeholder="Type the missing word…"
                placeholderTextColor="#94a3b8"
                value={userAnswer}
                onChangeText={setUserAnswer}
                editable={!showResult}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {currentQ?.hint && !showResult && (
                <Text style={styles.hintText}>Phonetic: {currentQ.hint}</Text>
              )}
            </View>

            {showResult && (
              <View style={[styles.resultFeedback, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={20} color={isCorrect ? '#22c55e' : '#ef4444'} />
                <Text style={[styles.feedbackText, { color: isCorrect ? '#15803d' : '#b91c1c' }]}>
                  {isCorrect ? 'Correct!' : `Answer: "${currentQ?.answer}"`}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.nextActionBtn, (!userAnswer.trim() && !showResult) && styles.disabledNextBtn]}
              onPress={showResult ? handleNext : checkAnswer}
              disabled={!userAnswer.trim() && !showResult}
            >
              <Text style={styles.nextActionBtnText}>
                {showResult ? (currentIndex + 1 < questions.length ? 'Next ►' : 'Finish ►') : 'Check ►'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  headerSection: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16 },
  appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  appSubtitle: { fontSize: 13, color: '#e2e8f0' },
  progressSection: { paddingHorizontal: 20, marginBottom: 12 },
  segmentContainer: { flexDirection: 'row', gap: 5 },
  segmentBar: { flex: 1, height: 4, borderRadius: 2 },
  activeSegment: { backgroundColor: '#ffffff' },
  inactiveSegment: { backgroundColor: 'rgba(255,255,255,0.25)' },
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  quizQuestionCard: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 16 },
  questionTag: { fontSize: 12, fontWeight: '700', color: '#16A487', marginBottom: 6 },
  questionTitleText: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  sentenceBox: { backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  sentenceText: { fontSize: 17, fontWeight: '600', color: '#166534', lineHeight: 24, fontStyle: 'italic' },
  inputSection: { width: '100%', marginBottom: 14 },
  answerInput: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, fontSize: 18, fontWeight: '600', borderWidth: 1.5, borderColor: '#e2e8f0', textAlign: 'center', color: '#1e293b' },
  inputCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  inputWrong: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  hintText: { fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  resultFeedback: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8, marginBottom: 12, width: '100%' },
  feedbackCorrect: { backgroundColor: '#f0fdf4' },
  feedbackWrong: { backgroundColor: '#fef2f2' },
  feedbackText: { fontSize: 14, fontWeight: '600', flex: 1 },
  nextActionBtn: { width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  disabledNextBtn: { opacity: 0.5 },
  nextActionBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 16, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  backToMenuText: { color: '#16A487', fontSize: 14, fontWeight: '600' },
});
