import React, { useEffect } from 'react';
import type { FirestorePlayer } from '../hooks/useFirestoreGame';

interface LeaderboardProps {
  players: FirestorePlayer[];
  isVisible: boolean;
  onClose: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, isVisible, onClose }) => {
  if (!isVisible) return null;

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">🏆 Leaderboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>
        
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
                <tr key={player.id} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="p-2">
                    {index === 0 && "🥇"}
                    {index === 1 && "🥈"}
                    {index === 2 && "🥉"}
                    {index > 2 && `${index + 1}`}
                  </td>
                  <td className="p-2 font-medium">
                    {player.name} {player.isBot ? '(Bot)' : ''}
                  </td>
                  <td className="p-2 text-center">{player.roundsWon || 0}</td>
                  <td className="p-2 text-center">{player.buncoCount || 0}</td>
                  <td className="p-2 text-center">{player.totalPoints || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard; 