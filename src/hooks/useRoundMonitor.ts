import { useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import type { TableData } from './useTableData';

export const useRoundMonitor = (gameCode: string, tableData: TableData | null) => {
  useEffect(() => {
    if (!gameCode || !tableData || tableData.id !== 0 || tableData.roundOver) return;

    const interval = setInterval(async () => {
      const playersSnap = await getDocs(collection(db, 'games', gameCode, 'players'));
      const teamScores = [0, 0];

      playersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.table === 0) {
          const team = data.seat % 2;
          teamScores[team] += data.pointsThisRound || 0;
        }
      });

      console.log('🧠 Head Table Team Scores:', teamScores);

      const maxScore = Math.max(...teamScores);
      if (maxScore >= 21) {
        const tablesSnap = await getDocs(collection(db, 'games', gameCode, 'tables'));
        const updates = tablesSnap.docs.map((doc) =>
          updateDoc(doc.ref, { roundOver: true })
        );
        await Promise.all(updates);
        console.log('✅ Round over triggered!');
        clearInterval(interval); // stop checking once round ends
      }
    }, 2000); // check every 2 seconds

    return () => clearInterval(interval);
  }, [gameCode, tableData]);

  // Check for win conditions after round transitions
  useEffect(() => {
    if (!gameCode) return;

    const checkWinCondition = async () => {
      try {
        // Get game settings
        const gameDoc = await getDoc(doc(db, 'games', gameCode));
        if (!gameDoc.exists()) return;
        
        const gameData = gameDoc.data();
        const targetRounds = gameData.targetRounds !== undefined ? gameData.targetRounds : 6;

        // Get all players
        const playersSnap = await getDocs(collection(db, 'games', gameCode, 'players'));
        const players = playersSnap.docs.map(doc => doc.data());

        // Check if any player has reached the target rounds
        const playersAtTarget = players.filter(player => player.roundsWon >= targetRounds);
        
        if (playersAtTarget.length > 0) {
          // Sort by total points to break ties
          const sortedWinners = playersAtTarget.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
          const winner = sortedWinners[0];
          
          console.log(`🏆 Game Over! ${winner.name} has won ${winner.roundsWon} rounds (target: ${targetRounds}) with ${winner.totalPoints || 0} total points`);
          
          // Mark game as finished
          await updateDoc(doc(db, 'games', gameCode), {
            gameOver: true,
            winner: {
              id: winner.id,
              name: winner.name,
              roundsWon: winner.roundsWon,
              totalPoints: winner.totalPoints || 0
            },
            finishedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error checking win condition:', error);
      }
    };

    // Check win condition every 5 seconds
    const winCheckInterval = setInterval(checkWinCondition, 5000);

    return () => clearInterval(winCheckInterval);
  }, [gameCode]);
};
