import React, { useState, useEffect } from 'react';
import { useTableData } from '../hooks/useTableData';
import { useFirestoreGame } from '../hooks/useFirestoreGame';
import TableControls from './TableControls';
import Leaderboard from './Leaderboard';
import DiceDisplay from './DiceDisplay';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface TableViewProps {
  gameCode: string;
  selfId: string;
  onGameOver?: (gameData: {
    players: any[];
    winner: { id: string; name: string; roundsWon: number; totalPoints: number };
    targetRounds: number;
  }) => void;
}

const TableView: React.FC<TableViewProps> = ({ gameCode, selfId, onGameOver }) => {
  const { players, gameOver, gameData } = useFirestoreGame(gameCode, true);
  const selfPlayer = players.find((p) => p.id === selfId) || null;
  const currentTable = selfPlayer?.table ?? null;
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{
    pointsScored?: number;
    isBunco?: boolean;
    isTripleOnes?: boolean;
    timestamp?: number;
  }>({});

  const currentTableData = useTableData(gameCode, currentTable);
  const targetRounds = gameData.targetRounds !== undefined ? gameData.targetRounds : 6;
  

  // Handle game over transition
  useEffect(() => {
    if (gameOver && gameData.winner && onGameOver) {
      onGameOver({
        players,
        winner: {
          id: gameData.winner.id,
          name: gameData.winner.name,
          roundsWon: gameData.winner.roundsWon,
          totalPoints: gameData.winner.totalPoints || 0
        },
        targetRounds: gameData.targetRounds !== undefined ? gameData.targetRounds : 6
      });
    }
  }, [gameOver, gameData, players, onGameOver]);

  // Clear roll result when round changes for a clean slate
  useEffect(() => {
    if (currentTableData?.round && currentTable) {
      setRollResult({});
      // Also clear from Firestore
      const tableRef = doc(db, 'games', gameCode, 'tables', `${currentTable}`);
      updateDoc(tableRef, {
        lastRollResult: null,
        isRolling: false
      }).catch(console.error);
    }
  }, [currentTableData?.round, currentTable, gameCode]);

  // Use synchronized roll data from Firestore
  useEffect(() => {
    if (currentTableData?.lastRollResult) {
      setRollResult(currentTableData.lastRollResult);
    }
  }, [currentTableData?.lastRollResult]);

  // Use synchronized rolling state from Firestore
  useEffect(() => {
    if (currentTableData?.isRolling !== undefined) {
      setIsRolling(currentTableData.isRolling);
    }
  }, [currentTableData?.isRolling]);

  // Clear roll result when turn changes to prevent stale results
  useEffect(() => {
    if (currentTableData?.currentTurn !== undefined) {
      // Small delay to allow the roll result to be processed first
      const timer = setTimeout(() => {
        setRollResult({});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentTableData?.currentTurn]);

  const groupedTables: Record<number, typeof players> = {};
  players.forEach((p) => {
    if (!groupedTables[p.table]) groupedTables[p.table] = [];
    groupedTables[p.table].push(p);
  });

  // Calculate team scores for each table
  const getTeamScore = (tablePlayers: typeof players, team: number) => {
    return tablePlayers
      .filter(p => p.seat % 2 === team)
      .reduce((sum, p) => sum + (p.pointsThisRound || 0), 0);
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Game Info Header */}
      <div className="text-center space-y-2">
        <div className="text-lg font-semibold text-yellow-400">
          Target: {targetRounds} Round{targetRounds !== 1 ? 's' : ''} to Win
        </div>
        {gameOver && (
          <div className="text-xl font-bold text-green-400">
            🏆 Game Over! Check the leaderboard for results.
          </div>
        )}
        <button
          onClick={() => setShowLeaderboard(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          🏆 View Leaderboard
        </button>
      </div>

      {/* Leaderboard Modal */}
      <Leaderboard
        players={players}
        isVisible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      {Object.entries(groupedTables).map(([tableIdStr, tablePlayers]) => {
        const tableId = Number(tableIdStr);
        const isCurrentTable = tableId === currentTable;
        const tableData = isCurrentTable ? currentTableData : null;

        const currentTurnPlayerId = tableData?.playerIds?.[tableData.currentTurn];
        const currentPlayer = players.find(p => p.id === currentTurnPlayerId) || null;

        // Show the most recent roll when a turn starts, or fresh dice if no roll exists
        const hasRecentRoll = tableData?.dice && tableData.dice.length > 0;
        const displayDice = hasRecentRoll ? tableData.dice : Array(3).fill(tableData?.round ?? 1);
        
        // Debug logging for dice display
        if (hasRecentRoll) {
          console.log(`🎲 Displaying dice: ${displayDice.join(" | ")} for turn ${tableData.currentTurn}`);
        }
        const playersBySeat = Array(4).fill(null);
        tablePlayers.forEach(p => {
          playersBySeat[p.seat] = p;
        })

        const team0Score = getTeamScore(tablePlayers, 0);
        const team1Score = getTeamScore(tablePlayers, 1);

        return (
          <div key={tableId} className="border border-gray-600 p-4 rounded">
            <h3 className="text-xl text-blue-400 font-semibold">Table {tableId}</h3>
            <div className="text-sm text-gray-300 mb-2">
              Team 0: {team0Score} | Team 1: {team1Score}
            </div>

            {isCurrentTable && tableData && (
              <>
                                 <DiceDisplay
                   dice={displayDice}
                   isRolling={isRolling}
                   round={tableData.round}
                   pointsScored={rollResult.pointsScored}
                   isBunco={rollResult.isBunco}
                   isTripleOnes={rollResult.isTripleOnes}
                   lastRollTimestamp={rollResult.timestamp}
                 />
                <div className="text-white space-y-1 mb-2">
                  <p>🔁 Round: {tableData.round}</p>
                  <p>🎯 Current Turn: {currentPlayer?.name ?? `Player #${tableData.currentTurn + 1}`}</p>
                </div>
                <TableControls
                  gameCode={gameCode}
                  tableData={tableData}
                  selfId={selfId}
                  players={players}
                  onRollingStateChange={setIsRolling}
                  onRollResult={setRollResult}
                  gameOver={gameOver}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              {playersBySeat.map((p, i) => {
                const isCurrentTurn = p?.id === currentTurnPlayerId;
                const isMyTurn = p?.id === selfId && isCurrentTurn;
                
                return p ? (
                  <div 
                    key={p.id} 
                    className={`border p-2 text-white rounded transition-all duration-300 ${
                      isCurrentTurn 
                        ? isMyTurn
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-400 current-turn-card'
                          : 'bg-gradient-to-br from-yellow-600 to-yellow-700 border-yellow-400 current-turn-card'
                        : 'bg-gray-800 border-gray-600'
                    } ${
                      isMyTurn ? 'ring-2 ring-blue-400 ring-opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold">
                        {p.name} {p.isBot ? '(Bot)' : ''} {p.id === selfId ? '← You' : ''}
                      </p>
                      {isCurrentTurn && (
                        <span className={`text-xs px-2 py-1 rounded-full font-bold turn-badge ${
                          isMyTurn 
                            ? 'bg-blue-500 text-blue-900' 
                            : 'bg-yellow-500 text-yellow-900'
                        }`}>
                          {isMyTurn ? '🎯 YOUR TURN' : '🎯 TURN'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">Team {p.seat % 2}</p>
                    <p>Points: {p.pointsThisRound ?? 0}</p>
                    <p>Buncos: {p.buncoCount ?? 0}</p>
                    <p>Wins: {p.roundsWon ?? 0}</p>
                    {/* Progress bar for round wins */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{p.roundsWon ?? 0}/{targetRounds}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (p.roundsWon ?? 0) >= targetRounds 
                              ? 'bg-green-500' 
                              : (p.roundsWon ?? 0) >= targetRounds * 0.7 
                                ? 'bg-yellow-500' 
                                : 'bg-blue-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, ((p.roundsWon ?? 0) / targetRounds) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="border border-gray-600 p-2 bg-gray-900 text-gray-500 rounded text-center">Empty Seat {i}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TableView;