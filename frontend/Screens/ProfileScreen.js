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

export default function ProfileScreen({navigation}) {
    const [profileData, setProfileData] = useState({
        name: 'Duy Long',
        email: "longdeptrai@gmail.com",
        englishLevel: "B2 English Level",
        stats: {
            streaks: 12,
            level: 3,
            xp: 243,
            words: 1280,
            quizzes: 45,
            perfect: 12,
            hours: 36,
        },
       
        avatarUrl: null, // URL ảnh đại diện của người dùng, nếu null thì sẽ hiển thị ảnh mặc định
        // Dữ liệu biểu đồ cột (số lượng từ học qua từng ngày từ Thứ 2 -> Chủ Nhật)
        weeklyHistory: [
        { day: 'M', words: 10 },
        { day: 'T', words: 25 },
        { day: 'W', words: 18 },
        { day: 'T', words: 8 },
        { day: 'F', words: 28 },
        { day: 'S', words: 12 },
        { day: 'S', words: 20 }, // Ngày hiện tại (Chủ nhật)
        ],
        // Dữ liệu thành tựu của người dùng
        achievements: [
            { title: 'First 100 Words', description: 'Learned 100 words', date: '2024-01-15' },
            { title: '7-Day Streak', description: 'Completed 7 days in a row', date: '2024-02-10' },
            { title: 'Level 5 Achieved', description: 'Reached Level 5', date: '2024-03-05' },
        ],
    });

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Hiện tại chưa có backend, ta dùng dữ liệu Mock khai báo ở useState phía trên.
        // Sau này có backend Node.js, chỉ cần mở đoạn code fetch dưới đây ra:
        
    }, []);

    const totalWordsThisWeek = profileData.weeklyHistory.reduce((sum, item) => sum + item.words, 0);
    {/*Lấy số từ học được nhiều nhất trong tuần để tính phần trăm chiều cao cột biểu đồ*/}
    const maxWordsInWeek = Math.max(...profileData.weeklyHistory.map((item) => item.words), 1);


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
                        {/*Nút back*/}
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Image source={require('../assets/back.png')} style={{ width: 16, height: 16, marginBottom: 0, resizeMode: 'contain' }} />
                        </TouchableOpacity>

                        <Text style={styles.appName}>My Profile</Text>

                        {/*Nút setting*/}
                        <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('NotificationScreen')}>
                            <Ionicons name="settings-outline" size={18} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.avatarSection}>
                        <View style={styles.avatarWrapper}>
                            {profileData.avatarUrl ? (
                                <Image source={{ uri: profileData.avatarUrl }} style={styles.avatarImage} />
                            ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={60} color="#ffffff" />
                            </View>
                            )}
                    
                            {/*Nút edit avatar*/}
                            <TouchableOpacity style={styles.editAvatarButton}>
                                <AntDesign name="edit" size={16} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/*Username và email người dùng*/}
                    <Text style={styles.userNameText}>{profileData.name}</Text>
                    <Text style={styles.userNameEmail}>{profileData.email}</Text>

                    <View style={styles.levelWrapper}>
                        {/*Hiển thị trình độ tiếng Anh của người dùng*/}
                        <View style={styles.englishLevelContainer}>
                            <Ionicons name="language-outline" size={16} color="#ffffff" />
                            <Text style={styles.englishLevelText}>{profileData.englishLevel}</Text>
                        </View>

                        {/*Hiển thị level */}
                        <View style={styles.levelContainer}>
                            <Image source={require('../assets/trophy.png')} style={styles.levelIcon} />
                            <Text style={styles.levelText}>Level {profileData.stats.level}</Text>
                        </View>
                    </View>

                    <View style={styles.whiteCardContainer}>
                        {/* Lưới 6 thông số học tập */}
                        <View style={styles.statsGridCard}>
                            <View style={styles.gridRow}>
                                <View style={styles.gridItem}>
                                    <Image source={require('../assets/fire.png')} style={styles.gridIcon} />
                                    <Text style={styles.gridValue}>{profileData.stats.streaks}</Text>
                                    <Text style={styles.gridLabel}>Day streaks</Text>
                                </View>
                                <View style={styles.gridItem}>
                                    <Image source={require('../assets/xp.png')} style={styles.gridIcon} />
                                    <Text style={styles.gridValue}>{profileData.stats.xp}</Text>
                                    <Text style={styles.gridLabel}>XP</Text>
                                </View>
                                <View style={styles.gridItem}>
                                    <Image source={require('../assets/books.png')} style={styles.gridIcon} />
                                    <Text style={styles.gridValue}>{profileData.stats.words}</Text>
                                    <Text style={styles.gridLabel}>Words</Text>
                                </View>
                            </View>

                            <View style={[styles.gridRow, { marginTop: 24 }]}>
                                <View style={styles.gridItem}>
                                    <Image source={require('../assets/target.png')} style={styles.gridIcon} />
                                    <Text style={styles.gridValue}>{profileData.stats.quizzes}</Text>
                                    <Text style={styles.gridLabel}>Quizzes</Text>
                                </View>
                                <View style={styles.gridItem}>
                                    <Text style={{fontSize: 22, marginBottom: 4}}>💯</Text>
                                    <Text style={styles.gridValue}>{profileData.stats.perfect}</Text>
                                    <Text style={styles.gridLabel}>Perfect</Text>
                                </View>
                                <View style={styles.gridItem}>
                                    <Text style={{fontSize: 22, marginBottom: 4}}>🕒</Text>
                                    <Text style={styles.gridValue}>{profileData.stats.hours}</Text>
                                    <Text style={styles.gridLabel}>Hours</Text>
                                </View>
                            </View>
                        </View>
                        
                        <View style={styles.chartCard}>
                            <View style={styles.chartHeader}>
                                <Text style={styles.chartTitle}>This week</Text>
                                <TouchableOpacity><Text style={styles.fullHistoryText}>Full history</Text></TouchableOpacity>
                            </View>

                            {/* Vẽ biểu đồ cột động tỉ lệ phần trăm */}
                            <View style={styles.chartBarWrapper}>
                                {profileData.weeklyHistory.map((item, index) => {
                                    // Cột cuối cùng (Chủ nhật) tô màu tím đậm làm nổi bật ngày hiện tại
                                    const isCurrentDay = index === profileData.weeklyHistory.length - 1;
                                    // Tính phần trăm chiều cao cột động dựa trên số từ gõ được
                                    const barHeightPercent = (item.words / maxWordsInWeek) * 100;

                                    return (
                                        <View key={index} style={styles.chartColumn}>
                                            <View style={styles.barBackground}>
                                                <View
                                                    style={[
                                                        styles.barFill,
                                                        {
                                                            height: `${barHeightPercent}%`,
                                                            backgroundColor: isCurrentDay ? '#6366f1' : '#e0e7ff',
                                                        },
                                                    ]}
                                                />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.chartDayText,
                                                    isCurrentDay && { color: '#6366f1', fontWeight: 'bold' },
                                                ]}
                                            >
                                                {item.day}
                                            </Text>
                                        </View>
                                    );
                                    })}
                            </View>

                                <Text style={styles.chartSubText}>Total: {totalWordsThisWeek} words practised this week</Text>
                            </View>

                        <View style={styles.achievementsSection}>
                            <Text style={{fontSize: 20, fontWeight: '700'}}>Achievements</Text>
                            
                            <ScrollView 
                                horizontal={true} 
                                showsHorizontalScrollIndicator={false} // Ẩn thanh cuộn mặc định cho đẹp
                                contentContainerStyle={styles.horizontalScrollContent}>
                                {profileData.achievements.map((achievement, index) => (
                                <View key={index} style={styles.achievementCard}>
                                    <AntDesign name="check-circle" size={16} color="#22c55e" style={styles.checkIcon} />
                                    <Image source={require('../assets/achievement.png')} style={styles.gridIcon} />
                                    
                                    <View style={styles.achievementInfo}>
                                        <Text style={styles.gridValue}>{achievement.title}</Text>
                                        
                                    </View>
                                </View>
                                ))}
                            </ScrollView>
                        </View>
                                    
                    </View>
                </ScrollView>
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
        fontSize: 29,
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

    backButton: {
        position: 'absolute',
        left: 20,
        top: 50,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',     
        borderRadius: 15,

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

    settingsButton: {
        position: 'absolute',
        right: 20,
        top: 50,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',     
        borderRadius:15,

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

    avatarSection: {
        marginTop: 20,
        alignItems: 'center',
        
    },

    avatarWrapper: {
        position: 'relative',
        width: 128,
        height: 128,
        borderRadius: 60,
        padding: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        borderColor: 'rgba(255, 255, 255, 0.28)',

        borderWidth: 2,         
        shadowColor: '#1f2937',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 5,

    },

    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        backgroundColor: '#ffffff',
    },

    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 60,
    },

    editAvatarButton: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#667eea',
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#1f2937',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 4,
        zIndex: 2,
    },

    userNameText: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 10,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
    },

    userNameEmail: {

        fontSize: 18,
        color: '#FFF3F3',
        marginTop: 4,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
    },

    englishLevelContainer: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 16,
        alignSelf: 'center',
    },

    englishLevelText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '600',
    },

    levelContainer: {
        flexDirection: 'row',
        marginTop: 8,
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 16,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(209, 182, 15, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
    },

    levelText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#FFEC1A',
        fontWeight: '600',
    },

    levelIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },

    levelWrapper: {
        flexDirection: 'row',
        paddingHorizontal: 16,  
        justifyContent: 'center',
        alignItems: 'center',

        gap: 12, // Khoảng cách giữa English Level và Level
        
    },
    

    statsGridCard: { 
        marginTop: -30,
        backgroundColor: '#ffffff', 
        borderRadius: 24, 
        paddingVertical: 12,
        paddingHorizontal: 16,
        shadowColor: '#000', 
        shadowOpacity: 0.04, 
        shadowRadius: 14, 
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,

        gap: 8, // Khoảng cách giữa các hàng trong lưới
        width: '100%',
    },

    gridRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'stretch',
        gap: 10,
    },
    gridItem: { 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: 76,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginHorizontal: 0,
       
    },
    gridIcon: { 
        width: 32, 
        height: 32, 
        marginBottom: 6, 
        resizeMode: 'contain' 
    },
    gridValue: { 
        fontSize: 24, 
        fontWeight: '800', 
        color: '#0f172a',
        lineHeight: 28,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    gridLabel: { 
        fontSize: 11, 
        color: '#64748b', 
        marginTop: 4, 
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        textAlign: 'center',
    },

    chartCard: { 
        backgroundColor: '#fff', 
        borderRadius: 24,
        paddingVertical: 16, 
        paddingHorizontal: 16, 
        marginTop: 16, 
        marginBottom: 10,
        shadowColor: '#000', 
        shadowOpacity: 0.03, 
        shadowRadius: 10, 
        elevation: 2, 
        borderWidth: 1, 
        borderColor: '#eef2ff',
        width: '100%' 
    },

    chartHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 10 
    },
    chartTitle: { 
        fontSize: 18, 
        fontWeight: '700', 
        color: '#1e293b' 
    
    },
    fullHistoryText: { 
        fontSize: 14, 
        color: '#6366f1', 
        fontWeight: '600' 
    },
    chartBarWrapper: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        height: 110, 
         
    },
    chartColumn: {
        alignItems: 'center', 
        flex: 1, 
        justifyContent: 'flex-end', 
    },
    barBackground: { 
        height: 82, 
        width: '72%',
        maxWidth: 30, 
        backgroundColor: '#eef2ff', 
        borderRadius: 10, 
        justifyContent: 'flex-end', 
        overflow: 'hidden' 
    },
    barFill: { 
        width: '100%', 
        borderTopLeftRadius: 10, 
        borderTopRightRadius: 10, 
        borderBottomLeftRadius: 10, 
        borderBottomRightRadius: 10 
    },
    chartDayText: { 
        fontSize: 12, 
        color: '#94a3b8', 
        marginTop: 6, 
        fontWeight: '600' 
    },
    chartSubText: { 
        fontSize: 13, 
        color: '#64748b', 
        textAlign: 'center', 
        marginTop: 14, 
        fontWeight: '500' 
    },

    
    achievementsSection: {
        width: '100%',
        marginBottom: 20,
    },
    
    // Cấu hình khoảng đệm (padding) cho vùng nội dung bên trong thanh cuộn ngang
    horizontalScrollContent: {
        paddingHorizontal: 4, // Tránh việc card đầu và cuối bị dính sát viền
        paddingVertical: 10,  // Chừa khoảng trống để đổ bóng đổ xuống không bị cắt
        gap: 12,              // Tạo khoảng cách giữa các card thành tựu
    },

    achievementCard: {
        width: 140,           // BẮT BUỘC: Đặt chiều rộng cố định cho mỗi ô khi cuộn ngang
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 10,
        alignItems: 'center', // Căn giữa tất cả icon và chữ theo chiều dọc
        
        // Đổ bóng nhẹ cho từng ô thành tựu nổi lên
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },

    achievementInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        width: '100%',
    },

    gridIcon: {
        width: 25,
        height: 25,
        resizeMode: 'contain',
    },

    gridValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        numberOfLines: 1,      // Giới hạn 1 dòng nếu tên quá dài
        ellipsizeMode: 'tail', // Hiện dấu ... nếu bị tràn chữ
    },

    achievementSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '500',
    },

    checkIcon: {
        position: 'absolute',
        top: 10,    // Cách mép trên cùng của card 10px
        right: 10,  // Cách mép bên phải của card 10px
        zIndex: 1,  // Đảm bảo icon luôn nổi lên trên cùng không bị ảnh hay chữ đè mất,
    }
});