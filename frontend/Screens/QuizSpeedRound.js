import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    StyleSheet, Text, View, ScrollView, StatusBar, Platform, Dimensions,
    TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const TIMER_SECONDS = 30;
const QUESTION_TIME = 10;

export default function QuizSpeedRound({ navigation, route }) {
    const { deckId, deckTitle } = route.params || {};

    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME);
    const [isGameActive, setIsGameActive] = useState(false);
    const [phase, setPhase] = useState('ready'); // 'ready' | 'playing' | 'ended'

    const timerRef = useRef(null);
    const questionTimerRef = useRef(null);

    const MOCK_QUIZ_DATA = [
        { id: 'q1', question: '"Ubiquitous" means:', options: ['Everywhere', 'Rare', 'Dangerous', 'Ancient'], correctAnswer: 'Everywhere' },
        { id: 'q2', question: '"Accurate" means:', options: ['Fast', 'Correct', 'Difficult', 'Beautiful'], correctAnswer: 'Correct' },
        { id: 'q3', question: '"Postpone" means:', options: ['Cancel', 'Delay', 'Advertise', 'Send'], correctAnswer: 'Delay' },
        { id: 'q4', question: '"Beneficial" means:', options: ['Harmful', 'Helpful', 'Useless', 'Costly'], correctAnswer: 'Helpful' },
        { id: 'q5', question: '"Brief" means:', options: ['Long', 'Short', 'Heavy', 'Bright'], correctAnswer: 'Short' },
    ];

    useEffect(() => {
        setTimeout(() => {
            setQuestions(MOCK_QUIZ_DATA);
            setLoading(false);
        }, 400);
    }, [deckId]);

    const startGame = useCallback(() => {
        setPhase('playing');
        setIsGameActive(true);
        setTimeLeft(TIMER_SECONDS);
        setQuestionTimeLeft(QUESTION_TIME);
        setCurrentIndex(0);
        setSelectedOption(null);
        setScore(0);
        setIsQuizEnded(false);
    }, []);

    useEffect(() => {
        if (!isGameActive || phase !== 'playing') return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setIsGameActive(false);
                    setPhase('ended');
                    setIsQuizEnded(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [isGameActive, phase]);

    useEffect(() => {
        if (!isGameActive || phase !== 'playing') return;

        questionTimerRef.current = setInterval(() => {
            setQuestionTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(questionTimerRef.current);
                    // Auto-move to next
                    if (currentIndex + 1 < questions.length) {
                        setCurrentIndex(prevIdx => prevIdx + 1);
                        setSelectedOption(null);
                        return QUESTION_TIME;
                    } else {
                        setIsGameActive(false);
                        setPhase('ended');
                        setIsQuizEnded(true);
                        return 0;
                    }
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(questionTimerRef.current);
    }, [isGameActive, phase, currentIndex, questions.length]);

    const handleSelect = (option) => {
        if (!isGameActive || selectedOption) return;
        setSelectedOption(option);

        const isCorrect = option === questions[currentIndex]?.correctAnswer;
        if (isCorrect) setScore(prev => prev + 1);

        // Brief delay then next question
        setTimeout(() => {
            if (currentIndex + 1 < questions.length) {
                setCurrentIndex(prev => prev + 1);
                setSelectedOption(null);
                setQuestionTimeLeft(QUESTION_TIME);
            } else {
                setIsGameActive(false);
                setPhase('ended');
                setIsQuizEnded(true);
            }
        }, 600);
    };

    const handleRestart = () => {
        startGame();
    };

    if (loading) {
        return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FFCE0A" /></View>;
    }

    if (phase === 'ended' && isQuizEnded) {
        return (
            <View style={styles.webWrapper}>
                <LinearGradient colors={['#FFCE0A', '#FF9500']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>Time's Up!</Text>
                            <Text style={styles.appSubtitle}>{deckTitle || 'Speed Round'}</Text>
                        </View>
                    </View>
                    <View style={styles.whiteCardContainer}>
                        <View style={styles.resultBannerCard}>
                            <View style={styles.trophyCircle}><Ionicons name="flash" size={32} color="#eab308" /></View>
                            <Text style={styles.resultScoreText}>{score}/{questions.length}</Text>
                            <Text style={styles.resultMotivationText}>Speed challenge complete!</Text>
                        </View>
                        <View style={styles.resultMetricsRow}>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#FF9500' }]}>{score}</Text><Text style={styles.metricLabel}>Correct</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#ef4444' }]}>{questions.length - score}</Text><Text style={styles.metricLabel}>Wrong</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#6366f1' }]}>{Math.round((score / questions.length) * 100)}%</Text><Text style={styles.metricLabel}>Accuracy</Text></View>
                        </View>
                        <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
                            <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} /><Text style={styles.restartButtonText}>Play Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backToMenuBtn} onPress={() => navigation.goBack()}><Text style={styles.backToMenuText}>Back to Quiz Menu</Text></TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    if (phase === 'ready') {
        return (
            <View style={styles.webWrapper}>
                <LinearGradient colors={['#FFCE0A', '#FF9500']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>Speed Round</Text>
                            <Text style={styles.appSubtitle}>{deckTitle || 'Race against time'}</Text>
                        </View>
                    </View>
                    <View style={styles.whiteCardContainer}>
                        <View style={styles.readyCard}>
                            <View style={styles.readyIconCircle}>
                                <Ionicons name="flash-outline" size={48} color="#FFCE0A" />
                            </View>
                            <Text style={styles.readyTitle}>Get Ready!</Text>
                            <Text style={styles.readyDesc}>
                                Answer as many questions as you can before time runs out!
                            </Text>
                            <View style={styles.readyRules}>
                                <View style={styles.readyRule}><Ionicons name="time-outline" size={16} color="#64748b" /><Text style={styles.readyRuleText}>{TIMER_SECONDS} seconds total</Text></View>
                                <View style={styles.readyRule}><Ionicons name="timer-outline" size={16} color="#64748b" /><Text style={styles.readyRuleText}>{QUESTION_TIME}s per question</Text></View>
                                <View style={styles.readyRule}><Ionicons name="flash-outline" size={16} color="#64748b" /><Text style={styles.readyRuleText}>Quick answering required</Text></View>
                            </View>
                            <TouchableOpacity style={styles.startRoundBtn} onPress={startGame}>
                                <Ionicons name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.startRoundBtnText}>START!</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // Playing phase
    const currentQ = questions[currentIndex];
    const timerPercent = (timeLeft / TIMER_SECONDS) * 100;
    const questionTimerPercent = (questionTimeLeft / QUESTION_TIME) * 100;

    return (
        <View style={styles.webWrapper}>
            <LinearGradient colors={['#FFCE0A', '#FF9500']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                <StatusBar barStyle="light-content" />
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.appName}>Speed Round</Text>
                        <Text style={styles.appSubtitle}>Quick! Answer fast!</Text>
                    </View>
                </View>

                {/* Timers */}
                <View style={styles.timerSection}>
                    <View style={styles.globalTimerRow}>
                        <Ionicons name="time-outline" size={16} color="#ffffff" />
                        <View style={styles.globalTimerBarBg}>
                            <View style={[styles.globalTimerBarFill, { width: `${timerPercent}%` }]} />
                        </View>
                        <Text style={styles.globalTimerText}>{timeLeft}s</Text>
                    </View>
                    <View style={styles.questionTimerRow}>
                        <Text style={styles.questionTimerLabel}>Q: {currentIndex + 1}/{questions.length}</Text>
                        <View style={styles.questionTimerBarBg}>
                            <View style={[styles.questionTimerBarFill, { width: `${questionTimerPercent}%` }]} />
                        </View>
                        <Text style={styles.questionTimerText}>{questionTimeLeft}s</Text>
                    </View>
                </View>

                <View style={styles.whiteCardContainer}>
                    <View style={styles.quizQuestionCard}>
                        <Text style={styles.questionTag}>QUESTION {currentIndex + 1} / {questions.length}</Text>
                        <Text style={styles.questionTitleText}>{currentQ?.question}</Text>
                    </View>
                    <View style={styles.optionsList}>
                        {currentQ?.options.map((opt, idx) => {
                            const isSelected = selectedOption === opt;
                            const isCorrect = selectedOption && opt === currentQ.correctAnswer;
                            const isWrong = selectedOption && isSelected && !isCorrect;
                            let btnStyle = styles.quizOptionBtn;
                            if (isSelected && isCorrect) btnStyle = [styles.quizOptionBtn, styles.quizOptionCorrect];
                            else if (isWrong) btnStyle = [styles.quizOptionBtn, styles.quizOptionWrong];
                            else if (isSelected) btnStyle = [styles.quizOptionBtn, styles.quizOptionSelected];

                            return (
                                <TouchableOpacity key={idx} activeOpacity={0.8}
                                    style={btnStyle}
                                    onPress={() => handleSelect(opt)}
                                    disabled={!!selectedOption}>
                                    <Text style={[styles.quizOptionText, isSelected && styles.quizOptionTextSelected]}>{opt}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <View style={styles.speedScoreRow}>
                        <Text style={styles.speedScoreText}>Score: {score}</Text>
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
    headerSection: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 6 },
    backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
    headerTextContainer: { marginLeft: 16 },
    appName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
    appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
    // Timers
    timerSection: { paddingHorizontal: 20, marginBottom: 8 },
    globalTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    globalTimerBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden' },
    globalTimerBarFill: { height: '100%', backgroundColor: '#ffffff', borderRadius: 4 },
    globalTimerText: { color: '#ffffff', fontWeight: '700', fontSize: 14, minWidth: 30, textAlign: 'right' },
    questionTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    questionTimerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', minWidth: 40 },
    questionTimerBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
    questionTimerBarFill: { height: '100%', backgroundColor: '#FFE066', borderRadius: 3 },
    questionTimerText: { color: '#FFE066', fontWeight: '700', fontSize: 13, minWidth: 25, textAlign: 'right' },
    // Ready Screen
    readyCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 40 },
    readyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    readyTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    readyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    readyRules: { width: '100%', gap: 10, marginBottom: 24 },
    readyRule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    readyRuleText: { fontSize: 14, color: '#475569' },
    startRoundBtn: { flexDirection: 'row', width: '100%', backgroundColor: '#FF9500', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    startRoundBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
    // Quiz
    whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
    quizQuestionCard: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 16 },
    questionTag: { fontSize: 12, fontWeight: '700', color: '#FF9500', marginBottom: 6 },
    questionTitleText: { fontSize: 18, fontWeight: '700', color: '#1e293b', lineHeight: 26 },
    optionsList: { width: '100%', gap: 10 },
    quizOptionBtn: { width: '100%', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0' },
    quizOptionSelected: { borderColor: '#FF9500', backgroundColor: '#fffbeb' },
    quizOptionCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
    quizOptionWrong: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
    quizOptionText: { fontSize: 14, fontWeight: '500', color: '#334155' },
    quizOptionTextSelected: { color: '#FF9500', fontWeight: '700' },
    speedScoreRow: { width: '100%', alignItems: 'center', marginTop: 16 },
    speedScoreText: { fontSize: 18, fontWeight: '800', color: '#FF9500' },
    // Result
    resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
    trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
    resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
    resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
    metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center' },
    metricValue: { fontSize: 20, fontWeight: '800' },
    metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
    restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#FF9500', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
    backToMenuText: { color: '#FF9500', fontSize: 14, fontWeight: '600' },
});
