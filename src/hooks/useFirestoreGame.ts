import { useEffect, useState } from 'react';
import { db, createDocumentWithTTL } from '../firebase';
import {
  collection,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  onSnapshot as onDocSnapshot,
} from 'firebase/firestore';
import { isGameExpired } from '../utils/ttlCleanup';

export interface FirestorePlayer {
  id: string;
  name: string;
  isBot: boolean;
  table: number;
  seat: number;
  pointsThisRound: number;
  totalPoints: number;
  buncoCount: number;
  roundsWon: number;
  isHost: boolean;
}

export function useFirestoreGame(gameCode: string, active: boolean = true) {
  const [players, setPlayers] = useState<FirestorePlayer[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameData, setGameData] = useState<{
    targetRounds?: number;
    winner?: { id: string; name: string; roundsWon: number; totalPoints: number };
  }>({});

  // Listen for player list
  useEffect(() => {
    if (!active || !gameCode.trim()) return;

    const q = query(collection(db, 'games', gameCode, 'players'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => doc.data() as FirestorePlayer);
      setPlayers(docs);
    });

    return () => unsub();
  }, [gameCode, active]);

  // Listen for game start and game over
  useEffect(() => {
    if (!active || !gameCode.trim()) return;

    const gameDocRef = doc(db, 'games', gameCode);
    const unsub = onDocSnapshot(gameDocRef, (docSnap) => {
      const data = docSnap.data();
      
      // Check if game is expired
      if (data?.createdAt && isGameExpired(data.createdAt.toDate())) {
        console.log('Game is expired, not loading data');
        return;
      }
      
      // Update gameData whenever we get new data from Firestore
      if (data) {
        setGameData({
          targetRounds: data.targetRounds,
          winner: data.winner
        });
      }
      
      if (data?.started) {
        setGameStarted(true);
      }
      if (data?.gameOver) {
        setGameOver(true);
      }
    });

    return () => unsub();
  }, [gameCode, active]);

  const addPlayer = async (player: FirestorePlayer) => {
    if (!active || !gameCode.trim()) return;

    const playerRef = collection(db, 'games', gameCode, 'players');
    const existing = await getDocs(query(playerRef, where('id', '==', player.id)));
    if (!existing.empty) return;

    const playerDataWithTTL = await createDocumentWithTTL(null, player.id, {
      ...player,
      joinedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'games', gameCode, 'players', player.id), playerDataWithTTL);
  };

  return {
    players,
    addPlayer,
    gameStarted,
    gameOver,
    gameData,
  };
}
