import React, { useEffect, useState } from 'react';
import {Ionicons} from '@expo/vector-icons';
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
    ActivityIndicator,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VocabQuizScreen({navigation}) {
    const { decks } = useData();

    // 'select_deck' | 'select_mode' | 'quiz' | 'result'
    const [viewState, setViewState] = useState('select_deck');
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [selectedMode, setSelectedMode] = useState('mc'); // 'mc' | 'fill' | 'match' | 'speed'

    // STATE DỮ LIỆU NGƯỜI DÙNG (sẽ được nạp từ backend, không hard code trong JSX)
    const [userStats, setUserStats] = useState({
        totalQuizzes: 0,
        averageScore: 0,
        level: '',
    });
    const [statsLoading, setStatsLoading] = useState(true);

    // STATE QUẢN LÝ DỮ LIỆU CÂU HỎI & TRẠNG THÁI QUIZ
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [loading, setLoading] = useState(false);

    // MOCK DATA CÂU HỎI (sẽ được thay thế bằng API call khi có backend)
    const MOCK_QUIZ_DATA = [
        {
            id: 'q1',
            question: 'What does "Ubiquitous" mean ?',
            options: [
                'A. Rare and difficult to find in nature',
                'B. Seeming to be everywhere at the same time',
                'C. Extremely dangerous or harmful.',
                'D. Ancient and no longer in use'
            ],
            correctAnswer: 'B. Seeming to be everywhere at the same time',
        },
        {
            id: 'q2',
            question: 'What does "Accurate" mean ?',
            options: [
                'A. Very fast and efficient.',
                'B. Correct, exact, and without any mistakes.',
                'C. Difficult to understand or explain.',
                'D. Beautiful and well-designed.'
            ],
            correctAnswer: 'B. Correct, exact, and without any mistakes.',
        },
        {
            id: 'q3',
            question: 'What does "Postpone" mean ?',
            options: [
                'A. To cancel an event completely.',
                'B. To delay something to a later time.',
                'C. To advertise something on social media.',
                'D. To send a letter through the post office.'
            ],
            correctAnswer: 'B. To delay something to a later time.',
        },
    ];

    // MOCK DATA THỐNG KÊ NGƯỜI DÙNG (thay bằng response thật khi có backend)
    const MOCK_USER_STATS = {
        totalQuizzes: 36,
        correctAnswers: 30,
        incorrectAnswers: 6,
        level: 'B1',
    };

    const fetchQuizQuestions = async () => {
        try {
            setLoading(true);
            /* === KHI CÓ BACKEND API ===
            const response = await fetch(`https://your-api.com/api/quiz?deckId=${selectedDeck?.id}&mode=${selectedMode}`);
            const data = await response.json();
            setQuestions(data);
            =========================== */
            setTimeout(() => {
                setQuestions(MOCK_QUIZ_DATA);
                setLoading(false);
            }, 500);
        } catch (err) {
            console.error('Error fetching quiz:', err);
            setLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            setStatsLoading(true);
            /* === KHI CÓ BACKEND API ===
            const response = await fetch('https://your-api.com/api/user/stats');
            const data = await response.json();
            setUserStats({
                totalQuizzes: data.totalQuizzes,
                averageScore: Math.round((data.correctAnswers / data.totalQuizzes) * 100),
                level: data.level,
            });
            =========================== */
            setTimeout(() => {
                const total = MOCK_USER_STATS.correctAnswers + MOCK_USER_STATS.incorrectAnswers;
                setUserStats({
                    totalQuizzes: MOCK_USER_STATS.totalQuizzes,
                    averageScore: total > 0 ? Math.round((MOCK_USER_STATS.correctAnswers / total) * 100) : 0,
                    level: MOCK_USER_STATS.level,
                });
                setStatsLoading(false);
            }, 300);
        } catch (err) {
            console.error('Error fetching user stats:', err);
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserStats();
    }, []);

    const handleSelectDeck = (deck) => {
        setSelectedDeck(deck);
        setViewState('select_mode');
    };

    const handleStartQuiz = () => {
        setCurrentIndex(0);
        setSelectedOption(null);
        setScore(0);
        setIsSubmitted(false);
        setIsQuizEnded(false);
        fetchQuizQuestions();
        setViewState('quiz');
    };

    const handleSelectOption = (option) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const handleNextQuestion = () => {
        if (!selectedOption) return;

        const currentQ = questions[currentIndex];
        let isCorrect = selectedOption === currentQ.correctAnswer;
        let newScore = score;

        if (isCorrect) {
            newScore = score + 1;
            setScore(newScore);
        }

        if (currentIndex + 1 < questions.length) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedOption(null);
        } else {
            setIsQuizEnded(true);
            submitQuizResult(newScore);
        }
    };

    const submitQuizResult = async (finalScore) => {
        /* === TÍCH HỢP BACKEND ===
        await fetch('https://your-api.com/api/quiz/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deckId: selectedDeck?.id, mode: selectedMode, score: finalScore, total: questions.length }),
        });
        ======================== */
        console.log('Submitted Quiz result:', { deckId: selectedDeck?.id, mode: selectedMode, score: finalScore, total: questions.length });
    };

    const handleRestart = () => {
        handleStartQuiz();
    };

    const handleBackToDeckSelect = () => {
        setViewState('select_deck');
        setSelectedDeck(null);
        setSelectedMode('mc');
    };

    const handleBackToModeSelect = () => {
        setViewState('select_mode');
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A487" />
            </View>
        );
    }

    const currentQ = questions[currentIndex];

    // Navigate to dedicated quiz mode screen
    const navigateToQuizMode = () => {
        if (!selectedDeck) return;
        const screenMap = {
            mc: 'QuizMultipleChoice',
            fill: 'QuizFillInBlank',
            match: 'QuizMatching',
            speed: 'QuizSpeedRound',
        };
        const screenName = screenMap[selectedMode];
        if (screenName) {
            navigation.navigate(screenName, { deckId: selectedDeck.id, deckTitle: selectedDeck.title });
        }
    };

    return (
        <View style={styles.webWrapper}>
            <LinearGradient
                colors={['#16A487', '#3FC5B7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.phoneContainer}
            >
                <StatusBar barStyle="light-content" />
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => {
                        if (viewState === 'select_deck') navigation.goBack();
                        else if (viewState === 'select_mode') handleBackToDeckSelect();
                        else handleBackToModeSelect();
                    }} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.appName}>Vocabulary Quiz</Text>
                        <Text style={styles.appSubtitle}>
                            {viewState === 'select_deck' ? 'Select a deck' : 
                             viewState === 'select_mode' ? (selectedDeck?.title || 'Choose mode') : 
                             'Test your knowledge'}
                        </Text>
                    </View>
                </View>

                {/* CONTINUOUS PROGRESS BAR KHI DANG TRONG MAN QUIZ */}
                {viewState === 'quiz' && !isQuizEnded && (
                    <View style={styles.progressSection}>
                        <View style={styles.segmentContainer}>
                            {questions.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.segmentBar,
                                        index <= currentIndex ? styles.activeSegment : styles.inactiveSegment,
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* 1. MAN HINH CHON DECK */}
                {viewState === 'select_deck' && (
                    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.whiteCardContainer}>
                            {/* USER STATS ROW */}
                            <View style={styles.statsRow}>
                                <View style={styles.statsCard}>
                                    <Image source={require('../assets/trophy.png')} style={{ width: 25, height: 25, marginBottom: 4, resizeMode: 'contain' }} />
                                    <Text style={styles.statsValue}>
                                        {statsLoading ? '-' : userStats.totalQuizzes}
                                    </Text>
                                    <Text style={styles.statsLabel}>Quizzes</Text>
                                </View>
                                <View style={styles.statsCard}>
                                    <Image source={require('../assets/target.png')} style={{ width: 22, height: 22, marginBottom: 4, resizeMode: 'contain' }} />
                                    <Text style={styles.statsValue}>
                                        {statsLoading ? '-' : `${userStats.averageScore}%`}
                                    </Text>
                                    <Text style={styles.statsLabel}>Avg Scores</Text>
                                </View>
                                <View style={styles.statsCard}>
                                    <Image source={require('../assets/level-up.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                                    <Text style={styles.statsValue}>
                                        {statsLoading ? '-' : userStats.level}
                                    </Text>
                                    <Text style={styles.statsLabel}>Eng-Level</Text>
                                </View>
                            </View>

                            {/* DECK SELECTION */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Choose a Deck</Text>
                                
                                {decks.length === 0 ? (
                                    <View style={styles.emptyDecksContainer}>
                                        <Ionicons name="albums-outline" size={48} color="#94a3b8" />
                                        <Text style={styles.emptyDecksText}>No decks available</Text>
                                        <Text style={styles.emptyDecksSubText}>Create a deck first in Flashcards</Text>
                                    </View>
                                ) : (
                                    decks.map((deck) => (
                                        <TouchableOpacity
                                            key={deck.id}
                                            style={[styles.deckSelectCard, selectedDeck?.id === deck.id && styles.deckSelectCardActive]}
                                            onPress={() => handleSelectDeck(deck)}
                                        >
                                            <View style={styles.deckSelectInfo}>
                                                <View style={[styles.deckSelectIcon, { backgroundColor: '#E3D5FF' }]}>
                                                    <Ionicons name="clipboard-outline" size={22} color="#5500FF" />
                                                </View>
                                                <View style={styles.deckSelectTextBlock}>
                                                    <Text style={styles.deckSelectTitle}>{deck.title}</Text>
                                                    <Text style={styles.deckSelectMeta}>
                                                        {deck.currentWords} / {deck.totalWords} words • {deck.level}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.radioDeckCircle, selectedDeck?.id === deck.id && styles.radioDeckSelected]} />
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        </View>
                    </ScrollView>
                )}

                {/* 2. MAN HINH CHON CHE DO QUIZ */}
                {viewState === 'select_mode' && (
                    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.whiteCardContainer}>
                            {/* SELECTED DECK INFO */}
                            {selectedDeck && (
                                <View style={styles.selectedDeckBanner}>
                                    <Ionicons name="clipboard-outline" size={18} color="#ffffff" />
                                    <Text style={styles.selectedDeckBannerText}>{selectedDeck.title}</Text>
                                </View>
                            )}

                            {/* QUIZ MODE SELECTION */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Quiz Mode</Text>
                                
                                <TouchableOpacity 
                                    style={[styles.modeCard, selectedMode === 'mc' && styles.activeModeCard]}
                                    onPress={() => setSelectedMode('mc')}
                                >
                                    <View style={[styles.modeIconBox, { backgroundColor: '#E3D5FF' }]}>
                                        <Ionicons name="checkbox-outline" size={22} color="#5500FF" />
                                    </View>
                                    <View style={styles.modeInfo}>
                                        <Text style={styles.modeTitle}>Multiple Choice</Text>
                                        <Text style={styles.modeSub}>Pick correct definition</Text>
                                    </View>
                                    <View style={[styles.radioCircle, selectedMode === 'mc' && styles.radioSelected]} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.modeCard, selectedMode === 'fill' && styles.activeModeCard]}
                                    onPress={() => setSelectedMode('fill')}
                                >
                                    <View style={[styles.modeIconBox, { backgroundColor: '#85FFC3' }]}>
                                        <MaterialCommunityIcons name="format-line-spacing" size={22} color="#16A487" />
                                    </View>
                                    <View style={styles.modeInfo}>
                                        <Text style={styles.modeTitle}>Fill in the blank</Text>
                                        <Text style={styles.modeSub}>Complete the sentence</Text>
                                    </View>
                                    <View style={[styles.radioCircle, selectedMode === 'fill' && styles.radioSelected]} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.modeCard, selectedMode === 'match' && styles.activeModeCard]}
                                    onPress={() => setSelectedMode('match')}
                                >
                                    <View style={[styles.modeIconBox, { backgroundColor: '#A7CDFE' }]}>
                                        <Ionicons name="git-compare-outline" size={22} color="#006FFF" />
                                    </View>
                                    <View style={styles.modeInfo}>
                                        <Text style={styles.modeTitle}>Word matching</Text>
                                        <Text style={styles.modeSub}>Drag and match pairs</Text>
                                    </View>
                                    <View style={[styles.radioCircle, selectedMode === 'match' && styles.radioSelected]} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.modeCard, selectedMode === 'speed' && styles.activeModeCard]}
                                    onPress={() => setSelectedMode('speed')}
                                >
                                    <View style={[styles.modeIconBox, { backgroundColor: '#FFF9A5' }]}>
                                        <Ionicons name="flash-outline" size={22} color="#FFCE0A" />
                                    </View>
                                    <View style={styles.modeInfo}>
                                        <Text style={styles.modeTitle}>Speed Round</Text>
                                        <Text style={styles.modeSub}>Time restriction</Text>
                                    </View>
                                    <View style={[styles.radioCircle, selectedMode === 'speed' && styles.radioSelected]} />
                                </TouchableOpacity>
                            </View>

                            {/* START BUTTON - Navigate to dedicated quiz screen */}
                            <TouchableOpacity style={styles.startQuizBtn} onPress={navigateToQuizMode}>
                                <Ionicons name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.startQuizBtnText}>Start Quiz</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                )}
    
                {/*Thanh điều hướng nhanh đến các màn hình khác*/}
                <View style={styles.quickNavContainer}>
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('Home')}>
                        <Ionicons name="home" size={20} color="#919191" opacity={1} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('FlashcardScreen')}>
                        <Ionicons name="albums" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Cards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('WordlistScreen')}>
                        <Ionicons name="book" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Words</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('AIReadingScreen')}>
                        <Ionicons name="sparkles" size={20} color="#919191" opacity={0.3} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Reading</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }}>
                        <Ionicons name="checkmark-circle" size={20} color="#667eea" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#667eea', marginTop: 4 }}>Quiz</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    )
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
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    headerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    appName: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    appSubtitle: {
        fontSize: 16,
        color: '#e2e8f0',
        opacity: 0.9,
    },
    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#F0F2FF',
        width: '100%',
        minHeight: 450,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    headerTextContainer: {
        marginLeft: 16,
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
    statsRow: {
        flexDirection: 'row',
        marginTop: 20,
        width: '100%',
    },
    statsCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        marginHorizontal: 5,
    },
    statsValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000000',
    },
    statsLabel: {
        fontSize: 14,
        color: '#000000',
        fontWeight: '500',
    },
    sectionBlock: {
        width: '100%',
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 12,
    },
    // Deck Selection Styles
    deckSelectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    deckSelectCardActive: {
        borderColor: '#16A487',
        backgroundColor: '#f0fdf4',
    },
    deckSelectInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    deckSelectIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    deckSelectTextBlock: {
        flex: 1,
    },
    deckSelectTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    deckSelectMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    radioDeckCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#cbd5e1',
    },
    radioDeckSelected: {
        borderColor: '#16A487',
        backgroundColor: '#16A487',
    },
    emptyDecksContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
        backgroundColor: '#ffffff',
        borderRadius: 16,
    },
    emptyDecksText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 12,
    },
    emptyDecksSubText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    // Selected Deck Banner
    selectedDeckBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(22, 164, 135, 0.15)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        width: '100%',
        marginTop: 16,
        gap: 8,
    },
    selectedDeckBannerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16A487',
    },
    // Mode Selection Styles
    modeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    activeModeCard: {
        borderColor: '#16A487',
        backgroundColor: '#f0fdf4',
    },
    modeIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    modeInfo: {
        flex: 1,
    },
    modeTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    modeSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#cbd5e1',
    },
    radioSelected: {
        borderColor: '#16A487',
        backgroundColor: '#16A487',
    },
    startQuizBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        backgroundColor: '#16A487',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    startQuizBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    progressSection: {
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
    },
    segmentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
    },
    segmentBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    activeSegment: {
        backgroundColor: '#ffffff',
    },
    inactiveSegment: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f2ff',
    },
    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        width: '100%',
        alignSelf: 'stretch',
    },
});
