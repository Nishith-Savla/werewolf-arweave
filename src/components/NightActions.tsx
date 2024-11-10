import { Player } from '../types/game';

interface NightActionsProps {
  currentPlayer: Player;
  players: Player[];
  nightActionsComplete: {
    werewolf: boolean;
    doctor: boolean;
    seer: boolean;
  };
}

export default function NightActions({ currentPlayer, players, nightActionsComplete }: NightActionsProps) {
  const handleAction = async (targetId: string, actionType: string) => {
    try {
      await fetch('/api/night-action', {
        method: 'POST',
        body: JSON.stringify({
          Target: targetId,
          ActionType: actionType
        })
      });
    } catch (error) {
      console.error('Failed to perform night action:', error);
    }
  };

  if (!currentPlayer.role || !currentPlayer.isAlive) {
    return <div>Wait for others to complete their actions...</div>;
  }

  const renderActionButtons = () => {
    switch (currentPlayer.role) {
      case 'werewolf':
        if (nightActionsComplete.werewolf) {
          return <div>You've completed your action</div>;
        }
        return (
          <div className="action-buttons">
            <h3>Choose a player to kill:</h3>
            {players.map(player => (
              <button 
                key={player.id}
                onClick={() => handleAction(player.id, 'kill')}
                disabled={player.id === currentPlayer.id}
              >
                Kill {player.name}
              </button>
            ))}
          </div>
        );

      case 'doctor':
        if (nightActionsComplete.doctor) {
          return <div>You've completed your action</div>;
        }
        return (
          <div className="action-buttons">
            <h3>Choose a player to protect:</h3>
            {players.map(player => (
              <button 
                key={player.id}
                onClick={() => handleAction(player.id, 'protect')}
              >
                Protect {player.name}
              </button>
            ))}
          </div>
        );

      case 'seer':
        if (nightActionsComplete.seer) {
          return <div>You've completed your action</div>;
        }
        return (
          <div className="action-buttons">
            <h3>Choose a player to reveal their role:</h3>
            {players.map(player => (
              <button 
                key={player.id}
                onClick={() => handleAction(player.id, 'see')}
                disabled={player.id === currentPlayer.id}
              >
                See {player.name}'s role
              </button>
            ))}
          </div>
        );

      default:
        return <div>Wait for others to complete their actions...</div>;
    }
  };

  return (
    <div className="night-actions">
      <h2>Night Phase</h2>
      {renderActionButtons()}
    </div>
  );
} 
