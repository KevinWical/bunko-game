import { useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import type { TableData } from './useTableData';

export const useRoundMonitor = (gameCode: string, tableData: TableData | null) => {
  useEffect(() => {
    if (!gameCode || !tableData || tableData.id !== 0 || tableData.roundOver) return;

    const checkHeadTable = async () => {
      const seatingSnap = await getDocs(collection(db, 'games', gameCode, 'seating'));
      const teamScores = [0, 0];

      seatingSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.table === 0) {
          const team = data.seat % 2;
          teamScores[team] += data.pointsThisRound || 0;
        }
      });

      const maxScore = Math.max(...teamScores);
      if (maxScore >= 21) {
        const tablesSnap = await getDocs(collection(db, 'games', gameCode, 'tables'));
        const updates = tablesSnap.docs.map(d =>
          updateDoc(d.ref, { roundOver: true })
        );
        await Promise.all(updates);
      }
    };

    checkHeadTable();
  }, [gameCode, tableData]);
};
