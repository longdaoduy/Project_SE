import { StatusBar } from 'expo-status-bar';
import LoginScreen from './Screens/LoginScreen';
import HomeScreen from './Screens/HomeScreen';
import ProfileScreen from './Screens/ProfileScreen';
import SettingsScreen from './Screens/SettingScreen';
import NotificationScreen from './Screens/NotificationScreen';
import WordlistScreen from './Screens/WordlistScreen';
import PracticeScreen from './Screens/PracticeScreen';
import FlashcardScreen from './Screens/FlashcardScreen';
import AIReadingScreen from './Screens/AIReadingScreen';
import VocabQuizScreen from './Screens/VocabQuizScreen';
import QuizMultipleChoice from './Screens/QuizMultipleChoice';
import QuizFillInBlank from './Screens/QuizFillInBlank';
import QuizMatching from './Screens/QuizMatching';
import QuizSpeedRound from './Screens/QuizSpeedRound';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DataProvider } from './context/DataContext';

const Stack = createStackNavigator();

export default function App() {
  return (
    <DataProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationScreen} />
          <Stack.Screen name="WordlistScreen" component={WordlistScreen} />
          <Stack.Screen name="FlashcardScreen" component={FlashcardScreen} />
          <Stack.Screen name="PracticeScreen" component={PracticeScreen} />
          <Stack.Screen name="AIReadingScreen" component={AIReadingScreen} />
          <Stack.Screen name="VocabQuizScreen" component={VocabQuizScreen} />
          <Stack.Screen name="QuizMultipleChoice" component={QuizMultipleChoice} />
          <Stack.Screen name="QuizFillInBlank" component={QuizFillInBlank} />
          <Stack.Screen name="QuizMatching" component={QuizMatching} />
          <Stack.Screen name="QuizSpeedRound" component={QuizSpeedRound} />
        </Stack.Navigator>
      </NavigationContainer>
    </DataProvider>
  );
}
