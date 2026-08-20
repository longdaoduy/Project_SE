import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    StatusBar,
    Platform,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, resendVerification, verifyEmail } from '../api';
import { useData } from '../context/DataContext';

const LEVELS = [
    { id: 'A1', title: 'Beginner A1', sub: 'Just starting out' },
    { id: 'A2', title: 'Elementary A2', sub: 'Basic conversation' },
    { id: 'B1', title: 'Intermediate B1', sub: 'Everyday topics' },
    { id: 'B2', title: 'Upper-intermediate B2', sub: 'Complex discussion' },
    { id: 'C1', title: 'Advanced C1', sub: 'Fluent and nuanced' },
    { id: 'C2', title: 'Proficient C2', sub: 'Near-native mastery' },
];

const GOALS = [
    { id: 'travel', label: 'Travel abroad', icon: 'airplane-outline' },
    { id: 'exam', label: 'IELTS / TOEIC', icon: 'ribbon-outline' },
    { id: 'academic', label: 'Academic study', icon: 'book-outline' },
    { id: 'career', label: 'Career growth', icon: 'trending-up-outline' },
];

const DAILY_GOALS = [5, 10, 15, 20];

export default function RegisterScreen({ navigation }) {
    // 1. Quản lý Step hiện tại
    const [step, setStep] = useState(1); // 1 | 2 | 3 | 4 (email verification)
    const [loading, setLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    // Hiện/ẩn mật khẩu
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // 2. State tổng quản lý toàn bộ Form
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        level: 'B2', // Default chọn B2 như UI
        goals: ['IELTS / TOEIC'], // Mặc định chọn 1 goal
        dailyGoal: 10, // Mặc định 10 min
    });

    // Helper cập nhật field trong formData
    const updateForm = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    // Toggle chọn nhiều Goals (Step 3)
    const toggleGoal = (goalLabel) => {
        setFormData((prev) => {
            const exists = prev.goals.includes(goalLabel);
            if (exists) {
                return { ...prev, goals: prev.goals.filter((g) => g !== goalLabel) };
            } else {
                return { ...prev, goals: [...prev.goals, goalLabel] };
            }
        });
    };

    // --- Nút Chuyển Bước / Submit ---
    const handleNext = () => {
        if (step === 1) {
            if (!formData.username || !formData.email || !formData.password) {
                Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                Alert.alert('Lỗi', 'Mật khẩu xác nhận không trùng khớp');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            handleFinalRegister();
        }
    };

    const handleBack = () => {
        if (step === 4) {
            navigation?.navigate('Login');
        } else if (step > 1) {
            setStep(step - 1);
        } else {
            navigation?.goBack();
        }
    };

    // --- API SUBMIT BƯỚC CUỐI ---
    const handleFinalRegister = async () => {
        try {
            setLoading(true);

            const payload = {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                englishLevel: formData.level,
                learningGoals: formData.goals,
                dailyGoalMinutes: formData.dailyGoal,
            };

            await registerUser(payload);
            setStep(4);
            Alert.alert('Check your email', `We sent a 6-digit code to ${formData.email}.`);
        } catch (err) {
            Alert.alert('Đăng ký thất bại', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEmail = async () => {
        if (!/^\d{6}$/.test(verificationCode)) {
            Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
            return;
        }
        try {
            setLoading(true);
            await verifyEmail({ email: formData.email, code: verificationCode });
            const loginResponse = await loginUser({
                email: formData.email,
                password: formData.password,
                device_name: 'Mobile App',
                ip_address: null,
            });

            await AsyncStorage.setItem('jwt_token', loginResponse.jwt_token);
            await AsyncStorage.setItem('session_id', String(loginResponse.session_id));
            await AsyncStorage.setItem('current_user', JSON.stringify(loginResponse.user));

            setUserId(loginResponse.user.user_id);
            setCurrentUser(loginResponse.user);
            setToken(loginResponse.jwt_token);

            Alert.alert('Success', 'Your email is verified and your account is ready.');

            // Điều hướng sang Home hoặc Main App
            navigation?.reset({
                index: 0,
                routes: [{ name: 'Home' }],
            });
        } catch (err) {
            Alert.alert('Verification failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        try {
            setLoading(true);
            await resendVerification(formData.email);
            setVerificationCode('');
            Alert.alert('Code sent', 'A new verification code was sent to your email.');
        } catch (err) {
            Alert.alert('Could not resend code', err.message);
        } finally {
            setLoading(false);
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

                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* PHẦN HEADER SECTION */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={20} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>
                                {step === 1 && 'Create account'}
                                {step === 2 && 'Your level'}
                                {step === 3 && 'Your goal'}
                                {step === 4 && 'Verify email'}
                            </Text>
                            <Text style={styles.stepSubtitle}>
                                {step === 4 ? 'Final step' : `Step ${step} of 3`}
                            </Text>
                        </View>
                    </View>

                    {/* PROGRESS BAR 3 ĐOẠN */}
                    <View style={styles.progressSection}>
                        {[1, 2, 3, 4].map((i) => (
                            <View
                                key={i}
                                style={[
                                    styles.progressSegment,
                                    i <= step ? styles.segmentActive : styles.segmentInactive,
                                ]}
                            />
                        ))}
                    </View>

                    <View style={styles.whiteCardContainer}>
                        {/* ================= STEP 1: ACCOUNT INFO ================= */}
                        {step === 1 && (
                            <View style={styles.stepContent}>
                                {/* Avatar Placeholder */}
                                <View style={styles.avatarWrapper}>
                                    <View style={styles.avatarCircle}>
                                        <Ionicons name="person-outline" size={40} color="#94a3b8" />
                                    </View>
                                    <TouchableOpacity style={styles.cameraBtn}>
                                        <Ionicons name="camera-outline" size={13} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                {/* Input Fields */}
                                <Text style={styles.inputLabel}>Username</Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="person-outline" size={18} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Duy Long"
                                        placeholderTextColor="#cbd5e1"
                                        value={formData.username}
                                        onChangeText={(val) => updateForm('username', val)}
                                    />
                                </View>

                                <Text style={styles.inputLabel}>Email</Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="mail-outline" size={18} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="longdeptrai@gmail.com"
                                        placeholderTextColor="#cbd5e1"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={formData.email}
                                        onChangeText={(val) => updateForm('email', val)}
                                    />
                                </View>

                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#cbd5e1"
                                        secureTextEntry={!showPassword}
                                        value={formData.password}
                                        onChangeText={(val) => updateForm('password', val)}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeBtn}
                                        onPress={() => setShowPassword((s) => !s)}
                                    >
                                        <Ionicons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={18}
                                            color="#94a3b8"
                                        />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.inputLabel}>Confirm password</Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#cbd5e1"
                                        secureTextEntry={!showConfirmPassword}
                                        value={formData.confirmPassword}
                                        onChangeText={(val) => updateForm('confirmPassword', val)}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeBtn}
                                        onPress={() => setShowConfirmPassword((s) => !s)}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={18}
                                            color="#94a3b8"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ================= STEP 2: YOUR LEVEL ================= */}
                        {step === 2 && (
                            <View style={styles.stepContent}>
                                <Text style={styles.questionTitle}>What’s your English level?</Text>
                                <Text style={styles.questionSub}>
                                    We’ll personalize your learning path.
                                </Text>
                                <View style={{ marginTop: 12, maxHeight: 320 }}>
                                <ScrollView 
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 2 }} // Tránh bị cấn shadow/border
                                >
                                    {LEVELS.map((level) => {
                                    const selected = formData.level === level.id;
                                    return (
                                        <TouchableOpacity
                                        key={level.id}
                                        style={[
                                            styles.levelCard,
                                            selected && styles.selectedLevelCard,
                                        ]}
                                        activeOpacity={0.7}
                                        onPress={() => updateForm('level', level.id)}
                                        >
                                        <View style={styles.levelTextWrap}>
                                            <Text
                                            style={[
                                                styles.levelTitle,
                                                selected && styles.selectedText,
                                            ]}
                                            >
                                            {level.title}
                                            </Text>
                                            <Text style={styles.levelSub}>{level.sub}</Text>
                                        </View>

                                        <View
                                            style={[
                                            styles.radio,
                                            selected && styles.radioActive,
                                            ]}
                                        >
                                            {selected && <View style={styles.radioInner} />}
                                        </View>
                                        </TouchableOpacity>
                                    );
                                    })}
                                </ScrollView>
                                </View>
                            </View>
                        )}

                        {/* ================= STEP 3: YOUR GOAL ================= */}
                        {step === 3 && (
                            <View style={styles.stepContent}>
                                <Text style={styles.questionTitle}>
                                    What are your learning goals?
                                </Text>
                                <Text style={styles.questionSub}>Select all that apply</Text>

                                <View style={styles.goalsGrid}>
                                    {GOALS.map((goal) => {
                                        const selected = formData.goals.includes(goal.label);
                                        return (
                                            <TouchableOpacity
                                                key={goal.id}
                                                style={[
                                                    styles.goalCard,
                                                    selected && styles.selectedGoalCard,
                                                ]}
                                                activeOpacity={0.7}
                                                onPress={() => toggleGoal(goal.label)}
                                            >
                                                <Ionicons
                                                    name={goal.icon}
                                                    size={26}
                                                    color={selected ? '#7c3aed' : '#94a3b8'}
                                                />
                                                <Text
                                                    style={[
                                                        styles.goalText,
                                                        selected && styles.selectedText,
                                                    ]}
                                                >
                                                    {goal.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.dailyGoalTitle}>DAILY GOAL</Text>
                                <View style={styles.dailyGoalRow}>
                                    {DAILY_GOALS.map((mins) => {
                                        const selected = formData.dailyGoal === mins;
                                        return (
                                            <TouchableOpacity
                                                key={mins}
                                                style={[
                                                    styles.timeBtn,
                                                    selected && styles.selectedTimeBtn,
                                                ]}
                                                activeOpacity={0.7}
                                                onPress={() => updateForm('dailyGoal', mins)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.timeText,
                                                        selected && styles.selectedTimeText,
                                                    ]}
                                                >
                                                    {mins} min
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {step === 4 && (
                            <View style={styles.stepContent}>
                                <View style={styles.verificationIcon}>
                                    <Ionicons name="mail-unread-outline" size={42} color="#7c3aed" />
                                </View>
                                <Text style={[styles.questionTitle, styles.centerText]}>
                                    Check your inbox
                                </Text>
                                <Text style={[styles.questionSub, styles.centerText]}>
                                    Enter the 6-digit code sent to {formData.email}. It expires in 10 minutes.
                                </Text>
                                <TextInput
                                    style={styles.codeInput}
                                    value={verificationCode}
                                    onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    placeholderTextColor="#cbd5e1"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                                <TouchableOpacity onPress={handleResendCode} disabled={loading}>
                                    <Text style={styles.resendText}>Didn’t receive it? Send a new code</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* NÚT ACTION CHÍNH (CONTINUE / START LEARNING) */}
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={step === 4 ? handleVerifyEmail : handleNext}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.actionBtnText}>
                                    {step === 4 ? 'Verify email' : step === 3 ? 'Create account' : 'Continue'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
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
            },
        }),
    },

    // Cấu hình chuẩn cho ScrollView con bên trong
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'space-between', // Đẩy Header lên đỉnh, Card trắng xuống đáy
    },

    whiteCardContainer: {
        flex: 1,
        backgroundColor: '#EEF0FB',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        width: '100%',
        minHeight: 470,
        alignItems: 'stretch',
        paddingHorizontal: 24,
        marginTop: 20,
        paddingTop: 20,
        paddingBottom: 24,
    },

    stepContent: {
        width: '100%',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginRight: 36,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    stepSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 2,
    },

    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 8,
        marginBottom: 12,
        gap: 6,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    segmentActive: {
        backgroundColor: '#ffffff',
    },
    segmentInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    avatarWrapper: {
        alignSelf: 'center',
        position: 'relative',
        marginBottom: 16,
    },
    avatarCircle: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    cameraBtn: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        backgroundColor: '#3F51B5',
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },

    inputLabel: {
        width: '100%',
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 13,
        marginBottom: 7,
    },
    inputBox: {
        width: '100%',
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#1e293b',
        paddingVertical: 0,
    },
    eyeBtn: {
        padding: 4,
    },

    questionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 6,
    },
    questionSub: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 18,
        marginTop: 4,
    },

    levelCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    selectedLevelCard: {
        borderColor: '#7c3aed',
        backgroundColor: '#F7F2FE',
    },
    levelTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    levelTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    levelSub: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    selectedText: {
        color: '#7c3aed',
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioActive: {
        borderColor: '#7c3aed',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#7c3aed',
    },

    goalsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    goalCard: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingVertical: 24,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        minHeight: 105,
    },
    selectedGoalCard: {
        borderColor: '#7c3aed',
        backgroundColor: '#F7F2FE',
    },
    goalText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginTop: 10,
        textAlign: 'center',
    },

    dailyGoalTitle: {
        width: '100%',
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.8,
        marginTop: 22,
        marginBottom: 12,
    },
    dailyGoalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeBtn: {
        width: '22.5%',
        paddingVertical: 11,
        backgroundColor: '#fff',
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    selectedTimeBtn: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    timeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    selectedTimeText: {
        color: '#fff',
    },

    actionBtn: {
        width: '100%',
        backgroundColor: '#1877F2',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 22,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    verificationIcon: {
        width: 82,
        height: 82,
        borderRadius: 41,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E8FF',
        marginTop: 28,
        marginBottom: 16,
    },
    centerText: {
        textAlign: 'center',
    },
    codeInput: {
        height: 64,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#c4b5fd',
        borderRadius: 16,
        color: '#1e293b',
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 12,
        textAlign: 'center',
        paddingLeft: 12,
        marginTop: 12,
    },
    resendText: {
        color: '#6d28d9',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 18,
    },
});
