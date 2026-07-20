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
    Image ,
    TouchableOpacity,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoginScreen({navigation}) {
    const [showPassword, setShowPassword] = useState(false);

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
                    {/* PHẦN HEADER SECTION */}
                    <View style={styles.headerSection}>
                        <Text style={styles.appName}>SmartEng</Text>
                        <Text style={styles.appSubtitle}>Master English, smarter</Text>
                    </View>

                    
                    <View style={styles.whiteCardContainer}>
                        <Text style={styles.appWelcome}>
                            Welcome Back !👋
                        </Text>
                        <Text style={styles.welcomeSubtitle}> Sign in to continue your streak </Text>
                        {/* Nút đăng nhập bằng GG*/}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                            <TouchableOpacity style={styles.googleButtonContainer}>
                                <Image source={require('../assets/google.png')} style={{ width: 24, height: 24, marginRight: 10 }} />
                                <Text style={styles.googleButton}>Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.facebookButtonContainer}>
                                <Image source={require('../assets/facebook.png')} style={{ width: 24, height: 24, marginRight: 10 }} />
                                <Text style={styles.facebookButton}>Facebook</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Đường phân cách */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20 }}>
                            <Text style={{ flex: 1, height: 1, backgroundColor: '#666' }} />
                            <Text style={{ marginHorizontal: 10, color: '#666' }}>or with email</Text>
                            <Text style={{ flex: 1, height: 1, backgroundColor: '#666' }} />
                        </View>


                        {/* Nút đăng nhập bằng Email */}
                        <View style={styles.emailSection}>
                            <Text style={styles.emailSectionTitle}>Email</Text>
                            <View style={styles.emailInputContainer}>
                                <Ionicons name="mail-outline" size={20} color="#666" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter your email"
                                    keyboardType="email-address"
                                />
                                
                            </View>
                        </View>

                        <View style={styles.passwordSection}>
                            <Text style={styles.passwordSectionTitle}>Password</Text>
                            <View style={styles.passwordInputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#666" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Enter your password"
                                    secureTextEntry={!showPassword}
                                />

                                {/*Icon mắt để hiển thị mật khẩu*/}
                                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#666"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Nút quên mật khẩu */}
                        <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                            <Text style={styles.forgotPassword}>Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Nút đăng nhập */}
                        <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Home')}>
                            <Text style={styles.loginButtonText}>Sign in</Text>
                        </TouchableOpacity>


                        {/* Nút đăng ký */}
                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <Text style={{ color: '#666' , fontSize: 16}}>Don't have an account? </Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#667eea', fontWeight: '600' }}>Sign Up for free</Text>
                            </TouchableOpacity>
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
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        width: '100%',
        minHeight: 450, // Đảm bảo card luôn có độ cao tối thiểu kể cả khi chưa có dữ liệu inside
        alignItems: 'center',
        paddingHorizontal: 24,

        marginTop: 20, // Tạo khoảng cách giữa phần header và card trắng
        paddingTop: 10, // Tạo khoảng cách giữa phần trên của card và nội dung bên trong
    },

    appWelcome: {
        marginTop: 30,
        fontSize: 29,
        fontWeight: '700',
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
        width: '100%',
        padding: 10,
        fontSize: 16,

        paddingHorizontal: 10,
        paddingVertical: 20,
    },

    emailInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBFB',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
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
        width: '100%',
        padding: 10,
        fontSize: 16,

        paddingHorizontal: 10,
        paddingVertical: 20,
    },

    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBFB',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },

    eyeButton: {
        marginLeft: 10,
        padding: 4,
    },

    loginButton: {
        paddingVertical: 15,
        paddingHorizontal: 30,
        backgroundColor: '#1877F2',
        borderRadius: 20,
        marginTop: 10,
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
    
    eyeButton: {
        marginLeft: 0,
    },
    
});