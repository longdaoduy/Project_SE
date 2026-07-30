import React, { useEffect, useState } from 'react';
import {
    StyleSheet, Text, View, ScrollView, StatusBar, Platform, Dimensions,
    TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function QuizMultipleChoice({ navigation, route }) {
    const { deckId, deckTitle } = route.params || {};

    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [loading, setLoading] = useState(true);

    const MOCK_QUIZ_DATA = [
        { id: 'q1', question: 'What does "Ubiquitous" mean ?',
            options: ['A. Rare and difficult to find in nature','B. Seeming to be everywhere at the same time','C. Extremely dangerous or harmful.','D. Ancient and no longer in use'],
            correctAnswer: 'B. Seeming to be everywhere at the same time', },
        { id: 'q2', question: 'What does "Accurate" mean ?',
            options: ['A. Very fast and efficient.','B. Correct, exact, and without any mistakes.','C. Difficult to understand or explain.','D. Beautiful and well-designed.'],
            correctAnswer: 'B. Correct, exact, and without any mistakes.', },
        { id: 'q3', question: 'What does "Postpone" mean ?',
            options: ['A. To cancel an event completely.','B. To delay something to a later time.','C. To advertise something on social media.','D. To send a letter through the post office.'],
            correctAnswer: 'B. To delay something to a later time.', },
    ];

    useEffect(() => {
        // Simulate loading questions based on deckId/mode
        setTimeout(() => {
            setQuestions(MOCK_QUIZ_DATA);
            setLoading(false);
        }, 400);
    }, [deckId]);

    const currentQ = questions[currentIndex];

    const handleSelect = (option) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const handleNext = () => {
        if (!selectedOption) return;
        const isCorrect = selectedOption === currentQ.correctAnswer;
        const newScore = isCorrect ? score + 1 : score;
        setScore(newScore);

        if (currentIndex + 1 < questions.length) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
        } else {
            setIsQuizEnded(true);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setSelectedOption(null);
        setScore(0);
        setIsQuizEnded(false);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#667eea" />
            </View>
        );
    }

    if (isQuizEnded) {
        return (
            <View style={styles.webWrapper}>
                <LinearGradient colors={['#16A487', '#3FC5B7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>Quiz Complete</Text>
                            <Text style={styles.appSubtitle}>{deckTitle || 'Multiple Choice'}</Text>
                        </View>
                    </View>
                    <View style={styles.whiteCardContainer}>
                        <View style={styles.resultBannerCard}>
                            <View style={styles.trophyCircle}>
                                <Ionicons name="trophy" size={32} color="#eab308" />
                            </View>
                            <Text style={styles.resultScoreText}>{score}/{questions.length}</Text>
                            <Text style={styles.resultMotivationText}>Practice makes perfect</Text>
                        </View>
                        <View style={styles.resultMetricsRow}>
                            <View style={styles.metricCard}>
                                <Text style={[styles.metricValue, { color: '#16A487' }]}>{score}</Text>
                                <Text style={styles.metricLabel}>Correct</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={[styles.metricValue, { color: '#ef4444' }]}>{questions.length - score}</Text>
                                <Text style={styles.metricLabel}>Wrong</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={[styles.metricValue, { color: '#6366f1' }]}>{Math.round((score / questions.length) * 100)}%</Text>
                                <Text style={styles.metricLabel}>Accuracy</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
                            <Ionicons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.restartButtonText}>Restart</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backToMenuBtn} onPress={() => navigation.goBack()}>
                            <Text style={styles.backToMenuText}>Back to Quiz Menu</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.webWrapper}>
            <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                <StatusBar barStyle="light-content" />
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.appName}>Multiple Choice</Text>
                        <Text style={styles.appSubtitle}>{deckTitle || 'Quiz'}</Text>
                    </View>
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.segmentContainer}>
                        {questions.map((_, i) => (
                            <View key={i} style={[styles.segmentBar, i <= currentIndex ? styles.activeSegment : styles.inactiveSegment]} />
                        ))}
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
                            return (
                                <TouchableOpacity key={idx} activeOpacity={0.8}
                                    style={[styles.quizOptionBtn, isSelected && styles.quizOptionSelected]}
                                    onPress={() => handleSelect(opt)}>
                                    <Text style={[styles.quizOptionText, isSelected && styles.quizOptionTextSelected]}>{opt}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TouchableOpacity disabled={!selectedOption}
                        style={[styles.nextActionBtn, !selectedOption && styles.disabledNextBtn]}
                        onPress={handleNext}>
                        <Text style={styles.nextActionBtnText}>{currentIndex + 1 < questions.length ? 'Next ►' : 'Finish ►'}</Text>
                    </TouchableOpacity>
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
    appSubtitle: { fontSize: 14, color: '#e2e8f0', opacity: 0.85 },
    progressSection: { width: '100%', paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
    segmentContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 },
    segmentBar: { flex: 1, height: 4, borderRadius: 2 },
    activeSegment: { backgroundColor: '#ffffff' },
    inactiveSegment: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
    whiteCardContainer: { flex: 1, backgroundColor: '#F0F2FF', width: '100%', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
    quizQuestionCard: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 16 },
    questionTag: { fontSize: 12, fontWeight: '700', color: '#667eea', marginBottom: 6 },
    questionTitleText: { fontSize: 18, fontWeight: '700', color: '#1e293b', lineHeight: 26 },
    optionsList: { width: '100%', gap: 10 },
    quizOptionBtn: { width: '100%', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0' },
    quizOptionSelected: { borderColor: '#667eea', backgroundColor: '#f0f3ff' },
    quizOptionText: { fontSize: 14, fontWeight: '500', color: '#334155' },
    quizOptionTextSelected: { color: '#4f46e5', fontWeight: '700' },
    nextActionBtn: { width: '100%', backgroundColor: '#667eea', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
    disabledNextBtn: { opacity: 0.5 },
    nextActionBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    // Result Styles
    resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
    trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
    resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
    resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
    metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center' },
    metricValue: { fontSize: 20, fontWeight: '800' },
    metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
    restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#667eea', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
    backToMenuText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
});
