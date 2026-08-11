import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, StatusBar, Platform,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getWords, buildMCQuestions, saveLocalQuizResult } from '../api';

const TIMER_SECONDS = 30;
const QUESTION_TIME = 10;
const QUESTION_COUNT = 10;

export default function QuizSpeedRound({ navigation, route }) {
  const { topicId, topicTitle, userId = 1, limit = 10 } = route.params || {};

  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null); // letter A-D
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [questionTimeLeft, setQTimeLeft] = useState(QUESTION_TIME);
  const [isGameActive, setIsGameActive] = useState(false);
  const [error, setError] = useState('');

  const globalTimer = useRef(null);
  const questionTimer = useRef(null);

  // ── Load words from backend ───────────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    try {
      setPhase('loading');
      // 2. Kéo tối đa 100 từ
      const words = await getWords(topicId, 100);
      if (words.length < 4) throw new Error('Not enough words in this topic (need at least 4).');

      // 3. Chốt chặn số lượng câu hỏi
      const actualLimit = Math.min(limit, words.length);
      const built = buildMCQuestions(words, actualLimit);

      if (!built.length) throw new Error('Could not build questions from this topic.');
      setQuestions(built);
      setPhase('ready');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }, [topicId, limit]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setPhase('playing');
    setIsGameActive(true);
    setTimeLeft(TIMER_SECONDS);
    setQTimeLeft(QUESTION_TIME);
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setResults([]);
  }, []);

  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = useCallback((finalResults) => {
    clearInterval(globalTimer.current);
    clearInterval(questionTimer.current);
    setIsGameActive(false);
    saveLocalQuizResult(userId, topicId, 'speed_round', finalResults);
    setPhase('result');
  }, [userId, topicId]);

  // ── Global countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGameActive || phase !== 'playing') return;
    globalTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { endGame(results); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(globalTimer.current);
  }, [isGameActive, phase, endGame, results]);

  // ── Per-question countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (!isGameActive || phase !== 'playing') return;
    questionTimer.current = setInterval(() => {
      setQTimeLeft(prev => {
        if (prev <= 1) {
          // auto-advance, no answer = wrong
          setResults(r => {
            const q = questions[currentIndex];
            const newR = q ? [...r, { word_id: q.word_id, is_correct: false }] : r;
            if (currentIndex + 1 >= questions.length) { endGame(newR); return newR; }
            setCurrentIndex(ci => ci + 1);
            setSelectedOption(null);
            return newR;
          });
          return QUESTION_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(questionTimer.current);
  }, [isGameActive, phase, currentIndex, questions, endGame]);

  const handleSelect = (letter) => {
    if (!isGameActive || selectedOption) return;
    setSelectedOption(letter);
    const q = questions[currentIndex];
    const isCorrect = letter === q.correct_option;
    const newScore = isCorrect ? score + 1 : score;
    const newResults = [...results, { word_id: q.word_id, is_correct: isCorrect }];
    setScore(newScore);
    setResults(newResults);

    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        endGame(newResults);
      } else {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setQTimeLeft(QUESTION_TIME);
      }
    }, 500);
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#FF9500" />
        <Text style={st.loadingText}>Loading words…</Text>
      </View>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={st.webWrapper}>
        <LinearGradient colors={['#FFCE0A', '#FF9500']} style={st.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={st.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={st.headerTextContainer}>
              <Text style={st.appName}>Speed Round</Text>
            </View>
          </View>
          <View style={st.whiteCardContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" style={{ marginTop: 30 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 12 }}>Could not start quiz</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>{error}</Text>
            <TouchableOpacity style={[st.restartButton, { marginTop: 20, width: '80%' }]} onPress={loadQuiz}>
              <Text style={st.restartButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── READY ─────────────────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <View style={st.webWrapper}>
        <LinearGradient colors={['#FFCE0A', '#FF9500']} style={st.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={st.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={st.headerTextContainer}>
              <Text style={st.appName}>Speed Round</Text>
              <Text style={st.appSubtitle}>{topicTitle || 'Race against time'}</Text>
            </View>
          </View>
          <View style={st.whiteCardContainer}>
            <View style={st.readyCard}>
              <View style={st.readyIcon}><Ionicons name="flash-outline" size={48} color="#FFCE0A" /></View>
              <Text style={st.readyTitle}>Get Ready!</Text>
              <Text style={st.readyDesc}>Answer as many questions as you can before time runs out!</Text>
              <View style={{ gap: 8, width: '100%', marginBottom: 24 }}>
                {[
                  ['time-outline', `${TIMER_SECONDS} seconds total`],
                  ['timer-outline', `${QUESTION_TIME}s per question`],
                  ['albums-outline', `${questions.length} questions from backend`],
                ].map(([icon, text]) => (
                  <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={icon} size={16} color="#64748b" />
                    <Text style={{ fontSize: 14, color: '#475569' }}>{text}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={st.startRoundBtn} onPress={startGame}>
                <Ionicons name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={st.startRoundBtnText}>START!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const total = results.length;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <View style={st.webWrapper}>
        <LinearGradient colors={['#FFCE0A', '#FF9500']} style={st.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={st.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={st.headerTextContainer}>
              <Text style={st.appName}>Time's Up!</Text>
              <Text style={st.appSubtitle}>{topicTitle || 'Speed Round'}</Text>
            </View>
          </View>
          <View style={st.whiteCardContainer}>
            <View style={st.resultBannerCard}>
              <View style={st.trophyCircle}><Ionicons name="flash" size={32} color="#eab308" /></View>
              <Text style={st.resultScoreText}>{score}/{total}</Text>
              <Text style={st.resultMotivationText}>Speed challenge complete!</Text>
            </View>
            <View style={st.resultMetricsRow}>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#FF9500' }]}>{score}</Text><Text style={st.metricLabel}>Correct</Text></View>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#ef4444' }]}>{total - score}</Text><Text style={st.metricLabel}>Wrong</Text></View>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#6366f1' }]}>{accuracy}%</Text><Text style={st.metricLabel}>Accuracy</Text></View>
            </View>
            <TouchableOpacity style={st.restartButton} onPress={() => { loadQuiz(); }}>
              <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={st.restartButtonText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.backToMenuBtn} onPress={() => navigation.goBack()}>
              <Text style={st.backToMenuText}>Back to Quiz Menu</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  const q = questions[currentIndex];
  const opts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const questionTimerPct = (questionTimeLeft / QUESTION_TIME) * 100;

  return (
    <View style={st.webWrapper}>
      <LinearGradient colors={['#FFCE0A', '#FF9500']} style={st.phoneContainer}>
        <StatusBar barStyle="light-content" />
        <View style={st.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={st.headerTextContainer}>
            <Text style={st.appName}>Speed Round</Text>
            <Text style={st.appSubtitle}>Quick! Answer fast!</Text>
          </View>
        </View>

        <View style={st.timerSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="time-outline" size={16} color="#ffffff" />
            <View style={st.timerBarBg}>
              <View style={[st.timerBarFill, { width: `${timerPct}%` }]} />
            </View>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, minWidth: 30 }}>{timeLeft}s</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', minWidth: 40 }}>Q {currentIndex + 1}/{questions.length}</Text>
            <View style={[st.timerBarBg, { height: 5 }]}>
              <View style={[st.timerBarFill, { width: `${questionTimerPct}%`, backgroundColor: '#FFE066' }]} />
            </View>
            <Text style={{ color: '#FFE066', fontWeight: '700', fontSize: 13, minWidth: 25 }}>{questionTimeLeft}s</Text>
          </View>
        </View>

        <View style={st.whiteCardContainer}>
          <View style={st.questionCard}>
            <Text style={st.questionTag}>Q{currentIndex + 1} / {questions.length}</Text>
            <Text style={st.questionText}>{q.question_text}</Text>
          </View>

          <View style={{ gap: 10, width: '100%' }}>
            {['A', 'B', 'C', 'D'].map((letter) => {
              const isSelected = selectedOption === letter;
              const correct = selectedOption && letter === q.correct_option;
              const wrong = isSelected && !correct;
              return (
                <TouchableOpacity
                  key={letter}
                  style={[
                    st.optionBtn,
                    isSelected && !selectedOption && st.optionSelected,
                    correct && st.optionCorrect,
                    wrong && st.optionWrong,
                    isSelected && st.optionSelected,
                  ]}
                  onPress={() => handleSelect(letter)}
                  disabled={!!selectedOption}
                  activeOpacity={0.8}
                >
                  <Text style={st.optionText}>{opts[letter]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ width: '100%', alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FF9500' }}>Score: {score}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fffbeb' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  headerSection: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 6 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16 },
  appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  timerSection: { paddingHorizontal: 20, marginBottom: 6 },
  timerBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden' },
  timerBarFill: { height: '100%', backgroundColor: '#ffffff', borderRadius: 4 },
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', paddingHorizontal: 20, paddingTop: 12 },
  questionCard: { width: '100%', backgroundColor: '#ffffff', padding: 18, borderRadius: 20, marginBottom: 14 },
  questionTag: { fontSize: 12, fontWeight: '700', color: '#FF9500', marginBottom: 4 },
  questionText: { fontSize: 17, fontWeight: '700', color: '#1e293b', lineHeight: 24 },
  optionBtn: { width: '100%', backgroundColor: '#ffffff', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  optionSelected: { borderColor: '#FF9500', backgroundColor: '#fffbeb' },
  optionCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optionWrong: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  optionText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  readyCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 30 },
  readyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  readyTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  readyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  startRoundBtn: { flexDirection: 'row', width: '100%', backgroundColor: '#FF9500', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  startRoundBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 16, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#FF9500', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  backToMenuText: { color: '#FF9500', fontSize: 14, fontWeight: '600' },
});
