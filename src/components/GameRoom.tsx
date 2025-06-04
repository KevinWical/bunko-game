import React, { useState, useEffect } from 'react';
import { useFirestoreGame } from '../hooks/useFirestoreGame';
import type { FirestorePlayer } from '../hooks/useFirestoreGame';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoundMonitor } from '../hooks/useRoundMonitor';
import { useSeatingData } from '../hooks/useSeatingData';
import { useTableData } from '../hooks/useTableData';

interface GameRoomProps {
  onStart: (selfId: string, gameCode: string) => void;
}

const generateGameCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

const GameRoom: React.FC<GameRoomProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [step, setStep] = useState<'select' | 'host' | 'join'>('select');
  const [gameCode, setGameCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) {
      setCustomCode(fromUrl.toUpperCase());
      setStep('join');
    }
  }, []);

  const code = gameCode || customCode.toUpperCase();
  const hasGameCode = code.trim().length > 0;
  const isReady = hasGameCode && (step === 'host' || step === 'join');

  const { players, addPlayer, gameStarted } = useFirestoreGame(code, isReady);

  const { seatingMap, selfSeating } = useSeatingData(code, selfId);
  const currentTable = selfSeating?.table ?? null;
  const currentTableData = useTableData(code, currentTable);

  useRoundMonitor(code, currentTableData);


  useEffect(() => {
    if (gameStarted && joined && selfId) {
      onStart(selfId, code);
    }
  }, [gameStarted, joined, selfId, code, onStart]);

  const handleHost = () => {
    const newCode = generateGameCode();
    setGameCode(newCode);
    setStep('host');
  };

  const handleJoin = () => {
    setStep('join');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || gameStarted) return;

    const id = `${name.trim().toLowerCase()}-${Math.floor(Math.random() * 1000)}`;
    const player: FirestorePlayer = {
      id,
      name: name.trim(),
      isBot: false,
      table: -1,
      seat: -1,
      pointsThisRound: 0,
      totalPoints: 0,
      buncoCount: 0,
      roundsWon: 0
    };
    await addPlayer(player);
    setSelfId(id);
  };

  useEffect(() => {
    if (!selfId) return;
    const exists = players.some(p => p.id === selfId);
    if (exists) {
      setJoined(true);
    }
  }, [players, selfId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?code=${code}`);
    alert('Game link copied to clipboard!');
  };

  const handleStartGame = async () => {
    const totalPlayers = players.length;
    const totalNeeded = Math.max(8, Math.ceil(totalPlayers / 4) * 4);
    const botsToAdd = totalNeeded - totalPlayers;

    // Add bots
    for (let i = 0; i < botsToAdd; i++) {
      const id = `bot-${i}-${Math.floor(Math.random() * 1000)}`;
      const bot: FirestorePlayer = {
        id,
        name: `Bot ${i + 1}`,
        isBot: true,
        table: -1,
        seat: -1,
        pointsThisRound: 0,
        totalPoints: 0,
        buncoCount: 0,
        roundsWon: 0
      };
      await addPlayer(bot);
      players.push(bot); // Add to local list so we can shuffle the full list
    }

    await new Promise((res) => setTimeout(res, 500));

    // Shuffle all players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const playersPerTable = 4;
    const tables: Record<number, FirestorePlayer[]> = {};

    for (let table = 0; table < Math.ceil(shuffled.length / playersPerTable); table++) {
      const tablePlayers = shuffled.slice(table * playersPerTable, (table + 1) * playersPerTable);

      for (let seat = 0; seat < tablePlayers.length; seat++) {
        const player = tablePlayers[seat];

        await setDoc(doc(db, 'games', code, 'seating', player.id), {
          id: player.id,
          name: player.name,
          isBot: player.isBot,
          table,
          seat,
          pointsThisRound: 0,
          totalPoints: 0,
          buncoCount: 0,
          roundsWon: 0
        });

        if (!tables[table]) tables[table] = [];
        tables[table].push({ ...player, table, seat });
      }
    }

    for (const [tableIdStr, playersAtTable] of Object.entries(tables)) {
      const tableId = Number(tableIdStr);
      await setDoc(doc(db, 'games', code, 'tables', `${tableId}`), {
        id: tableId,
        playerIds: playersAtTable.map((p) => p.id),
        currentTurn: 0,
        dice: [1, 1, 1],
        round: 1,
        turnStart: Date.now(),
        teamScores: [0, 0],
      });
    }

    await setDoc(doc(db, 'games', code), {
      started: true,
    }, { merge: true });
  };


  if (!hasGameCode) {
    return (
      <div className="text-white text-center mt-10">
        <h1 className="text-3xl font-bold">🎲 Bunko Lobby</h1>
        <button
          onClick={handleHost}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded my-2"
        >
          Host Game
        </button>
        <button
          onClick={handleJoin}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
        >
          Join Game
        </button>
      </div>
    );
  }

  if (gameStarted && joined && selfId) {
    return (
      <div className="text-white text-center mt-10">
        <p>Loading game...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded text-black"
        />
        {step === 'join' && (
          <input
            type="text"
            placeholder="Enter game code"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="w-full p-2 rounded text-black"
          />
        )}
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
          disabled={gameStarted}
        >
          {gameStarted ? 'Game Already In Session' : joined ? 'Waiting...' : step === 'host' ? 'Create Lobby' : 'Join Lobby'}
        </button>
      </form>

      {joined && (
        <div className="text-center mt-4 space-y-2">
          <p className="text-sm">Share this link to invite friends:</p>
          <button
            onClick={handleCopyLink}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-yellow-300"
          >
            Copy Game Link
          </button>
          <p className="text-lg font-mono">Code: {code}</p>
          <p className="mt-2">Current Players:</p>
          <ul className="text-sm text-white">
            {players.map((p) => (
              <li key={p.id}>{p.name} {p.isBot ? '(Bot)' : ''}</li>
            ))}
          </ul>
          {step === 'host' && joined && players.length > 0 && (
            <button
              onClick={handleStartGame}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Start Game with {players.length} Player{players.length !== 1 ? 's' : ''} + Fill with Bots
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameRoom;
