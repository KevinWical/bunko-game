import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { FirestorePlayer } from './useFirestoreGame';

export function useSeatingData(gameCode: string, selfId: string | null) {
  const [seatingMap, setSeatingMap] = useState<Record<string, FirestorePlayer>>({});
  const [selfSeating, setSelfSeating] = useState<FirestorePlayer | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    const ref = collection(db, 'games', gameCode, 'seating');
    const unsub = onSnapshot(ref, (snapshot) => {
      const map: Record<string, FirestorePlayer> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = { id: doc.id, ...(doc.data() as Omit<FirestorePlayer, 'id'>) };
      });
      setSeatingMap(map);
      if (selfId && map[selfId]) {
        setSelfSeating(map[selfId]);
      }
    });

    return () => unsub();
  }, [gameCode, selfId]);

  return {
    seatingMap,
    selfSeating,
  };
}
