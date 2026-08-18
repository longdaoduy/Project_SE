import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, Text, TextInput, View, ScrollView,
  StatusBar, Platform, Dimensions, Image,
  TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getWords, addWord } from '../api';
import { useData } from '../context/DataContext';

const { width: screenWidth } = Dimensions.get('window');

const WORD_TYPES = [
  { id: 'noun',      label: 'Noun'  },
  { id: 'verb',      label: 'Verb'  },
  { id: 'adjective', label: 'Adj'   },
  { id: 'adverb',    label: 'Adv'   },
  { id: 'phrase',    label: 'Phrase'},
];

export default function WordlistScreen({ navigation }) {
  const { userId, topics, loadTopics, starredWordIds, toggleStar } = useData();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [vocabularies,  setVocabularies]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState(null);

  // ── UI / filter state ────────────────────────────────────────────────────────
  const [selectedTopicId,      setSelectedTopicId]      = useState(null);
  const [searchQuery,          setSearchQuery]          = useState('');
  const [selectedFilter,       setSelectedFilter]       = useState('all');
  const [viewState,            setViewState]            = useState('list');
  const [isTopicModalVisible,  setIsTopicModalVisible]  = useState(false);

  // ── Add-word form state ──────────────────────────────────────────────────────
  const [newWord,         setNewWord]         = useState('');
  const [newPhonetic,     setNewPhonetic]     = useState('');
  const [newMeaningVi,    setNewMeaningVi]    = useState('');
  const [newExampleEn,    setNewExampleEn]    = useState('');
  const [newExampleVi,    setNewExampleVi]    = useState('');
  const [newTopicId,      setNewTopicId]      = useState(null);
  const [selectedType,    setSelectedType]    = useState('noun');
  const [submitting,      setSubmitting]      = useState(false);

  const selectedTopic = topics?.find((t) => t.topic_id === selectedTopicId) || null;

  // ── Fetch vocabularies ───────────────────────────────────────────────────────
  const fetchVocabularies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWords(selectedTopicId, 200);
      const normalized = (data || []).map((w) => ({
        id:         w.word_id,
        word:       w.word,
        type:       w.part_of_speech || 'word',
        phonetic:   w.phonetic || '',
        definition: w.meaning_vi || '',
        example:    w.example_en || w.example_vi || '',
        exampleVi:  w.example_vi || '',
        topicId:    w.topic_id,
        wordStatus: 'unstudied',
      }));
      setVocabularies(normalized);
    } catch (err) {
      console.error('WordlistScreen fetch error:', err);
      setError('Could not load vocabulary. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTopicId]);

  useEffect(() => { if (topics.length === 0) loadTopics(); }, []);
  useEffect(() => { fetchVocabularies(); }, [fetchVocabularies]);

  const handleRefresh = () => { setRefreshing(true); fetchVocabularies(); };

  // ── Text-to-Speech ───────────────────────────────────────────────────────────
  const handleSpeak = (word) => {
    if (!word) return;
    try { Speech.stop(); Speech.speak(word, { language: 'en-US', rate: 0.85 }); }
    catch (e) { console.warn('Speech:', e.message); }
  };

  // ── Add word submit ──────────────────────────────────────────────────────────
  const handleAddWordSubmit = async () => {
    const w  = newWord.trim();
    const m  = newMeaningVi.trim();
    const en = newExampleEn.trim();
    const vi = newExampleVi.trim();
    if (!w)  { Alert.alert('Validation', 'Please enter the word or phrase.'); return; }
    if (!m)  { Alert.alert('Validation', 'Please enter the Vietnamese meaning.'); return; }
    if (!en) { Alert.alert('Validation', 'Please enter an English example sentence.'); return; }
    if (!vi) { Alert.alert('Validation', 'Please enter the Vietnamese translation of the example.'); return; }
    const topicToUse = newTopicId || selectedTopicId || topics?.[0]?.topic_id;
    if (!topicToUse) { Alert.alert('Validation', 'Please select a topic.'); return; }
    try {
      setSubmitting(true);
      await addWord({
        topic_id: topicToUse,
        word: w,
        part_of_speech: selectedType,
        phonetic: newPhonetic.trim() || null,
        meaning_vi: m,
        example_en: en,
        example_vi: vi,
      });
      Alert.alert('Success', `"${w}" added to your vocabulary!`);
      setNewWord(''); setNewPhonetic(''); setNewMeaningVi('');
      setNewExampleEn(''); setNewExampleVi(''); setNewTopicId(null);
      setViewState('list');
      fetchVocabularies();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add word. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────────
  const displayList = vocabularies.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      item.word.toLowerCase().includes(q) ||
      item.definition.toLowerCase().includes(q);
    const matchFilter =
      selectedFilter === 'all'       ? true :
      selectedFilter === 'starred'   ? starredWordIds.has(item.id) :
      selectedFilter === 'studied'   ? item.wordStatus === 'studied' :
      selectedFilter === 'unstudied' ? item.wordStatus === 'unstudied' : true;
    return matchSearch && matchFilter;
  });

  // ── Render word card ─────────────────────────────────────────────────────────
  const renderVocabularyCard = ({ item }) => {
    const isStarred = starredWordIds.has(item.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.wordGroup}>
            <Text style={styles.wordText}>{item.word}</Text>
            {item.type ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.type}</Text></View>
            ) : null}
          </View>
          <View style={styles.cardActionGroup}>
            <TouchableOpacity
              style={[styles.actionIconButton, isStarred && styles.starredIconButton]}
              onPress={() => toggleStar(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isStarred ? 'star' : 'star-outline'}
                size={18}
                color={isStarred ? '#f59e0b' : '#94a3b8'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => handleSpeak(item.word)}
              activeOpacity={0.7}
            >
              <Ionicons name="volume-medium" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {item.phonetic ? <Text style={styles.phoneticText}>{item.phonetic}</Text> : null}
        <Text style={styles.definitionText}>{item.definition}</Text>
        {item.example ? <Text style={styles.exampleText}>"{item.example}"</Text> : null}

        <View style={styles.cardFooterRow}>
          <View style={[styles.statusBadge, item.wordStatus === 'studied' ? styles.studied : styles.unstudied]}>
            <Text style={styles.statusText}>{item.wordStatus === 'studied' ? 'Studied' : 'Unstudied'}</Text>
          </View>
          {isStarred && (
            <View style={styles.starredPill}>
              <Ionicons name="star" size={10} color="#d97706" style={{ marginRight: 2 }} />
              <Text style={styles.starredPillText}>Starred</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.webWrapper}>
      <LinearGradient colors={['#654190', '#667eea']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
        <StatusBar barStyle="light-content" />

        {/* ═══════════════════ LIST VIEW ═══════════════════ */}
        {viewState === 'list' && (
          <>
            {/* Header */}
            <View style={styles.headerSection}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.appName}>My Vocabulary</Text>
                <Text style={styles.appSubtitle}>
                  {selectedTopic ? `${selectedTopic.topic_name} · ` : ''}{vocabularies.length} words
                </Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => setViewState('add')}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                <TextInput
                  placeholder="Search word or meaning..."
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* White card with filter + list */}
            <View style={styles.whiteCardContainer}>
              {/* Filter row */}
              <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
                  {[
                    { key: 'all',       label: 'All' },
                    { key: 'starred',   label: `⭐ Starred (${starredWordIds.size})` },
                    { key: 'studied',   label: 'Studied' },
                    { key: 'unstudied', label: 'Unstudied' },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterButton, selectedFilter === f.key && styles.selectedFilter]}
                      onPress={() => setSelectedFilter(f.key)}
                    >
                      <Text style={[styles.filterText, selectedFilter === f.key && styles.selectedFilterText]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Topic funnel icon */}
                <TouchableOpacity onPress={() => setIsTopicModalVisible(true)} activeOpacity={0.7} style={{ paddingLeft: 8 }}>
                  <Ionicons
                    name={selectedTopicId !== null ? 'funnel' : 'funnel-outline'}
                    size={18}
                    color={selectedTopicId !== null ? '#6366f1' : '#94a3b8'}
                  />
                  {selectedTopicId !== null && <View style={styles.topicFilterActiveDot} />}
                </TouchableOpacity>
              </View>

              {/* Active topic banner */}
              {selectedTopic && (
                <View style={styles.activeTopicBanner}>
                  <View style={styles.activeTopicInfo}>
                    <Ionicons name="pricetag" size={13} color="#6366f1" style={{ marginRight: 6 }} />
                    <Text style={styles.activeTopicLabel}>Topic: </Text>
                    <Text style={styles.activeTopicName} numberOfLines={1}>{selectedTopic.topic_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedTopicId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.clearTopicText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Count label */}
              <Text style={styles.countLabel}>{displayList.length} word{displayList.length !== 1 ? 's' : ''}</Text>

              {/* Word FlatList */}
              <FlatList
                style={{ width: '100%', flex: 1 }}
                contentContainerStyle={styles.listContent}
                data={displayList}
                renderItem={renderVocabularyCard}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                  loading ? (
                    <View style={styles.centerState}>
                      <ActivityIndicator size="large" color="#667eea" />
                      <Text style={styles.stateText}>Loading words...</Text>
                    </View>
                  ) : error ? (
                    <View style={styles.centerState}>
                      <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
                      <Text style={styles.errorText}>{error}</Text>
                      <TouchableOpacity style={styles.retryBtn} onPress={fetchVocabularies}>
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : selectedFilter === 'starred' ? (
                    <View style={styles.centerState}>
                      <Ionicons name="star-outline" size={44} color="#94a3b8" />
                      <Text style={styles.stateText}>No starred words yet.</Text>
                      <Text style={styles.stateSubText}>Tap ⭐ on any word to save it here.</Text>
                    </View>
                  ) : (
                    <View style={styles.centerState}>
                      <Ionicons name="book-outline" size={44} color="#94a3b8" />
                      <Text style={styles.stateText}>No words found.</Text>
                    </View>
                  )
                }
              />
            </View>
          </>
        )}

        {/* ═══════════════════ ADD WORD VIEW ═══════════════════ */}
        {viewState === 'add' && (
          <>
            <View style={styles.headerSection}>
              <TouchableOpacity onPress={() => setViewState('list')} style={styles.backButton}>
                <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.appName}>Add Vocabulary</Text>
                <Text style={styles.appSubtitle}>Add new words to your deck</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              <View style={[styles.whiteCardContainer, { paddingBottom: 32 }]}>
                <View style={styles.addWordContainer}>

                  {/* Topic selector */}
                  <Text style={styles.addWordContainerTitle}>TARGET TOPIC</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {topics.map((t) => {
                      const sel = (newTopicId || selectedTopicId) === t.topic_id;
                      return (
                        <TouchableOpacity
                          key={t.topic_id}
                          style={[styles.formTopicChip, sel && styles.formTopicChipSel]}
                          onPress={() => setNewTopicId(t.topic_id)}
                        >
                          <Text style={[styles.formTopicChipText, sel && styles.formTopicChipTextSel]}>
                            {t.topic_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.addWordContainerTitle}>WORD / PHRASE *</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput placeholder="e.g. Resilience" style={styles.addWordInput} value={newWord} onChangeText={setNewWord} />
                  </View>

                  <Text style={styles.addWordContainerTitle}>PHONETIC</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput placeholder="e.g. /rɪˈzɪl.jəns/" style={styles.addWordInput} value={newPhonetic} onChangeText={setNewPhonetic} />
                  </View>

                  <Text style={styles.addWordContainerTitle}>VIETNAMESE MEANING *</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput placeholder="e.g. Khả năng phục hồi" style={styles.addWordInput} value={newMeaningVi} onChangeText={setNewMeaningVi} />
                  </View>

                  <Text style={styles.addWordContainerTitle}>EXAMPLE SENTENCE (ENGLISH) *</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput placeholder="e.g. She showed great resilience." style={styles.addWordInput} value={newExampleEn} onChangeText={setNewExampleEn} multiline />
                  </View>

                  <Text style={styles.addWordContainerTitle}>EXAMPLE TRANSLATION (VIETNAMESE) *</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput placeholder="e.g. Cô ấy thể hiện sự kiên cường tuyệt vời." style={styles.addWordInput} value={newExampleVi} onChangeText={setNewExampleVi} multiline />
                  </View>

                  <Text style={styles.addWordContainerTitle}>PART OF SPEECH</Text>
                  <View style={styles.wordTypeButtonContainer}>
                    {WORD_TYPES.map((t) => {
                      const sel = selectedType === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.wordTypeButton, sel && styles.wordTypeButtonSelected]}
                          onPress={() => setSelectedType(t.id)}
                        >
                          <Text style={[styles.wordTypeButtonText, sel && styles.wordTypeButtonTextSelected]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.addWordButton, submitting && { opacity: 0.6 }]}
                    onPress={handleAddWordSubmit}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#ffffff" />
                      : <Text style={styles.addWordButtonText}>Save Word to Database</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </>
        )}

        {/* ═══════════════════ TOPIC FILTER MODAL ═══════════════════ */}
        <Modal visible={isTopicModalVisible} transparent animationType="fade" onRequestClose={() => setIsTopicModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsTopicModalVisible(false)} />
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter by Topic</Text>
                <TouchableOpacity onPress={() => setIsTopicModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.topicOptionItem, selectedTopicId === null && styles.topicOptionItemActive]}
                  onPress={() => { setSelectedTopicId(null); setIsTopicModalVisible(false); }}
                >
                  <Ionicons name="grid-outline" size={16} color={selectedTopicId === null ? '#6366f1' : '#64748b'} style={{ marginRight: 10 }} />
                  <Text style={[styles.topicOptionText, selectedTopicId === null && styles.topicOptionTextActive]}>All Topics</Text>
                  {selectedTopicId === null && <Ionicons name="checkmark" size={16} color="#6366f1" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
                {topics.map((t) => {
                  const active = selectedTopicId === t.topic_id;
                  return (
                    <TouchableOpacity
                      key={t.topic_id}
                      style={[styles.topicOptionItem, active && styles.topicOptionItemActive]}
                      onPress={() => { setSelectedTopicId(t.topic_id); setIsTopicModalVisible(false); }}
                    >
                      <Ionicons name="pricetag-outline" size={16} color={active ? '#6366f1' : '#64748b'} style={{ marginRight: 10 }} />
                      <Text style={[styles.topicOptionText, active && styles.topicOptionTextActive]} numberOfLines={1}>{t.topic_name}</Text>
                      {active && <Ionicons name="checkmark" size={16} color="#6366f1" style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════ BOTTOM NAV ═══════════════════ */}
        <View style={styles.quickNavContainer}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={20} color="#919191" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('FlashcardScreen')}>
            <Ionicons name="albums" size={20} color="#919191" />
            <Text style={styles.navLabel}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('WordlistScreen')}>
            <Ionicons name="book" size={20} color="#667eea" />
            <Text style={[styles.navLabel, { color: '#667eea' }]}>Words</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AIReadingScreen')}>
            <Ionicons name="sparkles" size={20} color="#919191" />
            <Text style={styles.navLabel}>Reading</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('VocabQuizScreen')}>
            <Ionicons name="checkmark-circle" size={20} color="#919191" />
            <Text style={styles.navLabel}>Quiz</Text>
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
  phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden', ...Platform.select({ web: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 } }) },
  scrollContainer: { flexGrow: 1 },

  // ── Header ───────────────────────────────────────────────────────────────────
  headerSection: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 12 },
  headerTextContainer: { marginLeft: 14, flex: 1 },
  appName: { fontSize: 24, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  appSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  addButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginLeft: 'auto' },

  // ── Search ───────────────────────────────────────────────────────────────────
  searchSection: { width: '100%', paddingHorizontal: 20, marginBottom: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  searchInput: { flex: 1, fontSize: 14, color: '#ffffff', paddingHorizontal: 8 },

  // ── White card body ──────────────────────────────────────────────────────────
  whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', paddingHorizontal: 14, paddingTop: 12 },

  // ── Filters ──────────────────────────────────────────────────────────────────
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  filterTabsScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e0e7ff' },
  selectedFilter: { backgroundColor: '#4f46e5' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },
  selectedFilterText: { color: '#ffffff' },
  topicFilterActiveDot: { position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: '#6366f1', borderWidth: 1, borderColor: '#ffffff' },

  // ── Active topic banner ───────────────────────────────────────────────────────
  activeTopicBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ede9fe', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 },
  activeTopicInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  activeTopicLabel: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  activeTopicName: { fontSize: 12, color: '#4f46e5', fontWeight: '700', flex: 1 },
  clearTopicText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },

  // ── Count label ──────────────────────────────────────────────────────────────
  countLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 6, paddingHorizontal: 2 },
  listContent: { paddingBottom: 12 },

  // ── Word card ────────────────────────────────────────────────────────────────
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  wordGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  wordText: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  badge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#4f46e5' },
  cardActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionIconButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  starredIconButton: { backgroundColor: '#fef9c3' },
  audioButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#a855f7', justifyContent: 'center', alignItems: 'center' },
  phoneticText: { fontSize: 12, color: '#64748b', marginBottom: 3, fontStyle: 'italic' },
  definitionText: { fontSize: 14, color: '#334155', lineHeight: 20, fontWeight: '500' },
  exampleText: { fontSize: 12, color: '#7d7f81', marginTop: 4, fontStyle: 'italic' },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  studied: { backgroundColor: '#dcfce7' },
  unstudied: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  starredPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  starredPillText: { fontSize: 11, fontWeight: '700', color: '#a16207' },

  // ── Empty / error states ──────────────────────────────────────────────────────
  centerState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  stateText: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 24 },
  stateSubText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#667eea', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },

  // ── Add-word form ────────────────────────────────────────────────────────────
  addWordContainer: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginTop: 16 },
  addWordContainerTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  addWordInputContainer: { backgroundColor: '#f0f2ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#e0e7ff' },
  addWordInput: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  wordTypeButtonContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  wordTypeButton: { backgroundColor: '#f0f2ff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e7ff', paddingVertical: 8, paddingHorizontal: 14 },
  wordTypeButtonText: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },
  wordTypeButtonSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  wordTypeButtonTextSelected: { color: '#ffffff' },
  addWordButton: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  addWordButtonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  formTopicChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e0e7ff', marginRight: 8 },
  formTopicChipSel: { backgroundColor: '#4f46e5' },
  formTopicChipText: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },
  formTopicChipTextSel: { color: '#ffffff' },

  // ── Topic filter modal ────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  topicOptionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  topicOptionItemActive: { backgroundColor: '#ede9fe', borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  topicOptionText: { fontSize: 14, color: '#475569', fontWeight: '500', flex: 1 },
  topicOptionTextActive: { color: '#6366f1', fontWeight: '700' },

  // ── Bottom nav ───────────────────────────────────────────────────────────────
  quickNavContainer: { backgroundColor: '#ffffff', flexDirection: 'row', width: '100%' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navLabel: { fontSize: 11, color: '#919191', marginTop: 3 },
});
