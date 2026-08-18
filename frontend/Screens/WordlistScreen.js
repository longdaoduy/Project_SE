import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getWords, addWord, starWord, unstarWord, getStarredWords } from '../api';
import { useData } from '../context/DataContext';

const { width: screenWidth } = Dimensions.get('window');

const WORD_TYPES = [
  { id: 'noun', label: 'Noun' },
  { id: 'verb', label: 'Verb' },
  { id: 'adjective', label: 'Adj' },
  { id: 'adverb', label: 'Adv' },
  { id: 'phrase', label: 'Phrase' },
];

export default function WordlistScreen({ navigation }) {
  const { userId, topics, loadTopics } = useData();

  const [vocabularies, setVocabularies] = useState([]);
  const [starredSet, setStarredSet] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedTopicId, setSelectedTopicId] = useState(null); // null = all topics
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'starred', 'studied', 'unstudied'
  const [viewState, setViewState] = useState('list'); // 'list' | 'add'
  const [isTopicModalVisible, setIsTopicModalVisible] = useState(false);

  // Add Word Form State
  const [newWord, setNewWord] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newMeaningVi, setNewMeaningVi] = useState('');
  const [newExampleEn, setNewExampleEn] = useState('');
  const [newExampleVi, setNewExampleVi] = useState('');
  const [newTopicId, setNewTopicId] = useState(null);
  const [selectedWordType, setSelectedWordType] = useState('noun');
  const [submittingWord, setSubmittingWord] = useState(false);

  const selectedTopic = topics?.find((t) => t.topic_id === selectedTopicId) || null;

  // ── Fetch Vocabularies & Starred Words ───────────────────────────────────────
  const fetchVocabularies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const targetTopicId = selectedTopicId; // null = all topics

      const [wordsData, starredData] = await Promise.all([
        getWords(targetTopicId, 200),
        userId ? getStarredWords(userId, 200).catch(() => []) : Promise.resolve([]),
      ]);

      const starredIds = new Set((starredData || []).map((s) => s.word_id));
      setStarredSet(starredIds);

      const normalized = (wordsData || []).map((word) => ({
        id: word.word_id,
        word: word.word,
        type: word.part_of_speech || 'word',
        phonetic: word.phonetic || '',
        definition: word.meaning_vi || '',
        example: word.example_en || word.example_vi || '',
        exampleEn: word.example_en || '',
        exampleVi: word.example_vi || '',
        topicId: word.topic_id,
        isStarred: starredIds.has(word.word_id),
        wordStatus: 'unstudied',
      }));

      setVocabularies(normalized);
    } catch (err) {
      console.error('API Error in WordlistScreen:', err);
      setError('Could not load vocabulary list. Please try again!');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTopicId, userId]);

  useEffect(() => {
    if (topics.length === 0) {
      loadTopics();
    }
  }, []);

  useEffect(() => {
    fetchVocabularies();
  }, [fetchVocabularies]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVocabularies();
  };

  // ── Speech / Pronunciation ──────────────────────────────────────────────────
  const handlePlayAudio = (word) => {
    if (!word) return;
    try {
      Speech.stop();
      Speech.speak(word, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85,
      });
    } catch (e) {
      console.warn('Speech error:', e.message);
    }
  };

  // ── Toggle Starred Word ──────────────────────────────────────────────────────
  const handleToggleStar = async (wordId) => {
    if (!userId) {
      Alert.alert('Notice', 'Please log in to star words.');
      return;
    }

    const isCurrentlyStarred = starredSet.has(wordId);
    const newSet = new Set(starredSet);

    if (isCurrentlyStarred) {
      newSet.delete(wordId);
      setStarredSet(newSet);
      try {
        await unstarWord(userId, wordId);
      } catch (e) {
        console.warn('unstarWord error:', e.message);
      }
    } else {
      newSet.add(wordId);
      setStarredSet(newSet);
      try {
        await starWord(userId, wordId);
      } catch (e) {
        console.warn('starWord error:', e.message);
      }
    }
  };

  // ── Add Word Form Submission ────────────────────────────────────────────────
  const handleAddWordSubmit = async () => {
    const trimmedWord = newWord.trim();
    const trimmedMeaning = newMeaningVi.trim();
    const trimmedExampleEn = newExampleEn.trim();
    const trimmedExampleVi = newExampleVi.trim();

    if (!trimmedWord) {
      Alert.alert('Validation', 'Please enter the word or phrase.');
      return;
    }
    if (!trimmedMeaning) {
      Alert.alert('Validation', 'Please enter the Vietnamese meaning.');
      return;
    }
    if (!trimmedExampleEn) {
      Alert.alert('Validation', 'Please enter an English example sentence.');
      return;
    }
    if (!trimmedExampleVi) {
      Alert.alert('Validation', 'Please enter the Vietnamese translation of the example.');
      return;
    }

    const topicToUse = newTopicId || selectedTopicId || topics?.[0]?.topic_id;
    if (!topicToUse) {
      Alert.alert('Validation', 'Please select a topic for this word.');
      return;
    }

    try {
      setSubmittingWord(true);
      await addWord({
        topic_id: topicToUse,
        word: trimmedWord,
        part_of_speech: selectedWordType,
        phonetic: newPhonetic.trim() || null,
        meaning_vi: trimmedMeaning,
        example_en: trimmedExampleEn,
        example_vi: trimmedExampleVi,
      });

      Alert.alert('Success', `"${trimmedWord}" has been added to your vocabulary!`);
      // Reset form
      setNewWord('');
      setNewPhonetic('');
      setNewMeaningVi('');
      setNewExampleEn('');
      setNewExampleVi('');
      setViewState('list');
      fetchVocabularies();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add word. Please try again.');
    } finally {
      setSubmittingWord(false);
    }
  };

  // ── Filtered words ──────────────────────────────────────────────────────────
  const filteredVocabularies = vocabularies.filter((item) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      item.word.toLowerCase().includes(searchLower) ||
      item.definition.toLowerCase().includes(searchLower);

    let matchesFilter = true;
    if (selectedFilter === 'starred') {
      matchesFilter = starredSet.has(item.id);
    } else if (selectedFilter === 'studied') {
      matchesFilter = item.wordStatus === 'studied';
    } else if (selectedFilter === 'unstudied') {
      matchesFilter = item.wordStatus === 'unstudied';
    }

    return matchesSearch && matchesFilter;
  });

  // ── Render Card ─────────────────────────────────────────────────────────────
  const renderVocabularyCard = ({ item }) => {
    const isStarred = starredSet.has(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.wordGroup}>
            <Text style={styles.wordText}>{item.word}</Text>
            {item.type ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardActionGroup}>
            {/* Star button */}
            <TouchableOpacity
              style={[styles.actionIconButton, isStarred && styles.starredIconButton]}
              onPress={() => handleToggleStar(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isStarred ? 'star' : 'star-outline'}
                size={18}
                color={isStarred ? '#f59e0b' : '#94a3b8'}
              />
            </TouchableOpacity>

            {/* Audio pronunciation */}
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => handlePlayAudio(item.word)}
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
          <View
            style={[
              styles.statusBadge,
              item.wordStatus === 'studied' ? styles.studied : styles.unstudied,
            ]}
          >
            <Text style={styles.statusText}>
              {item.wordStatus === 'studied' ? 'Studied' : 'Unstudied'}
            </Text>
          </View>
          {isStarred && (
            <View style={styles.starredPill}>
              <Ionicons name="star" size={10} color="#d97706" style={{ marginRight: 2 }} />
              <Text style={styles.starredPillText}>Favorite</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.webWrapper}>
      <LinearGradient
        colors={['#654190', '#667eea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.phoneContainer}
      >
        <StatusBar barStyle="light-content" />

        {viewState === 'list' && (
          <>
            {/* ── HEADER ── */}
            <View style={styles.headerSection}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Image
                  source={require('../assets/back.png')}
                  style={{ width: 16, height: 16, resizeMode: 'contain' }}
                />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.appName}>My Vocabulary</Text>
                <Text style={styles.appSubtitle}>
                  {selectedTopic ? `${selectedTopic.topic_name} • ` : ''}{vocabularies.length} words available
                </Text>
              </View>

              <TouchableOpacity style={styles.addButton} onPress={() => setViewState('add')}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* ── SEARCH INPUT ── */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#94a3b8" style={{ marginLeft: 4 }} />
                <TextInput
                  placeholder="Search word or meaning..."
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* ── WHITE CARD WITH FILTERS & FLATLIST ── */}
            <View style={styles.whiteCardContainer}>
              {/* Filter Tabs & Topic Filter Icon */}
              <View style={styles.filterRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterTabsScroll}
                  style={styles.filterScroll}
                >
                  <TouchableOpacity
                    style={[styles.filterButton, selectedFilter === 'all' && styles.selectedFilter]}
                    onPress={() => setSelectedFilter('all')}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selectedFilter === 'all' && styles.selectedFilterText,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'starred' && styles.selectedFilter,
                    ]}
                    onPress={() => setSelectedFilter('starred')}
                  >
                    <Ionicons
                      name="star"
                      size={12}
                      color={selectedFilter === 'starred' ? '#ffffff' : '#f59e0b'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.filterText,
                        selectedFilter === 'starred' && styles.selectedFilterText,
                      ]}
                    >
                      Starred ({starredSet.size})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'studied' && styles.selectedFilter,
                    ]}
                    onPress={() => setSelectedFilter('studied')}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selectedFilter === 'studied' && styles.selectedFilterText,
                      ]}
                    >
                      Studied
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'unstudied' && styles.selectedFilter,
                    ]}
                    onPress={() => setSelectedFilter('unstudied')}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selectedFilter === 'unstudied' && styles.selectedFilterText,
                      ]}
                    >
                      Unstudied
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Topic Filter Icon Button (top right of whiteCardContainer) */}
                <TouchableOpacity

                  onPress={() => setIsTopicModalVisible(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Filter by topic"
                >
                  <Ionicons
                    name={selectedTopicId !== null ? 'funnel' : 'funnel-outline'}
                    size={16}
                    color={selectedTopicId !== null ? '#aba8a8ff' : '#6366f1'}
                  />
                  {selectedTopicId !== null && <View style={styles.topicFilterActiveDot} />}
                </TouchableOpacity>
              </View>

              {/* Active Topic Banner */}
              {selectedTopic && (
                <View style={styles.activeTopicBanner}>
                  <View style={styles.activeTopicInfo}>
                    <Ionicons name="pricetag" size={13} color="#6366f1" style={{ marginRight: 6 }} />
                    <Text style={styles.activeTopicLabel}>Topic:</Text>
                    <Text style={styles.activeTopicName} numberOfLines={1}>
                      {selectedTopic.topic_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearTopicButton}
                    onPress={() => setSelectedTopicId(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.clearTopicText}>Clear</Text>
                    <Ionicons name="close-circle" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Word List */}
              <FlatList
                style={{ width: '100%', flex: 1 }}
                contentContainerStyle={styles.listContent}
                data={filteredVocabularies}
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
                  ) : (
                    <View style={styles.centerState}>
                      <Ionicons name="book-outline" size={44} color="#94a3b8" />
                      <Text style={styles.stateText}>
                        {selectedFilter === 'starred'
                          ? 'No starred words yet. Tap the star icon on any word to bookmark it!'
                          : selectedTopic
                            ? `No words found in topic "${selectedTopic.topic_name}".`
                            : 'No words found matching your search.'}
                      </Text>
                      {selectedTopicId !== null && (
                        <TouchableOpacity
                          style={[styles.retryBtn, { marginTop: 12, backgroundColor: '#f1f5f9' }]}
                          onPress={() => setSelectedTopicId(null)}
                        >
                          <Text style={[styles.retryText, { color: '#6366f1' }]}>Show All Topics</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                }
              />
            </View>
          </>
        )}

        {/* ── ADD WORD FORM VIEW ── */}
        {viewState === 'add' && (
          <>
            <View style={styles.headerSection}>
              <TouchableOpacity onPress={() => setViewState('list')} style={styles.backButton}>
                <Image
                  source={require('../assets/back.png')}
                  style={{ width: 16, height: 16, resizeMode: 'contain' }}
                />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.appName}>Add Vocabulary</Text>
                <Text style={styles.appSubtitle}>Add new words to your deck</Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.whiteCardContainer}>
                <View style={styles.addWordContainer}>
                  {/* Topic Selector for New Word */}
                  <Text style={styles.addWordContainerTitle}>TARGET TOPIC</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    {topics.map((t) => {
                      const isSel = (newTopicId || selectedTopicId) === t.topic_id;
                      return (
                        <TouchableOpacity
                          key={t.topic_id}
                          style={[styles.formTopicChip, isSel && styles.formTopicChipSel]}
                          onPress={() => setNewTopicId(t.topic_id)}
                        >
                          <Text
                            style={[
                              styles.formTopicChipText,
                              isSel && styles.formTopicChipTextSel,
                            ]}
                          >
                            {t.topic_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.addWordContainerTitle}>WORD / PHRASE *</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput
                      placeholder="e.g. Resilience"
                      style={styles.addWordInput}
                      value={newWord}
                      onChangeText={setNewWord}
                    />
                  </View>

                  <Text style={styles.addWordContainerTitle}>PHONETIC (PRONUNCIATION)</Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput
                      placeholder="e.g. /rɪˈzɪl.jəns/"
                      style={styles.addWordInput}
                      value={newPhonetic}
                      onChangeText={setNewPhonetic}
                    />
                  </View>

                  <Text style={styles.addWordContainerTitle}>VIETNAMESE MEANING </Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput
                      placeholder="e.g. Khả năng phục hồi, kiên cường"
                      style={styles.addWordInput}
                      value={newMeaningVi}
                      onChangeText={setNewMeaningVi}
                    />
                  </View>

                  <Text style={styles.addWordContainerTitle}>EXAMPLE SENTENCE (ENGLISH) </Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput
                      placeholder="e.g. She showed great resilience in overcoming her illness."
                      style={styles.addWordInput}
                      value={newExampleEn}
                      onChangeText={setNewExampleEn}
                    />
                  </View>

                  <Text style={styles.addWordContainerTitle}>EXAMPLE TRANSLATION (VIETNAMESE) </Text>
                  <View style={styles.addWordInputContainer}>
                    <TextInput
                      placeholder="e.g. Cô ấy đã thể hiện sự kiên cường tuyệt vời để vượt qua bệnh tật."
                      style={styles.addWordInput}
                      value={newExampleVi}
                      onChangeText={setNewExampleVi}
                    />
                  </View>

                  <Text style={styles.addWordContainerTitle}>PART OF SPEECH</Text>
                  <View style={styles.wordTypeButtonContainer}>
                    {WORD_TYPES.map((type) => {
                      const isSel = selectedWordType === type.id;
                      return (
                        <TouchableOpacity
                          key={type.id}
                          style={[styles.wordTypeButton, isSel && styles.wordTypeButtonSelected]}
                          onPress={() => setSelectedWordType(type.id)}
                        >
                          <Text
                            style={[
                              styles.wordTypeButtonText,
                              isSel && styles.wordTypeButtonTextSelected,
                            ]}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[styles.addWordButton, submittingWord && { opacity: 0.7 }]}
                    onPress={handleAddWordSubmit}
                    disabled={submittingWord}
                  >
                    {submittingWord ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.addWordButtonText}>Save Word to Database</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </>
        )}

        {/* ── TOPIC FILTER MODAL ── */}
        <Modal
          visible={isTopicModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsTopicModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setIsTopicModalVisible(false)}
            />
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={styles.modalIconBadge}>
                    <Ionicons name="funnel" size={16} color="#6366f1" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Filter by Topic</Text>
                    <Text style={styles.modalSubtitle}>Select a topic to focus your vocabulary</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setIsTopicModalVisible(false)}
                >
                  <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Option: All Topics */}
                <TouchableOpacity
                  style={[
                    styles.topicOptionItem,
                    selectedTopicId === null && styles.topicOptionItemActive,
                  ]}
                  onPress={() => {
                    setSelectedTopicId(null);
                    setIsTopicModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.topicOptionLeft}>
                    <View
                      style={[
                        styles.topicOptionIconWrapper,
                        selectedTopicId === null && styles.topicOptionIconWrapperActive,
                      ]}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={18}
                        color={selectedTopicId === null ? '#6366f1' : '#64748b'}
                      />
                    </View>
                    <View style={styles.topicOptionTextWrapper}>
                      <Text
                        style={[
                          styles.topicOptionTitle,
                          selectedTopicId === null && styles.topicOptionTitleActive,
                        ]}
                      >
                        All Topics
                      </Text>
                      <Text style={styles.topicOptionDesc}>Show words across all topics</Text>
                    </View>
                  </View>
                  {selectedTopicId === null ? (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    </View>
                  ) : (
                    <View style={styles.uncheckCircle} />
                  )}
                </TouchableOpacity>

                {/* Topic list */}
                {topics.map((t) => {
                  const isSelected = selectedTopicId === t.topic_id;
                  return (
                    <TouchableOpacity
                      key={t.topic_id}
                      style={[
                        styles.topicOptionItem,
                        isSelected && styles.topicOptionItemActive,
                      ]}
                      onPress={() => {
                        setSelectedTopicId(t.topic_id);
                        setIsTopicModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.topicOptionLeft}>
                        <View
                          style={[
                            styles.topicOptionIconWrapper,
                            isSelected && styles.topicOptionIconWrapperActive,
                          ]}
                        >
                          <Ionicons
                            name="book-outline"
                            size={18}
                            color={isSelected ? '#6366f1' : '#64748b'}
                          />
                        </View>
                        <View style={styles.topicOptionTextWrapper}>
                          <Text
                            style={[
                              styles.topicOptionTitle,
                              isSelected && styles.topicOptionTitleActive,
                            ]}
                          >
                            {t.topic_name}
                          </Text>
                          {t.description ? (
                            <Text style={styles.topicOptionDesc} numberOfLines={1}>
                              {t.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {isSelected ? (
                        <View style={styles.checkCircle}>
                          <Ionicons name="checkmark" size={14} color="#ffffff" />
                        </View>
                      ) : (
                        <View style={styles.uncheckCircle} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                {selectedTopicId !== null && (
                  <TouchableOpacity
                    style={styles.modalResetBtn}
                    onPress={() => {
                      setSelectedTopicId(null);
                      setIsTopicModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalResetText}>Clear Filter</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalApplyBtn}
                  onPress={() => setIsTopicModalVisible(false)}
                >
                  <Text style={styles.modalApplyText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── QUICK NAV BAR ── */}
        <View style={styles.quickNavContainer}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="home" size={20} color="#919191" />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('FlashcardScreen')}
          >
            <Ionicons name="albums" size={20} color="#919191" />
            <Text style={styles.navText}>Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('WordlistScreen')}
          >
            <Ionicons name="book" size={20} color="#667eea" />
            <Text style={[styles.navText, { color: '#667eea', fontWeight: '700' }]}>Words</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('AIReadingScreen')}
          >
            <Ionicons name="sparkles" size={20} color="#919191" />
            <Text style={styles.navText}>Reading</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('VocabQuizScreen')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#919191" />
            <Text style={styles.navText}>Quiz</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneContainer: {
    width: Platform.OS === 'web' ? 400 : '100%',
    height: Platform.OS === 'web' ? 800 : '100%',
    borderRadius: Platform.OS === 'web' ? 35 : 0,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
    }),
  },
  scrollContainer: {
    flexGrow: 1,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
    marginBottom: 10
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  addButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  appSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#e2e8f0',
    opacity: 0.9,
  },

  // Topic chips
  topicScrollWrapper: {
    marginBottom: 10,
  },
  topicScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  topicChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  selectedTopicChip: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  selectedTopicChipText: {
    color: '#6366f1',
    fontWeight: '700',
  },

  // Search
  searchSection: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    marginLeft: 8,
  },

  // White Card
  whiteCardContainer: {
    flex: 1,
    backgroundColor: '#F0F2FF',
    paddingTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 15
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  filterScroll: {
    flex: 1,
  },
  filterTabsScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedFilter: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  selectedFilterText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  topicFilterIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topicFilterIconButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  topicFilterActiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea3b14ff',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  activeTopicBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    marginHorizontal: 16
  },
  activeTopicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  activeTopicLabel: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
    marginRight: 4,
  },
  activeTopicName: {
    fontSize: 12,
    color: '#312e81',
    fontWeight: '700',
    flex: 1,
  },
  clearTopicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  clearTopicText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  wordText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#eef2ff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  starredIconButton: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
  },
  phoneticText: {
    fontSize: 13,
    color: '#8b5cf6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  definitionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginTop: 6,
  },
  exampleText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  studied: {
    backgroundColor: '#ecfdf5',
  },
  unstudied: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  starredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  starredPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },

  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  stateText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Form Add Word ──
  addWordContainer: {
    padding: 20,
  },
  addWordContainerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  addWordInputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addWordInput: {
    fontSize: 14,
    color: '#0f172a',
    opacity: 0.5
  },
  formTopicChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTopicChipSel: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  formTopicChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  formTopicChipTextSel: {
    color: '#ffffff',
    fontWeight: '700',
  },
  wordTypeButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  wordTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wordTypeButtonSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  wordTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  wordTypeButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  addWordButton: {
    backgroundColor: '#667eea',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  addWordButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Quick Nav
  quickNavContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  navText: {
    fontSize: 11,
    color: '#919191',
    marginTop: 3,
    fontWeight: '500',
  },

  // ── Topic Filter Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalList: {
    maxHeight: 320,
  },
  topicOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topicOptionItemActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  topicOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  topicOptionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topicOptionIconWrapperActive: {
    backgroundColor: '#ffffff',
    borderColor: '#a5b4fc',
  },
  topicOptionTextWrapper: {
    flex: 1,
  },
  topicOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  topicOptionTitleActive: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  topicOptionDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  modalApplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});