import React, { useEffect, useState } from 'react';
import {
    StyleSheet, Text, TextInput, View, ScrollView, StatusBar, Platform, Dimensions,
    TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function QuizFillInBlank({ navigation, route }) {
    const { deckId, deckTitle } = route.params || {};

    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [score, setScore] = useState(0);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    const MOCK_QUIZ_DATA = [
        { id: 'q1', sentence: 'The Internet has become ______ in modern society.', answer: 'ubiquitous', hints: ['u_i_ui_o_s'] },
        { id: 'q2', sentence: 'Please make sure your data is ______ before submitting.', answer: 'accurate', hints: ['a_c_r_t_'] },
        { id: 'q3', sentence: 'Due to the storm, the event was ______ until next week.', answer: 'postponed', hints: ['p_s_p_n_d'] },
    ];

    useEffect(() => {
        setTimeout(() => {
            setQuestions(MOCK_QUIZ_DATA);
            setLoading(false);
        }, 400);
    }, [deckId]);

    const currentQ = questions[currentIndex];

    const checkAnswer = () => {
        const correct = userAnswer.trim().toLowerCase() === currentQ.answer.toLowerCase();
        setIsCorrect(correct);
        setShowResult(true);
    };

    const handleNext = () => {
        if (isCorrect) setScore(prev => prev + 1);
        if (currentIndex + 1 < questions.length) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer('');
            setShowResult(false);
            setIsCorrect(false);
        } else {
            if (isCorrect) setScore(prev => prev + 1);
            setIsQuizEnded(true);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setUserAnswer('');
        setScore(0);
        setIsQuizEnded(false);
        setShowResult(false);
        setIsCorrect(false);
    };

    if (loading) {
        return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#16A487" /></View>;
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
                            <Text style={styles.appSubtitle}>{deckTitle || 'Fill in the blank'}</Text>
                        </View>
                    </View>
                    <View style={styles.whiteCardContainer}>
                        <View style={styles.resultBannerCard}>
                            <View style={styles.trophyCircle}><Ionicons name="trophy" size={32} color="#eab308" /></View>
                            <Text style={styles.resultScoreText}>{score}/{questions.length}</Text>
                            <Text style={styles.resultMotivationText}>Practice makes perfect</Text>
                        </View>
                        <View style={styles.resultMetricsRow}>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#16A487' }]}>{score}</Text><Text style={styles.metricLabel}>Correct</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#ef4444' }]}>{questions.length - score}</Text><Text style={styles.metricLabel}>Wrong</Text></View>
                            <View style={styles.metricCard}><Text style={[styles.metricValue, { color: '#6366f1' }]}>{Math.round((score / questions.length) * 100)}%</Text><Text style={styles.metricLabel}>Accuracy</Text></View>
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
            <LinearGradient colors={['#16A487', '#3FC5B7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.phoneContainer}>
                <StatusBar barStyle="light-content" />
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.appName}>Fill in the blank</Text>
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

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.whiteCardContainer}>
                    <View style={styles.quizQuestionCard}>
                        <Text style={styles.questionTag}>QUESTION {currentIndex + 1} / {questions.length}</Text>
                        <Text style={styles.questionTitleText}>Complete the sentence:</Text>
                        <View style={styles.sentenceBox}>
                            <Text style={styles.sentenceText}>{currentQ?.sentence}</Text>
                        </View>
                    </View>

                    <View style={styles.inputSection}>
                        <TextInput
                            style={[styles.answerInput, showResult && (isCorrect ? styles.inputCorrect : styles.inputWrong)]}
                            placeholder="Type your answer..."
                            placeholderTextColor="#94a3b8"
                            value={userAnswer}
                            onChangeText={setUserAnswer}
                            editable={!showResult}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {currentQ?.hints && !showResult && (
                            <Text style={styles.hintText}>Hint: {currentQ.hints[0]}</Text>
                        )}
                    </View>

                    {showResult && (
                        <View style={[styles.resultFeedback, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                            <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={20} color={isCorrect ? '#22c55e' : '#ef4444'} />
                            <Text style={[styles.feedbackText, { color: isCorrect ? '#15803d' : '#b91c1c' }]}>
                                {isCorrect ? 'Correct!' : `The answer is: ${currentQ?.answer}`}
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.nextActionBtn, (!userAnswer.trim() && !showResult) && styles.disabledNextBtn]}
                        onPress={showResult ? handleNext : checkAnswer}
                        disabled={!userAnswer.trim() && !showResult}>
                        <Text style={styles.nextActionBtnText}>
                            {showResult ? (currentIndex + 1 < questions.length ? 'Next ►' : 'Finish ►') : 'Check ►'}
                        </Text>
                    </TouchableOpacity>
                </View>
                </KeyboardAvoidingView>
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
    questionTag: { fontSize: 12, fontWeight: '700', color: '#16A487', marginBottom: 6 },
    questionTitleText: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    sentenceBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
    sentenceText: { fontSize: 18, fontWeight: '600', color: '#166534', lineHeight: 26, fontStyle: 'italic' },
    inputSection: { width: '100%', marginBottom: 16 },
    answerInput: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, fontSize: 18, fontWeight: '600', borderWidth: 1.5, borderColor: '#e2e8f0', textAlign: 'center', color: '#1e293b' },
    inputCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
    inputWrong: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
    hintText: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
    resultFeedback: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8, marginBottom: 16, width: '100%' },
    feedbackCorrect: { backgroundColor: '#f0fdf4' },
    feedbackWrong: { backgroundColor: '#fef2f2' },
    feedbackText: { fontSize: 14, fontWeight: '600' },
    nextActionBtn: { width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
    disabledNextBtn: { opacity: 0.5 },
    nextActionBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    // Result
    resultBannerCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 16 },
    trophyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    resultScoreText: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
    resultMotivationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
    resultMetricsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 },
    metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center' },
    metricValue: { fontSize: 20, fontWeight: '800' },
    metricLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
    restartButton: { flexDirection: 'row', width: '100%', backgroundColor: '#16A487', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    restartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    backToMenuBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
    backToMenuText: { color: '#16A487', fontSize: 14, fontWeight: '600' },
});
