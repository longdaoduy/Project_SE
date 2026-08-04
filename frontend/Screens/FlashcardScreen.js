import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, TextInput, View, StatusBar, Platform,
  TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import {
  getRandomWords,
  createFlashcardSession, completeFlashcardSession,
  createFlashcardProgress, updateFlashcardProgress,
} from '../api';
import * as Speech from 'expo-speech';

const CARDS_PER_SESSION = 15;
const TOPICS_PER_PAGE = 5;

export default function FlashcardScreen({ navigation }) {
  const { userId, topics, topicsLoading, loadTopics, decks, addDeck, deleteDeck } = useData();

  // ── Screen navigation state ─────────────────────────────────────────────────
  // viewState: 'select' (choose deck / list) | 'add' (create deck form)
  // phase:     'select' | 'study' | 'done'
  const [viewState, setViewState] = useState('select');
  const [phase, setPhase] = useState('select');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedLocalDeck, setSelectedLocalDeck] = useState(null);

  // ── Deck search / filter (for user-created decks) ───────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [visibleTopicsCount, setVisibleTopicsCount] = useState(TOPICS_PER_PAGE);
  const [topicsExpanded, setTopicsExpanded] = useState(true);

  // ── Add-deck form state ─────────────────────────────────────────────────────
  const [deckTitle, setDeckTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [termRows, setTermRows] = useState([{ id: 1, term: '', definition: '' }]);

  // ── Flashcard session state ─────────────────────────────────────────────────
  const [cards, setCards] = useState([]);
  const [progressIds, setProgressIds] = useState({}); // word_id → progress_id
  const [sessionId, setSessionId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [ratings, setRatings] = useState({}); // word_id → rating
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Hiệu ứng lật thẻ 3D ───────────────────────────────────────────────────
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipInterpolate = flipAnim.interpolate({
    inputRange: [0, 90],
    outputRange: ['0deg', '90deg']
  });

  useEffect(() => {
    if (topics.length === 0) loadTopics();
  }, []);

  // ── Deck search/filter derived values ────────────────────────────────────────
  const deckFilters = ['All', ...Array.from(new Set(decks.map((d) => d.level)))];

  const filteredDecks = decks.filter((deck) => {
    const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedFilter === 'All') return matchesSearch;
    return matchesSearch && deck.level === selectedFilter;
  });

  const filteredTopics = topics.filter((t) =>
    t.topic_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleTopics = filteredTopics.slice(0, visibleTopicsCount);

  // ── Add-deck handlers ────────────────────────────────────────────────────────
  const handleAddTermRow = () => {
    setTermRows((prev) => [...prev, { id: Date.now(), term: '', definition: '' }]);
  };

  const handleUpdateTerm = (id, field, value) => {
    setTermRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveTermRow = (id) => {
    if (termRows.length === 1) {
      Alert.alert('Cannot Remove', 'A deck needs at least one term.');
      return;
    }
    setTermRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleCreateDeck = () => {
    const trimmedTitle = deckTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing Title', 'Please enter a deck title.');
      return;
    }

    const filledRows = termRows.filter((row) => row.term.trim() && row.definition.trim());
    if (filledRows.length === 0) {
      Alert.alert('Empty Terms', 'Please add at least one term and definition.');
      return;
    }

    addDeck({
      title: trimmedTitle,
      level: 'Beginner',
      totalWords: filledRows.length,
      terms: filledRows.map((row) => ({ term: row.term.trim(), definition: row.definition.trim() })),
    });
    setDeckTitle('');
    setDescription('');
    setShowDescription(false);
    setTermRows([{ id: 1, term: '', definition: '' }]);
    setViewState('select');
  };

  const confirmDeleteDeck = (deck) => {
    Alert.alert('Delete Deck', `Delete "${deck.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(deck.id) },
    ]);
  };

  // ── Header back handler ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (phase !== 'select') {
      setPhase('select');
      return;
    }
    if (viewState === 'add') {
      setViewState('select');
      return;
    }
    navigation.goBack();
  };

  // ── Start session (backend topic) ────────────────────────────────────────────
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

  // ── Start local session (user-created deck) ─────────────────────────────────
  const startLocalSession = useCallback((deck) => {
    const words = (deck.terms || []).map((t, i) => ({
      word_id: `local-${deck.id}-${i}`,
      word: t.term,
      meaning_vi: t.definition,
      part_of_speech: '',
      phonetic: '',
      example_en: '',
      example_vi: '',
      topic_id: null,
    }));
    if (!words.length) {
      Alert.alert('Empty Deck', 'This deck has no terms yet.');
      return;
    }
    setCards(words);
    setProgressIds({});
    setSessionId(null);
    setCurrentIndex(0);
    setShowMeaning(false);
    setRatings({});
    setSelectedTopic({ topic_id: deck.id, topic_name: deck.title });
    setSelectedLocalDeck(deck);
    setPhase('study');
  }, []);

  // ── Flip card ────────────────────────────────────────────────────────────────
  // ── Flip card (Có hiệu ứng) ──────────────────────────────────────────────────
  const handleFlip = useCallback(async () => {
    if (showMeaning) return;

    // Bước 1: Xoay thẻ 90 độ (úp thẻ xuống)
    Animated.timing(flipAnim, {
      toValue: 90,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Bước 2: Khi thẻ đang ngang (không nhìn thấy), đổi nội dung
      setShowMeaning(true);

      // Bước 3: Xoay thẻ trở về 0 độ (ngửa mặt sau lên)
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });

    // Code gọi API lưu tiến độ (giữ nguyên của bạn)
    const card = cards[currentIndex];
    const pid = progressIds[card.word_id];
    if (pid) {
      try { await updateFlashcardProgress(pid, { is_flipped: true }); }
      catch (e) { console.warn('flip progress:', e.message); }
    }
  }, [showMeaning, cards, currentIndex, progressIds, flipAnim]);

  // ── Rate & advance ───────────────────────────────────────────────────────────
  const handleRate = useCallback(async (rating) => {
    const card = cards[currentIndex];
    const pid = progressIds[card.word_id];
    const newRatings = { ...ratings, [card.word_id]: rating };
    setRatings(newRatings);

    if (pid) {
      try { await updateFlashcardProgress(pid, { difficulty_rating: rating }); }
      catch (e) { console.warn('rate progress:', e.message); }
    }

    const next = currentIndex + 1;
    if (next >= cards.length) {
      // complete session (backend sessions only; local sessions skip)
      try { if (sessionId) await completeFlashcardSession(sessionId); }
      catch (e) { console.warn('complete session:', e.message); }
      setPhase('done');
    } else {
      setCurrentIndex(next);
      setShowMeaning(false);
    }
  }, [cards, currentIndex, progressIds, ratings, sessionId]);

  const handleRestart = () => {
    if (selectedLocalDeck) startLocalSession(selectedLocalDeck);
    else if (selectedTopic) startSession(selectedTopic);
  };

  // ── Phát âm từ vựng (Text-to-Speech) ─────────────────────────────────────────
  const handleSpeak = useCallback((textToSpeak) => {
    Speech.speak(textToSpeak, {
      language: 'en-US', // Giọng Anh-Mỹ
      rate: 0.9,         // Đọc chậm lại một xíu cho dễ nghe
    });
  }, []);
  // ── Progress metrics ─────────────────────────────────────────────────────────
  const reviewed = currentIndex;
  const remaining = cards.length - currentIndex;
  const progressPct = cards.length > 0 ? (reviewed / cards.length) * 100 : 0;

  // ══ ADD DECK VIEW (viewState = 'add') ════════════════════════════════════════
  if (phase === 'select' && viewState === 'add') {
    return (
      <View style={s.wrapper}>
        <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
          <StatusBar barStyle="light-content" />

          <View style={s.headerSection}>
            <View style={s.headerTopRow}>
              <TouchableOpacity onPress={() => setViewState('select')} style={s.backButton}>
                <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
              </TouchableOpacity>
              <View style={s.headerTextContainer}>
                <Text style={s.appName}>New FlashCard</Text>
                <Text style={s.subTitleText}>Create new Deck</Text>
              </View>
              <View style={s.addHeaderActions}>
                <TouchableOpacity style={s.addIconButton}>
                  <Ionicons name="settings-outline" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.addIconButton} onPress={handleCreateDeck}>
                  <Ionicons name="checkmark" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={s.card}>
              <View style={s.titleInputWrapper}>
                <TextInput
                  style={s.titleUnderlineInput}
                  placeholder="Title"
                  placeholderTextColor="#94a3b8"
                  value={deckTitle}
                  onChangeText={setDeckTitle}
                />
                <View style={s.titleUnderline} />
              </View>

              <View style={s.actionRow}>
                <View style={s.lockedScanRow}>
                  <View style={s.lockIconContainer}>
                    <Ionicons name="lock-closed" size={14} color="#1C1C2E" />
                  </View>
                  <Text style={s.lockedScanText}>Scan Document</Text>
                </View>

                <TouchableOpacity
                  style={s.descriptionButton}
                  onPress={() => setShowDescription((prev) => !prev)}
                >
                  <Ionicons name="add" size={16} color="#4f46e5" />
                  <Text style={s.descriptionButtonText}>Description</Text>
                </TouchableOpacity>
              </View>

              {showDescription && (
                <View style={s.descriptionCard}>
                  <TextInput
                    style={s.descriptionInput}
                    placeholder="Enter description..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>
              )}

              {termRows.map((row, index) => (
                <View key={row.id} style={s.termCard}>
                  <View style={s.termCardHeader}>
                    <Text style={s.termCardNumber}>#{index + 1}</Text>
                    <TouchableOpacity
                      style={s.removeTermButton}
                      onPress={() => handleRemoveTermRow(row.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>TERM</Text>
                    <TextInput
                      style={s.fieldInput}
                      placeholder="Enter term"
                      placeholderTextColor="#94a3b8"
                      value={row.term}
                      onChangeText={(value) => handleUpdateTerm(row.id, 'term', value)}
                    />
                    <View style={s.fieldDivider} />
                  </View>

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>DEFINITION</Text>
                    <TextInput
                      style={s.fieldInput}
                      placeholder="Enter definition"
                      placeholderTextColor="#94a3b8"
                      value={row.definition}
                      onChangeText={(value) => handleUpdateTerm(row.id, 'definition', value)}
                    />
                    <View style={s.fieldDivider} />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={s.fabAddTerm} activeOpacity={0.8} onPress={handleAddTermRow}>
            <Ionicons name="add" size={28} color="#ffffff" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ══ DECK SELECT VIEW (viewState = 'select', phase = 'select') ════════════════
  if (phase === 'select') {
    return (
      <View style={s.wrapper}>
        <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
          <StatusBar barStyle="light-content" />

          <View style={s.headerSection}>
            <View style={s.headerTopRow}>
              <TouchableOpacity onPress={handleBack} style={s.backButton}>
                <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
              </TouchableOpacity>
              <View style={s.headerTextContainer}>
                <Text style={s.appName}>FlashCard Decks</Text>
                <Text style={s.subTitleText}>Choose your deck to study</Text>
              </View>

              <TouchableOpacity style={s.addButton} onPress={() => setViewState('add')}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Search — always visible, glass effect on gradient */}
            <View style={s.headerSearchBox}>
              <Ionicons name="search-outline" size={18} color="#ffffff" style={s.headerSearchIcon} />
              <TextInput
                style={s.headerSearchInput}
                placeholder="Search decks..."
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <View style={s.card}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {error ? (
                <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
              ) : null}

              {/* ── My decks (user-created) ─────────────────────────────── */}
              <View style={{ width: '100%', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Your Decks</Text>

                {decks.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="albums-outline" size={40} color="#94a3b8" />
                    <Text style={s.emptyText}>You haven't created any decks</Text>
                    <Text style={s.emptySubText}>Tap + to create your first deck</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.filtersContainer}>
                      {deckFilters.map((filter) => (
                        <TouchableOpacity
                          key={filter}
                          style={[s.filterChip, selectedFilter === filter && s.filterChipActive]}
                          onPress={() => setSelectedFilter(filter)}
                        >
                          <Text style={[s.filterText, selectedFilter === filter && s.filterTextActive]}>
                            {filter}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {filteredDecks.length === 0 ? (
                      <View style={s.emptyBox}>
                        <Ionicons name="search-outline" size={36} color="#94a3b8" />
                        <Text style={s.emptyText}>No decks found</Text>
                        <Text style={s.emptySubText}>Try a different search or filter</Text>
                      </View>
                    ) : (
                      filteredDecks.map((deck) => (
                        <View key={deck.id} style={s.deckCard}>
                          <View style={s.deckHeader}>
                            <View style={s.deckIconContainer}>
                              <Ionicons name="clipboard-outline" size={24} color="#1e293b" />
                            </View>
                            <View style={s.deckTitleContainer}>
                              <Text style={s.deckTitle} numberOfLines={1}>{deck.title}</Text>
                              <View style={s.badgeContainer}>
                                <Text style={s.badgeText}>{deck.level}</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={s.deleteButton}
                              onPress={() => confirmDeleteDeck(deck)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>

                          <View style={s.progressInfo}>
                            <Text style={s.progressText}>
                              {deck.currentWords || 0} / {deck.totalWords} words
                            </Text>
                            <Text style={s.progressPercentage}>{deck.progress || 0}%</Text>
                          </View>

                          <View style={s.progressTrack}>
                            <View style={[s.progressBar, { width: `${deck.progress || 0}%` }]} />
                          </View>

                          <TouchableOpacity
                            style={s.startButton}
                            activeOpacity={0.8}
                            onPress={() => startLocalSession(deck)}
                          >
                            <Ionicons name="play-outline" size={16} color="#ffffff" />
                            <Text style={s.startButtonText}>START LEARNING</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </>
                )}
              </View>

              {/* ── Backend decks (collapsible) ─────────────────────────── */}
              <View style={s.sectionHeaderRow}>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Choose a Deck</Text>
                <TouchableOpacity
                  style={s.sectionToggleBtn}
                  activeOpacity={0.7}
                  onPress={() => setTopicsExpanded((prev) => !prev)}
                >
                  <Ionicons
                    name={topicsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#5b65d6"
                  />
                </TouchableOpacity>
              </View>

              {topicsExpanded && (
                topicsLoading || loading ? (
                  <ActivityIndicator size="large" color="#5b65d6" style={{ marginTop: 24 }} />
                ) : topics.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="albums-outline" size={40} color="#94a3b8" />
                    <Text style={s.emptyText}>No decks found</Text>
                    <Text style={s.emptySubText}>Make sure the backend is running</Text>
                  </View>
                ) : filteredTopics.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="search-outline" size={36} color="#94a3b8" />
                    <Text style={s.emptyText}>No decks match</Text>
                    <Text style={s.emptySubText}>Try a different search keyword</Text>
                  </View>
                ) : (
                  <>
                    {visibleTopics.map((topic) => (
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

                    {filteredTopics.length > visibleTopics.length && (
                      <TouchableOpacity
                        style={s.showMoreBtn}
                        activeOpacity={0.8}
                        onPress={() => setVisibleTopicsCount((prev) => prev + TOPICS_PER_PAGE)}
                      >
                        <Ionicons name="chevron-down" size={16} color="#5b65d6" />
                        <Text style={s.showMoreText}>
                          Show more ({filteredTopics.length - visibleTopics.length} remaining)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )
              )}
            </ScrollView>
          </View>

          <BottomNav navigation={navigation} active="FlashcardScreen" />
        </LinearGradient>
      </View>
    );
  }

  // ══ DONE VIEW (phase = 'done') ═══════════════════════════════════════════════
  if (phase === 'done') {
    const again = Object.values(ratings).filter(r => r === 'again').length;
    const hard = Object.values(ratings).filter(r => r === 'hard').length;
    const good = Object.values(ratings).filter(r => r === 'good').length;
    const easy = Object.values(ratings).filter(r => r === 'easy').length;

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
                { label: 'Again', count: again, color: '#ef4444', bg: '#fee2e2' },
                { label: 'Hard', count: hard, color: '#f97316', bg: '#ffedd5' },
                { label: 'Good', count: good, color: '#3b82f6', bg: '#dbeafe' },
                { label: 'Easy', count: easy, color: '#22c55e', bg: '#dcfce7' },
              ].map((item) => (
                <View key={item.label} style={[s.ratingCard, { backgroundColor: item.bg }]}>
                  <Text style={[s.ratingCount, { color: item.color }]}>{item.count}</Text>
                  <Text style={[s.ratingLabel, { color: item.color }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.restartBtn} onPress={handleRestart}>
              <Ionicons name="reload" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={s.restartText}>Study Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhase('select')} style={s.backLink}>
              <Text style={s.backLinkText}>Choose another deck</Text>
            </TouchableOpacity>
          </View>

          <BottomNav navigation={navigation} active="FlashcardScreen" />
        </LinearGradient>
      </View>
    );
  }

  // ══ STUDY VIEW (phase = 'study') ═════════════════════════════════════════════
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

            {/* THAY ĐỔI QUAN TRỌNG NHẤT Ở DÒNG NÀY: View thành Animated.View */}
            <Animated.View style={[s.flashcard, { transform: [{ perspective: 1000 }, { rotateY: flipInterpolate }] }]}>

              {/* Tags */}
              <View style={s.cardHeader}>
                <View style={s.tags}>
                  {card.part_of_speech ? (
                    <View style={s.tag}><Text style={s.tagText}>{card.part_of_speech}</Text></View>
                  ) : null}
                  {card.topic_id ? (
                    <View style={s.tag}><Text style={s.tagText}>#{card.topic_id}</Text></View>
                  ) : null}
                </View>
              </View>

              {/* Word */}
              <Text style={s.mainWord}>{card.word}</Text>

              {/* Phonetic */}
              {/* Phonetic */}
              <View style={s.phoneticRow}>
                {card.phonetic ? (
                  <Text style={s.phoneticText}>/{card.phonetic}/</Text>
                ) : null}

                {/* NÚT LOA VỪA ĐƯỢC THÊM VÀO ĐÂY */}
                <TouchableOpacity
                  onPress={() => handleSpeak(card.word)}
                  style={{ padding: 4, marginLeft: 2 }}
                >
                  <Ionicons name="volume-high" size={20} color="#5b65d6" />
                </TouchableOpacity>

                {/* Khoảng trống để đẩy Loại từ (pos) sang phải */}
                <View style={{ flex: 1 }} />

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
                  {card.example_en ? (
                    <View style={s.exampleBox}>
                      <Text style={s.exLabel}>E.G.</Text>
                      <Text style={s.exText}>{card.example_en}</Text>
                      {card.example_vi ? (
                        <Text style={s.exViText}>{card.example_vi}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}
            </Animated.View>
            {/* Action row */}
            {!showMeaning ? (
              <View style={[s.actionRow, s.actionRowCentered]}>
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
                  { key: 'hard', label: 'Hard', color: '#f97316', bg: '#ffedd5' },
                  { key: 'good', label: 'Good', color: '#3b82f6', bg: '#dbeafe' },
                  { key: 'easy', label: 'Easy', color: '#22c55e', bg: '#dcfce7' },
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
    { icon: 'home', label: 'Home', screen: 'Home' },
    { icon: 'albums', label: 'Cards', screen: 'FlashcardScreen' },
    { icon: 'book', label: 'Words', screen: 'WordlistScreen' },
    { icon: 'sparkles', label: 'Reading', screen: 'AIReadingScreen' },
    { icon: 'checkmark-circle', label: 'Quiz', screen: 'VocabQuizScreen' },
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
  wrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phone: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden' },

  // Header (left-aligned, consistent with other feature screens)
  headerSection: { flexDirection: 'column', alignItems: 'stretch', width: '100%', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerTextContainer: { marginLeft: 16, flex: 1 },
  appName: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  subTitleText: { color: '#cbd5e1', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  addButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginLeft: 'auto' },

  // Header search — glass effect, always visible
  headerSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, width: '100%', marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  headerSearchIcon: { marginRight: 8 },
  headerSearchInput: { flex: 1, fontSize: 14, color: '#ffffff' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  sectionToggleBtn: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Add-deck header actions
  addHeaderActions: { flexDirection: 'row', justifyContent: 'flex-end', marginLeft: 'auto', gap: 8 },
  addIconButton: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },

  // Session header (study/done)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  headerSub: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  progressSection: { paddingHorizontal: 24, marginBottom: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#ffffff', fontSize: 12, fontWeight: '500' },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#fbbf24', borderRadius: 3 },
  pillsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8, paddingHorizontal: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 5 },
  pillText: { fontSize: 12, color: '#1e293b' },
  card: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', paddingHorizontal: 20, paddingTop: 16 },
  scrollContainer: { flexGrow: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 10 },
  emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  topicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  topicIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  topicName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#c7d2fe', gap: 6, marginTop: 2 },
  showMoreText: { fontSize: 14, fontWeight: '700', color: '#5b65d6' },

  // Filters (user-created decks)
  filtersContainer: { flexDirection: 'row', width: '100%', marginBottom: 16, gap: 10, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#e0e7ff', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  filterChipActive: { backgroundColor: '#4f46e5' },
  filterText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },
  filterTextActive: { color: '#ffffff' },

  // User-created deck card (from PracticeScreen)
  deckCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, width: '100%', marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  deckHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deckIconContainer: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deckTitleContainer: { flex: 1, justifyContent: 'center' },
  deckTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  badgeContainer: { backgroundColor: '#dcfce7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#16a34a', fontSize: 10, fontWeight: '700' },
  deleteButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  progressPercentage: { fontSize: 12, color: '#3b82f6', fontWeight: '700' },
  progressTrack: { height: 6, width: '100%', backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  progressBar: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3 },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5', paddingVertical: 12, borderRadius: 14, gap: 6, width: '100%' },
  startButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  // Flashcard
  flashcard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 22, marginBottom: 16 },
  cardHeader: { marginBottom: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#93c5fd' },
  tagText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  mainWord: { fontSize: 32, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  phoneticRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  phoneticText: { fontSize: 15, color: '#475569' },
  pos: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  hiddenBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  hintText: { color: '#94a3b8', fontSize: 14 },
  meaningBox: { backgroundColor: '#e0f2fe', padding: 14, borderRadius: 14, marginBottom: 14 },
  meaningText: { fontSize: 15, color: '#0f172a', lineHeight: 22 },
  exampleBox: { paddingHorizontal: 2 },
  exLabel: { fontSize: 13, color: '#3b82f6', fontWeight: '700', marginBottom: 4 },
  exText: { fontSize: 14, color: '#475569', fontStyle: 'italic', lineHeight: 20 },
  exViText: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },

  // Action row (study view: centered actions; add-deck view: spaced rows)
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingVertical: 8 },
  actionRowCentered: { justifyContent: 'center', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#5b65d6' },
  vDivider: { width: 1, height: 16, backgroundColor: '#cbd5e1' },
  ratingButtons: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  rateBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, gap: 5 },
  rateDot: { width: 8, height: 8, borderRadius: 4 },
  rateLabel: { fontSize: 12, fontWeight: '700' },

  // Done screen
  doneCircle: { alignItems: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  doneSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  ratingRow: { flexDirection: 'row', gap: 8, width: '100%', marginBottom: 24 },
  ratingCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  ratingCount: { fontSize: 20, fontWeight: '800' },
  ratingLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  restartBtn: { flexDirection: 'row', backgroundColor: '#5b65d6', paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 12 },
  restartText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  backLink: { alignItems: 'center', paddingVertical: 8 },
  backLinkText: { color: '#5b65d6', fontWeight: '600', fontSize: 14 },

  // Add-deck form
  titleInputWrapper: { width: '100%', marginBottom: 24 },
  titleUnderlineInput: { fontSize: 22, fontWeight: '700', color: '#1e293b', paddingVertical: 8, textAlign: 'center', letterSpacing: 1 },
  titleUnderline: { height: 2, width: '100%', backgroundColor: '#5C5CFF', borderRadius: 1 },
  lockedScanRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockIconContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' },
  lockedScanText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  descriptionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  descriptionButtonText: { color: '#4f46e5', fontSize: 14, fontWeight: '600' },
  descriptionCard: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  descriptionInput: { color: '#1e293b', fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  termCard: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  termCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  termCardNumber: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  removeTermButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  fieldBlock: { width: '100%', paddingVertical: 10 },
  fieldLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 1, textAlign: 'center', marginBottom: 6 },
  fieldInput: { color: '#1e293b', fontSize: 16, textAlign: 'center', paddingVertical: 4 },
  fieldDivider: { height: 1, backgroundColor: '#e2e8f0', marginTop: 6 },
  fabAddTerm: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5C5CFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#5C5CFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },

  // Bottom nav
  bottomNav: { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navLabel: { fontSize: 11, color: '#919191', marginTop: 3 },
});
