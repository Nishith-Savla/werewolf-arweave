import { useState } from "react";
import { Player } from "../types/game";

interface DayVotingProps {
  currentPlayer: Player;
  players: Player[];
}

export default function DayVoting({ currentPlayer, players }: DayVotingProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>();

  const handleVote = async (targetId: string) => {
    try {
      await fetch("/api/vote", {
        method: "POST",
        body: JSON.stringify({
          votedId: targetId,
        }),
      });
      setSelectedPlayer(targetId);
    } catch (error) {
      console.error("Failed to submit vote:", error);
    }
  };

  if (!currentPlayer.isAlive) {
    return <div>You are dead and cannot vote</div>;
  }

  return (
    <div className="day-voting">
      <h2>Day Phase - Vote to Eliminate</h2>
      <div className="voting-buttons">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => handleVote(player.id)}
            disabled={!currentPlayer.isAlive || selectedPlayer !== undefined}
            className={selectedPlayer === player.id ? "selected" : ""}
          >
            Vote for {player.name}
          </button>
        ))}
      </div>
    </div>
  );
}
