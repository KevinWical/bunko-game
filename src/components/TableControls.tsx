import React, { useEffect, useRef, useState } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import type { TableData } from '../hooks/useTableData';
import type { FirestorePlayer } from '../hooks/useFirestoreGame';

interface TableControlsProps {
  gameCode: string;
  tableData: TableData;
  selfId: string;
  seatingMap: Record<string, FirestorePlayer>;
}

const TableControls: React.FC<TableControlsProps> = ({ gameCode, tableData, selfId, seatingMap }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [canEndTurn, setCanEndTurn] = useState(false);
  const [turnTimeoutId, setTurnTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const currentPlayerId = tableData.playerIds[tableData.currentTurn];
  const currentPlayer = seatingMap[currentPlayerId];
  const isMyTurn = currentPlayerId === selfId;
  const isBotTurn = currentPlayer?.isBot;
  const hasRunBotTurn = useRef(false);

  const resetTeamPoints = async (tableId: number, team: number) => {
    const teammates = tableData.playerIds.filter((_, i) => i % 2 === team);
    const updates = teammates.map((pid) =>
      updateDoc(doc(db, 'games', gameCode, 'seating', pid), {
        pointsThisRound: 0
      })
    );
    await Promise.all(updates);
  };

  const endTurn = async () => {
    const nextTurn = (tableData.currentTurn + 1) % tableData.playerIds.length;
    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      currentTurn: nextTurn,
      turnStart: Date.now(),
    });

    setCanEndTurn(false);
    if (turnTimeoutId) clearTimeout(turnTimeoutId);
  };

  useEffect(() => {
    if (canEndTurn && isMyTurn) {
      const timeout = setTimeout(() => {
        endTurn();
      }, 4000);
      setTurnTimeoutId(timeout);
    }

    return () => {
      if (turnTimeoutId) clearTimeout(turnTimeoutId);
    };
  }, [canEndTurn, isMyTurn]);

  const handleRoll = async () => {
    if (!isMyTurn || isRolling || tableData.roundOver) return;
    setIsRolling(true);
    await new Promise((res) => setTimeout(res, 2000));

    const newDice = [1, 2, 3].map(() => Math.ceil(Math.random() * 6));
    const allSame = newDice.every((d) => d === newDice[0]);
    const target = tableData.round;

    let pointsToAdd = 0;
    let isBunco = false;
    let isTripleOnes = false;

    if (allSame) {
      if (newDice[0] === target) {
        pointsToAdd = 21;
        isBunco = true;
      } else if (newDice[0] === 1 && target !== 1) {
        pointsToAdd = 0;
        isTripleOnes = true;
      } else {
        pointsToAdd = 15;
      }
    } else {
      pointsToAdd = newDice.filter((d) => d === target).length;
    }

    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      dice: newDice,
      turnStart: Date.now(),
    });

    const myIndex = tableData.playerIds.indexOf(selfId);
    const team = myIndex % 2;
    const seatRef = doc(db, 'games', gameCode, 'seating', selfId);

    if (isTripleOnes) {
      await resetTeamPoints(tableData.id, team);
    } else {
      await updateDoc(seatRef, {
        pointsThisRound: increment(pointsToAdd),
        totalPoints: increment(pointsToAdd),
        ...(isBunco ? { buncoCount: increment(1) } : {})
      });
    }

    if (pointsToAdd === 0) {
      setTimeout(() => endTurn(), 1000);
    }

    setIsRolling(false);
  };

  // 🔁 Reset bot turn flag on every turn change
  useEffect(() => {
    hasRunBotTurn.current = false;
  }, [tableData.currentTurn]);

  // 🤖 Bot auto-turn logic
  useEffect(() => {
    if (!isBotTurn || hasRunBotTurn.current || tableData.roundOver) return;
    hasRunBotTurn.current = true;

    const botLoop = async () => {
      let keepRolling = true;

      while (keepRolling) {
        await new Promise((res) => setTimeout(res, 2000));

        const newDice = [1, 2, 3].map(() => Math.ceil(Math.random() * 6));
        const allSame = newDice.every((d) => d === newDice[0]);
        const target = tableData.round;

        let pointsToAdd = 0;
        let isBunco = false;
        let isTripleOnes = false;

        if (allSame) {
          if (newDice[0] === target) {
            pointsToAdd = 21;
            isBunco = true;
          } else if (newDice[0] === 1 && target !== 1) {
            pointsToAdd = 0;
            isTripleOnes = true;
          } else {
            pointsToAdd = 15;
          }
        } else {
          pointsToAdd = newDice.filter((d) => d === target).length;
        }

        await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
          dice: newDice,
          turnStart: Date.now(),
        });

        const botId = tableData.playerIds[tableData.currentTurn];
        const botIndex = tableData.playerIds.indexOf(botId);
        const team = botIndex % 2;
        const seatRef = doc(db, 'games', gameCode, 'seating', botId);

        if (isTripleOnes) {
          await resetTeamPoints(tableData.id, team);
          keepRolling = false;
        } else {
          await updateDoc(seatRef, {
            pointsThisRound: increment(pointsToAdd),
            totalPoints: increment(pointsToAdd),
            ...(isBunco ? { buncoCount: increment(1) } : {})
          });

          if (pointsToAdd === 0) {
            keepRolling = false;
          }
        }

        if (!keepRolling) {
          await new Promise((res) => setTimeout(res, 4000));
          await endTurn();
        }
      }
    };

    botLoop();
  }, [isBotTurn, tableData.currentTurn]);

  return (
    <div className="mt-4 text-center">
      {isMyTurn && (
        <button
          onClick={canEndTurn ? endTurn : handleRoll}
          disabled={isRolling}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        >
          {canEndTurn ? 'End Turn' : isRolling ? 'Rolling...' : 'Roll Dice'}
        </button>
      )}
    </div>
  );
};

export default TableControls;
