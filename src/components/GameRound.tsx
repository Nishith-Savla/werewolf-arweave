import { useEffect } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, messageResult } from "../lib/utils";

export const GameRound = () => {
  const { 
    mode,
    setMode,
    currentPlayer,
    gameState,
    setGamestate,
    joinedPlayers 
  } = useGameContext();

  const handleVote = async (votedPlayerId: string) => {
    const { Messages } = await messageResult(
      gameState.gameProcess,
      [
        {
          name: "Action",
          value: "Vote"
        }
      ],
      { votedId: votedPlayerId }
    );

    if (Messages[0].Data.includes("Vote recorded")) {
      // Handle successful vote
    }
  };

  const fetchGameState = async () => {
    const state = await dryrunResult(
      gameState.gameProcess,
      [
        {
          name: "Action",
          value: "Get-Game-State"
        }
      ]
    );

    if (state.phase !== gameState.currentPhase) {
      setGamestate({
        ...gameState,
        currentPhase: state.phase
      });
      setMode(state.phase === "night" ? "night" : "day");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetchGameState();
    }, 2000);

    return () => clearInterval(interval);
  }, [joinedPlayers]);

  return (
    <div className="game-round">
      {/* Render your game components here */}
    </div>
  );
}; 
