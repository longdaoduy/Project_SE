import React, { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet, Text, View, ScrollView, StatusBar, Platform,
  Image, TouchableOpacity, ActivityIndicator, TextInput, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import { getUserStats, getWords } from '../api';

const TOPICS_PER_PAGE = 5;

export default function VocabQuizScreen({ navigation, route }) {
  const { userId, topics, topicsLoading, loadTopics, decks } = useData();

  const routeDeckWords = route.params?.deckWords || null;
  const routeDeckTitle = route.params?.deckTitle || null;

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [selectedMode, setSelectedMode] = useState('mc');
  const [viewState, setViewState] = useState(routeDeckWords ? 'select_mode' : 'select_deck');
  const [numQuestions, setNumQuestions] = useState('10');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [visibleTopicsCount, setVisibleTopicsCount] = useState(TOPICS_PER_PAGE);
  const [userStats, setUserStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [topicWordCount, setTopicWordCount] = useState(null); // actual word count fetched from backend
  const [countLoading, setCountLoading] = useState(false);

  const visibleTopics = topics.slice(0, visibleTopicsCount);
  const isUserDeckSource = Boolean(routeDeckWords || selectedDeck?.words);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await getUserStats(userId);
      setUserStats(data);
    } catch (e) {
      console.warn('fetchStats:', e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
    if (topics.length === 0) loadTopics();
  }, []);

  // User-created flashcards do not provide reliable example sentences, so this
  // quiz mode is only available for the built-in topic decks.
  useEffect(() => {
    if (isUserDeckSource && selectedMode === 'fill') setSelectedMode('mc');
  }, [isUserDeckSource, selectedMode]);

  const modeScreenMap = {
    mc: 'QuizMultipleChoice',
    fill: 'QuizFillInBlank',
    match: 'QuizMatching',
    speed: 'QuizSpeedRound',
  };

  const modeTypeMap = {
    mc: 'multiple_choice',
    fill: 'fill_blank',
    match: 'word_matching',
    speed: 'speed_round',
  };

  // Max questions allowed based on active source
  const getMaxQuestions = () => {
    if (routeDeckWords) return routeDeckWords.length;
    if (selectedDeck?.words) return selectedDeck.words.length;
    if (topicWordCount !== null) return topicWordCount;
    return 100;
  };

  const showAlert = (msg) => {
    setAlertMessage(msg);
    setAlertVisible(true);
  };

  const handleStartQuiz = () => {
    const activeDeckWords = routeDeckWords || selectedDeck?.words || null;
    const activeDeckTitle = routeDeckTitle || selectedDeck?.title || null;

    // For deck-based quiz: validate against deck word count
    if (activeDeckWords) {
      if (selectedMode === 'fill') {
        setSelectedMode('mc');
        showAlert('Dạng Điền vào chỗ trống chỉ dùng cho các bộ Flashcard có sẵn.');
        return;
      }
      let limitNumber = parseInt(numQuestions, 10);
      if (isNaN(limitNumber) || limitNumber <= 0) {
        showAlert('Vui lòng nhập số câu hỏi hợp lệ!');
        return;
      }
      const maxWords = activeDeckWords.length;
      if (limitNumber > maxWords) {
        setNumQuestions(String(maxWords));
        showAlert(`Bộ từ này chỉ có ${maxWords} từ.\nĐã tự động điều chỉnh về ${maxWords} câu.`);
        return;
      }
      const screenName = modeScreenMap[selectedMode];
      const quizType = modeTypeMap[selectedMode];
      navigation.navigate(screenName, {
        deckWords: activeDeckWords.slice(0, limitNumber),
        topicTitle: activeDeckTitle,
        quizType,
        userId,
        limit: limitNumber,
      });
      return;
    }

    // For topic-based quiz
    if (!selectedTopic) {
      showAlert('Vui lòng chọn một chủ đề hoặc bộ từ trước!');
      return;
    }

    let limitNumber = parseInt(numQuestions, 10);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      showAlert('Vui lòng nhập số câu hỏi hợp lệ!');
      return;
    }

    const maxWords = topicWordCount !== null ? topicWordCount : 100;
    if (limitNumber > maxWords) {
      setNumQuestions(String(maxWords));
      showAlert(`Vượt quá giới hạn! Bộ từ này chỉ có ${maxWords} từ.\nĐã tự động điều chỉnh về ${maxWords} câu.`);
      return;
    }

    const screenName = modeScreenMap[selectedMode];
    const quizType = modeTypeMap[selectedMode];
    navigation.navigate(screenName, {
      topicId: selectedTopic.topic_id,
      topicTitle: selectedTopic.topic_name,
      quizType,
      userId,
      limit: limitNumber,
    });
  };

  const handleSelectTopic = async (topic) => {
    setSelectedTopic(topic);
    setSelectedDeck(null);
    setTopicWordCount(null);
    setViewState('select_mode');
    // Fetch actual word count from backend
    try {
      setCountLoading(true);
      const words = await getWords(topic.topic_id, 500);
      const count = words.length;
      setTopicWordCount(count);
      setNumQuestions(String(Math.min(10, count)));
    } catch (e) {
      console.warn('handleSelectTopic word count:', e.message);
      setNumQuestions('10');
    } finally {
      setCountLoading(false);
    }
  };

  const handleSelectDeck = (deck) => {
    const words = (deck.terms || []).map((t, i) => ({
      word_id: `local-${deck.id}-${i}`,
      word: t.term,
      meaning_vi: t.definition,
      part_of_speech: '',
      phonetic: '',
      example_en: t.term,
      example_vi: t.definition,
      topic_id: null,
    }));
    setSelectedDeck({ ...deck, words });
    setSelectedTopic(null);
    const max = words.length;
    setNumQuestions(String(Math.min(10, max)));
    setViewState('select_mode');
  };

  const handleBack = () => {
    if (viewState === 'select_deck') navigation.goBack();
    else if (routeDeckWords) navigation.goBack();
    else setViewState('select_deck');
  };

  const totalQuizzes = userStats?.total_quizzes ?? 0;
  const avgScore = userStats?.average_score ?? 0;
  const maxAllowed = getMaxQuestions();

  return (
    <View style={styles.webWrapper}>
      <LinearGradient colors={['#16A487', '#3FC5B7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
        <StatusBar barStyle="light-content" />

        {/* HEADER */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.appName}>Vocabulary Quiz</Text>
            <Text style={styles.appSubtitle}>
              {viewState === 'select_deck'
                ? 'Select a topic or deck'
                : (routeDeckTitle || selectedDeck?.title || selectedTopic?.topic_name || 'Choose mode')}
            </Text>
          </View>
        </View>

        {/* SELECT DECK / TOPIC VIEW */}
        {viewState === 'select_deck' && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.whiteCardContainer}>
              <View style={styles.statsRow}>
                <View style={styles.statsCard}>
                  <Image source={require('../assets/trophy.png')} style={{ width: 25, height: 25, marginBottom: 4, resizeMode: 'contain' }} />
                  <Text style={styles.statsValue}>{statsLoading ? '—' : totalQuizzes}</Text>
                  <Text style={styles.statsLabel}>Quizzes</Text>
                </View>
                <View style={styles.statsCard}>
                  <Image source={require('../assets/target.png')} style={{ width: 22, height: 22, marginBottom: 4, resizeMode: 'contain' }} />
                  <Text style={styles.statsValue}>{statsLoading ? '—' : `${Math.round(avgScore)}%`}</Text>
                  <Text style={styles.statsLabel}>Avg Score</Text>
                </View>
                <View style={styles.statsCard}>
                  <Image source={require('../assets/star.png')} style={{ width: 24, height: 24, marginBottom: 4, resizeMode: 'contain' }} />
                  <Text style={styles.statsValue}>{statsLoading ? '—' : (userStats?.total_xp ?? 0)}</Text>
                  <Text style={styles.statsLabel}>Total XP</Text>
                </View>
              </View>

              {decks.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Your Decks</Text>
                  {decks.map((deck) => (
                    <TouchableOpacity key={deck.id}
                      style={[styles.deckCard, selectedDeck?.id === deck.id && styles.deckCardActive]}
                      onPress={() => handleSelectDeck(deck)}>
                      <View style={styles.deckCardLeft}>
                        <View style={[styles.deckIcon, { backgroundColor: '#e0e7ff' }]}>
                          <Ionicons name="clipboard-outline" size={20} color="#4f46e5" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.deckTitle}>{deck.title}</Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{(deck.terms || []).length} words</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Choose a Topic</Text>
                  <TouchableOpacity style={styles.sectionToggleBtn} activeOpacity={0.7}
                    onPress={() => setTopicsExpanded((prev) => !prev)}>
                    <Ionicons name={topicsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#16A487" />
                  </TouchableOpacity>
                </View>

                {topicsLoading ? (
                  <ActivityIndicator size="large" color="#16A487" style={{ marginTop: 20 }} />
                ) : topics.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="albums-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyText}>No topics available</Text>
                    <Text style={styles.emptySubText}>Start the backend and seed the database</Text>
                  </View>
                ) : topicsExpanded ? (
                  <>
                    {visibleTopics.map((topic) => (
                      <TouchableOpacity key={topic.topic_id}
                        style={[styles.deckCard, selectedTopic?.topic_id === topic.topic_id && styles.deckCardActive]}
                        onPress={() => handleSelectTopic(topic)}>
                        <View style={styles.deckCardLeft}>
                          <View style={[styles.deckIcon, { backgroundColor: '#E3D5FF' }]}>
                            <Ionicons name="clipboard-outline" size={20} color="#5500FF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.deckTitle}>{topic.topic_name}</Text>
                            {(topic.total_words || topic.word_count) ? (
                              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                                {topic.total_words || topic.word_count} words
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                    {topics.length > visibleTopics.length && (
                      <TouchableOpacity style={styles.showMoreBtn} activeOpacity={0.8}
                        onPress={() => setVisibleTopicsCount((prev) => prev + TOPICS_PER_PAGE)}>
                        <Ionicons name="chevron-down" size={16} color="#16A487" />
                        <Text style={styles.showMoreText}>Show more ({topics.length - visibleTopics.length} remaining)</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}

        {/* SELECT MODE VIEW */}
        {viewState === 'select_mode' && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.whiteCardContainer}>
              {/* Source banner */}
              <View style={styles.topicBanner}>
                <Ionicons name="clipboard-outline" size={16} color="#ffffff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.topicBannerText}>
                    {routeDeckTitle || selectedDeck?.title || selectedTopic?.topic_name || '—'}
                  </Text>
                  {(routeDeckWords || selectedDeck?.words) ? (
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                      {(routeDeckWords || selectedDeck?.words || []).length} words · Your Deck
                    </Text>
                  ) : selectedTopic && (selectedTopic.total_words || selectedTopic.word_count) ? (
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                      {selectedTopic.total_words || selectedTopic.word_count} words available
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Quiz Mode */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Quiz Mode</Text>
                {[
                  { key: 'mc', label: 'Multiple Choice', sub: 'Pick correct definition', icon: 'checkbox-outline', bg: '#E3D5FF', color: '#5500FF' },
                  { key: 'fill', label: 'Fill in the blank', sub: 'Complete the sentence', icon: 'create-outline', bg: '#85FFC3', color: '#16A487' },
                  { key: 'match', label: 'Word Matching', sub: 'Match words with meaning', icon: 'git-compare-outline', bg: '#A7CDFE', color: '#006FFF' },
                  { key: 'speed', label: 'Speed Round', sub: 'Race against the clock', icon: 'flash-outline', bg: '#FFF9A5', color: '#FFCE0A' },
                ].filter((m) => !isUserDeckSource || m.key !== 'fill').map((m) => (
                  <TouchableOpacity key={m.key}
                    style={[styles.modeCard, selectedMode === m.key && styles.modeCardActive]}
                    onPress={() => setSelectedMode(m.key)}>
                    <View style={[styles.modeIcon, { backgroundColor: m.bg }]}>
                      <Ionicons name={m.icon} size={20} color={m.color} />
                    </View>
                    <View style={styles.modeInfo}>
                      <Text style={styles.modeTitle}>{m.label}</Text>
                      <Text style={styles.modeSub}>{m.sub}</Text>
                    </View>
                    <View style={[styles.radio, selectedMode === m.key && styles.radioActive]} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Number of Questions */}
              <View style={styles.sectionBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Number of Questions</Text>
                  <Text style={styles.maxHint}>Max: {maxAllowed}</Text>
                </View>

                <View style={styles.inputRow}>
                  <TouchableOpacity style={styles.stepBtn}
                    onPress={() => setNumQuestions(prev => String(Math.max(1, parseInt(prev || '1', 10) - 1)))}>
                    <Ionicons name="remove" size={18} color="#16A487" />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.numInput}
                    keyboardType="numeric"
                    value={String(numQuestions)}
                    onChangeText={(text) => {
                      const n = text.replace(/[^0-9]/g, '');
                      setNumQuestions(n);
                    }}
                    onBlur={() => {
                      const n = parseInt(numQuestions, 10);
                      if (isNaN(n) || n <= 0) { setNumQuestions('1'); return; }
                      if (n > maxAllowed) { setNumQuestions(String(maxAllowed)); }
                    }}
                    placeholder="10"
                    placeholderTextColor="#94a3b8"
                    textAlign="center"
                  />

                  <TouchableOpacity style={styles.stepBtn}
                    onPress={() => setNumQuestions(prev => String(Math.min(maxAllowed, parseInt(prev || '0', 10) + 1)))}>
                    <Ionicons name="add" size={18} color="#16A487" />
                  </TouchableOpacity>
                </View>

                {/* Quick-select chips */}
                <View style={styles.chipRow}>
                  {[5, 10, 15, 20].filter(n => n <= maxAllowed).map(n => (
                    <TouchableOpacity key={n}
                      style={[styles.chip, String(numQuestions) === String(n) && styles.chipActive]}
                      onPress={() => setNumQuestions(String(n))}>
                      <Text style={[styles.chipText, String(numQuestions) === String(n) && styles.chipTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                  {maxAllowed > 20 && (
                    <TouchableOpacity
                      style={[styles.chip, String(numQuestions) === String(maxAllowed) && styles.chipActive]}
                      onPress={() => setNumQuestions(String(maxAllowed))}>
                      <Text style={[styles.chipText, String(numQuestions) === String(maxAllowed) && styles.chipTextActive]}>All ({maxAllowed})</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity style={styles.startBtn} onPress={handleStartQuiz}>
                <Ionicons name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.startBtnText}>Start Quiz</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* BOTTOM NAV */}
        <View style={styles.bottomNav}>
          {[
            { icon: 'home', label: 'Home', screen: 'Home' },
            { icon: 'albums', label: 'Cards', screen: 'FlashcardScreen' },
            { icon: 'book', label: 'Words', screen: 'WordlistScreen' },
            { icon: 'sparkles', label: 'Reading', screen: 'AIReadingScreen' },
            { icon: 'checkmark-circle', label: 'Quiz', screen: null },
          ].map((item) => {
            const active = item.screen === null;
            return (
              <TouchableOpacity key={item.label} style={styles.navItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}>
                <Ionicons name={item.icon} size={20} color={active ? '#667eea' : '#919191'} />
                <Text style={[styles.navLabel, active && { color: '#667eea' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* ALERT MODAL */}
      <Modal transparent visible={alertVisible} animationType="fade" onRequestClose={() => setAlertVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="warning" size={32} color="#f59e0b" />
            </View>
            <Text style={styles.modalTitle}>Thông báo</Text>
            <Text style={styles.modalMsg}>{alertMessage}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setAlertVisible(false)}>
              <Text style={styles.modalBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden', ...Platform.select({ web: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 } }) },
  scrollContainer: { flexGrow: 1 },
  headerSection: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16 },
  appName: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  appSubtitle: { fontSize: 14, color: '#e2e8f0' },
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', minHeight: 400, alignItems: 'center', paddingHorizontal: 24, paddingTop: 10 },
  statsRow: { flexDirection: 'row', marginTop: 16, width: '100%', gap: 8 },
  statsCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: '#ffffff' },
  statsValue: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  statsLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionBlock: { width: '100%', marginTop: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 0 },
  sectionToggleBtn: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#d9f5ef', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#99e3d5', gap: 6, marginTop: 2 },
  showMoreText: { fontSize: 14, fontWeight: '700', color: '#16A487' },
  emptyContainer: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#ffffff', borderRadius: 16, width: '100%' },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  deckCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  deckCardActive: { borderColor: '#16A487', backgroundColor: '#f0fdf4' },
  deckCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  deckIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deckTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  topicBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22,164,135,0.15)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, width: '100%', marginTop: 16, gap: 8 },
  topicBannerText: { fontSize: 14, fontWeight: '600', color: '#16A487' },
  modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0', marginTop: 12 },
  modeCardActive: { borderColor: '#16A487', backgroundColor: '#f0fdf4' },
  modeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  modeSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1' },
  radioActive: { borderColor: '#16A487', backgroundColor: '#16A487' },
  maxHint: { fontSize: 12, fontWeight: '600', color: '#16A487', backgroundColor: '#d9f5ef', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1.5, borderColor: '#16A487', overflow: 'hidden', marginBottom: 12 },
  stepBtn: { width: 46, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  numInput: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1e293b', height: 50, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { borderColor: '#16A487', backgroundColor: '#16A487' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#ffffff' },
  startBtn: { flexDirection: 'row', justifyContent: 'center', width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  startBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  bottomNav: { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navLabel: { fontSize: 11, color: '#919191', marginTop: 3 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#ffffff', padding: 24, borderRadius: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  modalMsg: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalBtn: { backgroundColor: '#16A487', width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
