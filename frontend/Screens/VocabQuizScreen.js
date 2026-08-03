import React, { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet, Text, View, ScrollView, StatusBar, Platform,
  Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import { getUserStats } from '../api';

const TOPICS_PER_PAGE = 5;

export default function VocabQuizScreen({ navigation }) {
  const { userId, topics, topicsLoading, loadTopics } = useData();

  const [selectedTopic,  setSelectedTopic]  = useState(null);
  const [selectedMode,   setSelectedMode]   = useState('mc');
  const [viewState,      setViewState]      = useState('select_deck'); // 'select_deck' | 'select_mode'

  // Topic list paging / collapse (same pattern as FlashcardScreen)
  const [topicsExpanded,      setTopicsExpanded]      = useState(true);
  const [visibleTopicsCount,  setVisibleTopicsCount]  = useState(TOPICS_PER_PAGE);
  const visibleTopics = topics.slice(0, visibleTopicsCount);

  const [userStats,      setUserStats]      = useState(null);
  const [statsLoading,   setStatsLoading]   = useState(true);

  // ── Load user stats ─────────────────────────────────────────────────────────
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

  // ── Navigation ───────────────────────────────────────────────────────────────
  const modeScreenMap = {
    mc:    'QuizMultipleChoice',
    fill:  'QuizFillInBlank',
    match: 'QuizMatching',
    speed: 'QuizSpeedRound',
  };

  const modeTypeMap = {
    mc:    'multiple_choice',
    fill:  'fill_blank',
    match: 'word_matching',
    speed: 'speed_round',
  };

  const handleStartQuiz = () => {
    if (!selectedTopic) return;
    const screenName = modeScreenMap[selectedMode];
    navigation.navigate(screenName, {
      topicId:    selectedTopic.topic_id,
      topicTitle: selectedTopic.topic_name,
      quizType:   modeTypeMap[selectedMode],
      userId,
    });
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setViewState('select_mode');
  };

  // ── Header back handler ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (viewState === 'select_deck') navigation.goBack();
    else setViewState('select_deck');
  };

  // ── Derived stats values ─────────────────────────────────────────────────────
  const totalQuizzes  = userStats?.total_quizzes   ?? 0;
  const avgScore      = userStats?.average_score   ?? 0;
  const englishLevel  = userStats
    ? (/* try to get from parent user object */ 'B1')
    : '—';

  return (
    <View style={styles.webWrapper}>
      <LinearGradient
        colors={['#16A487', '#3FC5B7']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={styles.phoneContainer}
      >
        <StatusBar barStyle="light-content" />

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.appName}>Vocabulary Quiz</Text>
            <Text style={styles.appSubtitle}>
              {viewState === 'select_deck'
                ? 'Select a topic'
                : selectedTopic?.topic_name || 'Choose mode'}
            </Text>
          </View>
        </View>

        {/* ── SELECT TOPIC ───────────────────────────────────────────────── */}
        {viewState === 'select_deck' && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.whiteCardContainer}>
              {/* Stats row */}
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

              {/* Topic list */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Choose a Topic</Text>
                  <TouchableOpacity
                    style={styles.sectionToggleBtn}
                    activeOpacity={0.7}
                    onPress={() => setTopicsExpanded((prev) => !prev)}
                  >
                    <Ionicons
                      name={topicsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#16A487"
                    />
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
                      <TouchableOpacity
                        key={topic.topic_id}
                        style={[
                          styles.deckCard,
                          selectedTopic?.topic_id === topic.topic_id && styles.deckCardActive,
                        ]}
                        onPress={() => handleSelectTopic(topic)}
                      >
                        <View style={styles.deckCardLeft}>
                          <View style={[styles.deckIcon, { backgroundColor: '#E3D5FF' }]}>
                            <Ionicons name="clipboard-outline" size={20} color="#5500FF" />
                          </View>
                          <Text style={styles.deckTitle}>{topic.topic_name}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}

                    {topics.length > visibleTopics.length && (
                      <TouchableOpacity
                        style={styles.showMoreBtn}
                        activeOpacity={0.8}
                        onPress={() => setVisibleTopicsCount((prev) => prev + TOPICS_PER_PAGE)}
                      >
                        <Ionicons name="chevron-down" size={16} color="#16A487" />
                        <Text style={styles.showMoreText}>
                          Show more ({topics.length - visibleTopics.length} remaining)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}

        {/* ── SELECT MODE ────────────────────────────────────────────────── */}
        {viewState === 'select_mode' && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.whiteCardContainer}>
              {/* Selected topic banner */}
              <View style={styles.topicBanner}>
                <Ionicons name="clipboard-outline" size={16} color="#ffffff" />
                <Text style={styles.topicBannerText}>{selectedTopic?.topic_name}</Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Quiz Mode</Text>

                {[
                  { key: 'mc',    label: 'Multiple Choice', sub: 'Pick correct definition', icon: 'checkbox-outline',        bg: '#E3D5FF', color: '#5500FF' },
                  { key: 'fill',  label: 'Fill in the blank', sub: 'Complete the sentence',  icon: 'create-outline',          bg: '#85FFC3', color: '#16A487' },
                  { key: 'match', label: 'Word Matching',   sub: 'Drag and match pairs',    icon: 'git-compare-outline',      bg: '#A7CDFE', color: '#006FFF' },
                  { key: 'speed', label: 'Speed Round',     sub: 'Time restriction',        icon: 'flash-outline',            bg: '#FFF9A5', color: '#FFCE0A' },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeCard, selectedMode === m.key && styles.modeCardActive]}
                    onPress={() => setSelectedMode(m.key)}
                  >
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

              <TouchableOpacity style={styles.startBtn} onPress={handleStartQuiz}>
                <Ionicons name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.startBtnText}>Start Quiz</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── BOTTOM NAV ─────────────────────────────────────────────────── */}
        <View style={styles.bottomNav}>
          {[
            { icon: 'home',            label: 'Home',    screen: 'Home'           },
            { icon: 'albums',          label: 'Cards',   screen: 'FlashcardScreen'},
            { icon: 'book',            label: 'Words',   screen: 'WordlistScreen' },
            { icon: 'sparkles',        label: 'Reading', screen: 'AIReadingScreen'},
            { icon: 'checkmark-circle',label: 'Quiz',    screen: null             },
          ].map((item) => {
            const active = item.screen === null;
            return (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}
              >
                <Ionicons name={item.icon} size={20} color={active ? '#667eea' : '#919191'} />
                <Text style={[styles.navLabel, active && { color: '#667eea' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12 },
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
  modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  modeCardActive: { borderColor: '#16A487', backgroundColor: '#f0fdf4' },
  modeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  modeSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1' },
  radioActive: { borderColor: '#16A487', backgroundColor: '#16A487' },
  startBtn: { flexDirection: 'row', justifyContent: 'center', width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  startBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  bottomNav: { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navLabel: { fontSize: 11, color: '#919191', marginTop: 3 },
});
