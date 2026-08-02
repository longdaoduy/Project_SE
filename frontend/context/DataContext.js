import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTopics } from '../api';

const DataContext = createContext();

// Demo user — used for all backend calls until real auth is wired up
export const DEMO_USER_ID = 1;

export function DataProvider({ children }) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState(DEMO_USER_ID);

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
      userId, setUserId,
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
