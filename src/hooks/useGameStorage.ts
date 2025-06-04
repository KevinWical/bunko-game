// src/hooks/useGameStorage.ts
import { useEffect, useState } from 'react';

export interface StoredPlayer {
  id: string;
  name: string;
  isBot: boolean;
}

export function useGameStorage(gameCode: string) {
  const [players, setPlayers] = useState<StoredPlayer[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(`game:${gameCode}:players`);
    if (raw) {
      setPlayers(JSON.parse(raw));
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === `game:${gameCode}:players` && event.newValue) {
        setPlayers(JSON.parse(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [gameCode]);

  const addPlayer = (player: StoredPlayer) => {
    const raw = localStorage.getItem(`game:${gameCode}:players`);
    const current: StoredPlayer[] = raw ? JSON.parse(raw) : [];

    const alreadyExists = current.some(p => p.id === player.id);
    if (alreadyExists) return;

    const updated = [...current, player];
    localStorage.setItem(`game:${gameCode}:players`, JSON.stringify(updated));
    setPlayers(updated);
  };

  const clearPlayers = () => {
    localStorage.removeItem(`game:${gameCode}:players`);
    setPlayers([]);
  };

  return {
    players,
    addPlayer,
    clearPlayers,
  };
}
