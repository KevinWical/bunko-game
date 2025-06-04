import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  onSnapshot as onDocSnapshot,
} from 'firebase/firestore';

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
}

export function useFirestoreGame(gameCode: string, active: boolean = true) {
  const [players, setPlayers] = useState<FirestorePlayer[]>([]);
  const [gameStarted, setGameStarted] = useState(false);

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

  // Listen for game start
  useEffect(() => {
    if (!active || !gameCode.trim()) return;

    const gameDocRef = doc(db, 'games', gameCode);
    const unsub = onDocSnapshot(gameDocRef, (docSnap) => {
      const data = docSnap.data();
      if (data?.started) {
        setGameStarted(true);
      }
    });

    return () => unsub();
  }, [gameCode, active]);

  const addPlayer = async (player: FirestorePlayer) => {
    if (!active || !gameCode.trim()) return;

    const playerRef = collection(db, 'games', gameCode, 'players');
    const existing = await getDocs(query(playerRef, where('id', '==', player.id)));
    if (!existing.empty) return;

    await addDoc(playerRef, {
      ...player,
      joinedAt: serverTimestamp(),
    });
  };

  return {
    players,
    addPlayer,
    gameStarted,
  };
}
