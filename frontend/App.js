import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from './Screens/LoginScreen';
import HomeScreen from './Screens/HomeScreen';
import ProfileScreen from './Screens/ProfileScreen';
import SettingsScreen from './Screens/SettingScreen';
import NotificationScreen from './Screens/NotificationScreen';
import WordlistScreen from './Screens/WordlistScreen';
import FlashcardScreen from './Screens/FlashcardScreen';
import AIReadingScreen from './Screens/AIReadingScreen';
import VocabQuizScreen from './Screens/VocabQuizScreen';
import QuizMultipleChoice from './Screens/QuizMultipleChoice';
import QuizFillInBlank from './Screens/QuizFillInBlank';
import QuizMatching from './Screens/QuizMatching';
import QuizSpeedRound from './Screens/QuizSpeedRound';
import RegisterScreen from './Screens/RegisterScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DataProvider } from './context/DataContext';
import { useData } from './context/DataContext';

const Stack = createStackNavigator();

function AppNavigator() {
  const { token, authReady } = useData();

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={token ? 'authenticated' : 'guest'}
        initialRouteName={token ? 'Home' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="Notifications" component={NotificationScreen} />
        <Stack.Screen name="WordlistScreen" component={WordlistScreen} />
        <Stack.Screen name="FlashcardScreen" component={FlashcardScreen} />
        <Stack.Screen name="AIReadingScreen" component={AIReadingScreen} />
        <Stack.Screen name="VocabQuizScreen" component={VocabQuizScreen} />
        <Stack.Screen name="QuizMultipleChoice" component={QuizMultipleChoice} />
        <Stack.Screen name="QuizFillInBlank" component={QuizFillInBlank} />
        <Stack.Screen name="QuizMatching" component={QuizMatching} />
        <Stack.Screen name="QuizSpeedRound" component={QuizSpeedRound} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppNavigator />
    </DataProvider>
  );
}
