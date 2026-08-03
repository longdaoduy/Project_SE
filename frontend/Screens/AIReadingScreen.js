import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  submitAIAnswer,
  submitAIReading,
} from '../api';
import { useData } from '../context/DataContext';

const { width: screenWidth } = Dimensions.get('window');

const DIFFICULTY_FILTERS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function splitVocabulary(input) {
  return (input || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function calcReadingMinutes(passage = '') {
  const words = passage.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} min`;
}

export default function AIReadingScreen({ navigation }) {
  const { userId, topics, topicsLoading, loadTopics } = useData();

  const [viewState, setViewState] = useState('history'); // 'history' | 'input' | 'generated'
  const [selectedFilter, setSelectedFilter] = useState('All');

  const [historyReadings, setHistoryReadings] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [inputText, setInputText] = useState('');
  const [topicParam, setTopicParam] = useState('');
  const [difficultyParam, setDifficultyParam] = useState('');
  const [quickTopicId, setQuickTopicId] = useState(null);

  const [currentReading, setCurrentReading] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [resultReading, setResultReading] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [loadingReading, setLoadingReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [screenError, setScreenError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setScreenError('');
      const data = await getUserAIReadings(userId, 30);
      setHistoryReadings(data || []);
    } catch (e) {
      setScreenError(e.message || 'Could not load reading history');
      console.warn('loadHistory error:', e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
    if (topics.length === 0) {
      loadTopics();
    }
  }, []);

  const filteredHistory = useMemo(() => {
    if (selectedFilter === 'All') return historyReadings;
    return historyReadings.filter((item) => item.difficulty_param === selectedFilter);
  }, [historyReadings, selectedFilter]);

  const wordCount = useMemo(() => splitVocabulary(inputText).length, [inputText]);

  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) {
      setScreenError('Please enter at least one vocabulary word.');
      return;
    }

    try {
      setGenerating(true);
      setScreenError('');
      const reading = await generateAIReading(
        userId,
        inputText.trim(),
        topicParam.trim() || null,
        difficultyParam || null
      );

      setCurrentReading(reading);
      setSelectedAnswers({});
      setResultReading(null);
      setViewState('generated');
      await loadHistory();
    } catch (e) {
      setScreenError(e.message || 'Generate reading failed');
      console.warn('handleGenerate error:', e.message);
    } finally {
      setGenerating(false);
    }
  }, [difficultyParam, inputText, loadHistory, topicParam, userId]);

  const handleLoadQuickTopicWords = useCallback(async () => {
    if (!quickTopicId) return;
    try {
      setScreenError('');
      const words = await getWords(quickTopicId, 10);
      const vocab = (words || []).map((w) => w.word).join(', ');
      setInputText(vocab);
    } catch (e) {
      setScreenError(e.message || 'Could not load words from topic');
      console.warn('handleLoadQuickTopicWords error:', e.message);
    }
  }, [quickTopicId]);

  const openReading = useCallback(async (readingId) => {
    try {
      setLoadingReading(true);
      setScreenError('');
      const reading = await getAIReading(readingId);
      const seededAnswers = {};
      (reading.comprehension_questions || []).forEach((q) => {
        if (q.user_answer) {
          seededAnswers[q.question_id] = q.user_answer;
        }
      });

      setCurrentReading(reading);
      setSelectedAnswers(seededAnswers);
      setResultReading(reading.is_completed ? reading : null);
      setViewState('generated');
    } catch (e) {
      setScreenError(e.message || 'Could not open this reading test');
      console.warn('openReading error:', e.message);
    } finally {
      setLoadingReading(false);
    }
  }, []);

  const handleSubmitReading = useCallback(async () => {
    if (!currentReading) return;

    const questions = currentReading.comprehension_questions || [];
    if (!questions.length) {
      setScreenError('This reading has no comprehension questions to submit.');
      return;
    }

    const unanswered = questions.filter((q) => !selectedAnswers[q.question_id]);
    if (unanswered.length > 0) {
      setScreenError(`Please answer all questions (${unanswered.length} remaining).`);
      return;
    }

    try {
      setSubmitting(true);
      setScreenError('');

      for (const q of questions) {
        await submitAIAnswer(q.question_id, selectedAnswers[q.question_id]);
      }

      const scored = await submitAIReading(currentReading.reading_id);
      setCurrentReading(scored);
      setResultReading(scored);
      await loadHistory();
    } catch (e) {
      setScreenError(e.message || 'Submit failed');
      console.warn('handleSubmitReading error:', e.message);
    } finally {
      setSubmitting(false);
    }
  }, [currentReading, loadHistory, selectedAnswers]);

  const handleReset = useCallback(() => {
    setViewState('input');
    setCurrentReading(null);
    setResultReading(null);
    setSelectedAnswers({});
    setScreenError('');
  }, []);

  const historyBadge = useMemo(() => {
    if (viewState !== 'history') return 'Reading Generator';
    return `Reading Tests (${historyReadings.length})`;
  }, [historyReadings.length, viewState]);

  return (
    <View style={styles.webWrapper}>
      <LinearGradient
        colors={['#56509f', '#667eea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.phoneContainer}
      >
        <StatusBar barStyle="light-content" />

        <View style={styles.headerSection}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <View style={styles.aiBadgeRow}>
                <Image source={require('../assets/shining.png')} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                <Text style={styles.aiBadgeText}>AI-Generated</Text>
              </View>
              <Text style={styles.appName}>{historyBadge}</Text>
            </View>

            {viewState === 'history' ? (
              <TouchableOpacity style={styles.filterBtnHeader} onPress={loadHistory}>
                <Ionicons name="refresh" size={16} color="#ffffff" />
                <Text style={styles.filterBtnHeaderText}>Reload</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButtonPlaceholder} />
            )}
          </View>

          {viewState === 'history' && (
            <View style={styles.filterRow}>
              {DIFFICULTY_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.whiteCardContainer}>
          {!!screenError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={16} color="#991b1b" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{screenError}</Text>
            </View>
          )}

          {viewState === 'history' && (
            <ScrollView contentContainerStyle={styles.scrollContentHistory} showsVerticalScrollIndicator={false}>
              {(historyLoading || loadingReading) ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#5b4feb" />
                  <Text style={styles.loadingText}>Loading your reading tests...</Text>
                </View>
              ) : filteredHistory.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="sparkles-outline" size={42} color="#6366f1" />
                  <Text style={styles.emptyTitle}>No reading test yet</Text>
                  <Text style={styles.emptySub}>Generate your first AI reading to start practicing.</Text>
                </View>
              ) : (
                filteredHistory.map((item) => {
                  const isDone = item.is_completed;
                  const level = item.difficulty_param || '—';
                  return (
                    <View key={item.reading_id} style={styles.historyCard}>
                      <View style={styles.badgeRowContainer}>
                        <View style={styles.levelBadgeHistory}>
                          <Text style={styles.levelBadgeHistoryText}>{level}</Text>
                        </View>
                        {!!item.topic_param && (
                          <View style={styles.topicBadgeHistory}>
                            <Text style={styles.topicBadgeHistoryText}>{item.topic_param}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.historyCardTopRow}>
                        <Text style={styles.historyCardTitle} numberOfLines={2}>
                          {item.topic_param || `Reading #${item.reading_id}`}
                        </Text>
                        <View style={[styles.historyIconCircle, { backgroundColor: isDone ? '#d1fae5' : '#f3e8ff' }]}>
                          <Ionicons
                            name={isDone ? 'checkmark-circle-outline' : 'book-outline'}
                            size={22}
                            color={isDone ? '#10b981' : '#8b5cf6'}
                          />
                        </View>
                      </View>

                      <View style={styles.historyCardFooter}>
                        <View style={styles.timeRow}>
                          <Ionicons name="time-outline" size={16} color="#94a3b8" style={{ marginRight: 4 }} />
                          <Text style={styles.timeText}>{calcReadingMinutes(item.generated_passage)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.startReadingBtn}
                          onPress={() => openReading(item.reading_id)}
                        >
                          <Text style={styles.startReadingBtnText}>{isDone ? 'Review →' : 'Continue →'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={styles.generateBanner}
                activeOpacity={0.85}
                onPress={() => {
                  setViewState('input');
                  setScreenError('');
                }}
              >
                <View style={styles.bannerIconCircle}>
                  <Image source={require('../assets/sparkling.png')} style={{ width: 20, height: 30, resizeMode: 'contain' }} />
                </View>
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>Generate New Article</Text>
                  <Text style={styles.bannerSubtitle}>AI creates a personalized reading test</Text>
                </View>
                <Ionicons name="arrow-forward" size={22} color="#ffffff" />
              </TouchableOpacity>
            </ScrollView>
          )}

          {viewState === 'input' && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Enter Vocabulary</Text>
                  <View style={styles.wordCountBadge}>
                    <Text style={styles.wordCountText}>{wordCount} words</Text>
                  </View>
                </View>

                <TextInput
                  style={styles.textInputArea}
                  multiline
                  placeholder="elusive, sustainable, acquire, proliferate..."
                  placeholderTextColor="#94a3b8"
                  value={inputText}
                  onChangeText={setInputText}
                  textAlignVertical="top"
                />

                <TextInput
                  style={styles.singleLineInput}
                  placeholder="Topic / context (optional), e.g. IELTS Academic"
                  placeholderTextColor="#94a3b8"
                  value={topicParam}
                  onChangeText={setTopicParam}
                />

                <Text style={styles.recentSetsLabel}>DIFFICULTY</Text>
                <View style={styles.recentSetsRow}>
                  {['A2', 'B1', 'B2', 'C1'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.recentSetChip, difficultyParam === d && styles.recentSetChipActive]}
                      onPress={() => setDifficultyParam((prev) => (prev === d ? '' : d))}
                    >
                      <Text style={[styles.recentSetText, difficultyParam === d && styles.recentSetTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.recentSetsLabel, { marginTop: 16 }]}>RECENT SETS</Text>
                {topicsLoading ? (
                  <ActivityIndicator color="#5b4feb" style={{ marginVertical: 8 }} />
                ) : (
                  <View style={styles.recentSetsRowWrap}>
                    {topics.slice(0, 8).map((topic) => (
                      <TouchableOpacity
                        key={topic.topic_id}
                        style={[styles.recentSetChip, quickTopicId === topic.topic_id && styles.recentSetChipActive]}
                        onPress={() => setQuickTopicId(topic.topic_id)}
                      >
                        <Ionicons name="document-text" size={14} color="#1e293b" />
                        <Text style={styles.recentSetText}>{topic.topic_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.secondaryButton, !quickTopicId && styles.secondaryButtonDisabled]}
                  onPress={handleLoadQuickTopicWords}
                  disabled={!quickTopicId}
                >
                  <Ionicons name="download-outline" size={16} color="#1e293b" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Load Words From Topic</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.generateButton, generating && styles.generateButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="sparkles" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.generateButtonText}>
                  {generating ? 'Generating...' : 'Generate Reading Test'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {viewState === 'generated' && currentReading && (
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.resultToolbar}>
                <View style={styles.wordTagsRow}>
                  {splitVocabulary(currentReading.input_vocabulary).slice(0, 6).map((word) => (
                    <View style={styles.wordTag} key={word}>
                      <Text style={styles.wordTagText}>{word}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.newButton} onPress={handleReset}>
                  <Ionicons name="refresh" size={14} color="#1e293b" style={{ marginRight: 4 }} />
                  <Text style={styles.newButtonText}>New</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContentResult} showsVerticalScrollIndicator={false}>
                {resultReading ? (
                  <View style={styles.resultSummaryCard}>
                    <Text style={styles.resultSummaryTitle}>Reading Test Complete</Text>
                    <Text style={styles.resultSummaryScore}>
                      {Math.round(resultReading.score || 0)}/{(resultReading.comprehension_questions || []).length}
                    </Text>
                    <Text style={styles.resultSummarySub}>Accuracy: {(resultReading.accuracy || 0).toFixed(1)}%</Text>
                  </View>
                ) : null}

                <View style={styles.readingCard}>
                  <View style={styles.readingCardHeader}>
                    <View style={styles.readingCardTitleRow}>
                      <View style={styles.documentIconBox}>
                        <Ionicons name="document-text" size={16} color="#1e293b" />
                      </View>
                      <Text style={styles.readingCardTitle}>Reading Passage</Text>
                    </View>
                    <View style={styles.ieltsBadge}>
                      <Text style={styles.ieltsBadgeText}>{currentReading.difficulty_param || 'AI Style'}</Text>
                    </View>
                  </View>

                  <Text style={styles.paragraph}>{currentReading.generated_passage}</Text>
                </View>

                <View style={styles.quizCard}>
                  <Text style={styles.quizTitle}>Comprehension Check</Text>
                  {(currentReading.comprehension_questions || []).length === 0 ? (
                    <Text style={styles.questionText}>This reading has no generated questions yet.</Text>
                  ) : (
                    (currentReading.comprehension_questions || []).map((q, idx) => {
                      const options = [
                        { key: 'A', text: q.option_a },
                        { key: 'B', text: q.option_b },
                        { key: 'C', text: q.option_c },
                        { key: 'D', text: q.option_d },
                      ];
                      const selected = selectedAnswers[q.question_id];
                      const showResult = !!resultReading;

                      return (
                        <View key={q.question_id} style={{ marginBottom: 18 }}>
                          <Text style={styles.questionText}>{idx + 1}. {q.question_text}</Text>
                          <View style={styles.optionsContainer}>
                            {options.map((option) => {
                              const isSelected = selected === option.key;
                              const isCorrect = showResult && q.correct_option === option.key;
                              const isWrongChoice = showResult && isSelected && q.correct_option !== option.key;
                              return (
                                <TouchableOpacity
                                  key={option.key}
                                  style={[
                                    styles.optionButton,
                                    isSelected && styles.optionButtonSelected,
                                    isCorrect && styles.optionButtonCorrect,
                                    isWrongChoice && styles.optionButtonWrong,
                                  ]}
                                  onPress={() => {
                                    if (!showResult) {
                                      setSelectedAnswers((prev) => ({ ...prev, [q.question_id]: option.key }));
                                    }
                                  }}
                                  activeOpacity={0.7}
                                  disabled={showResult}
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
                    })
                  )}

                  {!resultReading && (currentReading.comprehension_questions || []).length > 0 && (
                    <TouchableOpacity
                      style={[styles.generateButton, submitting && styles.generateButtonDisabled]}
                      onPress={handleSubmitReading}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
                      ) : (
                        <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.generateButtonText}>{submitting ? 'Submitting...' : 'Submit Answers'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.quickNavContainer}>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={20} color="#919191" />
            <Text style={styles.quickNavText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('FlashcardScreen')}>
            <Ionicons name="albums" size={20} color="#919191" />
            <Text style={styles.quickNavText}>Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('WordlistScreen')}>
            <Ionicons name="book" size={20} color="#919191" />
            <Text style={styles.quickNavText}>Words</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavBtn}>
            <Ionicons name="sparkles" size={20} color="#667eea" />
            <Text style={[styles.quickNavText, { color: '#667eea' }]}>Reading</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('VocabQuizScreen')}>
            <Ionicons name="checkmark-circle" size={20} color="#919191" />
            <Text style={styles.quickNavText}>Quiz</Text>
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
  headerSection: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  backButtonPlaceholder: {
    width: 32,
  },
  filterBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  filterBtnHeaderText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  headerTitleContainer: {
    alignItems: 'flex-start',
    flex: 1,
    marginLeft: 16,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  aiBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 3,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
    justifyContent: 'flex-start',
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#ffffff',
  },
  filterChipText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#4f46e5',
  },
  whiteCardContainer: {
    flex: 1,
    backgroundColor: '#F0F2FF',
    width: '100%',
    alignItems: 'center',
  },
  errorBox: {
    width: '92%',
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#991b1b',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 10,
    color: '#475569',
    fontWeight: '600',
  },
  emptyCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  scrollContentHistory: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    width: Platform.OS === 'web' ? 400 : screenWidth,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeRowContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  levelBadgeHistory: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  levelBadgeHistoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  topicBadgeHistory: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  topicBadgeHistoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  historyCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    paddingRight: 10,
    lineHeight: 22,
  },
  historyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  startReadingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startReadingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  generateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5b4feb',
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    width: '100%',
    shadowColor: '#5b4feb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#c7d2fe',
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    width: Platform.OS === 'web' ? 400 : screenWidth,
  },
  inputCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  wordCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wordCountText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  textInputArea: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    minHeight: 120,
    padding: 16,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 12,
  },
  singleLineInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
    color: '#1e293b',
  },
  recentSetsLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  recentSetsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  recentSetsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recentSetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recentSetChipActive: {
    borderColor: '#5b4feb',
    backgroundColor: '#ede9fe',
  },
  recentSetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 6,
  },
  recentSetTextActive: {
    color: '#4338ca',
  },
  secondaryButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderColor: '#cbd5e1',
    borderWidth: 1,
    backgroundColor: '#f8fafc',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 13,
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  generateButtonDisabled: {
    opacity: 0.75,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  resultToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    width: '100%',
  },
  wordTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  wordTag: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  wordTagText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginLeft: 10,
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  scrollContentResult: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    width: Platform.OS === 'web' ? 400 : screenWidth,
  },
  resultSummaryCard: {
    width: '100%',
    borderRadius: 16,
    marginBottom: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  resultSummaryTitle: {
    color: '#3730a3',
    fontWeight: '700',
    fontSize: 14,
  },
  resultSummaryScore: {
    color: '#1e1b4b',
    fontWeight: '800',
    fontSize: 26,
    marginTop: 4,
  },
  resultSummarySub: {
    color: '#4338ca',
    fontWeight: '600',
    marginTop: 2,
  },
  readingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  readingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  readingCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIconBox: {
    backgroundColor: '#f1f5f9',
    padding: 6,
    borderRadius: 10,
    marginRight: 10,
  },
  readingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  ieltsBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ieltsBadgeText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  paragraph: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 16,
  },
  quizCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  optionButtonSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  optionButtonCorrect: {
    borderColor: '#10b981',
    backgroundColor: '#dcfce7',
  },
  optionButtonWrong: {
    borderColor: '#ef4444',
    backgroundColor: '#fee2e2',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionRadioSelected: {
    borderColor: '#6366f1',
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  optionTextSelected: {
    color: '#4338ca',
    fontWeight: '600',
  },
  quickNavContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    width: '100%',
    alignSelf: 'stretch',
  },
  quickNavBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
  },
  quickNavText: {
    fontSize: 12,
    color: '#919191',
    marginTop: 4,
  },
});
