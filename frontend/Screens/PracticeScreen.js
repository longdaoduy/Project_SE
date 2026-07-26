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
    FlatList
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PracticeScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('All');

    const filters = ['All', 'Daily', 'Business'];

    const mockDecks = [
        {
            id: '1',
            title: 'Academic Vocabulary',
            level: 'Beginner',
            currentWords: 0,
            totalWords: 10,
            progress: 0,
        },
    ];

    const renderDeck = ({ item }) => (
        <View style={styles.deckCard}>
            <View style={styles.deckHeader}>
                <View style={styles.deckIconContainer}>
                    <Ionicons name="clipboard-outline" size={24} color="#1e293b" />
                </View>
                <View style={styles.deckTitleContainer}>
                    <Text style={styles.deckTitle}>{item.title}</Text>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{item.level}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.progressInfo}>
                <Text style={styles.progressText}>
                    {item.currentWords} / {item.totalWords} words
                </Text>
                <Text style={styles.progressPercentage}>{item.progress}%</Text>
            </View>

            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
            </View>

            <TouchableOpacity
                style={styles.startButton}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('FlashcardScreen')}
            >
                <Ionicons name="play-outline" size={16} color="#3b82f6" />
                <Text style={styles.startButtonText}>START LEARNING</Text>
            </TouchableOpacity>
        </View>
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

                <View style={styles.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.subTitleText}>CHOOSE YOUR DECK</Text>
                        <Text style={styles.appName}>Vocabulary Library</Text>
                    </View>
                </View>

                <View style={styles.whiteCardContainer}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search decks..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <View style={styles.filtersContainer}>
                        {filters.map((filter) => (
                            <TouchableOpacity
                                key={filter}
                                style={[
                                    styles.filterChip,
                                    selectedFilter === filter && styles.filterChipActive
                                ]}
                                onPress={() => setSelectedFilter(filter)}
                            >
                                <Text style={[
                                    styles.filterText,
                                    selectedFilter === filter && styles.filterTextActive
                                ]}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <FlatList
                        data={mockDecks}
                        keyExtractor={item => item.id}
                        renderItem={renderDeck}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        style={{ width: '100%' }}
                    />
                </View>

                {/*Thanh điều hướng nhanh đến các màn hình khác (Chuẩn theo Ảnh 1)*/}
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
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    headerTextContainer: {
        marginLeft: 16,
    },
    subTitleText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    appName: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 2,
    },
    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#F0F2FF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
    },
    filtersContainer: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 20,
        gap: 12,
    },
    filterChip: {
        backgroundColor: '#ffffff',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    filterChipActive: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
    },
    filterText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    filterTextActive: {
        color: '#1e293b',
    },
    deckCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 3,
    },
    deckHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    deckIconContainer: {
        width: 40,
        height: 40,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    deckTitleContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    deckTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    badgeContainer: {
        backgroundColor: '#dcfce7',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#16a34a',
        fontSize: 10,
        fontWeight: '700',
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    progressPercentage: {
        fontSize: 12,
        color: '#3b82f6',
        fontWeight: '700',
    },
    progressContainer: {
        height: 6,
        width: '100%',
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 16,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 3,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dbeafe',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
    },
    startButtonText: {
        color: '#2563eb',
        fontSize: 14,
        fontWeight: '700',
    },
    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        width: '100%',
        alignSelf: 'stretch',
    },
});