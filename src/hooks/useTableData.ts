import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export type TableData = {
  id: number;
  playerIds: string[];
  currentTurn: number;
  dice: number[];
  round: number;
  roundOver: boolean;
};

export function useTableData(gameCode: string, tableId: number | null) {
  const [tableData, setTableData] = useState<TableData | null>(null);

  useEffect(() => {
    if (!gameCode || tableId === null) return;

    const ref = doc(db, 'games', gameCode, 'tables', `${tableId}`);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setTableData(snap.data() as TableData);
      }
    });

    return () => unsub();
  }, [gameCode, tableId]);

  return tableData;
}
