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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';
import {
  getMyStatistics,
  getUserStats,
  getMyHistory,
  getUserHistory,
  getUserLoginLogs,
  getMe,
} from '../api';

const { width: screenWidth } = Dimensions.get('window');

export default function NotificationScreen({ navigation }) {
  const { token, userId, currentUser } = useData();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Build Dynamic Notifications from Backend Data ────────────────────────────
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const [stats, historyData, logs, user] = await Promise.all([
        token ? getMyStatistics(token).catch(() => null) : userId ? getUserStats(userId).catch(() => null) : null,
        token ? getMyHistory(token, { limit: 5, offset: 0 }).catch(() => null) : userId ? getUserHistory(userId, { limit: 5 }).catch(() => null) : null,
        userId ? getUserLoginLogs(userId, 3).catch(() => []) : Promise.resolve([]),
        token ? getMe(token).catch(() => currentUser) : currentUser,
      ]);

      const list = [];
      let idCounter = 1;

      // 1. Streak Alert
      const streak = stats?.current_streak || 0;
      list.push({
        id: `streak-${idCounter++}`,
        type: 'Streak',
        title: streak > 0 ? `Active Streak: ${streak} Days! 🔥` : 'Start Your Streak Today!',
        message:
          streak > 0
            ? `Awesome job! You have practiced ${streak} days in a row. Complete today's session to keep the momentum going.`
            : 'Practice today with Flashcards or Quizzes to start your daily learning streak.',
        time: 'Today',
        isRead: false,
        actionRoute: 'FlashcardScreen',
      });

      // 2. Daily Goal Alert
      const target = user?.daily_goal || 20;
      const learned = stats?.total_words || 0;
      const remaining = Math.max(target - (learned % target), 0);
      list.push({
        id: `goal-${idCounter++}`,
        type: 'Studying',
        title: `Daily Goal: ${target} Words`,
        message:
          remaining === 0
            ? "Congratulations! You've crushed your daily goal for today."
            : `You have ${remaining} more words to practice to reach today's target.`,
        time: 'Today',
        isRead: false,
        actionRoute: 'WordlistScreen',
      });

      // 3. Level & XP Achievement
      const xp = stats?.total_xp || 0;
      const level = Math.max(1, Math.floor(xp / 100) + 1);
      list.push({
        id: `level-${idCounter++}`,
        type: 'Achievement',
        title: `Level ${level} Explorer (XP: ${xp})`,
        message: `You have accumulated ${xp} total XP. Reach ${(level) * 100} XP to level up!`,
        time: '1 day ago',
        isRead: false,
        actionRoute: 'Profile',
      });

      // 4. Recent Learning Activities
      const recentActivities = historyData?.items || (Array.isArray(historyData) ? historyData : []);
      if (recentActivities.length > 0) {
        const latest = recentActivities[0];
        const acc = latest.accuracy != null ? Math.round(latest.accuracy) : null;
        list.push({
          id: `activity-${idCounter++}`,
          type: latest.activity_type === 'Quiz' ? 'Achievement' : 'Studying',
          title: `Recent ${latest.activity_type} Practice`,
          message:
            acc !== null
              ? `You finished a ${latest.activity_type} session with ${acc}% accuracy.`
              : `You completed a ${latest.activity_type} session. Check your full history for breakdown.`,
          time: latest.completed_at ? 'Recently' : '2 days ago',
          isRead: false,
          actionRoute: 'HistoryScreen',
        });
      }

      // 5. Security Login Logs
      if (logs && logs.length > 0) {
        const latestLog = logs[0];
        list.push({
          id: `login-${idCounter++}`,
          type: 'Security',
          title: `Account Login (${latestLog.login_status})`,
          message: `Login detected from ${latestLog.device_name || 'App Client'}${
            latestLog.ip_address ? ` (${latestLog.ip_address})` : ''
          }.`,
          time: latestLog.login_time ? 'Recent' : '3 days ago',
          isRead: true,
          actionRoute: null,
        });
      }

      setNotifications(list);
    } catch (e) {
      console.warn('loadNotifications error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, userId, currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  // 1. Mark item as read and navigate
  const handlePressNotification = (item) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    if (item.actionRoute) {
      navigation.navigate(item.actionRoute);
    }
  };

  // 2. Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  // 3. Render icon based on type
  const renderNotificationsIcon = (type) => {
    switch (type) {
      case 'Streak':
        return (
          <View style={[styles.iconBadge, { backgroundColor: '#ffedd5' }]}>
            <Ionicons name="flame" size={20} color="#f97316" />
          </View>
        );
      case 'Achievement':
        return (
          <View style={[styles.iconBadge, { backgroundColor: '#fef9c3' }]}>
            <Ionicons name="trophy" size={20} color="#eab308" />
          </View>
        );
      case 'Studying':
        return (
          <View style={[styles.iconBadge, { backgroundColor: '#e0e7ff' }]}>
            <Ionicons name="book" size={20} color="#6366f1" />
          </View>
        );
      case 'Security':
        return (
          <View style={[styles.iconBadge, { backgroundColor: '#ecfdf5' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          </View>
        );
      default:
        return (
          <View style={[styles.iconBadge, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name="notifications" size={20} color="#64748b" />
          </View>
        );
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => handlePressNotification(item)}
      style={[
        styles.notificationItem,
        item.isRead ? styles.readNotification : styles.unreadNotification,
      ]}
    >
      <View style={styles.notificationIcon}>{renderNotificationsIcon(item.type)}</View>

      <View style={styles.notificationContent}>
        <View style={styles.cardTopRow}>
          <Text
            style={[
              styles.notificationTitle,
              !item.isRead && styles.unreadTitleText,
            ]}
          >
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        {item.message ? (
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
        ) : null}

        <View style={styles.cardBottomRow}>
          <Text style={styles.notificationTime}>{item.time}</Text>
          {item.actionRoute ? (
            <Text style={styles.actionPrompt}>Tap to view →</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.webWrapper}>
      <LinearGradient
        colors={['#654190', '#667eea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.phoneContainer}
      >
        <StatusBar barStyle="light-content" />

        {/* ── HEADER ── */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Image
              source={require('../assets/back.png')}
              style={{ width: 16, height: 16, resizeMode: 'contain' }}
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.appName}>Notifications</Text>
            <Text style={styles.appSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </Text>
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={styles.markAllButton}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done" size={18} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        {/* ── CONTENT CONTAINER ── */}
        <View style={styles.whiteCardContainer}>
          {loading && !refreshing ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.stateText}>Loading notifications...</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              style={{ width: '100%' }}
              contentContainerStyle={styles.notificationsList}
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
                  <Ionicons name="notifications-off-outline" size={54} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptyText}>
                    You're all up to date. Keep learning to earn new badges and maintain your streak!
                  </Text>
                </View>
              }
            />
          )}
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
    paddingBottom: 14,
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
  markAllButton: {
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

  whiteCardContainer: {
    flex: 1,
    backgroundColor: '#F0F2FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    overflow: 'hidden',
  },
  notificationsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  unreadNotification: {
    backgroundColor: '#ffffff',
    borderColor: '#c7d2fe',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  readNotification: {
    backgroundColor: '#fafafa',
    opacity: 0.88,
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  unreadTitleText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginLeft: 6,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actionPrompt: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
  },

  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 30,
  },
  stateText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});