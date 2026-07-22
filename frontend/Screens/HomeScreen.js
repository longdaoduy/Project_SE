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
    Image ,
    TouchableOpacity,
} from 'react-native';

import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen({navigation}) {
    const [userData, setUserData] = useState({
        name: 'Duy Long',
        streak: 12,
        level: 3,
        xp: 243,
        wordlearned: 1280,
        dailyGoal:{
            current: 12,
            target: 20
        }
    });

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Hiện tại chưa có backend, ta dùng dữ liệu Mock khai báo ở useState phía trên.
        // Sau này có backend Node.js, chỉ cần mở đoạn code fetch dưới đây ra:
        
    }, []);

    const wordRemaining = userData.dailyGoal.target - userData.dailyGoal.current;

    return (
        // Khung bọc ngoài cùng (Nếu là Web thì căn giữa để tạo hiệu ứng giả lập)
        <View style={styles.webWrapper}>
            <LinearGradient
                colors={['#654190', '#667eea']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.phoneContainer}
            >
                {/* Thanh trạng thái màu sáng */}
                <StatusBar barStyle="light-content" />
                
                <ScrollView contentContainerStyle={styles.scrollContainer} 
                showsVerticalScrollIndicator={false}>
                    <View style={styles.headerSection}>
                        <Text style={styles.appWelcome}>Welcome Student👋</Text>
                        <Text style={styles.userNameText}>Hello, {userData.name}!</Text>
                        {/*Phần hiển thị thông số */}
                        <View style={styles.statsRow}>
                            <View style={styles.statsCard}>
                                <Image source={require('../assets/fire.png')} style={{ width: 30, height: 30, marginBottom: 5 }} />
                                <Text style={styles.statsValue}>{userData.streak}</Text>
                                <Text style={styles.statsLabel}>Streak</Text>
                            </View>

                            <View style={styles.statsCard}>
                                <Image source={require('../assets/xp.png')} style={{ width: 30, height: 30, marginBottom: 5 }} />
                                <Text style={styles.statsValue}>{userData.xp}</Text>
                                <Text style={styles.statsLabel}>XP</Text>
                            </View>

                            <View style={styles.statsCard}>
                                <Image source={require('../assets/books.png')} style={{ width: 30, height: 30, marginBottom: 5 }} />
                                <Text style={styles.statsValue}>{userData.wordlearned}</Text>
                                <Text style={styles.statsLabel}>Words</Text>
                            </View>

                            <View style={styles.statsCard}>
                                <Image source={require('../assets/badge.png')} style={{ width: 30, height: 30, marginBottom: 5 }} />
                                <Text style={styles.statsValue}>{userData.level}</Text>
                                <Text style={styles.statsLabel}>Level</Text>
                            </View>

                        </View>
                        {/*Nút notification*/}
                        <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Notifications')}>
                            <Image source={require('../assets/Bell.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                        </TouchableOpacity>

                        {/*Nút profile*/}
                        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
                            <Ionicons name="person" size={16} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.whiteCardContainer}>
                        {/* Ô hiển thị số từ còn lại để đạt mục tiêu hàng ngày */}
                        <View style={styles.wordRemainingContainer}>
                            <View style={styles.wordCountTitle}>
                                <View style={styles.wordCountLabelGroup}>
                                    <Image source={require('../assets/target.png')} style={{ width: 24, height: 24, marginBottom: 5 }} />
                                    <Text style={styles.wordCountHeader}>Today's goal</Text>
                                </View>

                                <Text style={styles.wordCountValue}>
                                    {userData.dailyGoal.current} / {userData.dailyGoal.target} words
                                </Text>
                            </View>

                            

                            {/* Vẽ thanh tiến trình */}
                            <View style={styles.progressContainer}>
                                <View style={[styles.progressBar, { width: `${(userData.dailyGoal.current / userData.dailyGoal.target) * 100}%` }]} />
                            </View>

                            <View style={{ marginTop: 10 }}>
                                <Text style={{ fontSize: 14, color: '#000000', opacity: 0.5 }}>
                                    {wordRemaining > 0 ? `${wordRemaining} more words to reach your goal today.` : "Congratulations! You've reached your daily goal!"}
                                </Text>
                            </View>
                        </View>

                        <Text style={{fontSize: 24, color: '#000000', fontWeight: '700', marginTop: 10, alignSelf: 'flex-start'}}>
                            Quick Practice
                        </Text>

                        <View style={styles.practiceButtonsContainer}>
                            {/* Nút Words list */}
                            <TouchableOpacity style={styles.practiceButton} onPress={() => navigation.navigate('PracticeScreen')} activeOpacity={0.8}>
                                <View style={styles.buttonContentWrapper}>
                                    <View style={[styles.iconCircle, { backgroundColor: '#eeeffe' }]}>
                                        <Image source={require('../assets/wordlist.png')} style={styles.buttonIcon} />
                                    </View>
                                    <Text style={styles.buttonMainText}>Words list</Text>
                                    <Text style={styles.buttonSubText}>{userData.wordlearned} words learned</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Nút Flashcards */}
                            <TouchableOpacity style={styles.practiceButton} onPress={() => navigation.navigate('FlashcardScreen')} activeOpacity={0.8}>
                                <View style={styles.buttonContentWrapper}>
                                    <View style={[styles.iconCircle, { backgroundColor: '#e6f9f3' }]}>
                                        <Image source={require('../assets/flashcard.png')} style={styles.buttonIcon} />
                                    </View>
                                    <Text style={styles.buttonMainText}>Flashcards</Text>
                                    <Text style={styles.buttonSubText}>Review your flashcards</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Nút AI Reading */}
                            <TouchableOpacity style={styles.practiceButton} onPress={() => navigation.navigate('AIReadingScreen')} activeOpacity={0.8}>
                                <View style={styles.buttonContentWrapper}>
                                    <View style={[styles.iconCircle, { backgroundColor: '#f5f3ff' }]}>
                                        <Image source={require('../assets/reading.png')} style={styles.buttonIcon} />
                                    </View>
                                    <Text style={styles.buttonMainText}>AI Reading</Text>
                                    <Text style={styles.buttonSubText}>Practice reading</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Nút Vocab Quiz */}
                            <TouchableOpacity style={styles.practiceButton} onPress={() => navigation.navigate('VocabQuizScreen')} activeOpacity={0.8}>
                                <View style={styles.buttonContentWrapper}>
                                    <View style={[styles.iconCircle, { backgroundColor: '#fffbeb' }]}>
                                        <Image source={require('../assets/test.png')} style={styles.buttonIcon} />
                                    </View>
                                    <Text style={styles.buttonMainText}>Vocab Quiz</Text>
                                    <Text style={styles.buttonSubText}>10 questions</Text>
                                </View>
                            </TouchableOpacity>                        
                        </View>
                    </View>

                    
                </ScrollView>
                {/*Thanh điều hướng nhanh đến các màn hình khác*/}
                <View style={styles.quickNavContainer}>
                    {/*Nút home */}
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('HomeScreen')}>
                        <Ionicons name="home" size={20} color="#667eea" opacity={1} />
                        <Text style={{ fontSize: 12, color: '#667eea', marginTop: 4 }}>Home</Text>
                    </TouchableOpacity>

                    {/*Nút card */}
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('PracticeScreen')}>
                        <Ionicons name="albums" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Cards</Text>
                    </TouchableOpacity>

                    {/*Nút Wordlist */}
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('WordListScreen')}>
                        <Ionicons name="book" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Words</Text>
                    </TouchableOpacity>

                    {/*Nút Reading */}
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('AIReadingScreen')}>
                        <Ionicons name="sparkles" size={20} color="#919191" opacity={0.3} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Reading</Text>
                    </TouchableOpacity>

                    {/*Nút Quiz */}
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 15 }} onPress={() => navigation.navigate('VocabQuizScreen')}>
                        <Ionicons name="checkmark-circle" size={20} color="#919191" opacity={0.6} />
                        <Text style={{ fontSize: 12, color: '#919191', marginTop: 4 }}>Quiz</Text>
                    </TouchableOpacity>

                </View>
            </LinearGradient>
        </View>
    )
}

