import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, StatusBar, Platform,
  TouchableOpacity, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import {
  getRandomWords,
  createFlashcardSession, completeFlashcardSession,
  createFlashcardProgress, updateFlashcardProgress,
} from '../api';

const CARDS_PER_SESSION = 15;

export default function FlashcardScreen({ navigation }) {
  const { userId, topics, topicsLoading, topicsError, loadTopics } = useData();

  // ── Screen phase: 'select' | 'study' | 'done' ──────────────────────────────
  const [phase,         setPhase]         = useState('select');
  const [selectedTopic, setSelectedTopic] = useState(null);

  // ── Session data ────────────────────────────────────────────────────────────
  const [cards,         setCards]         = useState([]);
  const [progressIds,   setProgressIds]   = useState({}); // word_id → progress_id
  const [sessionId,     setSessionId]     = useState(null);
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [showMeaning,   setShowMeaning]   = useState(false);
  const [ratings,       setRatings]       = useState({}); // word_id → rating
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (topics.length === 0) loadTopics();
  }, []);

  // ── Start session ────────────────────────────────────────────────────────────
  const startSession = useCallback(async (topic) => {
    try {
      setLoading(true);
      setError('');
      const words = await getRandomWords(topic.topic_id, CARDS_PER_SESSION);
      if (!words.length) throw new Error('No words found for this topic.');

      const session = await createFlashcardSession(userId, topic.topic_id, words.length);

      // Pre-create a progress record for each card
      const pIds = {};
      for (const w of words) {
        const prog = await createFlashcardProgress(session.session_id, w.word_id);
        pIds[w.word_id] = prog.progress_id;
      }

      setCards(words);
      setProgressIds(pIds);
      setSessionId(session.session_id);
      setCurrentIndex(0);
      setShowMeaning(false);
      setRatings({});
      setSelectedTopic(topic);
      setPhase('study');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Flip card ────────────────────────────────────────────────────────────────
  const handleFlip = useCallback(async () => {
    if (showMeaning) return;
    setShowMeaning(true);
    const card = cards[currentIndex];
    const pid  = progressIds[card.word_id];
    if (pid) {
      try { await updateFlashcardProgress(pid, { is_flipped: true }); }
      catch (e) { console.warn('flip progress:', e.message); }
    }
  }, [showMeaning, cards, currentIndex, progressIds]);

  // ── Rate & advance ───────────────────────────────────────────────────────────
  const handleRate = useCallback(async (rating) => {
    const card = cards[currentIndex];
    const pid  = progressIds[card.word_id];
    const newRatings = { ...ratings, [card.word_id]: rating };
    setRatings(newRatings);

    if (pid) {
      try { await updateFlashcardProgress(pid, { difficulty_rating: rating }); }
      catch (e) { console.warn('rate progress:', e.message); }
    }

    const next = currentIndex + 1;
    if (next >= cards.length) {
      // complete session
      try { if (sessionId) await completeFlashcardSession(sessionId); }
      catch (e) { console.warn('complete session:', e.message); }
      setPhase('done');
    } else {
      setCurrentIndex(next);
      setShowMeaning(false);
    }
  }, [cards, currentIndex, progressIds, ratings, sessionId]);

  // ── Progress metrics ─────────────────────────────────────────────────────────
  const reviewed = currentIndex;
  const remaining = cards.length - currentIndex;
  const progressPct = cards.length > 0 ? (reviewed / cards.length) * 100 : 0;

  // ── TOPIC SELECT PHASE ───────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <View style={s.wrapper}>
        <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
          <StatusBar barStyle="light-content" />
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.headerSub}>SMARTENG</Text>
              <Text style={s.headerTitle}>Flashcards</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Choose a Topic</Text>
            {error ? (
              <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
            ) : null}

            {topicsLoading || loading ? (
              <ActivityIndicator size="large" color="#5b65d6" style={{ marginTop: 30 }} />
            ) : topics.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="albums-outline" size={40} color="#94a3b8" />
                <Text style={s.emptyText}>No topics found</Text>
                <Text style={s.emptySubText}>Make sure the backend is running</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {topics.map((topic) => (
                  <TouchableOpacity
                    key={topic.topic_id}
                    style={s.topicRow}
                    onPress={() => startSession(topic)}
                  >
                    <View style={s.topicIcon}>
                      <Ionicons name="albums-outline" size={20} color="#5b65d6" />
                    </View>
                    <Text style={s.topicName} numberOfLines={1}>{topic.topic_name}</Text>
                    <Ionicons name="play-circle" size={24} color="#5b65d6" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <BottomNav navigation={navigation} active="FlashcardScreen" />
        </LinearGradient>
      </View>
    );
  }

  // ── DONE PHASE ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const again  = Object.values(ratings).filter(r => r === 'again').length;
    const hard   = Object.values(ratings).filter(r => r === 'hard').length;
    const good   = Object.values(ratings).filter(r => r === 'good').length;
    const easy   = Object.values(ratings).filter(r => r === 'easy').length;

    return (
      <View style={s.wrapper}>
        <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
          <StatusBar barStyle="light-content" />
          <View style={s.header}>
            <TouchableOpacity onPress={() => setPhase('select')} style={s.iconBtn}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.headerSub}>{selectedTopic?.topic_name?.toUpperCase()}</Text>
              <Text style={s.headerTitle}>Session Complete!</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <View style={[s.card, { paddingTop: 30 }]}>
            <View style={s.doneCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            </View>
            <Text style={s.doneTitle}>{cards.length} cards reviewed</Text>
            <Text style={s.doneSub}>{selectedTopic?.topic_name}</Text>

            <View style={s.ratingRow}>
              {[
                { label: 'Again', count: again,  color: '#ef4444', bg: '#fee2e2' },
                { label: 'Hard',  count: hard,   color: '#f97316', bg: '#ffedd5' },
                { label: 'Good',  count: good,   color: '#3b82f6', bg: '#dbeafe' },
                { label: 'Easy',  count: easy,   color: '#22c55e', bg: '#dcfce7' },
              ].map((item) => (
                <View key={item.label} style={[s.ratingCard, { backgroundColor: item.bg }]}>
                  <Text style={[s.ratingCount, { color: item.color }]}>{item.count}</Text>
                  <Text style={[s.ratingLabel, { color: item.color }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.restartBtn} onPress={() => startSession(selectedTopic)}>
              <Ionicons name="reload" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={s.restartText}>Study Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhase('select')} style={s.backLink}>
              <Text style={s.backLinkText}>Choose another topic</Text>
            </TouchableOpacity>
          </View>

          <BottomNav navigation={navigation} active="FlashcardScreen" />
        </LinearGradient>
      </View>
    );
  }

  // ── STUDY PHASE ──────────────────────────────────────────────────────────────
  const card = cards[currentIndex];

  return (
    <View style={s.wrapper}>
      <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setPhase('select')} style={s.iconBtn}>
            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerSub}>{selectedTopic?.topic_name?.toUpperCase()}</Text>
            <Text style={s.headerTitle}>Session</Text>
          </View>
          <View style={s.iconBtn} />
        </View>

        {/* Progress bar */}
        <View style={s.progressSection}>
          <View style={s.progressRow}>
            <Text style={s.progressLabel}>{reviewed} reviewed</Text>
            <Text style={s.progressLabel}>{remaining} left</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        {/* Stats pills */}
        <View style={s.pillsRow}>
          <View style={s.pill}>
            <Ionicons name="book-outline" size={14} color="#0f172a" />
            <Text style={s.pillText}>New <Text style={{ fontWeight: '700' }}>{cards.length - Object.keys(ratings).length}</Text></Text>
          </View>
          <View style={s.pill}>
            <Ionicons name="copy-outline" size={14} color="#0f172a" />
            <Text style={s.pillText}>Done <Text style={{ fontWeight: '700' }}>{Object.keys(ratings).length}</Text></Text>
          </View>
          <View style={s.pill}>
            <Ionicons name="star-outline" size={14} color="#eab308" />
            <Text style={s.pillText}>Total <Text style={{ fontWeight: '700' }}>{cards.length}</Text></Text>
          </View>
        </View>

        {/* Card area */}
        <View style={s.card}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={s.flashcard}>
              {/* Tags */}
              <View style={s.cardHeader}>
                <View style={s.tags}>
                  {card.part_of_speech && (
                    <View style={s.tag}><Text style={s.tagText}>{card.part_of_speech}</Text></View>
                  )}
                  {card.topic_id && (
                    <View style={s.tag}><Text style={s.tagText}>#{card.topic_id}</Text></View>
                  )}
                </View>
              </View>

              {/* Word */}
              <Text style={s.mainWord}>{card.word}</Text>

              {/* Phonetic */}
              <View style={s.phoneticRow}>
                {card.phonetic ? (
                  <Text style={s.phoneticText}>/{card.phonetic}/</Text>
                ) : null}
                {card.part_of_speech ? (
                  <Text style={s.pos}>{card.part_of_speech}</Text>
                ) : null}
              </View>

              <View style={s.divider} />

              {/* Front / Back */}
              {!showMeaning ? (
                <TouchableOpacity style={s.hiddenBox} onPress={handleFlip}>
                  <Ionicons name="eye-outline" size={22} color="#94a3b8" />
                  <Text style={s.hintText}>Tap to reveal meaning</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <View style={s.meaningBox}>
                    <Text style={s.meaningText}>{card.meaning_vi}</Text>
                  </View>
                  <View style={s.exampleBox}>
                    <Text style={s.exLabel}>E.G.</Text>
                    <Text style={s.exText}>{card.example_en}</Text>
                    {card.example_vi ? (
                      <Text style={s.exViText}>{card.example_vi}</Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            {/* Action row */}
            {!showMeaning ? (
              <View style={s.actionRow}>
                <TouchableOpacity style={s.actionBtn} onPress={handleFlip}>
                  <Ionicons name="eye-outline" size={20} color="#5b65d6" />
                  <Text style={s.actionText}>Reveal answer</Text>
                </TouchableOpacity>
                <View style={s.vDivider} />
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => {
                    const next = currentIndex + 1;
                    if (next >= cards.length) setPhase('done');
                    else { setCurrentIndex(next); setShowMeaning(false); }
                  }}
                >
                  <Ionicons name="play-skip-forward-outline" size={18} color="#64748b" />
                  <Text style={[s.actionText, { color: '#64748b' }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.ratingButtons}>
                {[
                  { key: 'again', label: 'Again', color: '#ef4444', bg: '#fee2e2' },
                  { key: 'hard',  label: 'Hard',  color: '#f97316', bg: '#ffedd5' },
                  { key: 'good',  label: 'Good',  color: '#3b82f6', bg: '#dbeafe' },
                  { key: 'easy',  label: 'Easy',  color: '#22c55e', bg: '#dcfce7' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.rateBtn, { backgroundColor: item.bg }]}
                    onPress={() => handleRate(item.key)}
                  >
                    <View style={[s.rateDot, { backgroundColor: item.color }]} />
                    <Text style={[s.rateLabel, { color: item.color }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        <BottomNav navigation={navigation} active="FlashcardScreen" />
      </LinearGradient>
    </View>
  );
}

// ── Shared bottom nav ─────────────────────────────────────────────────────────
function BottomNav({ navigation, active }) {
  const items = [
    { icon: 'home',             label: 'Home',    screen: 'Home'            },
    { icon: 'albums',           label: 'Cards',   screen: 'FlashcardScreen' },
    { icon: 'book',             label: 'Words',   screen: 'WordlistScreen'  },
    { icon: 'sparkles',         label: 'Reading', screen: 'AIReadingScreen' },
    { icon: 'checkmark-circle', label: 'Quiz',    screen: 'VocabQuizScreen' },
  ];
  return (
    <View style={s.bottomNav}>
      {items.map((item) => {
        const isActive = item.screen === active;
        return (
          <TouchableOpacity
            key={item.label}
            style={s.navItem}
            onPress={() => item.screen && item.screen !== active && navigation.navigate(item.screen)}
          >
            <Ionicons name={item.icon} size={20} color={isActive ? '#667eea' : '#919191'} />
            <Text style={[s.navLabel, isActive && { color: '#667eea' }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phone:        { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerSub:    { color: '#cbd5e1', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  progressSection: { paddingHorizontal: 24, marginBottom: 14 },
  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:{ color: '#ffffff', fontSize: 12, fontWeight: '500' },
  progressBg:   { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#fbbf24', borderRadius: 3 },
  pillsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8, paddingHorizontal: 20 },
  pill:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 5 },
  pillText:     { fontSize: 12, color: '#1e293b' },
  card:         { flex: 1, backgroundColor: '#F0F2FF', width: '100%', paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  emptyBox:     { alignItems: 'center', paddingVertical: 30 },
  emptyText:    { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 10 },
  emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  topicRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  topicIcon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  topicName:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  // Flashcard
  flashcard:    { backgroundColor: '#ffffff', borderRadius: 24, padding: 22, marginBottom: 16 },
  cardHeader:   { marginBottom: 14 },
  tags:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:          { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#93c5fd' },
  tagText:      { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  mainWord:     { fontSize: 32, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  phoneticRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  phoneticText: { fontSize: 15, color: '#475569' },
  pos:          { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  divider:      { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  hiddenBox:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  hintText:     { color: '#94a3b8', fontSize: 14 },
  meaningBox:   { backgroundColor: '#e0f2fe', padding: 14, borderRadius: 14, marginBottom: 14 },
  meaningText:  { fontSize: 15, color: '#0f172a', lineHeight: 22 },
  exampleBox:   { paddingHorizontal: 2 },
  exLabel:      { fontSize: 13, color: '#3b82f6', fontWeight: '700', marginBottom: 4 },
  exText:       { fontSize: 14, color: '#475569', fontStyle: 'italic', lineHeight: 20 },
  exViText:     { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  // Action row
  actionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 8 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  actionText:   { fontSize: 14, fontWeight: '600', color: '#5b65d6' },
  vDivider:     { width: 1, height: 16, backgroundColor: '#cbd5e1' },
  ratingButtons:{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  rateBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, gap: 5 },
  rateDot:      { width: 8, height: 8, borderRadius: 4 },
  rateLabel:    { fontSize: 12, fontWeight: '700' },
  // Done screen
  doneCircle:   { alignItems: 'center', marginBottom: 12 },
  doneTitle:    { fontSize: 22, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  doneSub:      { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  ratingRow:    { flexDirection: 'row', gap: 8, width: '100%', marginBottom: 24 },
  ratingCard:   { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  ratingCount:  { fontSize: 20, fontWeight: '800' },
  ratingLabel:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  restartBtn:   { flexDirection: 'row', backgroundColor: '#5b65d6', paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 12 },
  restartText:  { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  backLink:     { alignItems: 'center', paddingVertical: 8 },
  backLinkText: { color: '#5b65d6', fontWeight: '600', fontSize: 14 },
  // Bottom nav
  bottomNav:    { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  navItem:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navLabel:     { fontSize: 11, color: '#919191', marginTop: 3 },
});
