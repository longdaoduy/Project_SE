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
  getFlashcardQueue,
  submitSRSRating,
  getDailyStatus,
  createFlashcardSession, completeFlashcardSession,
  createFlashcardProgress, updateFlashcardProgress,
} from '../api';
import * as Speech from 'expo-speech';

const CARDS_PER_SESSION = 15;
const TOPICS_PER_PAGE = 5;

export default function FlashcardScreen({ navigation }) {
  const { userId, topics, topicsLoading, loadTopics, decks, addDeck, saveDeckEdit, deleteDeck } = useData();

  // ── Screen navigation state ─────────────────────────────────────────────────
  // viewState: 'select' | 'add' (create/edit) | phase: 'select' | 'study' | 'done'
  const [viewState, setViewState] = useState('select');
  const [phase, setPhase] = useState('select');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedLocalDeck, setSelectedLocalDeck] = useState(null);

  // ── Deck search / filter ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Add/Edit-deck form state ─────────────────────────────────────────────────
  // editingDeck: null → CREATE mode | non-null → EDIT mode
  const [editingDeck, setEditingDeck] = useState(null);
  const [deckFormError, setDeckFormError] = useState('');
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
  const [ratings, setRatings] = useState({}); // word_id → final rating (hard/good/easy)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Per-card session tracking ─────────────────────────────────────────────────
  // cardStats: { [word_id]: { again_count, last_option, flagged_difficult } }
  //   again_count      – how many times "Again" was pressed this session (resets on success)
  //   last_option      – most recent rating selected ('again'|'hard'|'good'|'easy')
  //   flagged_difficult– true if card was EVER rated again OR hard (before final success)
  const [cardStats, setCardStats] = useState({});
  // cardStore: { [word_id]: word } – keeps word objects after they leave the queue
  const [cardStore, setCardStore] = useState({});

  // ── SRS / daily-limit state ──────────────────────────────────────────────────
  const [topicDailyStatus, setTopicDailyStatus] = useState({});
  const [cardTypes, setCardTypes] = useState({});
  const [srsResults, setSrsResults] = useState({});

  // ── Hiệu ứng lật thẻ 3D ───────────────────────────────────────────────────
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipInterpolate = flipAnim.interpolate({
    inputRange: [0, 90],
    outputRange: ['0deg', '90deg']
  });

  useEffect(() => {
    if (topics.length === 0) loadTopics();
  }, []);

  // Load daily status for all visible topics so we can show badges
  useEffect(() => {
    if (!userId || topics.length === 0) return;
    const loadStatuses = async () => {
      const results = {};
      for (const topic of topics) {
        try {
          const status = await getDailyStatus(userId, topic.topic_id);
          results[topic.topic_id] = status;
        } catch (_) { /* ignore per-topic errors */ }
      }
      setTopicDailyStatus(results);
    };
    loadStatuses();
  }, [userId, topics]);

  // ── Deck search/filter derived values ────────────────────────────────────────
  // No level filter — show all decks, just search by title
  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTopics = topics.filter((t) =>
    t.topic_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleTopics = filteredTopics.slice(0, visibleTopicsCount);

  // ── Add/Edit-deck handlers ────────────────────────────────────────────────────
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

  // Unified save — works for both CREATE and EDIT mode
  const handleCreateDeck = async () => {
    const trimmedTitle = deckTitle.trim();
    setDeckFormError('');

    if (!trimmedTitle) {
      setDeckFormError('Please enter a deck title.');
      return;
    }

    // Only rows with a term value count (blank trailing rows are ignored)
    const filledRows = termRows.filter((row) => row.term.trim());
    if (filledRows.length === 0) {
      setDeckFormError('Please add at least one term.');
      return;
    }

    if (editingDeck) {
      // ── EDIT MODE: full save (update + delete + add) ──────────────────────
      // Check for in-list duplicates
      const seen = new Set();
      for (const row of filledRows) {
        const key = row.term.trim().toLowerCase();
        if (seen.has(key)) {
          setDeckFormError(`Duplicate word "${row.term.trim()}" in the deck.`);
          return;
        }
        seen.add(key);
      }

      const result = await saveDeckEdit(
        editingDeck.id,
        trimmedTitle,
        filledRows.map((r) => ({
          id: r.id,
          term: r.term.trim(),
          definition: r.definition.trim(),
        }))
      );

      if (!result.success) {
        setDeckFormError(result.error || 'Could not save deck.');
        return;
      }

      _resetDeckForm();
      setViewState('select');
    } else {
      // ── CREATE MODE ─────────────────────────────────────────────────────────
      const validRows = filledRows.filter((row) => row.definition.trim());
      if (validRows.length === 0) {
        setDeckFormError('Please add at least one term and definition.');
        return;
      }

      const result = await addDeck({
        title: trimmedTitle,
        level: 'Beginner',
        terms: validRows.map((row) => ({ term: row.term.trim(), definition: row.definition.trim() })),
      });

      if (!result.success) {
        setDeckFormError(result.error || 'Could not create deck.');
        return;
      }

      _resetDeckForm();
      setViewState('select');
    }
  };

  const _resetDeckForm = () => {
    setEditingDeck(null);
    setDeckFormError('');
    setDeckTitle('');
    setDescription('');
    setShowDescription(false);
    setTermRows([{ id: 1, term: '', definition: '' }]);
  };

  const confirmDeleteDeck = (deck) => {
    Alert.alert('Delete Deck', `Delete "${deck.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(deck.id) },
    ]);
  };

  // ── Navigate to Quiz using deck vocabulary ───────────────────────────────
  const openDeckQuiz = (deck) => {
    const words = (deck.terms || []).map((t, i) => ({
      word_id: `local-${deck.id}-${i}`,
      word: t.term,
      meaning_vi: t.definition,
      part_of_speech: '',
      phonetic: '',
      example_en: t.term,   // fallback so fill-in-blank has something
      example_vi: t.definition,
      topic_id: null,
    }));
    navigation.navigate('VocabQuizScreen', {
      deckId: deck.id,
      deckTitle: deck.title,
      deckWords: words,
      userId,
    });
  };

  // ── Navigate to AI Reading using deck vocabulary ──────────────────────────
  const openDeckAIReading = (deck) => {
    const vocab = (deck.terms || []).map((t) => t.term.trim()).filter(Boolean).join(', ');
    navigation.navigate('AIReadingScreen', {
      presetDeckTitle: deck.title,
      presetVocab: vocab,
    });
  };

  // ── Open Edit Deck — pre-fills all existing terms (fully editable) ────────────
  const openEditDeck = (deck) => {
    setEditingDeck(deck);
    setDeckTitle(deck.title);
    setDescription('');
    setShowDescription(false);
    setDeckFormError('');
    const rows = (deck.terms || []).map((t) => ({
      id: t.id || `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      term: t.term || '',
      definition: t.definition || '',
    }));
    // Add one blank row for new entries
    setTermRows([...rows, { id: `new_${Date.now()}`, term: '', definition: '' }]);
    setViewState('add');
  };

  // ── Header back handler ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (phase !== 'select') {
      setPhase('select');
      return;
    }
    if (viewState === 'add') {
      _resetDeckForm();
      setViewState('select');
      return;
    }
    navigation.goBack();
  };

  // ── Start session (backend topic) – now uses SRS queue ───────────────────────
  const startSession = useCallback(async (topic) => {
    try {
      setLoading(true);
      setError('');

      // Fetch SRS-ordered queue from backend
      const queue = await getFlashcardQueue(userId, topic.topic_id);

      // Combine: review cards first, then new cards
      const allCards = [...queue.review_cards, ...queue.new_cards];

      if (!allCards.length) {
        // Nothing to study: no reviews due and daily limit reached
        setError(
          queue.daily_remaining === 0
            ? `You've reached the daily limit of ${queue.daily_limit} new words for this topic. Come back tomorrow!`
            : 'No cards available for this topic yet.'
        );
        return;
      }

      // Build card-type map so UI can badge Review vs New
      const types = {};
      queue.review_cards.forEach(w => { types[w.word_id] = 'review'; });
      queue.new_cards.forEach(w => { types[w.word_id] = 'new'; });
      setCardTypes(types);

      // Create a backend session (for history tracking)
      const session = await createFlashcardSession(userId, topic.topic_id, allCards.length);

      // Pre-create progress records (kept for backward-compat flip tracking)
      const pIds = {};
      for (const w of allCards) {
        try {
          const prog = await createFlashcardProgress(session.session_id, w.word_id);
          pIds[w.word_id] = prog.progress_id;
        } catch (_) { /* non-critical */ }
      }

      setCards(allCards);
      setProgressIds(pIds);
      setSessionId(session.session_id);
      setCurrentIndex(0);
      setShowMeaning(false);
      setRatings({});
      setSrsResults({});
      setCardStats({});
      // Pre-populate cardStore so done screen can look up word objects
      const store = {};
      allCards.forEach(w => { store[w.word_id] = w; });
      setCardStore(store);
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
    setCardStats({});
    const store = {};
    words.forEach(w => { store[w.word_id] = w; });
    setCardStore(store);
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

  // ── Rate & advance – full session tracking + SRS ────────────────────────────
  const handleRate = useCallback(async (rating) => {
    const card = cards[currentIndex];
    const pid = progressIds[card.word_id];
    const wid = card.word_id;

    // ── Update per-card session stats ─────────────────────────────────────────
    setCardStats(prev => {
      const existing = prev[wid] || { again_count: 0, last_option: null, flagged_difficult: false };
      if (rating === 'again') {
        return {
          ...prev,
          [wid]: {
            again_count: existing.again_count + 1,
            last_option: 'again',
            flagged_difficult: true,      // once flagged, stays flagged for done screen
          },
        };
      } else {
        // Hard/Good/Easy → reset again_count, keep flagged if previously flagged
        return {
          ...prev,
          [wid]: {
            again_count: 0,               // RESET per spec
            last_option: rating,
            flagged_difficult: existing.flagged_difficult || rating === 'hard',
          },
        };
      }
    });

    // ── Legacy flip-progress (keeps session history) ──────────────────────────
    if (pid) {
      try { await updateFlashcardProgress(pid, { difficulty_rating: rating }); }
      catch (e) { console.warn('rate progress:', e.message); }
    }

    // ── SRS rating (backend) ──────────────────────────────────────────────────
    if (selectedTopic && card.topic_id !== undefined) {
      try {
        const topicId = card.topic_id ?? selectedTopic.topic_id;
        const srsResult = await submitSRSRating(userId, card.word_id, topicId, rating);
        setSrsResults(prev => ({ ...prev, [wid]: srsResult }));
      } catch (e) { console.warn('srs rating:', e.message); }
    }

    // ── Queue management ──────────────────────────────────────────────────────
    if (rating === 'again') {
      // Move card to end; do NOT record a final rating
      const rest = cards.slice(currentIndex + 1);
      setCards(rest.length > 0 ? [...rest, card] : [card]);
      setCurrentIndex(0);
      setShowMeaning(false);
      flipAnim.setValue(0);
      return;
    }

    // Hard / Good / Easy → card leaves the queue, record final rating
    setRatings(prev => ({ ...prev, [wid]: rating }));
    const remainingCards = cards.slice(currentIndex + 1);

    if (remainingCards.length === 0) {
      try { if (sessionId) await completeFlashcardSession(sessionId); }
      catch (e) { console.warn('complete session:', e.message); }
      setPhase('done');
    } else {
      setCards(remainingCards);
      setCurrentIndex(0);
      setShowMeaning(false);
      flipAnim.setValue(0);
    }
  }, [cards, currentIndex, progressIds, ratings, sessionId, selectedTopic, userId, flipAnim]);

  const handleRestart = () => {
    if (selectedLocalDeck) startLocalSession(selectedLocalDeck);
    else if (selectedTopic) startSession(selectedTopic);
  };

  // ── Start focused session (only flagged-difficult cards) ─────────────────────
  const startFocusedSession = useCallback(() => {
    const difficultWords = Object.entries(cardStats)
      .filter(([, st]) => st.flagged_difficult)
      .map(([wid]) => cardStore[wid])
      .filter(Boolean);

    if (!difficultWords.length) {
      Alert.alert('No difficult cards', 'All cards were answered correctly!');
      return;
    }

    // Reuse startLocalSession-style setup (no backend queue call needed)
    const store = {};
    difficultWords.forEach(w => { store[w.word_id] = w; });

    setCards(difficultWords);
    setProgressIds({});          // no new backend progress rows for focused mode
    setCurrentIndex(0);
    setShowMeaning(false);
    setRatings({});
    setCardStats({});
    setCardStore(store);
    setSrsResults({});
    // Keep selectedTopic & sessionId so SRS ratings still post
    setPhase('study');
  }, [cardStats, cardStore]);

  // ── Phát âm từ vựng (Text-to-Speech) ─────────────────────────────────────────
  const handleSpeak = useCallback((textToSpeak) => {
    Speech.speak(textToSpeak, {
      language: 'en-US', // Giọng Anh-Mỹ
      rate: 0.9,         // Đọc chậm lại một xíu cho dễ nghe
    });
  }, []);
  // ── Progress metrics ─────────────────────────────────────────────────────────
  // "reviewed" = words that received a final rating (hard/good/easy, not again)
  const reviewed = Object.keys(ratings).length;
  // "remaining" = cards still in the queue (including any re-queued "again" cards)
  const remaining = cards.length;
  // total = reviewed + remaining, keeps the bar anchored to total work done
  const totalCards = reviewed + remaining;
  const progressPct = totalCards > 0 ? (reviewed / totalCards) * 100 : 0;

  // ══ ADD / EDIT DECK VIEW (viewState = 'add') ═════════════════════════════════
  // editingDeck == null → CREATE  |  non-null → EDIT (full save)
  if (phase === 'select' && viewState === 'add') {
    const isEditMode = !!editingDeck;
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
                <Text style={s.appName}>{isEditMode ? 'Edit FlashCard' : 'New FlashCard'}</Text>
                <Text style={s.subTitleText}>{isEditMode ? 'Edit Deck' : 'Create new Deck'}</Text>
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
              {/* Deck name — always editable (user can rename in edit mode) */}
              <View style={s.titleInputWrapper}>
                <TextInput
                  style={s.titleUnderlineInput}
                  placeholder="Title"
                  placeholderTextColor="#94a3b8"
                  value={deckTitle}
                  onChangeText={(v) => { setDeckTitle(v); setDeckFormError(''); }}
                />
                <View style={s.titleUnderline} />
              </View>

              {/* Inline error (duplicate name, empty, duplicate word, etc.) */}
              {!!deckFormError && (
                <View style={s.inlineErrorBox}>
                  <Ionicons name="warning-outline" size={14} color="#b91c1c" style={{ marginRight: 6 }} />
                  <Text style={s.inlineErrorText}>{deckFormError}</Text>
                </View>
              )}

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

              {/* All rows fully editable — existing words shown with current values */}
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
                    {filteredDecks.length === 0 ? (
                      <View style={s.emptyBox}>
                        <Ionicons name="search-outline" size={36} color="#94a3b8" />
                        <Text style={s.emptyText}>No decks found</Text>
                        <Text style={s.emptySubText}>Try a different search keyword</Text>
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
                              <Text style={s.deckWordCount}>{(deck.terms || []).length} words</Text>
                            </View>
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

                          {/* ── Primary actions: Study | Quiz | AI Reading ── */}
                          <View style={s.deckPrimaryRow}>
                            <TouchableOpacity
                              style={s.deckStudyBtn}
                              activeOpacity={0.8}
                              onPress={() => startLocalSession(deck)}
                            >
                              <Ionicons name="play-outline" size={14} color="#ffffff" />
                              <Text style={s.deckStudyBtnText}>Study</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.deckQuizBtn}
                              activeOpacity={0.8}
                              onPress={() => openDeckQuiz(deck)}
                            >
                              <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
                              <Text style={s.deckQuizBtnText}>Quiz</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.deckReadingBtn}
                              activeOpacity={0.8}
                              onPress={() => openDeckAIReading(deck)}
                            >
                              <Ionicons name="sparkles-outline" size={14} color="#7c3aed" />
                              <Text style={s.deckReadingBtnText}>AI Reading</Text>
                            </TouchableOpacity>
                          </View>

                          {/* ── Secondary actions: Edit Deck | Delete ── */}
                          <View style={s.deckSecondaryRow}>
                            <TouchableOpacity
                              style={s.deckEditBtn}
                              activeOpacity={0.8}
                              onPress={() => openEditDeck(deck)}
                            >
                              <Ionicons name="pencil-outline" size={13} color="#4f46e5" />
                              <Text style={s.deckEditBtnText}>Edit Deck</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.deckDeleteBtn}
                              activeOpacity={0.8}
                              onPress={() => confirmDeleteDeck(deck)}
                            >
                              <Ionicons name="trash-outline" size={13} color="#ef4444" />
                              <Text style={s.deckDeleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
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
                        <View style={{ flex: 1 }}>
                          <Text style={s.topicName} numberOfLines={1}>{topic.topic_name}</Text>
                          {/* SRS daily-status badges */}
                          {topicDailyStatus[topic.topic_id] && (() => {
                            const st = topicDailyStatus[topic.topic_id];
                            return (
                              <View style={s.srsStatusRow}>
                                {st.due_review_count > 0 && (
                                  <View style={s.srsBadgeReview}>
                                    <Text style={s.srsBadgeText}>🔄 {st.due_review_count} due</Text>
                                  </View>
                                )}
                                {st.daily_remaining > 0 ? (
                                  <View style={s.srsBadgeNew}>
                                    <Text style={s.srsBadgeText}>✨ {st.daily_remaining} new</Text>
                                  </View>
                                ) : (
                                  <View style={s.srsBadgeDone}>
                                    <Text style={s.srsBadgeText}>✅ limit reached</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })()}
                        </View>
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
    const hard = Object.values(ratings).filter(r => r === 'hard').length;
    const good = Object.values(ratings).filter(r => r === 'good').length;
    const easy = Object.values(ratings).filter(r => r === 'easy').length;

    // Cards flagged as difficult (ever rated again OR hard during session)
    const difficultCards = Object.entries(cardStats)
      .filter(([, st]) => st.flagged_difficult)
      .map(([wid, st]) => ({
        word: cardStore[wid],
        again_count: st.again_count,      // 0 if user eventually succeeded (reset)
        final_rating: ratings[wid] || 'again',
      }))
      .filter(c => c.word);

    // Next-review schedule from SRS
    const dueToday    = Object.values(srsResults).filter(r => r.interval_days === 0).length;
    const dueTomorrow = Object.values(srsResults).filter(r => r.interval_days === 1).length;
    const dueLater    = Object.values(srsResults).filter(r => r.interval_days > 1).length;

    return (
      <View style={s.wrapper}>
        <LinearGradient colors={['#4c3b7a', '#5b65d6']} style={s.phone}>
          <StatusBar barStyle="light-content" />

          {/* Header – same pattern as select/study screens */}
          <View style={s.headerSection}>
            <View style={s.headerTopRow}>
              <TouchableOpacity onPress={() => setPhase('select')} style={s.backButton}>
                <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
              </TouchableOpacity>
              <View style={s.headerTextContainer}>
                <Text style={s.appName}>Session Complete!</Text>
                <Text style={s.subTitleText}>{selectedTopic?.topic_name}</Text>
              </View>
              <View style={{ width: 32 }} />
            </View>
          </View>

          {/* Body – same #F0F2FF card background as select/study screens */}
          <View style={s.card}>
          <ScrollView contentContainerStyle={s.doneScroll} showsVerticalScrollIndicator={false}>

            {/* ── Summary circle ── */}
            <View style={s.doneCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            </View>
            <Text style={s.doneTitle}>{reviewed} cards reviewed</Text>
            <Text style={s.doneSub}>{selectedTopic?.topic_name}</Text>

            {/* ── Rating breakdown pills ── */}
            <View style={s.ratingRow}>
              {[
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

            {/* ── Difficult cards list ── */}
            {difficultCards.length > 0 && (
              <View style={s.difficultSection}>
                <View style={s.difficultHeader}>
                  <Ionicons name="warning-outline" size={16} color="#ef4444" />
                  <Text style={s.difficultTitle}>
                    {difficultCards.length} difficult word{difficultCards.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {difficultCards.map(({ word, again_count }) => {
                  const isStillHard = ratings[word.word_id] === 'hard' || !ratings[word.word_id];
                  return (
                    <View key={word.word_id} style={[s.difficultCard, isStillHard && s.difficultCardHighlight]}>
                      <View style={s.difficultCardLeft}>
                        <Text style={s.difficultWord}>{word.word}</Text>
                        {word.phonetic ? (
                          <Text style={s.difficultPhonetic}>/{word.phonetic}/</Text>
                        ) : null}
                        <Text style={s.difficultMeaning} numberOfLines={2}>{word.meaning_vi}</Text>
                      </View>
                      {again_count > 0 && (
                        <View style={s.againBadge}>
                          <Text style={s.againBadgeText}>↩ ×{again_count}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Action buttons ── */}
            {difficultCards.length > 0 && (
              <TouchableOpacity style={s.focusBtn} onPress={startFocusedSession} activeOpacity={0.85}>
                <Ionicons name="flash-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={s.focusBtnText}>Practice Difficult Cards ({difficultCards.length})</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.restartBtn} onPress={handleRestart} activeOpacity={0.85}>
              <Ionicons name="reload" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={s.restartText}>Study Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhase('select')} style={s.backLink}>
              <Text style={s.backLinkText}>Choose another deck</Text>
            </TouchableOpacity>
          </ScrollView>
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
          <TouchableOpacity style={s.addIconButton}>
            <Ionicons name="settings-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
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
            <Text style={s.pillText}>Left <Text style={{ fontWeight: '700' }}>{remaining}</Text></Text>
          </View>
          <View style={s.pill}>
            <Ionicons name="copy-outline" size={14} color="#0f172a" />
            <Text style={s.pillText}>Done <Text style={{ fontWeight: '700' }}>{reviewed}</Text></Text>
          </View>
          <View style={s.pill}>
            <Ionicons name="star-outline" size={14} color="#eab308" />
            <Text style={s.pillText}>Total <Text style={{ fontWeight: '700' }}>{totalCards}</Text></Text>
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
                  {/* SRS card-type badge */}
                  {cardTypes[card.word_id] === 'review' ? (
                    <View style={[s.tag, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                      <Text style={[s.tagText, { color: '#1d4ed8' }]}>🔄 Review</Text>
                    </View>
                  ) : cardTypes[card.word_id] === 'new' ? (
                    <View style={[s.tag, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                      <Text style={[s.tagText, { color: '#15803d' }]}>✨ New</Text>
                    </View>
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

  // User-created deck card
  deckCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, width: '100%', marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  deckHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  deckIconContainer: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deckTitleContainer: { flex: 1, justifyContent: 'center' },
  deckTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  deckWordCount: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  progressPercentage: { fontSize: 12, color: '#3b82f6', fontWeight: '700' },
  progressTrack: { height: 5, width: '100%', backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressBar: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3 },

  // Primary action row: Study | Quiz | AI Reading
  deckPrimaryRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  deckStudyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#4f46e5' },
  deckStudyBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  deckQuizBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 1.5, borderColor: '#bbf7d0' },
  deckQuizBtnText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  deckReadingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ede9fe', borderWidth: 1.5, borderColor: '#ddd6fe' },
  deckReadingBtnText: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },

  // Secondary action row: Edit Deck | Delete
  deckSecondaryRow: { flexDirection: 'row', gap: 6 },
  deckEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0' },
  deckEditBtnText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  deckDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca' },
  deckDeleteBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  // Legacy refs kept to avoid crashes
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5', paddingVertical: 12, borderRadius: 14, gap: 6, width: '100%' },
  startButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  badgeContainer: { backgroundColor: '#dcfce7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#16a34a', fontSize: 10, fontWeight: '700' },
  deleteButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

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

  // SRS status badges on topic rows
  srsStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  srsBadgeReview: { backgroundColor: '#dbeafe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  srsBadgeNew: { backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  srsBadgeDone: { backgroundColor: '#f1f5f9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  srsBadgeText: { fontSize: 10, fontWeight: '600', color: '#334155' },

  // SRS next-review schedule box (done screen)
  srsScheduleBox: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  srsScheduleTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 10, textAlign: 'center' },
  srsScheduleRow: { flexDirection: 'row', justifyContent: 'space-around' },
  srsScheduleItem: { alignItems: 'center', gap: 2 },
  srsScheduleCount: { fontSize: 22, fontWeight: '800' },
  srsScheduleLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  // Done screen scroll container
  doneScroll: { paddingBottom: 24, alignItems: 'center' },

  // Difficult cards section
  difficultSection: { width: '100%', marginBottom: 16 },
  difficultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  difficultTitle: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  difficultCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderColor: '#e2e8f0' },
  difficultCardHighlight: { borderColor: '#fca5a5', backgroundColor: '#fff7f7' },
  difficultCardLeft: { flex: 1, marginRight: 10 },
  difficultWord: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  difficultPhonetic: { fontSize: 12, color: '#64748b', marginBottom: 3 },
  difficultMeaning: { fontSize: 12, color: '#475569', lineHeight: 17 },
  difficultCardRight: { alignItems: 'flex-end', gap: 5 },
  againBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  againBadgeText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  finalRatingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  finalRatingText: { fontSize: 12, fontWeight: '700' },

  // Focused practice button
  focusBtn: { flexDirection: 'row', backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 10 },
  focusBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
