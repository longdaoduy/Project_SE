import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, StatusBar, Platform,
  TouchableOpacity, Image, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getWords, buildMatchingPairs, saveLocalQuizResult } from '../api';

const PAIR_COUNT = 6;

export default function QuizMatching({ navigation, route }) {
  const { topicId, topicTitle, userId = 1, deckWords = null, limit = 6 } = route.params || {};

  const [phase, setPhase] = useState('loading');
  const [pairs, setPairs] = useState([]);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState(0);
  const [error, setError] = useState('');

  const loadQuiz = useCallback(async () => {
    try {
      setPhase('loading');
      const words = deckWords ? deckWords : await getWords(topicId, Math.max(limit * 2, 40));
      if (words.length < 4) throw new Error('Not enough words to start a quiz (need at least 4).');
      const built = buildMatchingPairs(words, limit);
      setPairs(built);
      setLeftItems([...built].sort(() => Math.random() - 0.5));
      setRightItems([...built].sort(() => Math.random() - 0.5));
      setSelectedLeft(null);
      setMatched([]);
      setWrong(0);
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }, [topicId, deckWords, limit]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const isMatched = (wordId) => matched.includes(wordId);

  const handleSelectLeft = (item) => {
    if (isMatched(item.word_id)) return;
    setSelectedLeft(item);
  };

  const handleSelectRight = (item) => {
    if (isMatched(item.word_id) || !selectedLeft) return;
    if (selectedLeft.word_id === item.word_id) {
      const newMatched = [...matched, item.word_id];
      setMatched(newMatched);
      setSelectedLeft(null);
      if (newMatched.length === pairs.length) {
        if (!deckWords) {
          const results = pairs.map((p) => ({ word_id: p.word_id, is_correct: true }));
          saveLocalQuizResult(userId, topicId, 'word_matching', results);
        }
        setPhase('result');
      }
    } else {
      setWrong(prev => prev + 1);
      setSelectedLeft(null);
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#006FFF" />
        <Text style={st.loadingText}>Building quiz…</Text>
      </View>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={st.webWrapper}>
        <LinearGradient colors={['#006FFF', '#4F9FFF']} style={st.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={st.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={st.headerTextContainer}>
              <Text style={st.appName}>Word Matching</Text>
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

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const accuracy = Math.round((pairs.length / (pairs.length + wrong)) * 100);
    return (
      <View style={st.webWrapper}>
        <LinearGradient colors={['#006FFF', '#4F9FFF']} style={st.phoneContainer}>
          <StatusBar barStyle="light-content" />
          <View style={st.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={st.headerTextContainer}>
              <Text style={st.appName}>All Matched!</Text>
              <Text style={st.appSubtitle}>{topicTitle || 'Word Matching'}</Text>
            </View>
          </View>
          <View style={st.whiteCardContainer}>
            <View style={st.resultBannerCard}>
              <View style={st.trophyCircle}><Ionicons name="trophy" size={32} color="#eab308" /></View>
              <Text style={st.resultScoreText}>{pairs.length}/{pairs.length}</Text>
              <Text style={st.resultMotivationText}>{wrong === 0 ? '🎉 Perfect!' : `${wrong} wrong attempt${wrong > 1 ? 's' : ''}`}</Text>
            </View>
            <View style={st.resultMetricsRow}>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#006FFF' }]}>{pairs.length}</Text><Text style={st.metricLabel}>Matched</Text></View>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#ef4444' }]}>{wrong}</Text><Text style={st.metricLabel}>Mistakes</Text></View>
              <View style={st.metricCard}><Text style={[st.metricValue, { color: '#6366f1' }]}>{accuracy}%</Text><Text style={st.metricLabel}>Accuracy</Text></View>
            </View>
            <TouchableOpacity style={st.restartButton} onPress={loadQuiz}>
              <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={st.restartButtonText}>New Round</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.backToMenuBtn} onPress={() => navigation.goBack()}>
              <Text style={st.backToMenuText}>Back to Quiz Menu</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  return (
    <View style={st.webWrapper}>
      <LinearGradient colors={['#006FFF', '#4F9FFF']} style={st.phoneContainer}>
        <StatusBar barStyle="light-content" />
        <View style={st.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={st.headerTextContainer}>
            <Text style={st.appName}>Word Matching</Text>
            <Text style={st.appSubtitle}>{topicTitle || 'Match words with definitions'}</Text>
          </View>
        </View>

        <View style={st.scoreBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
          <Text style={st.scoreBadgeText}>{matched.length}/{pairs.length} matched</Text>
          {wrong > 0 && <Text style={st.scoreBadgeText}>· {wrong} wrong</Text>}
        </View>

        <View style={st.whiteCardContainer}>
          <View style={st.instruction}>
            <Text style={st.instructionText}>
              {selectedLeft ? '👉 Now tap the matching definition' : '👆 Tap a word on the left'}
            </Text>
          </View>

          <ScrollView style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={[st.columns, { flex: 0 }]}>
              <View style={st.column}>
                <Text style={st.columnLabel}>Words</Text>
                {leftItems.map((item) => (
                  <TouchableOpacity
                    key={item.word_id}
                    style={[
                      st.matchCard,
                      isMatched(item.word_id) && st.matchCardMatched,
                      selectedLeft?.word_id === item.word_id && st.matchCardSelected,
                    ]}
                    onPress={() => handleSelectLeft(item)}
                    disabled={isMatched(item.word_id)}
                  >
                    <Text style={[st.matchCardText, isMatched(item.word_id) && st.matchCardTextMatched]} numberOfLines={2}>
                      {isMatched(item.word_id) ? '✓' : item.word}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={st.column}>
                <Text style={st.columnLabel}>Definitions</Text>
                {rightItems.map((item) => (
                  <TouchableOpacity
                    key={item.word_id}
                    style={[
                      st.matchCard,
                      isMatched(item.word_id) && st.matchCardMatched,
                    ]}
                    onPress={() => handleSelectRight(item)}
                    disabled={isMatched(item.word_id)}
                  >
                    <Text style={[st.matchCardText, isMatched(item.word_id) && st.matchCardTextMatched]} numberOfLines={3}>
                      {isMatched(item.word_id) ? '✓' : item.definition}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f7ff' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  headerSection: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16 },
  appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  appSubtitle: { fontSize: 13, color: '#e2e8f0' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, gap: 6, marginBottom: 10 },
  scoreBadgeText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12 },
  instruction: { backgroundColor: '#ffffff', padding: 12, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  instructionText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  columns: { flexDirection: 'row', width: '100%', gap: 8, flex: 1, paddingBottom: 20 },
  column: { flex: 1, gap: 8 },
  columnLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 },
  matchCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  matchCardSelected: { borderColor: '#006FFF', backgroundColor: '#f0f7ff' },
  matchCardMatched: { borderColor: '#22c55e', backgroundColor: '#f0fdf4', opacity: 0.8 },
  matchCardText: { fontSize: 12, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  matchCardTextMatched: { color: '#22c55e', fontWeight: '700' },
  resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 16, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#006FFF', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  backToMenuText: { color: '#006FFF', fontSize: 14, fontWeight: '600' },
});
