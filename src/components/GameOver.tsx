import React from 'react';
import type { FirestorePlayer } from '../hooks/useFirestoreGame';

interface GameOverProps {
  players: FirestorePlayer[];
  winner: {
    id: string;
    name: string;
    roundsWon: number;
    totalPoints: number;
  };
  targetRounds: number;
  onPlayAgain: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ players, winner, targetRounds, onPlayAgain }) => {
  // Sort players by round wins (descending), then by buncos (descending), then by total points (descending)
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.roundsWon !== b.roundsWon) {
      return b.roundsWon - a.roundsWon;
    }
    if (a.buncoCount !== b.buncoCount) {
      return b.buncoCount - a.buncoCount;
    }
    return b.totalPoints - a.totalPoints;
  });

  // Find players with most buncos (top 3)
  const sortedByBuncos = [...players].sort((a, b) => (b.buncoCount || 0) - (a.buncoCount || 0));
  const top3Buncos = sortedByBuncos.slice(0, 3);

  // Find players with most total points (top 3)
  const sortedByPoints = [...players].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  const top3Points = sortedByPoints.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        {/* Winner Announcement */}
        <div className="text-center space-y-4">
          <div className="text-6xl">🏆</div>
          <h1 className="text-4xl font-bold text-yellow-400">
            Game Over!
          </h1>
          <div className="text-2xl text-green-400">
            <span className="font-bold">{winner.name}</span> wins with {winner.roundsWon} round{winner.roundsWon !== 1 ? 's' : ''}!
          </div>
          <p className="text-gray-300">
            Target: {targetRounds} round{targetRounds !== 1 ? 's' : ''} • Total Points: {winner.totalPoints || 0}
          </p>
          <p className="text-sm text-gray-400">
            Ties are broken by total points scored
          </p>
        </div>

        {/* Special Achievements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Buncos */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-pink-400 mb-3">🎯 Most Buncos</h3>
            {top3Buncos.map((player, index) => (
              <div key={player.id} className="flex justify-between items-center mb-2">
                <span className="text-white">
                  {index === 0 && "🥇 "}
                  {index === 1 && "🥈 "}
                  {index === 2 && "🥉 "}
                  {player.name} {player.isBot ? '(Bot)' : ''}
                </span>
                <span className="text-pink-400 font-bold">{player.buncoCount || 0}</span>
              </div>
            ))}
          </div>

          {/* Most Total Points */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-blue-400 mb-3">📊 Most Total Points</h3>
            {top3Points.map((player, index) => (
              <div key={player.id} className="flex justify-between items-center mb-2">
                <span className="text-white">
                  {index === 0 && "🥇 "}
                  {index === 1 && "🥈 "}
                  {index === 2 && "🥉 "}
                  {player.name} {player.isBot ? '(Bot)' : ''}
                </span>
                <span className="text-blue-400 font-bold">{player.totalPoints || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Final Leaderboard */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">📋 Final Standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Player</th>
                  <th className="text-center p-2">Round Wins</th>
                  <th className="text-center p-2">Buncos</th>
                  <th className="text-center p-2">Total Points</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, index) => (
                  <tr 
                    key={player.id} 
                    className={`border-b border-gray-700 hover:bg-gray-700 ${
                      player.id === winner.id ? 'bg-yellow-900 bg-opacity-30' : ''
                    }`}
                  >
                    <td className="p-2">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && `${index + 1}`}
                    </td>
                    <td className="p-2 font-medium">
                      {player.name} {player.isBot ? '(Bot)' : ''}
                      {player.id === winner.id && <span className="ml-2 text-yellow-400">👑</span>}
                    </td>
                    <td className="p-2 text-center">{player.roundsWon || 0}</td>
                    <td className="p-2 text-center">{player.buncoCount || 0}</td>
                    <td className={`p-2 text-center ${player.id === winner.id ? 'text-yellow-400 font-bold' : ''}`}>
                      {player.totalPoints || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Play Again Button */}
        <div className="text-center">
          <button
            onClick={onPlayAgain}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-bold transition-colors"
          >
            🎲 Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOver; 