const styles = StyleSheet.create({
    // Khung bọc ngoài cùng trên Web để căn giữa mô phỏng điện thoại
    webWrapper: {
        flex: 1,
        backgroundColor: Platform.OS === 'web' ? '#f0f2f5' : 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },

    
    phoneContainer: {
        
        width: Platform.OS === 'web' ? 400 : '100%',
        height: Platform.OS === 'web' ? 800 : '100%',
        
        // Tạo hiệu ứng giống chiếc điện thoại khi xem trên máy tính
        borderRadius: Platform.OS === 'web' ? 35 : 0,
        overflow: 'hidden',
        
        // Đổ bóng cho khung trên Web
        ...Platform.select({
            web: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
            }
        })
    },

    // Cấu hình chuẩn cho ScrollView con bên trong
    scrollContainer: {
        flexGrow: 1, 
        justifyContent: 'space-between', // Đẩy Header lên đỉnh, Card trắng xuống đáy
    },

    headerSection: {
        alignItems: 'center',
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, // Chừa khoảng trống an toàn cho tai thỏ điện thoại
        paddingHorizontal: 20,
    },
    appName: {
        fontSize: 42,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    appSubtitle: {
        marginTop: 6,
        fontSize: 20,
        color: '#e2e8f0',
        textAlign: 'center',
        opacity: 0.9,
    },

    
    whiteCardContainer: {
        flex: 1, // Tự động chiếm trọn phần không gian trống bên dưới
        backgroundColor: '#F0F2FF',
        width: '100%',
        minHeight: 450, // Đảm bảo card luôn có độ cao tối thiểu kể cả khi chưa có dữ liệu inside
        alignItems: 'center',
        paddingHorizontal: 24,

        marginTop: 34, // Tạo khoảng cách giữa phần header và card trắng
        paddingTop: 10, // Tạo khoảng cách giữa phần trên của card và nội dung bên trong
    },

    appWelcome: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        marginTop: 10,
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF3F3',

    },

    welcomeSubtitle: {
        marginTop: 10,
        fontSize: 24,
        color: '#919191',
        textAlign: 'center',
        opacity: 0.9,
    },


    googleButton: {
        fontSize: 18,
        color: '#000000',
        fontWeight: '600',
    },

    googleButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',

        borderRadius: 50,
        margin: 10,

        paddingVertical: 10,
        paddingHorizontal: 20,
    },

    facebookButton: {
        fontSize: 18,
        color: '#ffffff',
        fontWeight: '600',
        
    },

    facebookButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1877F2',
        borderRadius: 50,

        margin: 10,

        paddingVertical: 10,
        paddingHorizontal: 20,
    },

    //Email Section styles
    emailSection: {
        marginTop: 10,
        width: '100%',
    },
    emailSectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    emailInput: {
        
        backgroundColor: '#FFFBFB',
        borderRadius: 20,
        padding: 10,
        fontSize: 16,

        paddingHorizontal: 30,
        paddingVertical: 20,
    },

    //Password Section styles
    passwordSection: {
        marginTop: 20,
        width: '100%',  
    },

    passwordSectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },

    passwordInput: {
        
        backgroundColor: '#FFFBFB',    
        borderRadius: 20,
        padding: 10,
        fontSize: 16,

        paddingHorizontal: 30,
        paddingVertical: 20,
    },

    loginButton: {
        paddingVertical: 15,
        paddingHorizontal: 30,
        backgroundColor: '#1877F2',
        borderRadius: 20,
        marginTop: 30,
        width: '100%',
        alignItems: 'center',
    },

    loginButtonText: {

        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },

    forgotPassword: {
        color: '#667eea',
        fontWeight: '600',
        marginTop: 10,
        textAlign: 'right',
    },

    userNameText: {
        alignSelf: 'flex-start',
        marginTop: 5,
        marginLeft: 10,
        fontSize: 24,
        color: '#ffffff',
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

        //Độ opacity và màu sắc của tấm kính mờ
        backgroundColor: 'rgba(255, 255, 255, 0.12)', 
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',  

        // Đổ bóng dịu nhẹ phía dưới tấm kính 
        shadowColor: 'rgba(31, 38, 135, 0.15)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 10,

        
        elevation: 3,

        marginHorizontal: 5,    
    },
    
    statsValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',

    },

    statsLabel: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },

    wordRemainingContainer: {
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginTop: -30,
        width: '100%',
        alignItems: 'stretch',
    },

    wordCountTitle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        width: '100%',
    },

    wordCountLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    wordCountValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#5500FF',
    },

    wordCountHeader: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000000',
        marginLeft: 8,
    },

    progressContainer: {
        height: 10,
        width: '100%',
        backgroundColor: '#e0e0e0',
        borderRadius: 5,
        overflow: 'hidden',
        marginTop: 10,
    },

    progressBar: {
        height: '100%',
        backgroundColor: '#667eea',
        borderRadius: 5,
    },

    practiceButtonsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 16,
        gap: 10,
        justifyContent: 'space-between',
        width: '100%',
    },

    practiceButton: {
        width: '47.8%', // Chiếm gần nửa màn hình, chừa khoảng trống cho gap tự căn giữa
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 3,



    }, 

    buttonIcon: {
        width: 26,
        height: 26,
        resizeMode: 'contain',
    },
    buttonMainText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    buttonSubText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },

    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },

    quickNavContainer: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',

        width: '100%', 
        alignSelf: 'stretch',
    
    },

    notificationButton: {
        position: 'absolute',
        top: 50,
        right: 60,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',     
        borderRadius: 22,         

        //Độ opacity và màu sắc của tấm kính mờ
        backgroundColor: 'rgba(255, 255, 255, 0.12)', 
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',  

        // Đổ bóng dịu nhẹ phía dưới tấm kính 
        shadowColor: 'rgba(31, 38, 135, 0.15)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 10,

        
        elevation: 3,
    },

    profileButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',     
        borderRadius: 22,

        //Độ opacity và màu sắc của tấm kính mờ
        backgroundColor: 'rgba(255, 255, 255, 0.12)', 
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',  

        // Đổ bóng dịu nhẹ phía dưới tấm kính 
        shadowColor: 'rgba(31, 38, 135, 0.15)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 10,

        
        elevation: 3,
    },

});