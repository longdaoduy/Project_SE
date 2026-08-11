import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  generateAIReading,
  getAIReading,
  getUserAIReadings,
  getWords,
  retakeAIReading,
  submitAIReading,
} from '../api';
import { useData } from '../context/DataContext';

const { width: screenWidth } = Dimensions.get('window');

// Difficulty → time limit in seconds (must match backend defaults)
const DIFFICULTY_TIME = { A1: 600, A2: 600, B1: 720, B2: 900, C1: 1080, C2: 1200 };
const DEFAULT_TIME = 600;

const DIFFICULTY_FILTERS  = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DIFFICULTY_OPTIONS  = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COLORS = {
  A1: { bg: '#dcfce7', text: '#15803d' },
  A2: { bg: '#d1fae5', text: '#065f46' },
  B1: { bg: '#dbeafe', text: '#1d4ed8' },
  B2: { bg: '#ede9fe', text: '#6d28d9' },
  C1: { bg: '#fef3c7', text: '#d97706' },
  C2: { bg: '#fee2e2', text: '#b91c1c' },
};

function calcReadingMinutes(passage = '') {
  const words = passage.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} min`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function AIReadingScreen({ navigation, route }) {
  const { userId, topics, topicsLoading, loadTopics } = useData();

  // Route params injected when launched from a deck card
  const presetDeckTitle = route?.params?.presetDeckTitle || null;
  const presetVocab     = route?.params?.presetVocab     || null;

  // 'history' | 'input' | 'test' | 'result'
  // If launched from a deck, skip straight to the input/configure view
  const [viewState, setViewState] = useState(presetVocab ? 'input' : 'history');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const [historyReadings, setHistoryReadings]   = useState([]);
  const [historyLoading, setHistoryLoading]     = useState(false);
  const [visibleCount, setVisibleCount]         = useState(8);    // pagination: show 8 at a time
  const [searchQuery, setSearchQuery]           = useState('');   // search by title/topic

  // Input form — pre-fill if launched from a deck
  const [difficultyParam, setDifficultyParam]   = useState('B1');
  const [quickTopicId, setQuickTopicId]         = useState(null);
  const [topicWords, setTopicWords]             = useState([]);   // words loaded from selected topic
  const [manualInput, setManualInput]           = useState(presetVocab || '');   // pre-filled from deck
  const [loadingWords, setLoadingWords]         = useState(false);

  // Active reading
  const [currentReading, setCurrentReading]     = useState(null);
  const [selectedAnswers, setSelectedAnswers]   = useState({});
  const [resultReading, setResultReading]       = useState(null);

  // UI flags
  const [generating, setGenerating]             = useState(false);
  const [loadingReading, setLoadingReading]     = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [screenError, setScreenError]           = useState('');

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft]                 = useState(DEFAULT_TIME);
  const [timerActive, setTimerActive]           = useState(false);
  const timerRef                                = useRef(null);
  const elapsedRef                              = useRef(0);   // seconds spent
  const autoSubmitRef                           = useRef(null);

  // Track whether auto-submit is already in progress to avoid double calls
  const autoSubmittingRef = useRef(false);

  // ── Timer management ───────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerActive(false);
  }, []);

  const startTimer = useCallback((limitSeconds) => {
    stopTimer();
    autoSubmittingRef.current = false;
    elapsedRef.current = 0;
    setTimeLeft(limitSeconds);
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setTimerActive(false);
          // schedule auto-submit outside the state update
          autoSubmitRef.current = true;
          return 0;
        }
        elapsedRef.current += 1;
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // Clean up on unmount
  useEffect(() => { return () => stopTimer(); }, [stopTimer]);

  // ── Auto-submit when timer hits 0 ──────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && autoSubmitRef.current && !autoSubmittingRef.current) {
      autoSubmitRef.current = false;
      autoSubmittingRef.current = true;
      doSubmit(true);   // true = auto (timer expired)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setScreenError('');
      const data = await getUserAIReadings(userId, 30);
      setHistoryReadings(data || []);
    } catch (e) {
      setScreenError(e.message || 'Could not load reading history');
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
    if (topics.length === 0) loadTopics();
  }, []);

  const filteredHistory = useMemo(() => {
    let list = historyReadings;
    if (selectedFilter !== 'All') {
      list = list.filter(item => item.difficulty_param === selectedFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.difficulty_param || '').toLowerCase().includes(q) ||
        (item.input_vocabulary || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [historyReadings, selectedFilter, searchQuery]);

  const visibleHistory = useMemo(
    () => filteredHistory.slice(0, visibleCount),
    [filteredHistory, visibleCount]
  );

  // ── Generate new test ──────────────────────────────────────────────────────
  const handleTopicSelect = useCallback(async (topicId) => {
    // Toggle off if same topic tapped again
    if (quickTopicId === topicId) {
      setQuickTopicId(null);
      setTopicWords([]);
      return;
    }
    setQuickTopicId(topicId);
    setTopicWords([]);
    try {
      setLoadingWords(true);
      const words = await getWords(topicId, 20);
      setTopicWords(words || []);
    } catch (e) {
      setScreenError(e.message || 'Could not load topic words');
    } finally {
      setLoadingWords(false);
    }
  }, [quickTopicId]);

  const handleGenerate = useCallback(async () => {
    // Build vocabulary: topic words first, then any manually entered words
    const topicVocab  = topicWords.map(w => w.word);
    const manualVocab = manualInput.split(',').map(s => s.trim()).filter(Boolean);

    // Deduplicate (manual words override topic words of the same spelling)
    const seen = new Set();
    const combined = [];
    [...topicVocab, ...manualVocab].forEach(w => {
      const key = w.toLowerCase();
      if (!seen.has(key)) { seen.add(key); combined.push(w); }
    });

    if (combined.length === 0) {
      setScreenError('Please select a topic or enter vocabulary words first.');
      return;
    }

    const vocab = combined.join(', ');

    try {
      setGenerating(true);
      setScreenError('');
      const reading = await generateAIReading(userId, vocab, null, difficultyParam || null);
      const limit = DIFFICULTY_TIME[difficultyParam] || reading.time_limit_seconds || DEFAULT_TIME;

      setCurrentReading(reading);
      setSelectedAnswers({});
      setResultReading(null);
      startTimer(limit);
      setViewState('test');
      await loadHistory();
    } catch (e) {
      setScreenError(e.message || 'Generate reading failed');
    } finally {
      setGenerating(false);
    }
  }, [difficultyParam, loadHistory, manualInput, startTimer, topicWords, userId]);

  // ── Open existing test from history ───────────────────────────────────────
  const openReading = useCallback(async (readingId) => {
    try {
      setLoadingReading(true);
      setScreenError('');
      const reading = await getAIReading(readingId);

      const seededAnswers = {};
      (reading.comprehension_questions || []).forEach(q => {
        if (q.user_answer) seededAnswers[q.question_id] = q.user_answer;
      });

      setCurrentReading(reading);
      setSelectedAnswers(seededAnswers);

      if (reading.is_completed) {
        setResultReading(reading);
        stopTimer();
        setViewState('result');
      } else {
        setResultReading(null);
        const limit = reading.time_limit_seconds || DEFAULT_TIME;
        startTimer(limit);
        setViewState('test');
      }
    } catch (e) {
      setScreenError(e.message || 'Could not open this reading test');
    } finally {
      setLoadingReading(false);
    }
  }, [startTimer, stopTimer]);

  // ── Submit (manual or auto) ────────────────────────────────────────────────
  const doSubmit = useCallback(async (isAuto = false) => {
    if (!currentReading) return;
    const questions = currentReading.comprehension_questions || [];
    if (!questions.length) { setScreenError('No questions to submit.'); return; }

    if (!isAuto) {
      const unanswered = questions.filter(q => !selectedAnswers[q.question_id]);
      if (unanswered.length > 0) {
        setScreenError(`Please answer all questions (${unanswered.length} remaining).`);
        return;
      }
    }

    stopTimer();
    try {
      setSubmitting(true);
      setScreenError('');
      const elapsed = elapsedRef.current;
      const scored = await submitAIReading(
        currentReading.reading_id,
        selectedAnswers,
        elapsed,
      );
      setCurrentReading(scored);
      setResultReading(scored);
      setViewState('result');
      await loadHistory();
    } catch (e) {
      setScreenError(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
      autoSubmittingRef.current = false;
    }
  }, [currentReading, loadHistory, selectedAnswers, stopTimer]);

  const handleSubmit = useCallback(() => doSubmit(false), [doSubmit]);

  // ── Retake ─────────────────────────────────────────────────────────────────
  const handleRetake = useCallback(async () => {
    if (!currentReading) return;
    try {
      setLoadingReading(true);
      setScreenError('');
      const newReading = await retakeAIReading(currentReading.reading_id, userId);
      const limit = newReading.time_limit_seconds || DEFAULT_TIME;
      setCurrentReading(newReading);
      setSelectedAnswers({});
      setResultReading(null);
      startTimer(limit);
      setViewState('test');
    } catch (e) {
      setScreenError(e.message || 'Could not retake test');
    } finally {
      setLoadingReading(false);
    }
  }, [currentReading, startTimer, userId]);

  const handleNewTest = useCallback(() => {
    stopTimer();
    setCurrentReading(null);
    setResultReading(null);
    setSelectedAnswers({});
    setScreenError('');
    setViewState('input');
  }, [stopTimer]);

  const handleBackToHistory = useCallback(() => {
    stopTimer();
    setViewState('history');
    setScreenError('');
  }, [stopTimer]);

  // Timer urgency color
  const timerColor = timeLeft <= 60 ? '#ef4444' : timeLeft <= 180 ? '#f97316' : '#22c55e';
  const timerBg    = timeLeft <= 60 ? '#fee2e2' : timeLeft <= 180 ? '#ffedd5' : '#dcfce7';

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.webWrapper}>
      <LinearGradient
        colors={['#56509f', '#667eea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.phoneContainer}
      >
        <StatusBar barStyle="light-content" />

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={viewState === 'history' ? () => navigation.goBack() : handleBackToHistory}
              style={styles.backButton}
            >
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <View style={styles.aiBadgeRow}>
                <Image source={require('../assets/shining.png')} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
                <Text style={styles.aiBadgeText}>AI-Generated</Text>
              </View>
              <Text style={styles.appName}>
                {viewState === 'history' ? `Reading Tests (${historyReadings.length})`
                  : viewState === 'input'  ? 'New Reading Test'
                  : viewState === 'test'   ? 'Reading Test'
                  :                          'Test Result'}
              </Text>
            </View>

            {/* Timer badge (test view only) */}
            {viewState === 'test' && (
              <View style={[styles.timerBadge, { backgroundColor: timerBg }]}>
                <Ionicons name="time-outline" size={14} color={timerColor} />
                <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
              </View>
            )}
            {viewState === 'history' && (
              <TouchableOpacity style={styles.reloadBtn} onPress={loadHistory}>
                <Ionicons name="refresh" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
            {(viewState === 'input' || viewState === 'result') && (
              <View style={{ width: 32 }} />
            )}
          </View>

          {/* Difficulty filter chips now live inside the history body, not in the header */}
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <View style={styles.whiteCardContainer}>
          {!!screenError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={16} color="#991b1b" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{screenError}</Text>
            </View>
          )}

          {/* ── HISTORY VIEW ──────────────────────────────────────────── */}
          {viewState === 'history' && (
            <View style={{ flex: 1 }}>
              {/* ── Sticky Generate button ── */}
              <TouchableOpacity
                style={styles.stickyGenerateBtn}
                activeOpacity={0.85}
                onPress={() => { setViewState('input'); setScreenError(''); }}
              >
                <Ionicons name="sparkles" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.stickyGenerateBtnText}>Generate New Reading Test</Text>
              </TouchableOpacity>

              {/* ── Search bar ── */}
              <View style={styles.searchBarRow}>
                <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by title or vocabulary…"
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={v => { setSearchQuery(v); setVisibleCount(8); }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Difficulty filter chips ── */}
              <View style={styles.historyFilterRow}>
                {DIFFICULTY_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.historyChip, selectedFilter === f && styles.historyChipActive]}
                    onPress={() => { setSelectedFilter(f); setVisibleCount(8); }}
                  >
                    <Text style={[styles.historyChipText, selectedFilter === f && styles.historyChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView contentContainerStyle={styles.scrollContentHistory} showsVerticalScrollIndicator={false}>
                {(historyLoading || loadingReading) ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#5b4feb" />
                    <Text style={styles.loadingText}>Loading your reading tests…</Text>
                  </View>
                ) : filteredHistory.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="sparkles-outline" size={42} color="#6366f1" />
                    <Text style={styles.emptyTitle}>
                      {searchQuery ? 'No results found' : 'No reading tests yet'}
                    </Text>
                    <Text style={styles.emptySub}>
                      {searchQuery ? 'Try a different search.' : 'Tap the button above to generate your first test.'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.historyCountLabel}>
                      {filteredHistory.length} test{filteredHistory.length !== 1 ? 's' : ''}
                      {selectedFilter !== 'All' ? ` · ${selectedFilter}` : ''}
                    </Text>
                    {visibleHistory.map(item => {
                      const isDone  = item.is_completed;
                      const level   = item.difficulty_param || '—';
                      const lc      = LEVEL_COLORS[level] || { bg: '#f1f5f9', text: '#475569' };
                      const title   = item.title || `Reading #${item.reading_id}`;
                      const dateStr = item.generated_at
                        ? new Date(item.generated_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
                        : '';
                      return (
                        <TouchableOpacity
                          key={item.reading_id}
                          style={styles.compactCard}
                          onPress={() => openReading(item.reading_id)}
                          activeOpacity={0.75}
                        >
                          {/* Left color bar based on level */}
                          <View style={[styles.compactCardBar, { backgroundColor: lc.text }]} />

                          <View style={styles.compactCardBody}>
                            <View style={styles.compactCardTopRow}>
                              {/* Level badge */}
                              <View style={[styles.compactLevelBadge, { backgroundColor: lc.bg }]}>
                                <Text style={[styles.compactLevelText, { color: lc.text }]}>{level}</Text>
                              </View>
                              {/* Retake badge */}
                              {item.attempt_number > 1 && (
                                <View style={styles.retakeBadge}>
                                  <Text style={styles.retakeBadgeText}>Retake {item.attempt_number - 1}</Text>
                                </View>
                              )}
                              {/* Status */}
                              <View style={[styles.statusDot, { backgroundColor: isDone ? '#22c55e' : '#f97316' }]} />
                              <Text style={[styles.statusLabel, { color: isDone ? '#16a34a' : '#c2410c' }]}>
                                {isDone ? 'Done' : 'Pending'}
                              </Text>
                            </View>

                            <Text style={styles.compactCardTitle} numberOfLines={2}>{title}</Text>

                            <View style={styles.compactCardFooter}>
                              {isDone && item.accuracy != null && (
                                <Text style={styles.compactScore}>{item.accuracy.toFixed(0)}%</Text>
                              )}
                              <Text style={styles.compactDate}>{dateStr}</Text>
                              <View style={styles.compactArrow}>
                                <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Load more */}
                    {visibleCount < filteredHistory.length && (
                      <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={() => setVisibleCount(v => v + 8)}
                      >
                        <Ionicons name="chevron-down" size={16} color="#5b4feb" />
                        <Text style={styles.loadMoreText}>
                          Load more ({filteredHistory.length - visibleCount} remaining)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          )}

          {/* ── INPUT VIEW ────────────────────────────────────────────── */}
          {viewState === 'input' && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={styles.cardTitle}>Configure Your Test</Text>

                {/* ── Deck source banner (shown when launched from a deck) ── */}
                {presetDeckTitle && (
                  <View style={styles.deckSourceBanner}>
                    <Ionicons name="clipboard-outline" size={15} color="#4f46e5" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deckSourceTitle}>Vocabulary Source: {presetDeckTitle}</Text>
                      <Text style={styles.deckSourceSub} numberOfLines={2}>{presetVocab}</Text>
                    </View>
                  </View>
                )}

                {/* ── Difficulty (A1–C2) ── */}
                <Text style={styles.fieldLabel}>DIFFICULTY LEVEL</Text>
                <View style={styles.chipRow}>
                  {DIFFICULTY_OPTIONS.map(d => {
                    const lc = LEVEL_COLORS[d] || { bg: '#f1f5f9', text: '#1e293b' };
                    const isActive = difficultyParam === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.levelChip,
                          { backgroundColor: isActive ? lc.text : lc.bg, borderColor: lc.text }]}
                        onPress={() => setDifficultyParam(d)}
                      >
                        <Text style={[styles.levelChipText, { color: isActive ? '#ffffff' : lc.text }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Time limit hint */}
                <View style={styles.timeLimitRow}>
                  <Ionicons name="time-outline" size={15} color="#64748b" />
                  <Text style={styles.timeLimitText}>
                    Time limit: {formatTime(DIFFICULTY_TIME[difficultyParam] || DEFAULT_TIME)}
                  </Text>
                </View>

                {/* ── Topic picker ── */}
                <Text style={[styles.fieldLabel, { marginTop: 18 }]}>TOPIC (loads vocabulary automatically)</Text>
                {topicsLoading ? (
                  <ActivityIndicator color="#5b4feb" style={{ marginVertical: 8 }} />
                ) : (
                  <View style={styles.chipRow}>
                    {topics.slice(0, 16).map(topic => (
                      <TouchableOpacity
                        key={topic.topic_id}
                        style={[styles.chip, quickTopicId === topic.topic_id && styles.chipActive]}
                        onPress={() => handleTopicSelect(topic.topic_id)}
                      >
                        <Ionicons
                          name="document-text"
                          size={13}
                          color={quickTopicId === topic.topic_id ? '#ffffff' : '#1e293b'}
                        />
                        <Text style={[styles.chipText, quickTopicId === topic.topic_id && styles.chipTextActive]}>
                          {topic.topic_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ── Vocabulary preview from topic ── */}
                {loadingWords && (
                  <View style={styles.vocabLoadingRow}>
                    <ActivityIndicator size="small" color="#5b4feb" />
                    <Text style={styles.vocabLoadingText}>Loading vocabulary…</Text>
                  </View>
                )}
                {!loadingWords && topicWords.length > 0 && (
                  <View style={styles.vocabPreviewBox}>
                    <View style={styles.vocabPreviewHeader}>
                      <Ionicons name="library-outline" size={14} color="#5b4feb" />
                      <Text style={styles.vocabPreviewTitle}>
                        Topic vocabulary ({topicWords.length} words)
                      </Text>
                    </View>
                    <View style={styles.vocabTagsWrap}>
                      {topicWords.map(w => (
                        <View key={w.word_id} style={styles.vocabTag}>
                          <Text style={styles.vocabTagWord}>{w.word}</Text>
                          {w.meaning_vi ? (
                            <Text style={styles.vocabTagMeaning} numberOfLines={1}>{w.meaning_vi}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Manual vocabulary input ── */}
                <Text style={[styles.fieldLabel, { marginTop: 18 }]}>ADD WORDS MANUALLY (optional, comma-separated)</Text>
                <TextInput
                  style={styles.manualInput}
                  multiline
                  placeholder="e.g. elusive, sustainable, acquire, proliferate"
                  placeholderTextColor="#94a3b8"
                  value={manualInput}
                  onChangeText={setManualInput}
                  textAlignVertical="top"
                />

                {/* ── Combined preview ── */}
                {(topicWords.length > 0 || manualInput.trim()) && (() => {
                  const manual = manualInput.split(',').map(s => s.trim()).filter(Boolean);
                  const total  = new Set([
                    ...topicWords.map(w => w.word.toLowerCase()),
                    ...manual.map(w => w.toLowerCase()),
                  ]).size;
                  return (
                    <View style={styles.combinedPreviewRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.combinedPreviewText}>
                        {total} unique word{total !== 1 ? 's' : ''} will be used
                        {topicWords.length > 0 && manual.length > 0
                          ? ` (${topicWords.length} from topic + ${manual.length} manual)`
                          : topicWords.length > 0
                          ? ` from topic`
                          : ` manually entered`}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              <TouchableOpacity
                style={[styles.generateButton,
                  (generating || (topicWords.length === 0 && !manualInput.trim())) && styles.generateButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleGenerate}
                disabled={generating || (topicWords.length === 0 && !manualInput.trim())}
              >
                {generating ? (
                  <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="sparkles" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.generateButtonText}>
                  {generating ? 'Generating…' : 'Generate Reading Test'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── TEST VIEW ─────────────────────────────────────────────── */}
          {viewState === 'test' && currentReading && (
            <View style={{ flex: 1, width: '100%' }}>
              {/* Timer bar */}
              <View style={styles.timerBar}>
                <View style={[styles.timerBarFill, {
                  width: `${(timeLeft / (currentReading.time_limit_seconds || DEFAULT_TIME)) * 100}%`,
                  backgroundColor: timerColor,
                }]} />
              </View>

              <ScrollView contentContainerStyle={styles.scrollContentResult} showsVerticalScrollIndicator={false}>
                {/* Passage */}
                <View style={styles.readingCard}>
                  <View style={styles.readingCardHeader}>
                    <View style={styles.readingCardTitleRow}>
                      <View style={styles.documentIconBox}>
                        <Ionicons name="document-text" size={16} color="#1e293b" />
                      </View>
                      <Text style={styles.readingCardTitle}>Reading Passage</Text>
                    </View>
                    <View style={styles.ieltsBadge}>
                      <Text style={styles.ieltsBadgeText}>{currentReading.difficulty_param || 'AI'}</Text>
                    </View>
                  </View>
                  <Text style={styles.paragraph} selectable={false}>{currentReading.generated_passage}</Text>
                </View>

                {/* Questions */}
                <View style={styles.quizCard}>
                  <Text style={styles.quizTitle}>Comprehension Questions</Text>
                  {(currentReading.comprehension_questions || []).map((q, idx) => {
                    const options = [
                      { key: 'A', text: q.option_a },
                      { key: 'B', text: q.option_b },
                      { key: 'C', text: q.option_c },
                      { key: 'D', text: q.option_d },
                    ];
                    const selected = selectedAnswers[q.question_id];
                    return (
                      <View key={q.question_id} style={{ marginBottom: 18 }}>
                        <Text style={styles.questionText}>{idx + 1}. {q.question_text}</Text>
                        <View style={styles.optionsContainer}>
                          {options.map(option => {
                            const isSelected = selected === option.key;
                            return (
                              <TouchableOpacity
                                key={option.key}
                                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                                onPress={() => setSelectedAnswers(prev => ({ ...prev, [q.question_id]: option.key }))}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                                  {isSelected && <View style={styles.optionRadioInner} />}
                                </View>
                                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                  {option.key}. {option.text}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={[styles.generateButton, submitting && styles.generateButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
                    ) : (
                      <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.generateButtonText}>{submitting ? 'Submitting…' : 'Submit Answers'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── RESULT VIEW ───────────────────────────────────────────── */}
          {viewState === 'result' && resultReading && (
            <ScrollView contentContainerStyle={styles.scrollContentResult} showsVerticalScrollIndicator={false}>
              {/* Score card */}
              <View style={styles.resultSummaryCard}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" style={{ marginBottom: 8 }} />
                <Text style={styles.resultSummaryTitle}>Test Complete</Text>
                <Text style={styles.resultSummaryScore}>
                  {Math.round(resultReading.score || 0)}/{(resultReading.comprehension_questions || []).length}
                </Text>
                <Text style={styles.resultSummarySub}>
                  Accuracy: {(resultReading.accuracy || 0).toFixed(1)}%
                  {resultReading.completion_seconds
                    ? `  ·  Time: ${formatTime(resultReading.completion_seconds)}`
                    : ''}
                </Text>
                {resultReading.attempt_number > 1 && (
                  <Text style={styles.attemptLabel}>Attempt #{resultReading.attempt_number}</Text>
                )}
              </View>

              {/* Passage (read-only) */}
              <View style={styles.readingCard}>
                <View style={styles.readingCardHeader}>
                  <View style={styles.readingCardTitleRow}>
                    <View style={styles.documentIconBox}>
                      <Ionicons name="document-text" size={16} color="#1e293b" />
                    </View>
                    <Text style={styles.readingCardTitle}>Reading Passage</Text>
                  </View>
                  <View style={styles.ieltsBadge}>
                    <Text style={styles.ieltsBadgeText}>{resultReading.difficulty_param || 'AI'}</Text>
                  </View>
                </View>
                <Text style={styles.paragraph}>{resultReading.generated_passage}</Text>
              </View>

              {/* Questions + explanations */}
              <View style={styles.quizCard}>
                <Text style={styles.quizTitle}>Answer Review</Text>
                {(resultReading.comprehension_questions || []).map((q, idx) => {
                  const options = [
                    { key: 'A', text: q.option_a },
                    { key: 'B', text: q.option_b },
                    { key: 'C', text: q.option_c },
                    { key: 'D', text: q.option_d },
                  ];
                  const isCorrect = q.is_correct;
                  return (
                    <View key={q.question_id} style={styles.reviewQuestion}>
                      {/* Question header with correct/wrong icon */}
                      <View style={styles.reviewQuestionHeader}>
                        <Ionicons
                          name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                          size={20}
                          color={isCorrect ? '#22c55e' : '#ef4444'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.questionText}>{idx + 1}. {q.question_text}</Text>
                      </View>

                      {/* Options */}
                      <View style={styles.optionsContainer}>
                        {options.map(option => {
                          const isUserAnswer  = q.user_answer === option.key;
                          const isCorrectOpt  = q.correct_option === option.key;
                          const isWrongChoice = isUserAnswer && !isCorrectOpt;
                          return (
                            <View
                              key={option.key}
                              style={[
                                styles.optionButton,
                                isCorrectOpt  && styles.optionButtonCorrect,
                                isWrongChoice && styles.optionButtonWrong,
                              ]}
                            >
                              <View style={[styles.optionRadio, isUserAnswer && styles.optionRadioSelected]}>
                                {isUserAnswer && <View style={styles.optionRadioInner} />}
                              </View>
                              <Text style={[styles.optionText, isUserAnswer && styles.optionTextSelected]}>
                                {option.key}. {option.text}
                              </Text>
                              {isCorrectOpt && (
                                <Ionicons name="checkmark" size={14} color="#16a34a" style={{ marginLeft: 'auto' }} />
                              )}
                            </View>
                          );
                        })}
                      </View>

                      {/* Explanation */}
                      {!!q.explanation && (
                        <View style={styles.explanationBox}>
                          <Ionicons name="bulb-outline" size={14} color="#7c3aed" style={{ marginRight: 6, marginTop: 1 }} />
                          <Text style={styles.explanationText}>{q.explanation}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Actions */}
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} disabled={loadingReading}>
                {loadingReading
                  ? <ActivityIndicator color="#ffffff" />
                  : <><Ionicons name="reload" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                     <Text style={styles.generateButtonText}>Retake Same Test</Text></>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.generateButton} onPress={handleNewTest}>
                <Ionicons name="sparkles" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.generateButtonText}>Generate New Test</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

        </View>{/* end whiteCardContainer */}

        {/* ── Bottom nav ──────────────────────────────────────────────── */}
        <View style={styles.quickNavContainer}>
          {[
            { icon: 'home',              label: 'Home',    screen: 'Home' },
            { icon: 'albums',            label: 'Cards',   screen: 'FlashcardScreen' },
            { icon: 'book',              label: 'Words',   screen: 'WordlistScreen' },
            { icon: 'sparkles',          label: 'Reading', screen: null },
            { icon: 'checkmark-circle',  label: 'Quiz',    screen: 'VocabQuizScreen' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickNavBtn}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.screen === null ? '#667eea' : '#919191'}
              />
              <Text style={[styles.quickNavText, item.screen === null && { color: '#667eea' }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },

  // Header
  headerSection: { width: '100%', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  reloadBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  aiBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  aiBadgeText: { color: '#fbbf24', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginLeft: 4 },
  appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },

  // Timer badge in header
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  timerText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Difficulty filter row
  filterRow: { flexDirection: 'row', marginTop: 14, gap: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  filterChipActive: { backgroundColor: '#ffffff' },
  filterChipText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  filterChipTextActive: { color: '#4f46e5' },

  // Body container
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%' },

  // Error
  errorBox: { margin: 12, marginBottom: 0, padding: 10, borderRadius: 12, backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  errorText: { color: '#991b1b', flex: 1, fontSize: 13, fontWeight: '600' },
});

// Additional styles appended separately due to size limit
Object.assign(styles, StyleSheet.create({
  // Loading / empty
  loadingBox: { backgroundColor: '#ffffff', borderRadius: 20, alignItems: 'center', paddingVertical: 24, marginBottom: 16 },
  loadingText: { marginTop: 10, color: '#475569', fontWeight: '600' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 20, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginBottom: 16 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emptySub: { marginTop: 4, fontSize: 13, color: '#64748b', textAlign: 'center' },

  // Scroll containers
  scrollContentHistory: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, width: Platform.OS === 'web' ? 400 : screenWidth },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  scrollContentResult: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // History card
  historyCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  badgeRowContainer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  levelBadgeHistory: { backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  levelBadgeHistoryText: { fontSize: 12, fontWeight: '700', color: '#8b5cf6' },
  retakeBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  retakeBadgeText: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  historyCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  historyCardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 10 },
  historyIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  historyScore: { fontSize: 13, color: '#475569', fontWeight: '600', marginBottom: 10 },
  historyCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  startReadingBtn: { backgroundColor: '#ede9fe', paddingVertical: 7, paddingHorizontal: 16, borderRadius: 12 },
  startReadingBtnText: { color: '#6d28d9', fontWeight: '700', fontSize: 13 },

  // Generate banner
  generateBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5b4feb', borderRadius: 20, padding: 18, marginTop: 4, marginBottom: 8, gap: 12 },
  bannerIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bannerTextContainer: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  bannerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Input card
  inputCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f1f5f9', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#5b4feb', borderColor: '#5b4feb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  chipTextActive: { color: '#ffffff' },
  timeLimitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  timeLimitText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  // Generate button
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5b4feb', borderRadius: 16, paddingVertical: 15, marginBottom: 12 },
  generateButtonDisabled: { opacity: 0.5 },
  generateButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // Retake button
  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderRadius: 16, paddingVertical: 15, marginBottom: 10 },

  // Timer progress bar (top of test view)
  timerBar: { height: 4, width: '100%', backgroundColor: '#e2e8f0' },
  timerBarFill: { height: 4, borderRadius: 2 },

  // Passage card
  readingCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, marginBottom: 14 },
  readingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  readingCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  documentIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  readingCardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  ieltsBadge: { backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  ieltsBadgeText: { fontSize: 12, fontWeight: '700', color: '#6d28d9' },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 22 },

  // Quiz / questions card
  quizCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, marginBottom: 14 },
  quizTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  questionText: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1, lineHeight: 20 },
  optionsContainer: { marginTop: 8, gap: 8 },
  optionButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0' },
  optionButtonSelected: { borderColor: '#5b4feb', backgroundColor: '#ede9fe' },
  optionButtonCorrect: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  optionButtonWrong: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  optionRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  optionRadioSelected: { borderColor: '#5b4feb' },
  optionRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5b4feb' },
  optionText: { fontSize: 13, color: '#334155', flex: 1 },
  optionTextSelected: { color: '#3730a3', fontWeight: '600' },

  // Result view
  resultSummaryCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14 },
  resultSummaryTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  resultSummaryScore: { fontSize: 40, fontWeight: '800', color: '#5b4feb', lineHeight: 48 },
  resultSummarySub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  attemptLabel: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#d97706', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },

  // Review question row
  reviewQuestion: { marginBottom: 22, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14 },
  reviewQuestionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },

  // Explanation box
  explanationBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#faf5ff', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  explanationText: { fontSize: 13, color: '#6b21a8', lineHeight: 19, flex: 1 },

  // Bottom nav
  quickNavContainer: { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  quickNavBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  quickNavText: { fontSize: 11, color: '#919191', marginTop: 3 },

  // Level difficulty chips (A1–C2) in input view
  levelChip: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  levelChipText: { fontSize: 13, fontWeight: '700' },

  // ── History view redesign ──────────────────────────────────────────────────

  // Sticky Generate button at top of history view
  stickyGenerateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5b4feb', marginHorizontal: 16, marginTop: 12, marginBottom: 6, paddingVertical: 13, borderRadius: 16 },
  stickyGenerateBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // Search bar
  searchBarRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', marginHorizontal: 16, marginVertical: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },

  // Horizontal filter chips inside body (not header)
  historyFilterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  historyChip: { backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  historyChipActive: { backgroundColor: '#5b4feb', borderColor: '#5b4feb' },
  historyChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  historyChipTextActive: { color: '#ffffff' },

  // Count label above the list
  historyCountLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 8, marginTop: 4 },

  // Compact card
  compactCard: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  compactCardBar: { width: 5, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  compactCardBody: { flex: 1, padding: 12 },
  compactCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  compactLevelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  compactLevelText: { fontSize: 11, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  compactCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', lineHeight: 20, marginBottom: 6 },
  compactCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactScore: { fontSize: 12, fontWeight: '700', color: '#5b4feb', backgroundColor: '#ede9fe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  compactDate: { fontSize: 11, color: '#94a3b8', flex: 1 },
  compactArrow: { marginLeft: 'auto' },

  // Load more button
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: '#ede9fe', marginTop: 4, marginBottom: 8 },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: '#5b4feb' },

  // Vocabulary preview from topic
  vocabLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  vocabLoadingText: { fontSize: 13, color: '#64748b' },
  vocabPreviewBox: { backgroundColor: '#f5f3ff', borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#ddd6fe' },
  vocabPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  vocabPreviewTitle: { fontSize: 12, fontWeight: '700', color: '#5b4feb' },
  vocabTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vocabTag: { backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#c4b5fd', maxWidth: '48%' },
  vocabTagWord: { fontSize: 13, fontWeight: '700', color: '#3730a3' },
  vocabTagMeaning: { fontSize: 11, color: '#6b7280', marginTop: 1 },

  // Manual text input for vocabulary
  manualInput: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 12, fontSize: 13, color: '#1e293b', minHeight: 72, marginBottom: 10 },

  // Combined vocab count preview
  combinedPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  combinedPreviewText: { fontSize: 12, fontWeight: '600', color: '#15803d', flex: 1 },

  // Deck source banner (shown in input view when launched from a deck card)
  deckSourceBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#ede9fe', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1.5, borderColor: '#c4b5fd' },
  deckSourceTitle: { fontSize: 13, fontWeight: '700', color: '#4f46e5', marginBottom: 3 },
  deckSourceSub: { fontSize: 11, color: '#6d28d9', lineHeight: 16 },
}));
