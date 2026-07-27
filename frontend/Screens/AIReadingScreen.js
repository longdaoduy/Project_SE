import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    StatusBar,
    Platform,
    Dimensions,
    TouchableOpacity,
    ScrollView
} from 'react-native';

import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Dữ liệu giả lập cho Lịch sử bài đọc
const historyData = [
    { id: 1, title: 'The Story of the Fallen Hero', level: 'B2', time: '6 min', iconType: 'check', iconColor: '#10b981', bgColor: '#d1fae5' },
    { id: 2, title: 'The Science of Spaced Repetition', level: 'B1', time: '6 min', iconType: 'brain', iconColor: '#8b5cf6', bgColor: '#f3e8ff' },
    { id: 3, title: 'AI Transforming Language Learning', level: 'C1', time: '6 min', iconType: 'brain', iconColor: '#8b5cf6', bgColor: '#f3e8ff' },
];

export default function AIReadingScreen({ navigation }) {
    const [inputText, setInputText] = useState('');
    const [selectedAnswer, setSelectedAnswer] = useState(null);

    // Quản lý 3 trạng thái màn hình: 'input' | 'generated' | 'history'
    const [viewState, setViewState] = useState('input');

    // Quản lý bộ lọc ở màn hình lịch sử
    const [selectedFilter, setSelectedFilter] = useState('All');

    const handleGenerate = () => {
        if (inputText.trim() !== '') {
            setViewState('generated');
        }
    };

    const handleReset = () => {
        setViewState('input');
        setInputText('');
        setSelectedAnswer(null);
    };

    const wordCount = inputText.trim() === '' ? 0 : inputText.split(/[\s,]+/).filter(w => w.length > 0).length;

    // Filter dữ liệu lịch sử
    const filteredHistory = historyData.filter(item => selectedFilter === 'All' || item.level === selectedFilter);

    return (
        <View style={styles.webWrapper}>
            <LinearGradient
                colors={['#56509f', '#667eea']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.phoneContainer}
            >
                <StatusBar barStyle="light-content" />

                {/* Phần Header chung cho cả 3 màn hình */}
                <View style={styles.headerSection}>
                    <View style={styles.headerTopRow}>
                        {viewState !== 'input' ? (
                            <TouchableOpacity onPress={() => setViewState('input')} style={styles.backButton}>
                                <Ionicons name="chevron-back" size={24} color="#ffffff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backButtonPlaceholder} />
                        )}

                        <View style={styles.headerTitleContainer}>
                            <View style={styles.aiBadgeRow}>
                                <Ionicons name="sparkles" size={16} color="#fbbf24" />
                                <Text style={styles.aiBadgeText}>AI POWERED</Text>
                            </View>
                            <Text style={styles.appName}>Reading Generator</Text>
                        </View>

                        {/* Nút History chỉ hiện ở màn hình Input */}
                        {viewState === 'input' ? (
                            <TouchableOpacity onPress={() => setViewState('history')} style={styles.historyButton}>
                                <Ionicons name="time-outline" size={26} color="#ffffff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backButtonPlaceholder} />
                        )}
                    </View>

                    {/* Bộ lọc (Filters) chỉ hiện ở màn hình History */}
                    {viewState === 'history' && (
                        <View style={styles.filterRow}>
                            {['All', 'B1', 'B2', 'C1'].map(filter => (
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

                {/* Main Content Area */}
                <View style={styles.whiteCardContainer}>

                    {viewState === 'input' && (
                        /* ================= TRẠNG THÁI 1: NHẬP TỪ VỰNG ================= */
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
                                    multiline={true}
                                    placeholder="elusive, sustainable, acquire, proliferate..."
                                    placeholderTextColor="#94a3b8"
                                    value={inputText}
                                    onChangeText={setInputText}
                                    textAlignVertical="top"
                                />

                                <Text style={styles.recentSetsLabel}>RECENT SETS</Text>
                                <View style={styles.recentSetsRow}>
                                    <TouchableOpacity style={styles.recentSetChip}>
                                        <Ionicons name="document-text" size={14} color="#1e293b" />
                                        <Text style={styles.recentSetText}>IELTS Band 7</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.recentSetChip}>
                                        <Ionicons name="document-text" size={14} color="#1e293b" />
                                        <Text style={styles.recentSetText}>Environment</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.generateButton} activeOpacity={0.8} onPress={handleGenerate}>
                                <Ionicons name="color-wand" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.generateButtonText}>Generate Reading Test</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}

                    {viewState === 'generated' && (
                        /* ================= TRẠNG THÁI 2: HIỂN THỊ BÀI ĐỌC ================= */
                        <View style={{ flex: 1, width: '100%' }}>
                            <View style={styles.resultToolbar}>
                                <View style={styles.wordTagsRow}>
                                    <View style={styles.wordTag}><Text style={styles.wordTagText}>acquire</Text></View>
                                    <View style={styles.wordTag}><Text style={styles.wordTagText}>concede</Text></View>
                                </View>
                                <TouchableOpacity style={styles.newButton} onPress={handleReset}>
                                    <Ionicons name="refresh" size={14} color="#1e293b" style={{ marginRight: 4 }} />
                                    <Text style={styles.newButtonText}>New</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.scrollContentResult} showsVerticalScrollIndicator={false}>
                                <View style={styles.readingCard}>
                                    <View style={styles.readingCardHeader}>
                                        <View style={styles.readingCardTitleRow}>
                                            <View style={styles.documentIconBox}>
                                                <Ionicons name="document-text" size={16} color="#1e293b" />
                                            </View>
                                            <Text style={styles.readingCardTitle}>Reading Passage</Text>
                                        </View>
                                        <View style={styles.ieltsBadge}>
                                            <Text style={styles.ieltsBadgeText}>IELTS Style</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.paragraph}>
                                        In recent decades, the concept of sustainable development has become ubiquitous in global policy discussions. As nations struggle to mitigate the effects of climate change, governments and organisations must proliferate initiatives that balance economic growth with environmental stewardship.
                                    </Text>
                                    <Text style={styles.paragraph}>
                                        Pragmatic approaches to sustainability acknowledge that elusive solutions often require cooperation across borders. Countries that concede short-term economic advantages in favour of long-term ecological resilience tend to acquire greater stability.
                                    </Text>
                                </View>

                                <View style={styles.quizCard}>
                                    <Text style={styles.quizTitle}>Comprehension Check</Text>
                                    <Text style={styles.questionText}>
                                        1. According to the passage, what is required alongside technological innovation for the transition to renewable energy?
                                    </Text>

                                    <View style={styles.optionsContainer}>
                                        {['A. Immediate economic advantages', 'B. A shift in cultural perception', 'C. Global industrial output', 'D. Short-term ecological resilience'].map((option, index) => {
                                            const isSelected = selectedAnswer === option;
                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                                                    onPress={() => setSelectedAnswer(option)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                                                        {isSelected && <View style={styles.optionRadioInner} />}
                                                    </View>
                                                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                                        {option}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {viewState === 'history' && (
                        /* ================= TRẠNG THÁI 3: LỊCH SỬ TẠO ================= */
                        <ScrollView contentContainerStyle={styles.scrollContentHistory} showsVerticalScrollIndicator={false}>
                            {filteredHistory.map(item => (
                                <View key={item.id} style={styles.historyCard}>
                                    <View style={styles.historyCardTopRow}>
                                        <Text style={styles.historyCardTitle}>{item.title}</Text>
                                        <View style={[styles.historyIconCircle, { backgroundColor: item.bgColor }]}>
                                            {item.iconType === 'brain' ? (
                                                <FontAwesome5 name="brain" size={20} color={item.iconColor} />
                                            ) : (
                                                <Ionicons name="checkmark-circle-outline" size={24} color={item.iconColor} />
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.levelBadgeHistory}>
                                        <Text style={styles.levelBadgeHistoryText}>{item.level}</Text>
                                    </View>

                                    <View style={styles.historyCardFooter}>
                                        <View style={styles.timeRow}>
                                            <Ionicons name="time-outline" size={16} color="#94a3b8" style={{ marginRight: 4 }} />
                                            <Text style={styles.timeText}>{item.time}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.startReadingBtn}
                                            onPress={() => setViewState('generated')}
                                        >
                                            <Text style={styles.startReadingBtnText}>Start reading</Text>
                                            <Ionicons name="arrow-forward" size={16} color="#7c3aed" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Thanh điều hướng nhanh */}
                <View style={styles.quickNavContainer}>
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('Home')}>
                        <Ionicons name="home" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('WordListScreen')}>
                        <Ionicons name="book" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Words</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('PracticeScreen')}>
                        <Ionicons name="albums" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Cards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }}>
                        <Ionicons name="sparkles" size={20} color="#667eea" opacity={1} />
                        <Text style={{ fontSize: 12, color: '#667eea', marginTop: 4 }}>Read</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('VocabQuizScreen')}>
                        <Ionicons name="checkmark-circle" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Quiz</Text>
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
            }
        })
    },
    headerSection: {
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    backButton: {
        padding: 4,
    },
    backButtonPlaceholder: {
        width: 32, // Để cân bằng với nút back/history
    },
    historyButton: {
        padding: 4,
    },
    headerTitleContainer: {
        alignItems: 'center',
        flex: 1,
    },
    aiBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    aiBadgeText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginLeft: 6,
    },
    appName: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Style cho thanh bộ lọc của History
    filterRow: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 12,
        justifyContent: 'center',
    },
    filterChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    filterChipActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
    },
    filterChipText: {
        color: '#e2e8f0',
        fontWeight: '700',
        fontSize: 14,
    },
    filterChipTextActive: {
        color: '#ffffff',
    },

    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#F0F2FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        width: '100%',
        alignItems: 'center',
    },

    // ================= STYLES NHẬP TỪ =================
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 30,
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
        minHeight: 140,
        padding: 16,
        fontSize: 15,
        color: '#1e293b',
        marginBottom: 20,
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
    recentSetText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
        marginLeft: 6,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: '#7c3aed',
        width: '100%',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    generateButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },

    // ================= STYLES BÀI ĐỌC =================
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
        marginBottom: 16,
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

    // ================= STYLES LỊCH SỬ TẠO =================
    scrollContentHistory: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 20,
        width: Platform.OS === 'web' ? 400 : screenWidth,
    },
    historyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 20,
        width: '100%',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 3,
    },
    historyCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    historyCardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        flex: 1,
        paddingRight: 15,
        lineHeight: 24,
    },
    historyIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelBadgeHistory: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#8b5cf6',
        marginBottom: 20,
    },
    levelBadgeHistoryText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8b5cf6',
    },
    historyCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 14,
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
        color: '#7c3aed',
        marginRight: 6,
    },

    // ================= THANH ĐIỀU HƯỚNG =================
    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        width: '100%',
        alignSelf: 'stretch',
    },
});