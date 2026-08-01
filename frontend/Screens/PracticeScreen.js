import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    StatusBar,
    Platform,
    Dimensions,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../context/DataContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PracticeScreen({ navigation }) {
    const [viewState, setViewState] = useState('list'); // 'list' or 'add'
    const { decks, addDeck, deleteDeck } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('All');

    const [deckTitle, setDeckTitle] = useState('');
    const [description, setDescription] = useState('');
    const [showDescription, setShowDescription] = useState(false);
    const [termRows, setTermRows] = useState([{ id: 1, term: '', definition: '' }]);

    const filters = ['All', 'Daily', 'Business'];

    const handleAddTermRow = () => {
        setTermRows((prev) => [...prev, { id: Date.now(), term: '', definition: '' }]);
    };

    const handleUpdateTerm = (id, field, value) => {
        setTermRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
        );
    };

    const handleRemoveTermRow = (id) => {
        if (termRows.length === 1) {
            Alert.alert('Cannot Remove', 'A deck needs at least one term.');
            return;
        }
        setTermRows((prev) => prev.filter((row) => row.id !== id));
    };

    const handleCreateDeck = () => {
        const trimmedTitle = deckTitle.trim();
        if (!trimmedTitle) {
            Alert.alert('Missing Title', 'Please enter a deck title.');
            return;
        }

        const filledRows = termRows.filter((row) => row.term.trim() && row.definition.trim());
        if (filledRows.length === 0) {
            Alert.alert('Empty Terms', 'Please add at least one term and definition.');
            return;
        }

        addDeck({
            title: trimmedTitle,
            level: 'Beginner',
            totalWords: filledRows.length,
        });
        setDeckTitle('');
        setDescription('');
        setShowDescription(false);
        setTermRows([{ id: 1, term: '', definition: '' }]);
        setViewState('list');
    };

    const filteredDecks = decks.filter((deck) => {
        const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase());
        if (selectedFilter === 'All') return matchesSearch;
        return matchesSearch && deck.level === selectedFilter;
    });

    return (
        <View style={styles.webWrapper}>
            <LinearGradient
                colors={['#654190', '#667eea']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.phoneContainer}
            >
                <StatusBar barStyle="light-content" />
                {viewState === 'list' && (
                    <>
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>FlashCard Decks</Text>
                            <Text style={styles.subTitleText}>Choose your deck to study</Text>
                        </View>

                        <TouchableOpacity style={styles.addButton} onPress={() => setViewState('add')}>
                            <Ionicons name="add" size={20} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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

                            {filteredDecks.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="albums-outline" size={48} color="#94a3b8" />
                                    <Text style={styles.emptyText}>No decks found</Text>
                                    <Text style={styles.emptySubText}>Create a new deck to get started</Text>
                                </View>
                            ) : (
                            filteredDecks.map((item) => (
                                <View key={item.id} style={styles.deckCard}>
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
                                        <TouchableOpacity
                                            onPress={() => {
                                                Alert.alert('Delete Deck', `Delete "${item.title}"?`, [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(item.id) },
                                                ]);
                                            }}
                                            style={styles.deleteButton}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                        </TouchableOpacity>
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
                                        onPress={() => navigation.navigate('FlashcardScreen', { deckId: item.id })}
                                    >
                                        <Ionicons name="play-outline" size={16} color="#ffffff" />
                                        <Text style={styles.startButtonText}>START LEARNING</Text>
                                    </TouchableOpacity>
                                </View>
                            )))}
                        </View>
                    </ScrollView>
                </>
                )}

                {viewState === 'add' && (
                    <>
                    <View style={styles.headerSection}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                        </TouchableOpacity>

                        <View style={styles.headerTextContainer}>
                            <Text style={styles.appName}>New FlashCard</Text>
                            <Text style={styles.subTitleText}>Create new Deck</Text>
                        </View>

                        <View style={styles.addHeaderActions}>
                            <TouchableOpacity style={styles.addIconButton}>
                                <Ionicons name="settings-outline" size={20} color="#ffffff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addIconButton} onPress={handleCreateDeck}>
                                <Ionicons name="checkmark" size={22} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                
                    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.whiteCardContainer}>
                            <View style={styles.titleInputWrapper}>
                                <TextInput
                                    style={styles.titleUnderlineInput}
                                    placeholder="Title"
                                    placeholderTextColor="#94a3b8"
                                    value={deckTitle}
                                    onChangeText={setDeckTitle}
                                />
                                <View style={styles.titleUnderline} />
                            </View>

                            <View style={styles.actionRow}>
                                <View style={styles.lockedScanRow}>
                                    <View style={styles.lockIconContainer}>
                                        <Ionicons name="lock-closed" size={14} color="#1C1C2E" />
                                    </View>
                                    <Text style={styles.lockedScanText}>Scan Document</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.descriptionButton}
                                    onPress={() => setShowDescription((prev) => !prev)}
                                >
                                    <Ionicons name="add" size={16} color="#4f46e5" />
                                    <Text style={styles.descriptionButtonText}>Description</Text>
                                </TouchableOpacity>
                            </View>

                            {showDescription && (
                                <View style={styles.descriptionCard}>
                                    <TextInput
                                        style={styles.descriptionInput}
                                        placeholder="Enter description..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={description}
                                        onChangeText={setDescription}
                                    />
                                </View>
                            )}

                            {termRows.map((row, index) => (
                                <View key={row.id} style={styles.termCard}>
                                    <View style={styles.termCardHeader}>
                                        <Text style={styles.termCardNumber}>#{index + 1}</Text>
                                        <TouchableOpacity
                                            style={styles.removeTermButton}
                                            onPress={() => handleRemoveTermRow(row.id)}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>TERM</Text>
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="Enter term"
                                            placeholderTextColor="#94a3b8"
                                            value={row.term}
                                            onChangeText={(value) => handleUpdateTerm(row.id, 'term', value)}
                                        />
                                        <View style={styles.fieldDivider} />
                                    </View>

                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>DEFINITION</Text>
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="Enter definition"
                                            placeholderTextColor="#94a3b8"
                                            value={row.definition}
                                            onChangeText={(value) => handleUpdateTerm(row.id, 'definition', value)}
                                        />
                                        <View style={styles.fieldDivider} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={styles.fabAddTerm} activeOpacity={0.8} onPress={handleAddTermRow}>
                        <Ionicons name="add" size={28} color="#ffffff" />
                    </TouchableOpacity>
                    </>
                )}

                {viewState === 'list' && (
                <View style={styles.quickNavContainer}>
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('Home')}>
                        <Ionicons name="home" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }}>
                        <Ionicons name="albums" size={20} color="#667eea" opacity={1} />
                        <Text style={{ fontSize: 12, color: '#667eea', marginTop: 4 }}>Cards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('WordlistScreen')}>
                        <Ionicons name="book" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Words</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('AIReadingScreen')}>
                        <Ionicons name="sparkles" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Reading</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('VocabQuizScreen')}>
                        <Ionicons name="checkmark-circle" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Quiz</Text>
                    </TouchableOpacity>
                </View>
                )}
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

    addButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        marginLeft: 'auto',
    },

    headerTextContainer: {
        marginLeft: 16,
    },
    subTitleText: {
        color: '#cbd5e1',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    appName: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 2,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },

    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#F0F2FF',
        width: '100%',
        minHeight: 450,
        alignItems: 'center',
        paddingHorizontal: 24,

        marginTop: 20,
        paddingTop: 10,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 15,
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,

        marginTop: 10,
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
        backgroundColor: '#e0e7ff',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    filterChipActive: {
        backgroundColor: '#4f46e5',
    },
    filterText: {
        color: '#4f46e5',
        fontWeight: '600',
        fontSize: 14,
    },
    filterTextActive: {
        color: '#ffffff',
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
        backgroundColor: '#4f46e5',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
        width: '100%',
    },
    startButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        width: '100%',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 12,
    },
    emptySubText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    deleteButton: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        width: '100%',
        alignSelf: 'stretch',
    },

    /* ===== Add new Deck ===== */
    addHeaderSection: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
    },
    addIconButton: {
        width: 32,
        height: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    addHeaderTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    addHeaderTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    addPageIndicator: {
        color: '#cbd5e1',
        fontSize: 12,
        marginTop: 2,
    },
    addHeaderActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginLeft: 'auto',
        gap: 8,
    },
    addContentContainer: {
        flex: 1,
        position: 'relative',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    addScrollContainer: {
        paddingBottom: 100,
    },
    addWhiteCard: {
        flexGrow: 1,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    titleInputWrapper: {
        width: '100%',
        marginBottom: 24,
    },
    titleUnderlineInput: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        paddingVertical: 8,
        textAlign: 'center',
        letterSpacing: 1,
    },
    titleUnderline: {
        height: 2,
        width: '100%',
        backgroundColor: '#5C5CFF',
        borderRadius: 1,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    lockedScanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lockIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFCC00',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedScanText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
    },
    descriptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    descriptionButtonText: {
        color: '#4f46e5',
        fontSize: 14,
        fontWeight: '600',
    },
    descriptionCard: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    descriptionInput: {
        color: '#1e293b',
        fontSize: 14,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    termCard: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    termCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    termCardNumber: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '600',
    },
    removeTermButton: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldBlock: {
        width: '100%',
        paddingVertical: 10,
    },
    fieldLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        textAlign: 'center',
        marginBottom: 6,
    },
    fieldInput: {
        color: '#1e293b',
        fontSize: 16,
        textAlign: 'center',
        paddingVertical: 4,
    },
    fieldDivider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginTop: 6,
    },
    fabAddTerm: {
        position: 'absolute',
        right: 20,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#5C5CFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#5C5CFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
});
