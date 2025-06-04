import React, { useState } from 'react';
import GameRoom from './components/GameRoom';
import TableView from './components/TableView';

function App() {
  const [phase, setPhase] = useState<'lobby' | 'game' | 'finished'>('lobby');
  const [selfId, setSelfId] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [gameResults, setGameResults] = useState<null | {
    top: any;
    bottom: any;
    mostBuncos: any;
  }>(null);

  const handleStartGame = (id: string, code: string) => {
    setSelfId(id);
    setGameCode(code);
    setPhase('game');
  };

  const handleGameOver = (results: { top: any; bottom: any; mostBuncos: any }) => {
    setGameResults(results);
    setPhase('finished');
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      {phase === 'lobby' && <GameRoom onStart={handleStartGame} />}

      {phase === 'game' && gameCode && selfId && (
        <TableView gameCode={gameCode} selfId={selfId} />
      )}

      {phase === 'finished' && gameResults && (
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">🏆 Game Over</h1>
          <p className="text-green-400">Most Wins: {gameResults.top.name} ({gameResults.top.roundsWon})</p>
          <p className="text-red-400">Least Wins: {gameResults.bottom.name} ({gameResults.bottom.roundsWon})</p>
          <p className="text-pink-400">Most Bunkos: {gameResults.mostBuncos.name} ({gameResults.mostBuncos.bunkoCount})</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded"
            onClick={() => {
              setPhase('lobby');
              setGameResults(null);
              setSelfId('');
              setGameCode('');
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </main>
  );
}

export default App;
