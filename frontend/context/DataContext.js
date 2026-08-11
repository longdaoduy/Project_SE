import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, getTopics } from '../api';

async function clearAuthStorage() {
  await Promise.all([
    AsyncStorage.removeItem('jwt_token'),
    AsyncStorage.removeItem('session_id'),
    AsyncStorage.removeItem('current_user'),
  ]);
}

const DataContext = createContext();

export function DataProvider({ children }) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('jwt_token');
        const savedUser = await AsyncStorage.getItem('current_user');
        const savedSessionId = await AsyncStorage.getItem('session_id');

        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setCurrentUser(parsedUser);
          setUserId(parsedUser.user_id ?? null);
        }
        if (savedToken) {
          setToken(savedToken);
          try {
            const me = await getMe(savedToken);
            setCurrentUser(me);
            setUserId(me.user_id ?? null);
          } catch (e) {
            console.warn('restoreAuth getMe error:', e.message);
            setToken(null);
            setCurrentUser(null);
            setUserId(null);
            await clearAuthStorage();
          }
        }
        if (savedSessionId) {
          // session_id kept for logout compatibility
        }
      } catch (e) {
        console.warn('restoreAuth error:', e.message);
      } finally {
        setAuthReady(true);
      }
    };

    restoreAuth();
  }, []);

  // ── Backend topics ──────────────────────────────────────────────────────────
  const [topics,        setTopics]        = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError,   setTopicsError]   = useState('');

  const loadTopics = useCallback(async () => {
    try {
      setTopicsLoading(true);
      setTopicsError('');
      const data = await getTopics(200);
      setTopics(data);
    } catch (e) {
      setTopicsError(e.message || 'Could not reach backend');
      console.warn('loadTopics error:', e.message);
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  // Load once on mount
  useEffect(() => { loadTopics(); }, [loadTopics]);

  // ── Legacy local decks (PracticeScreen) ─────────────────────────────────────
  const [decks, setDecks] = useState([]);

  const addDeck = useCallback((deck) => {
    setDecks((prev) => [...prev, {
      id: Date.now().toString(),
      currentWords: 0, totalWords: deck.totalWords || 10, progress: 0,
      createdAt: new Date().toISOString(), ...deck,
    }]);
  }, []);

  const updateDeckProgress = useCallback((deckId, currentWords, totalWords) => {
    setDecks((prev) => prev.map((d) =>
      d.id === deckId
        ? { ...d, currentWords, totalWords, progress: totalWords > 0 ? Math.round((currentWords / totalWords) * 100) : 0 }
        : d
    ));
  }, []);

  const deleteDeck = useCallback((deckId) => {
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  }, []);

  return (
    <DataContext.Provider value={{
      token, setToken,
      currentUser, setCurrentUser,
      userId, setUserId,
      authReady,
      topics, topicsLoading, topicsError, loadTopics,
      decks, addDeck, updateDeckProgress, deleteDeck,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}

export default DataContext;
