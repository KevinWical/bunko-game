import React, { useEffect, useRef, useState } from 'react';
import { doc, updateDoc, getDoc, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { TableData } from '../hooks/useTableData';
import type { FirestorePlayer } from '../hooks/useFirestoreGame';
import { transitionToNextRound } from '../hooks/useRoundTransition';
import { checkHeadTableForRoundEnd } from '../utils/roundLogic';

interface TableControlsProps {
  gameCode: string;
  tableData: TableData;
  selfId: string;
  players: FirestorePlayer[];
  onRollingStateChange?: (isRolling: boolean) => void;
     onRollResult?: (result: {
     pointsScored?: number;
     isBunco?: boolean;
     isTripleOnes?: boolean;
     timestamp?: number;
   }) => void;
  gameOver?: boolean;
}

const TableControls: React.FC<TableControlsProps> = ({ 
  gameCode, 
  tableData, 
  selfId, 
  players, 
  onRollingStateChange,
  onRollResult,
  gameOver = false
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [canEndTurn, setCanEndTurn] = useState(false);
  const [nextRoundReady, setNextRoundReady] = useState(false);
  const [roundTransitionInProgress, setRoundTransitionInProgress] = useState(false);
  const [turnTimeoutId, setTurnTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Notify parent component when rolling state changes
  useEffect(() => {
    onRollingStateChange?.(isRolling);
  }, [isRolling, onRollingStateChange]);

  // Clear roll result when rolling starts
  useEffect(() => {
    if (isRolling) {
      onRollResult?.({});
    }
  }, [isRolling, onRollResult]);

  // Clear rolling state when turn changes (safety check)
  useEffect(() => {
    if (isRolling) {
      const currentPlayerId = tableData.playerIds[tableData.currentTurn];
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      
      // If it's not a bot turn and we're rolling, clear the rolling state
      if (!currentPlayer?.isBot) {
        console.log('🔄 Clearing rolling state - turn changed to non-bot player');
        setIsRolling(false);
      }
    }
  }, [tableData.currentTurn, players, isRolling]);

  const currentPlayerId = tableData.playerIds[tableData.currentTurn];

  console.log(`🧩 Table ${tableData.id} → currentTurn index: ${tableData.currentTurn}`);
  console.log(`🪑 Players at table ${tableData.id}:`, tableData.playerIds);
  console.log(`🎯 Current player ID: ${currentPlayerId}`);

  const currentPlayer = players.find(p => p.id === currentPlayerId) || null;
  const isMyTurn = currentPlayerId === selfId;
  const isBotTurn = currentPlayer?.isBot;
  const selfPlayer = players.find(p => p.id === selfId);
  const isHost = selfPlayer?.isHost === true;

  const resetTeamPoints = async (team: number) => {
    const teammates = tableData.playerIds.filter((_, i) => i % 2 === team);
    const updates = teammates.map((pid) =>
      updateDoc(doc(db, 'games', gameCode, 'players', pid), {
        pointsThisRound: 0
      })
    );
    await Promise.all(updates);
  };

  const endTurn = async () => {
    const nextTurn = (tableData.currentTurn + 1) % tableData.playerIds.length;
    console.log(`🔄 Ending turn: ${tableData.currentTurn} → ${nextTurn}`);
    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      currentTurn: nextTurn,
      turnStart: Date.now(),
      lastRollResult: null, // Clear roll result
      isRolling: false // Ensure rolling state is cleared
      // Note: dice are NOT cleared here - they remain visible for the next player
    });

    setCanEndTurn(false);
    if (turnTimeoutId) clearTimeout(turnTimeoutId);
  };

  // If it's a players turn and you are allowed to end, auto-end turn after 4 seconds
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

  // Human Roll logic
  const handleRoll = async () => {
    if (!isMyTurn || isRolling || tableData.roundOver || roundTransitionInProgress) return;
    setIsRolling(true);
    
    // Set rolling state in Firestore for all players to see
    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      isRolling: true,
      lastRollResult: null
      // Note: dice are NOT cleared here - they remain visible during rolling
    });
    
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
      isRolling: false,
      lastRollResult: {
        pointsScored: pointsToAdd,
        isBunco,
        isTripleOnes,
        timestamp: Date.now()
      }
    });

    const myIndex = tableData.playerIds.indexOf(selfId);
    const team = myIndex % 2;
    const seatRef = doc(db, 'games', gameCode, 'players', selfId);

    const Player = players.find(p => p.id === currentPlayerId);
    console.log(
    `[${Player?.name || Player}] rolled:`, 
    newDice.join(" | "), 
    `→ Points to add: ${pointsToAdd}`
);

    if (isTripleOnes) {
      await resetTeamPoints(team);
    } else {
      await updateDoc(seatRef, {
        pointsThisRound: increment(pointsToAdd),
        ...(isBunco ? { buncoCount: increment(1) } : {})
      });
    }

         // Notify parent component of roll result
     onRollResult?.({
       pointsScored: pointsToAdd,
       isBunco,
       isTripleOnes,
       timestamp: Date.now()
     });

    await checkHeadTableForRoundEnd(gameCode);

    if (pointsToAdd === 0) {
      setTimeout(() => endTurn(), 1000);
    }

    setIsRolling(false);
  }; // End human dice roll

  // Rigged Roll logic for testing - always scores 2 points
  const handleRiggedRoll = async () => {
    if (!isMyTurn || isRolling || tableData.roundOver || roundTransitionInProgress || !isHost) return;
    setIsRolling(true);
    
    // Set rolling state in Firestore for all players to see
    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      isRolling: true,
      lastRollResult: null
      // Note: dice are NOT cleared here - they remain visible during rolling
    });
    
    await new Promise((res) => setTimeout(res, 1000)); // Faster for testing

    const target = tableData.round % 6 || 6; // Ensures target is 1-6
    // Create dice that will score exactly 2 points
    // For round 1: [1, 1, 2] (two 1s = 2 points)
    // For round 2: [2, 3, 2] (two 2s = 2 points)
    // For round 3: [3, 4, 3] (two 3s = 2 points)
    // etc.
    const newDice = [target, target, target + 1]; // This ensures exactly 2 dice match the target

    await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
      dice: newDice,
      turnStart: Date.now(),
      isRolling: false,
      lastRollResult: {
        pointsScored: 2,
        isBunco: false,
        isTripleOnes: false,
        timestamp: Date.now()
      }
    });

    const myIndex = tableData.playerIds.indexOf(selfId);
    const team = myIndex % 2;
    const seatRef = doc(db, 'games', gameCode, 'players', selfId);

    const Player = players.find(p => p.id === currentPlayerId);
    console.log(
      `[${Player?.name || Player}] RIGGED roll:`, 
      newDice.join(" | "), 
      `→ Points to add: 2`
    );

    await updateDoc(seatRef, {
      pointsThisRound: increment(2),
    });

         // Notify parent component of roll result
     onRollResult?.({
       pointsScored: 2,
       isBunco: false,
       isTripleOnes: false,
       timestamp: Date.now()
     });

    await checkHeadTableForRoundEnd(gameCode);
    setTimeout(() => endTurn(), 1000);

    setIsRolling(false);
  }; // End rigged dice roll

  // Sets NextRoundReady and roundTransitionInProgress to true or false
  useEffect(() => {
    const gameDocRef = doc(db, 'games', gameCode);
    const unsub = onSnapshot(gameDocRef, (docSnap) => {
      const data = docSnap.data();
      setNextRoundReady(!!data?.nextRoundReady);
      setRoundTransitionInProgress(!!data?.roundTransitionInProgress);
    });

    return () => unsub();
  }, [gameCode]);

  const hasRunBotTurnFor = useRef<string | null>(null);

  // Reset bot turn tracking when turn changes or round changes
  useEffect(() => {
    hasRunBotTurnFor.current = null;
  }, [tableData.currentTurn, tableData.round]);

  // 🤖 Bot auto-turn logic
  useEffect(() => {
    const botId = tableData.playerIds[tableData.currentTurn];
    const currentPlayer = players.find(p => p.id === botId);

    const isBotTurn = currentPlayer?.isBot;
    const alreadyRan = hasRunBotTurnFor.current === botId;

    console.log(`🤖 Bot turn check: botId=${botId}, isBotTurn=${isBotTurn}, alreadyRan=${alreadyRan}, roundOver=${tableData.roundOver}, roundTransitionInProgress=${roundTransitionInProgress}`);

    if (!isBotTurn || alreadyRan || tableData.roundOver || roundTransitionInProgress) return;

    // Additional safety check: verify the bot is still the current player
    if (tableData.playerIds[tableData.currentTurn] !== botId) {
      console.log(`🤖 Bot turn skipped - turn changed before bot could start`);
      return;
    }

    hasRunBotTurnFor.current = botId;
    console.log(`🤖 Starting bot turn for ${currentPlayer?.name || botId}`);

    // Set rolling state for bot
    setIsRolling(true);

    const botLoop = async () => {
      let keepRolling = true;

      while (keepRolling) {
        // Check if the turn has changed or round ended
        const currentTurnPlayerId = tableData.playerIds[tableData.currentTurn];
                 if (currentTurnPlayerId !== botId) {
           console.log(`🤖 Bot turn ended - current player changed from ${botId} to ${currentTurnPlayerId}`);
           // Clear rolling state when turn changes
           await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
             isRolling: false
           });
           break;
         }

        // Check to see if the round ended between rolls
        const gameSnapshot = await getDoc(doc(db, 'games', gameCode));
        const gameData = gameSnapshot.data();
                 if (gameData?.nextRoundReady || gameData?.roundTransitionInProgress) {
           console.log('[BotLoop] Stopping bot rolls due to round end/transition flag.');
           // Clear rolling state when round ends
           await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
             isRolling: false
           });
           break;
         }

        // Set rolling state in Firestore for all players to see
        await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
          isRolling: true,
          lastRollResult: null
          // Note: dice are NOT cleared here - they remain visible during rolling
        });

        await new Promise((res) => setTimeout(res, 3000)); // Increased from 2s to 3s for better visibility

        // Double-check turn hasn't changed during the delay
        const updatedTableSnapshot = await getDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`));
        const updatedTableData = updatedTableSnapshot.data();
                 if (updatedTableData?.playerIds[updatedTableData.currentTurn] !== botId) {
           console.log(`🤖 Bot turn ended during delay - current player changed`);
           // Clear rolling state when turn changes during delay
           await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
             isRolling: false
           });
           break;
         }

        const newDice = [1, 2, 3].map(() => Math.ceil(Math.random() * 6));
        const allSame = newDice.every((d) => d === newDice[0]);
        const target = tableData.round % 6 || 6; // Ensures target is 1-6

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

        // Update dice and roll result
        const rollUpdate = {
          dice: newDice,
          turnStart: Date.now(),
          isRolling: false,
          lastRollResult: {
            pointsScored: pointsToAdd,
            isBunco,
            isTripleOnes,
            timestamp: Date.now()
          }
        };
        
        await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), rollUpdate);
        
        // If this is the final roll (0 points), ensure it's preserved
        if (pointsToAdd === 0) {
          console.log(`🤖 Final non-scoring roll preserved: ${newDice.join(" | ")}`);
        }

        const currentBotId = tableData.playerIds[tableData.currentTurn];
        const botIndex = tableData.playerIds.indexOf(currentBotId);
        const team = botIndex % 2;
        const seatRef = doc(db, 'games', gameCode, 'players', currentBotId);

        const botPlayer = players.find(p => p.id === currentBotId);
        console.log(
          `[${botPlayer?.name || currentBotId}] rolled:`, 
          newDice.join(" | "), 
          `→ Points to add: ${pointsToAdd}`
        );

        if (isTripleOnes) {
          await resetTeamPoints(team);
          keepRolling = false;
        } else {
          await updateDoc(seatRef, {
            pointsThisRound: increment(pointsToAdd),
            ...(isBunco ? { buncoCount: increment(1) } : {})
          });

                     // Notify parent component of bot roll result
           onRollResult?.({
             pointsScored: pointsToAdd,
             isBunco,
             isTripleOnes,
             timestamp: Date.now()
           });

          await checkHeadTableForRoundEnd(gameCode);

          // Add a small delay after each roll so players can see the result
          await new Promise((res) => setTimeout(res, 1000));

          if (pointsToAdd === 0) {
            console.log(`🤖 Bot ${botPlayer?.name || currentBotId} scored 0 points, stopping rolls`);
            console.log(`🤖 Final dice for ${botPlayer?.name || currentBotId}: ${newDice.join(" | ")}`);
            keepRolling = false;
          }
        }

        if (!keepRolling) {
          console.log(`🤖 Bot ${botPlayer?.name || currentBotId} finished rolling, ending turn`);
          console.log(`🤖 Preserving final dice: ${newDice.join(" | ")}`);
          // Give players time to see the final roll result before ending turn
          await new Promise((res) => setTimeout(res, 2000));
          
          // Clear rolling state before ending turn
          await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
            isRolling: false
          });
          
          await endTurn();
        }
             }

       // Clear rolling state when bot turn ends
       setIsRolling(false);
       
       // Also clear from Firestore to ensure all clients see the update
       await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableData.id}`), {
         isRolling: false
       });
    };

    botLoop();

    // Cleanup function to handle component unmount or effect cleanup
    return () => {
      console.log(`🤖 Bot turn cleanup for ${botId}`);
      setIsRolling(false);
    };
  }, [tableData.currentTurn, gameCode, tableData.id, tableData.roundOver, tableData.round, roundTransitionInProgress, players, onRollResult]); // end bot dice roll/turn 

  return (
    <div className="mt-4 text-center space-y-3">
      {isMyTurn && (
        <>
          <button
            onClick={canEndTurn ? endTurn : handleRoll}
            disabled={isRolling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
          >
            {canEndTurn ? 'End Turn' : isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
          
          {/* Rigged roll button for host testing */}
          {isHost && !canEndTurn && (
            <button
              onClick={handleRiggedRoll}
              disabled={isRolling}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded ml-2"
              title="Roll dice that always score 2 points (for testing)"
            >
              🎲 Rigged Roll (2 pts)
            </button>
          )}
        </>
      )}

      {/* 🟡 Show Start Next Round button to host if round is over and nextRoundReady is true */}
      {tableData.roundOver && isHost && nextRoundReady && !gameOver && (
        <button
          onClick={() => transitionToNextRound(gameCode)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Start Next Round
        </button>
      )}
    </div>
  );
}

export default TableControls;
