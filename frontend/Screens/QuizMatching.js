import React, { useEffect, useState } from 'react';
import {
    StyleSheet, Text, View, ScrollView, StatusBar, Platform, Dimensions,
    TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

export default function QuizMatching({ navigation, route }) {
    const { deckId, deckTitle } = route.params || {};

    const [pairs, setPairs] = useState([]);
    const [leftItems, setLeftItems] = useState([]);
    const [rightItems, setRightItems] = useState([]);
    const [selectedLeft, setSelectedLeft] = useState(null);
    const [matchedPairs, setMatchedPairs] = useState([]);
    const [score, setScore] = useState(0);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [loading, setLoading] = useState(true);

    const MOCK_PAIRS = [
        { id: 'p1', word: 'Ubiquitous', definition: 'Seeming to be everywhere' },
        { id: 'p2', word: 'Accurate', definition: 'Correct and exact' },
        { id: 'p3', word: 'Postpone', definition: 'Delay to a later time' },
        { id: 'p4', word: 'Beneficial', definition: 'Having a good effect' },
    ];

    useEffect(() => {
        setTimeout(() => {
            const shuffledLeft = [...MOCK_PAIRS].sort(() => Math.random() - 0.5);
            const shuffledRight = [...MOCK_PAIRS].sort(() => Math.random() - 0.5);
            setPairs(MOCK_PAIRS);
            setLeftItems(shuffledLeft.map(p => ({ ...p, side: 'left' })));
            setRightItems(shuffledRight.map(p => ({ ...p, side: 'right' })));
            setLoading(false);
        }, 400);
    }, [deckId]);

    const isMatched = (itemId) => matchedPairs.includes(itemId);

    const handleSelectLeft = (item) => {
        if (isMatched(item.id)) return;
        setSelectedLeft(item);
    };

    const handleSelectRight = (item) => {
        if (isMatched(item.id) || !selectedLeft) return;

        const isCorrect = selectedLeft.id === item.id;
        if (isCorrect) {
            const newMatched = [...matchedPairs, item.id];
            setMatchedPairs(newMatched);
            setScore(prev => prev + 1);
            setSelectedLeft(null);

            if (newMatched.length === pairs.length) {
                setIsQuizEnded(true);
            }
        } else {
            setSelectedLeft(null);
        }
    };

    const handleRestart = () => {
        const shuffledLeft = [...pairs].sort(() => Math.random() - 0.5);
        const shuffledRight = [...pairs].sort(() => Math.random() - 0.5);
        setLeftItems(shuffledLeft.map(p => ({ ...p, side: 'left' })));
        setRightItems(shuffledRight.map(p => ({ ...p, side: 'right' })));
        setSelectedLeft(null);
        setMatchedPairs([]);
        setScore(0);
        setIsQuizEnded(false);
    };

    if (loading) {
        return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#006FFF" /></View>;
    }

    if (isQuizEnded) {
        return (
            <View style={styles.webWrapper}>
                <LinearGradient colors={['#006FFF', '#4F9FFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>Quiz Complete</Text>
                            <Text style={styles.appSubtitle}>{deckTitle || 'Word Matching'}</Text>
                        </View>
                    </View>
                    <View style={styles.whiteCardContainer}>
                        <View style={styles.resultBannerCard}>
                            <View style={styles.trophyCircle}><Ionicons name="trophy" size={32} color="#eab308" /></View>
                            <Text style={styles.resultScoreText}>{score}/{pairs.length}</Text>
                            <Text style={styles.resultMotivationText}>Practice makes perfect</Text>
                        </View>
                        <View style={styles.resultMetricsRow}>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#006FFF' }]}>{score}</Text><Text style={styles.metricLabel}>Correct</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#ef4444' }]}>{pairs.length - score}</Text><Text style={styles.metricLabel}>Wrong</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#6366f1' }]}>{Math.round((score / pairs.length) * 100)}%</Text><Text style={styles.metricLabel}>Accuracy</Text></View>
                        </View>
                        <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
                            <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} /><Text style={styles.restartButtonText}>Restart</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backToMenuBtn} onPress={() => navigation.goBack()}><Text style={styles.backToMenuText}>Back to Quiz Menu</Text></TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.webWrapper}>
            <LinearGradient colors={['#006FFF', '#4F9FFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                <StatusBar barStyle="light-content" />
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.appName}>Word Matching</Text>
                        <Text style={styles.appSubtitle}>{deckTitle || 'Match words with definitions'}</Text>
                    </View>
                </View>

                <View style={styles.scoreBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                    <Text style={styles.scoreBadgeText}>{matchedPairs.length}/{pairs.length} matched</Text>
                </View>

                <View style={styles.whiteCardContainer}>
                    <View style={styles.matchingInstruction}>
                        <Text style={styles.instructionText}>
                            {selectedLeft ? 'Now tap the matching definition' : 'Tap a word on the left'}
                        </Text>
                    </View>

                    <View style={styles.matchingColumns}>
                        <View style={styles.column}>
                            <Text style={styles.columnLabel}>Words</Text>
                            {leftItems.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.matchCard,
                                        isMatched(item.id) && styles.matchCardMatched,
                                        selectedLeft?.id === item.id && styles.matchCardSelected,
                                    ]}
                                    onPress={() => handleSelectLeft(item)}
                                    disabled={isMatched(item.id)}
                                >
                                    <Text style={[styles.matchCardText, isMatched(item.id) && styles.matchCardTextMatched]}>
                                        {isMatched(item.id) ? '✓' : item.word}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.column}>
                            <Text style={styles.columnLabel}>Definitions</Text>
                            {rightItems.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.matchCard,
                                        isMatched(item.id) && styles.matchCardMatched,
                                    ]}
                                    onPress={() => handleSelectRight(item)}
                                    disabled={isMatched(item.id)}
                                >
                                    <Text style={[styles.matchCardText, isMatched(item.id) && styles.matchCardTextMatched]}>
                                        {isMatched(item.id) ? '✓' : item.definition}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    webWrapper: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent', justifyContent: 'center', alignItems: 'center' },
    phoneContainer: { width: Platform.OS === 'web' ? 400 : '100%', height: Platform.OS === 'web' ? 800 : '100%', borderRadius: Platform.OS === 'web' ? 35 : 0, overflow: 'hidden', ...Platform.select({ web: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 } }) },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2ff' },
    headerSection: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 10 },
    backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
    headerTextContainer: { marginLeft: 16 },
    appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
    appSubtitle: { fontSize: 13, color: '#e2e8f0', opacity: 0.85 },
    scoreBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, gap: 6, marginBottom: 10 },
    scoreBadgeText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
    matchingInstruction: { backgroundColor: '#ffffff', padding: 12, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
    instructionText: { fontSize: 14, fontWeight: '600', color: '#334155' },
    matchingColumns: { flexDirection: 'row', width: '100%', gap: 10, flex: 1, paddingBottom: 20 },
    column: { flex: 1, gap: 8 },
    columnLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
    matchCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    matchCardSelected: { borderColor: '#006FFF', backgroundColor: '#f0f7ff' },
    matchCardMatched: { borderColor: '#22c55e', backgroundColor: '#f0fdf4', opacity: 0.8 },
    matchCardText: { fontSize: 13, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
    matchCardTextMatched: { color: '#22c55e', fontWeight: '700' },
    // Result
    resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
    trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
    resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
    resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
    metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center' },
    metricValue: { fontSize: 20, fontWeight: '800' },
    metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
    restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#006FFF', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
    backToMenuText: { color: '#006FFF', fontSize: 14, fontWeight: '600' },
});
