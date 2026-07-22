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
import { FlatList } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function NotificationScreen({navigation}) {
    
    const [notifications, setNotifications] = useState([]);
    const MOCK_NOTIFICATIONS = [
        { 
            id: 1, 
            title: 'Continue Streak', 
            type: 'Streak',
            isRead: false,
            time: '2 hours ago' },
        { 
            id: 2, 
            title: 'You have reached Level 3', 
            type: 'Achievement',
            isRead: false,
            time: '1 day ago' 
        },
        { 
            id: 3, 
            title: 'Reminder', 
            type: 'Studying',
            isRead: false,
            time: '3 days ago' 
        },
    ];
    useEffect(() => {
        // Giả lập dữ liệu thông báo
        setNotifications(MOCK_NOTIFICATIONS);
    }, []);
    // 1. CHỨC NĂNG: Bấm vào 1 item -> Đánh dấu là đã đọc
    const handlePressNotification = (id) => {
        setNotifications(prev =>
        prev.map(item => item.id === id ? { ...item, isRead: true } : item)
        );
    };

    // 2. CHỨC NĂNG: Đánh dấu tất cả là đã đọc
    const handleMarkAllAsRead = () => {
        setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
    };
    
    // RENDER TỪNG CARD THÔNG BÁO
  const renderItem = ({ item }) => (
    <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => handlePressNotification(item.id)}
        style={[
            styles.notificationItem, 
            item.isRead ? styles.readNotification : styles.unreadNotification
        ]}
        >
        <View style={styles.notificationIcon}>
            {renderNotificationsIcon(item.type)}
        </View>
        
        <View style={styles.notificationContent}>
            <View style={styles.cardTopRow}>
                <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitleText]}>
                    {item.title}
                </Text>
                {!item.isRead && <View style={styles.unreadDot} />}
            </View>

            {item.message && (
            <Text style={styles.notificationMessage} numberOfLines={2}>
                {item.message}
            </Text>
            )}

            <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
        </TouchableOpacity>
    );

    const unreadCount = notifications.filter(n => !n.isRead).length;

    {/* 3. CHỨC NĂNG: Render icon dựa trên loại thông báo */}
    const renderNotificationsIcon = (type) => {
        switch (type) {
        case 'Streak':
            return (
            <View style={[styles.iconBadge, { backgroundColor: '#ffedd5' }]}>
                <Ionicons name="flame" size={20} color="#f97316" />
            </View>
            );
        case 'Achievement':
            return (
            <View style={[styles.iconBadge, { backgroundColor: '#fef9c3' }]}>
                <Ionicons name="trophy" size={20} color="#eab308" />
            </View>
            );
        case 'Studying':
            return (
            <View style={[styles.iconBadge, { backgroundColor: '#adead5' }]}>
                <Image source={require('../assets/layer.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
            </View>
            );
        default:
            return (
            <View style={[styles.iconBadge, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="notifications" size={20} color="#64748b" />
            </View>
            );
        }
    };

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

                        <Text style={styles.appName}>Notifications</Text>
                    </View>


                    <View style={styles.whiteCardContainer}>
                        {/*Danh sách thông báo*/}
                        <FlatList 
                            data={notifications}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderItem}
                            style={{ width: '100%' , paddingHorizontal: 30, marginTop: 15}}
                            contentContainerStyle={styles.notificationsList}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={50} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No notifications yet</Text>
                            </View>
                            }
                        />
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
        paddingHorizontal: 0,

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
    },

    accountSettingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        opacity: 0.6,
       
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 8,
    },

    accountSetting: {
        width: '100%',
        marginTop: 20,
        marginBottom: 20,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
    
    },
    accountSettingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },

    accountSettingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },

    accountDeleteLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ef4444', // Màu đỏ để nhấn mạnh tính nguy hiểm
    },

    accountSettingSubLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },

    appearenceSetting: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
    },

    customToggle: {
        width: 54,
        height: 28,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 2,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },

    customToggleActive: {
        backgroundColor: '#667eea',
        justifyContent: 'flex-end',
    },

    customToggleThumb: {
        width: 25,
        height: 25,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },

    customToggleThumbActive: {
        backgroundColor: '#ffffff',
    },

    learningSetting: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
    },

    learningGoal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4160ed',
        backgroundColor: '#e0e7ff',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderColor: '#c7d2fe',
        borderWidth: 1,
    },

    notificationItem: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 10,
        width: '100%',

        backgroundColor: '#ffffff'
        
    },
    unreadNotification: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 10,
        width: '100%',
        backgroundColor: '#e0e7ff', // Màu nền khác biệt cho thông báo chưa đọc

    },
    notificationIcon: {
        marginRight: 12,
    },

    notificationContent: {
        flex: 1,

    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
    },

    notificationTime: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },

    notificationsList: {
        width: '100%',
    },

    iconBadge: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },

    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },

    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 10,
    },


    unreadTitleText: {
        fontWeight: '700',
        color: '#0f172a',
    },

    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#667eea',
    },

    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

});