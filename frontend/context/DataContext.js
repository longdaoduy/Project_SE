import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, getTopics, getStarredWords, starWord, unstarWord } from '../api';

async function clearAuthStorage() {
  await Promise.all([
    AsyncStorage.removeItem('jwt_token'),
    AsyncStorage.removeItem('session_id'),
    AsyncStorage.removeItem('current_user'),
  ]);
}

const DataContext = createContext();
const DECKS_KEY_PREFIX = 'user_decks_v3_';
const LEGACY_DECKS_KEY = 'user_decks_v2';

/** Normalise for duplicate comparison: trim + lowercase. */
const normalise = (s) => (s || '').trim().toLowerCase();

/** Returns the per-user AsyncStorage key. Falls back to a guest key when userId is unknown. */
const decksKey = (userId) => userId ? `${DECKS_KEY_PREFIX}${userId}` : `${DECKS_KEY_PREFIX}guest`;

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
        const savedUser  = await AsyncStorage.getItem('current_user');

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

  useEffect(() => { loadTopics(); }, [loadTopics]);

  // ── User-created decks — persisted to AsyncStorage keyed by userId ──────────
  const [decks, setDecks] = useState([]);

  // Reload decks whenever userId changes (login / logout / switch account)
  useEffect(() => {
    (async () => {
      try {
        const key = decksKey(userId);

        // One-time migration: fold the old global key into the current user's key
        // so existing decks aren't lost after this upgrade.
        const legacyRaw = await AsyncStorage.getItem(LEGACY_DECKS_KEY);
        if (legacyRaw) {
          let legacyDecks = [];
          try { legacyDecks = JSON.parse(legacyRaw); } catch (_) {}
          if (Array.isArray(legacyDecks) && legacyDecks.length > 0) {
            // Merge legacy decks into current user's key (avoid duplicates by id)
            const existingRaw = await AsyncStorage.getItem(key);
            let existing = [];
            try { existing = JSON.parse(existingRaw) || []; } catch (_) {}
            for (const d of legacyDecks) {
              if (!existing.find(e => e.id === d.id)) existing.push(d);
            }
            await AsyncStorage.setItem(key, JSON.stringify(existing));
            await AsyncStorage.removeItem(LEGACY_DECKS_KEY);
            setDecks(existing);
            return;
          }
          // Legacy key was empty — just remove it
          await AsyncStorage.removeItem(LEGACY_DECKS_KEY);
        }

        const raw = await AsyncStorage.getItem(key);
        setDecks(raw ? JSON.parse(raw) : []);
      } catch (e) {
        console.warn('loadDecks error:', e);
        setDecks([]);
      }
    })();
  }, [userId]); // re-run on every userId change

  const _persist = useCallback((updated) => {
    AsyncStorage.setItem(decksKey(userId), JSON.stringify(updated)).catch(() => {});
  }, [userId]);

  /** Remove all local deck data for this user (call on account deletion / logout). */
  const clearUserDecks = useCallback(async () => {
    await AsyncStorage.removeItem(decksKey(userId)).catch(() => {});
    setDecks([]);
  }, [userId]);

  /**
   * Create a new deck.
   * Returns Promise<{ success, deck? }> or { success: false, error }.
   */
  const addDeck = useCallback((deck) => {
    const trimTitle = (deck.title || '').trim();
    if (!trimTitle) return Promise.resolve({ success: false, error: 'Deck title cannot be empty.' });

    return new Promise((resolve) => {
      setDecks((prev) => {
        if (prev.some((d) => normalise(d.title) === normalise(trimTitle))) {
          resolve({ success: false, error: `A deck named "${trimTitle}" already exists.` });
          return prev;
        }
        const newDeck = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: trimTitle,
          level: deck.level || 'Beginner',
          totalWords: (deck.terms || []).length,
          currentWords: 0,
          progress: 0,
          createdAt: new Date().toISOString(),
          terms: (deck.terms || []).map((t) => ({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            term: (t.term || '').trim(),
            definition: (t.definition || '').trim(),
          })),
        };
        const updated = [...prev, newDeck];
        _persist(updated);
        resolve({ success: true, deck: newDeck });
        return updated;
      });
    });
  }, [_persist]);

  /**
   * Full deck edit — replaces title + entire terms list atomically.
   */
  const saveDeckEdit = useCallback((deckId, newTitle, newTerms) => {
    const trimTitle = (newTitle || '').trim();
    if (!trimTitle) return Promise.resolve({ success: false, error: 'Deck title cannot be empty.' });

    return new Promise((resolve) => {
      setDecks((prev) => {
        if (prev.some((d) => d.id !== deckId && normalise(d.title) === normalise(trimTitle))) {
          resolve({ success: false, error: `A deck named "${trimTitle}" already exists.` });
          return prev;
        }
        const termSet = new Set();
        for (const t of newTerms) {
          const key = normalise(t.term);
          if (key && termSet.has(key)) {
            resolve({ success: false, error: `Duplicate word "${t.term.trim()}" in the deck.` });
            return prev;
          }
          if (key) termSet.add(key);
        }
        const updatedDeck = {
          ...prev.find((d) => d.id === deckId),
          title: trimTitle,
          terms: newTerms.map((t) => ({
            id: t.id || `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            term: (t.term || '').trim(),
            definition: (t.definition || '').trim(),
          })),
          totalWords: newTerms.length,
        };
        const updated = prev.map((d) => (d.id === deckId ? updatedDeck : d));
        _persist(updated);
        resolve({ success: true });
        return updated;
      });
    });
  }, [_persist]);

  const updateDeckProgress = useCallback((deckId, currentWords, totalWords) => {
    setDecks((prev) => {
      const updated = prev.map((d) =>
        d.id === deckId
          ? { ...d, currentWords, totalWords,
              progress: totalWords > 0 ? Math.round((currentWords / totalWords) * 100) : 0 }
          : d
      );
      _persist(updated);
      return updated;
    });
  }, [_persist]);

  const deleteDeck = useCallback((deckId) => {
    setDecks((prev) => {
      const updated = prev.filter((d) => String(d.id) !== String(deckId));
      _persist(updated);
      return updated;
    });
  }, [_persist]);

  // ── Starred Words ───────────────────────────────────────────────────────────
  const [starredWordIds, setStarredWordIds] = useState(new Set());
  const [starredWords,   setStarredWords]   = useState([]);
  const [starredLoading, setStarredLoading] = useState(false);

  const loadStarredWords = useCallback(async (uid) => {
    if (!uid) return;
    try {
      setStarredLoading(true);
      const data = await getStarredWords(uid, 200);
      setStarredWords(data || []);
      setStarredWordIds(new Set((data || []).map(s => s.word_id)));
    } catch (e) {
      console.warn('loadStarredWords error:', e.message);
    } finally {
      setStarredLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) loadStarredWords(userId);
  }, [userId, loadStarredWords]);

  const toggleStar = useCallback(async (wordId) => {
    if (!userId) return;
    const isStarred = starredWordIds.has(wordId);
    setStarredWordIds(prev => {
      const next = new Set(prev);
      isStarred ? next.delete(wordId) : next.add(wordId);
      return next;
    });
    try {
      if (isStarred) {
        await unstarWord(userId, wordId);
        setStarredWords(prev => prev.filter(s => s.word_id !== wordId));
      } else {
        const record = await starWord(userId, wordId);
        setStarredWords(prev => [record, ...prev]);
      }
    } catch (e) {
      setStarredWordIds(prev => {
        const next = new Set(prev);
        isStarred ? next.add(wordId) : next.delete(wordId);
        return next;
      });
      console.warn('toggleStar error:', e.message);
    }
  }, [userId, starredWordIds]);

  return (
    <DataContext.Provider value={{
      token, setToken,
      currentUser, setCurrentUser,
      userId, setUserId,
      authReady,
      topics, topicsLoading, topicsError, loadTopics,
      decks, addDeck, saveDeckEdit, updateDeckProgress, deleteDeck, clearUserDecks,
      starredWordIds, starredWords, starredLoading, loadStarredWords, toggleStar,
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
