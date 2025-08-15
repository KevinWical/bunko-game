import React, { useState, useEffect } from 'react';
import GameRoom from './components/GameRoom';
import TableView from './components/TableView';
import GameOver from './components/GameOver';
import { startPeriodicCleanup } from './utils/ttlCleanup';

function App() {
  const [phase, setPhase] = useState<'lobby' | 'game' | 'finished'>('lobby');
  const [selfId, setSelfId] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [gameResults, setGameResults] = useState<null | {
    players: any[];
    winner: { id: string; name: string; roundsWon: number; totalPoints: number };
    targetRounds: number;
  }>(null);

  // Start TTL cleanup when app loads
  useEffect(() => {
    const stopCleanup = startPeriodicCleanup();
    
    // Cleanup function when component unmounts
    return () => {
      stopCleanup();
    };
  }, []);

  const handleStartGame = (id: string, code: string) => {
    setSelfId(id);
    setGameCode(code);
    setPhase('game');
  };

  const handleGameOver = (results: {
    players: any[];
    winner: { id: string; name: string; roundsWon: number; totalPoints: number };
    targetRounds: number;
  }) => {
    setGameResults(results);
    setPhase('finished');
  };

  const handlePlayAgain = () => {
    setPhase('lobby');
    setGameResults(null);
    setSelfId('');
    setGameCode('');
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      {phase === 'lobby' && <GameRoom onStart={handleStartGame} />}

      {phase === 'game' && gameCode && selfId && (
        <TableView 
          gameCode={gameCode} 
          selfId={selfId} 
          onGameOver={handleGameOver}
        />
      )}

      {phase === 'finished' && gameResults && (
        <GameOver
          players={gameResults.players}
          winner={gameResults.winner}
          targetRounds={gameResults.targetRounds}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
}

export default App;
