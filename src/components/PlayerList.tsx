import { Player } from '../types/game';

interface PlayerListProps {
  players: Player[];
  currentPlayer: Player;
  gamePhase?: string;
}

export default function PlayerList({ players, currentPlayer, gamePhase }: PlayerListProps) {
  return (
    <div className="players-list">
      <h3 className="text-xl mb-4">Players ({players.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player) => (
          <div 
            key={player.id} 
            className={`player-card p-4 rounded-lg border ${
              player.id === currentPlayer.id ? 'border-blue-500' : 'border-gray-200'
            } ${!player.isAlive ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{player.name}</span>
              <div className="flex gap-2">
                {player.isCreator && (
                  <span className="creator-badge">Creator</span>
                )}
                {!player.isAlive && (
                  <span className="dead-badge">Dead</span>
                )}
              </div>
            </div>
            {gamePhase !== 'lobby' && player.role && player.id === currentPlayer.id && (
              <div className="mt-2 text-sm text-gray-600">
                Role: {player.role}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 
