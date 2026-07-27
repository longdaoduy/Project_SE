import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    StatusBar,
    Platform,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    Image
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function FlashcardScreen({ navigation }) {
    const [showMeaning, setShowMeaning] = useState(false);

    const handleShowMeaning = () => {
        setShowMeaning(true);
    };

    const handleNextCard = () => {
        setShowMeaning(false);
    };

    return (
        <View style={styles.webWrapper}>
            <LinearGradient
                colors={['#4c3b7a', '#5b65d6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.phoneContainer}
            >
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                    </TouchableOpacity>

                    <View style={styles.headerTextContainer}>
                        <Text style={styles.subTitleText}>IELTS ACADEMIC</Text>
                        <Text style={styles.appName}>Session 3</Text>
                    </View>

                    <TouchableOpacity style={styles.settingsButton}>
                        <Ionicons name="settings-outline" size={20} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                    <View style={styles.progressTextRow}>
                        <Text style={styles.progressText}>0 reviewed</Text>
                        <Text style={styles.progressText}>20 left</Text>
                    </View>
                    <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, { width: '0%' }]} />
                    </View>
                    <View style={styles.progressDotsRow}>
                        {[1, 2, 3, 4, 5].map((_, index) => (
                            <View key={index} style={styles.progressDot} />
                        ))}
                    </View>
                </View>

                {/* Main Content */}
                <View style={styles.whiteCardContainer}>

                    {/* Stats */}
                    <View style={styles.statsFloatingRow}>
                        <View style={styles.statPill}>
                            <Ionicons name="book-outline" size={16} color="#0f172a" />
                            <Text style={styles.statPillText}>New  <Text style={{ fontWeight: '700' }}>20</Text></Text>
                        </View>
                        <View style={styles.statPill}>
                            <Ionicons name="copy-outline" size={16} color="#0f172a" />
                            <Text style={styles.statPillText}>Review  <Text style={{ fontWeight: '700' }}>0</Text></Text>
                        </View>
                        <View style={styles.statPill}>
                            <Ionicons name="star-outline" size={16} color="#eab308" />
                            <Text style={styles.statPillText}>Starred  <Text style={{ fontWeight: '700' }}>0</Text></Text>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={styles.flashcardWrapper} showsVerticalScrollIndicator={false}>
                        <View style={styles.flashcard}>

                            <View style={styles.cardHeader}>
                                <View style={styles.tagsContainer}>
                                    <View style={styles.tag}><Text style={styles.tagText}>C1</Text></View>
                                    <View style={styles.tag}><Text style={styles.tagText}>Academic</Text></View>
                                    <View style={styles.tag}><Text style={styles.tagText}>Descriptive</Text></View>
                                </View>
                                <TouchableOpacity>
                                    <Ionicons name="star-outline" size={26} color="#3b82f6" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.mainWord}>Ubiquitous</Text>

                            {/* Nút âm thanh nhỏ gọn (đã fix tròn và ép tâm) */}
                            <View style={styles.phoneticRow}>
                                <Text style={styles.phoneticText}>/juːˈbɪk.wɪ.təs/</Text>
                                <TouchableOpacity style={styles.soundButton}>
                                    <Ionicons name="volume-high" size={20} color="#3b82f6" style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }} />
                                <Text style={styles.partOfSpeech}>adjective</Text>
                            </View>

                            <View style={styles.divider} />

                            {!showMeaning ? (
                                <View style={styles.hiddenMeaningContainer}>
                                    {/* ĐÃ XÓA NÚT LOA TO ĐÙNG Ở ĐÂY */}
                                    <TouchableOpacity style={styles.showMeaningButton} onPress={handleShowMeaning} activeOpacity={0.8}>
                                        <Text style={styles.showMeaningText}>Show Meaning</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.hintText}>Think about the definition first</Text>
                                </View>
                            ) : (
                                <View style={styles.revealedMeaningContainer}>
                                    <View style={styles.meaningBox}>
                                        <Text style={styles.meaningText}>
                                            Present, appearing, or found everywhere; seemingly present in all places at the same time.
                                        </Text>
                                    </View>

                                    <View style={styles.exampleContainer}>
                                        <Text style={styles.exampleLabel}>E.G.</Text>
                                        <Text style={styles.exampleText}>
                                            "Mobile phones have become ubiquitous in modern society."
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {!showMeaning ? (
                            <TouchableOpacity style={styles.skipButtonContainer} onPress={handleNextCard}>
                                <Ionicons name="arrow-forward-circle-outline" size={32} color="#0f172a" />
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.assessmentContainer}>
                                <TouchableOpacity style={[styles.assessButton, { backgroundColor: '#fee2e2' }]} onPress={handleNextCard}>
                                    <View style={[styles.assessDot, { backgroundColor: '#ef4444' }]} />
                                    <Text style={[styles.assessText, { color: '#ef4444' }]}>Again</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.assessButton, { backgroundColor: '#ffedd5' }]} onPress={handleNextCard}>
                                    <View style={[styles.assessDot, { backgroundColor: '#f97316' }]} />
                                    <Text style={[styles.assessText, { color: '#f97316' }]}>Hard</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.assessButton, { backgroundColor: '#dbeafe' }]} onPress={handleNextCard}>
                                    <View style={[styles.assessDot, { backgroundColor: '#3b82f6' }]} />
                                    <Text style={[styles.assessText, { color: '#3b82f6' }]}>Good</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.assessButton, { backgroundColor: '#dcfce7' }]} onPress={handleNextCard}>
                                    <View style={[styles.assessDot, { backgroundColor: '#22c55e' }]} />
                                    <Text style={[styles.assessText, { color: '#22c55e' }]}>Easy</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Thanh điều hướng */}
                <View style={styles.quickNavContainer}>
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('Home')}>
                        <Ionicons name="home" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }}>
                        <Ionicons name="albums" size={20} color="#667eea" opacity={1} />
                        <Text style={{ fontSize: 12, color: '#667eea', marginTop: 4 }}>Cards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('WordListScreen')}>
                        <Ionicons name="book" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Words</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('AIReadingScreen')}>
                        <Ionicons name="sparkles" size={20} color="#919191" opacity={0.3} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Reading</Text>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
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
    settingsButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',

        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    headerTextContainer: {
        alignItems: 'center',
    },
    subTitleText: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    appName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 2,
    },
    progressSection: {
        paddingHorizontal: 24,
        marginTop: 20,
        marginBottom: 20,
    },
    progressTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '500',
    },
    progressBarBackground: {
        height: 6,
        backgroundColor: '#ffffff',
        borderRadius: 3,
        width: '100%',
    },
    progressBarFill: {
        height: 6,
        backgroundColor: '#fbbf24',
        borderRadius: 3,
    },
    progressDotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingHorizontal: 5,
    },
    progressDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#fbbf24',
    },
    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#F0F2FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        width: '100%',
        alignItems: 'center',
        position: 'relative',
    },
    statsFloatingRow: {
        flexDirection: 'row',
        position: 'absolute',
        top: -16,
        gap: 10,
        zIndex: 10,
    },
    statPill: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        gap: 6,
    },
    statPillText: {
        fontSize: 12,
        color: '#1e293b',
    },
    flashcardWrapper: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 20,
        width: Platform.OS === 'web' ? 400 : screenWidth,
        alignItems: 'center',
    },
    flashcard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        minHeight: 350,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
    },
    tag: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#93c5fd',
    },
    tagText: {
        fontSize: 10,
        color: '#2563eb',
        fontWeight: '600',
    },
    mainWord: {
        fontSize: 34,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 10,
    },
    phoneticRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneticText: {
        fontSize: 16,
        color: '#475569',
        marginRight: 8,
    },
    soundButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#dbeafe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    partOfSpeech: {
        fontSize: 14,
        color: '#64748b',
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        width: '100%',
        marginVertical: 20,
    },
    hiddenMeaningContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    showMeaningButton: {
        backgroundColor: '#8b5cf6',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 20, // Thêm margin top để bù đắp khoảng trống của nút loa vừa xóa
    },
    showMeaningText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    hintText: {
        marginTop: 16,
        color: '#94a3b8',
        fontSize: 13,
    },
    skipButtonContainer: {
        marginTop: 30,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 4,
    },
    revealedMeaningContainer: {
        marginTop: 5,
    },
    meaningBox: {
        backgroundColor: '#e0f2fe',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    meaningText: {
        fontSize: 15,
        color: '#0f172a',
        lineHeight: 22,
    },
    exampleContainer: {
        paddingHorizontal: 4,
    },
    exampleLabel: {
        fontSize: 14,
        color: '#3b82f6',
        fontWeight: '700',
        marginBottom: 6,
    },
    exampleText: {
        fontSize: 15,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    assessmentContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 30,
        paddingHorizontal: 0,
        gap: 10,
    },
    assessButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        flexDirection: 'column',
        gap: 6,
    },
    assessDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    assessText: {
        fontSize: 13,
        fontWeight: '700',
    },
    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        width: '100%',
        alignSelf: 'stretch',
    },
});