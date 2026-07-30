import React, { createContext, useContext, useState, useCallback } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  // Decks data - shared between PracticeScreen and VocabQuizScreen
  const [decks, setDecks] = useState([
    {
      id: '1',
      title: 'Academic Vocabulary',
      level: 'Beginner',
      currentWords: 0,
      totalWords: 10,
      progress: 0,
      createdAt: new Date().toISOString(),
    },
  ]);

  const addDeck = useCallback((deck) => {
    const newDeck = {
      id: Date.now().toString(),
      currentWords: 0,
      totalWords: deck.totalWords || 10,
      progress: 0,
      createdAt: new Date().toISOString(),
      ...deck,
    };
    setDecks((prev) => [...prev, newDeck]);
  }, []);

  const updateDeckProgress = useCallback((deckId, currentWords, totalWords) => {
    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              currentWords,
              totalWords,
              progress: totalWords > 0 ? Math.round((currentWords / totalWords) * 100) : 0,
            }
          : deck
      )
    );
  }, []);

  const deleteDeck = useCallback((deckId) => {
    setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
  }, []);

  return (
    <DataContext.Provider value={{ decks, addDeck, updateDeckProgress, deleteDeck }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
