import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import { getMyHistory, getUserHistoryPage, getMyStatistics, getUserStats } from '../api';

const { width: screenWidth } = Dimensions.get('window');
const PAGE_SIZE = 20;

const TABS = [
  { id: 'ALL', label: 'All', icon: 'apps-outline', type: null },
  { id: 'Flashcard', label: 'Flashcards', icon: 'albums-outline', type: 'Flashcard' },
  { id: 'Quiz', label: 'Quizzes', icon: 'checkmark-circle-outline', type: 'Quiz' },
  { id: 'AI Reading', label: 'AI Reading', icon: 'sparkles-outline', type: 'AI Reading' },
];

export default function HistoryScreen({ navigation }) {
  const { token, userId } = useData();

  const [selectedTab, setSelectedTab] = useState('ALL');
  const [historyItems, setHistoryItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [stats, setStats] = useState({
    totalActivities: 0,
    avgAccuracy: 0,
    studyHours: 0,
    totalXp: 0,
  });

  // ── Load overall stats for summary header ─────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      let data = null;
      if (token) {
        data = await getMyStatistics(token).catch(() => null);
      } else if (userId) {
        data = await getUserStats(userId).catch(() => null);
      }
      if (data) {
        const total = (data.total_flashcards || 0) + (data.total_quizzes || 0);
        setStats({
          totalActivities: total,
          avgAccuracy: Math.round(data.average_score || 0),
          studyHours: Math.round((data.study_hours || 0) * 10) / 10,
          totalXp: data.total_xp || 0,
        });
      }
    } catch (_) { }
  }, [token, userId]);

  // ── Fetch history page ───────────────────────────────────────────────────────
  const fetchHistory = useCallback(
    async (reset = false, tabKey = selectedTab) => {
      if (!token && !userId) {
        setLoading(false);
        return;
      }

      try {
        const currentOffset = reset ? 0 : offset;
        const currentTab = TABS.find((t) => t.id === tabKey);
        const activityType = currentTab ? currentTab.type : null;

        const params = {
          limit: PAGE_SIZE,
          offset: currentOffset,
        };
        if (activityType) {
          params.activity_type = activityType;
        }

        let response = null;
        if (token) {
          response = await getMyHistory(token, params);
        } else {
          response = await getUserHistoryPage(userId, params);
        }

        const items = response?.items || [];
        const total = response?.total || 0;
        const more = response?.has_more ?? (currentOffset + items.length < total);

        if (reset) {
          setHistoryItems(items);
          setOffset(items.length);
        } else {
          setHistoryItems((prev) => [...prev, ...items]);
          setOffset((prev) => prev + items.length);
        }

        setTotalCount(total);
        setHasMore(more);
        setError('');
      } catch (err) {
        setError(err.message || 'Could not load learning history');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token, userId, offset, selectedTab]
  );

  // Initial load or tab change
  useEffect(() => {
    setLoading(true);
    setOffset(0);
    loadStats();
    fetchHistory(true, selectedTab);
  }, [selectedTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    loadStats();
    fetchHistory(true, selectedTab);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    fetchHistory(false, selectedTab);
  };

  // ── Helper formatters ────────────────────────────────────────────────────────
  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      if (isToday) return `Today, ${timeStr}`;

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return `Yesterday, ${timeStr}`;

      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year} • ${timeStr}`;
    } catch (_) {
      return isoString;
    }
  };

  const getActivityConfig = (type) => {
    switch (type) {
      case 'Flashcard':
        return {
          title: 'Flashcards Session',
          subtitle: 'Vocabulary review & SRS',
          iconName: 'albums',
          color: '#6366f1',
          bgLight: '#eef2ff',
          badgeText: 'SRS Deck',
        };
      case 'Quiz':
        return {
          title: 'Vocabulary Quiz',
          subtitle: 'Practice & testing',
          iconName: 'checkmark-circle',
          color: '#10b981',
          bgLight: '#ecfdf5',
          badgeText: 'Quiz Test',
        };
      case 'AI Reading':
        return {
          title: 'AI Reading Comprehension',
          subtitle: 'Context & passage test',
          iconName: 'sparkles',
          color: '#8b5cf6',
          bgLight: '#f5f3ff',
          badgeText: 'AI Reading',
        };
      default:
        return {
          title: type || 'Learning Activity',
          subtitle: 'Self-study session',
          iconName: 'book',
          color: '#64748b',
          bgLight: '#f1f5f9',
          badgeText: type,
        };
    }
  };

  // ── Render each History Card ────────────────────────────────────────────────
  const renderHistoryItem = ({ item }) => {
    const config = getActivityConfig(item.activity_type);
    const accuracy = item.accuracy != null ? Math.round(item.accuracy) : null;
    const score = item.score != null ? item.score : null;
    const duration = item.duration != null ? item.duration : 1;

    let xpEarned = 0;
    if (item.activity_type === 'Flashcard') {
      xpEarned = duration * 2;
    } else if (item.activity_type === 'Quiz') {
      xpEarned = Math.round(Number(score || 0)) * 5;
    } else if (item.activity_type === 'AI Reading') {
      xpEarned = Math.floor(Number(accuracy || 0) / 10) * 3;
    }

    return (
      <View style={styles.historyCard}>
        {/* Top row: Icon + Title + Timestamp */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIconContainer, { backgroundColor: config.bgLight }]}>
            <Ionicons name={config.iconName} size={22} color={config.color} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{config.title}</Text>
              <View style={[styles.typeBadge, { backgroundColor: config.bgLight }]}>
                <Text style={[styles.typeBadgeText, { color: config.color }]}>
                  {config.badgeText}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDate}>{formatDate(item.completed_at)}</Text>
          </View>
        </View>

        {/* Metrics divider */}
        <View style={styles.cardDivider} />

        {/* Bottom row: Score / Accuracy / Duration / XP badges */}
        <View style={styles.cardFooter}>
          {accuracy !== null && (
            <View style={styles.metricBadge}>
              <Ionicons
                name={accuracy >= 80 ? 'ribbon' : 'analytics-outline'}
                size={14}
                color={accuracy >= 80 ? '#16a34a' : '#eab308'}
              />
              <Text
                style={[
                  styles.metricText,
                  { color: accuracy >= 80 ? '#16a34a' : accuracy >= 50 ? '#ca8a04' : '#ef4444' },
                ]}
              >
                {accuracy}% Acc
              </Text>
            </View>
          )}

          {score !== null && (
            <View style={styles.metricBadge}>
              <Text style={styles.metricLabel}>Score:</Text>
              <Text style={styles.metricValue}>{score} pts</Text>
            </View>
          )}

          <View style={styles.metricBadge}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.metricText}>{duration} min</Text>
          </View>

          {xpEarned > 0 && (
            <View style={[styles.metricBadge, styles.xpBadge]}>
              <Text style={styles.xpText}>+{xpEarned} XP</Text>
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

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Image
              source={require('../assets/back.png')}
              style={{ width: 16, height: 16, resizeMode: 'contain' }}
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.appName}>Learning History</Text>
            <Text style={styles.appSubtitle}>
              {totalCount > 0 ? `${totalCount} activities recorded` : 'Track your learning journey'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* ── SUMMARY STATS BANNER ────────────────────────────────────────── */}
        <View style={styles.statsBanner}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.totalActivities}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.avgAccuracy}%</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.studyHours}h</Text>
            <Text style={styles.statLabel}>Study Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.totalXp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
        </View>

        {/* ── WHITE CONTAINER WITH TABS & LIST ──────────────────────────────── */}
        <View style={styles.whiteCardContainer}>
          {/* TAB FILTER BAR */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const active = selectedTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabButton, active && styles.activeTabButton]}
                  onPress={() => setSelectedTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.tabButtonText, active && styles.activeTabButtonText]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* LIST / LOADING / ERROR */}
          {loading && !refreshing ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={historyItems}
              renderItem={renderHistoryItem}
              keyExtractor={(item, index) =>
                item.history_id ? String(item.history_id) : `history-${index}`
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#667eea']}
                  tintColor="#667eea"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="time-outline" size={48} color="#94a3b8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Activities Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedTab === 'ALL'
                      ? "You haven't completed any practice sessions yet. Start with Flashcards or a Quiz!"
                      : `No ${selectedTab} activities recorded yet.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => navigation.navigate('Home')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.startBtnText}>Start Practicing Now</Text>
                  </TouchableOpacity>
                </View>
              }
              ListFooterComponent={
                hasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#667eea" />
                    ) : (
                      <Text style={styles.loadMoreText}>Load More Activities</Text>
                    )}
                  </TouchableOpacity>
                ) : historyItems.length > 0 ? (
                  <Text style={styles.endOfListText}>— End of learning history —</Text>
                ) : null
              }
            />
          )}
        </View>

        {/* ── QUICK NAV ────────────────────────────────────────────────────── */}
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
            <Ionicons name="book" size={20} color="#919191" />
            <Text style={styles.navText}>Words</Text>
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
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
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
  headerActionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
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

  // ── Stats Summary Banner ──
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: '#e0e7ff',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // ── White Card Container ──
  whiteCardContainer: {
    flex: 1,
    backgroundColor: '#F0F2FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    overflow: 'hidden',
    paddingHorizontal: 10
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 6,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeTabButton: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },

  // ── History Card ──
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
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
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  typeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginLeft: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  xpBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    marginLeft: 'auto',
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706',
  },

  // ── States ──
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  startBtn: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadMoreBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadMoreText: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '600',
  },
  endOfListText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 14,
  },

  // ── Quick Nav ──
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
});
